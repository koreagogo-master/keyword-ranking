import {
  CAFE24_API_TIMEOUT_MS,
  CAFE24_MAX_RATE_LIMIT_RETRIES,
  CAFE24_MAX_RETRY_AFTER_MS,
  CAFE24_MIN_REQUEST_INTERVAL_MS,
  buildApiBaseUrl,
} from './config';
import { getUsableAccessToken, type UsableTokenFailureReason } from './accessToken';
import {
  extractCafe24ErrorCode,
  extractCafe24ErrorDetail,
  formatCafe24ErrorDetailForLog,
  isCafe24DebugEnabled,
  type Cafe24ErrorDetail,
} from './errorDetail';

/**
 * 카페24 Admin API 공통 호출기.
 *
 * - 호출 전에 유효한 access token을 확보합니다. (필요하면 갱신)
 * - Leaky Bucket 정책에 맞춰 요청 사이 최소 간격을 지킵니다.
 * - 401은 토큰을 강제 갱신한 뒤 한 번만 재시도합니다.
 * - access token은 Authorization 헤더로만 사용하고, 반환값·로그에 남기지 않습니다.
 *
 * GET과 POST를 함께 지원하지만 재시도 규칙이 다릅니다.
 *
 *   GET  : 429는 Retry-After만큼 기다린 뒤 다시 시도할 수 있습니다. (읽기라 부작용이 없습니다)
 *   POST : 게시글이 실제로 만들어졌는지 알 수 없는 상태에서 다시 보내면 중복 등록이 됩니다.
 *          그래서 카페24가 "처리 전에 명확히 거절"한 401만 토큰을 갱신해 한 번 재시도하고,
 *          네트워크 오류·타임아웃·본문 해석 실패·5xx는 결과를 알 수 없는 상태(unknown_result)로
 *          즉시 돌려주고, 429도 기다리지 않고 그대로 실패로 돌려줍니다.
 */

export type Cafe24AdminFailure =
  | { ok: false; kind: 'config_error'; retryable: false }
  | { ok: false; kind: 'not_connected'; retryable: false }
  | { ok: false; kind: 'reauth_required'; retryable: false }
  | { ok: false; kind: 'store_error'; retryable: false }
  | { ok: false; kind: 'token_error'; retryable: false }
  | { ok: false; kind: 'network'; retryable: true }
  | { ok: false; kind: 'rate_limited'; retryable: true; retryAfterSeconds: number | null }
  | { ok: false; kind: 'server_error'; retryable: true; status: number }
  /**
   * 카페24가 요청을 거절한 경우.
   * detail은 개발 환경에서만 채워지는 원본 오류 요약이고 운영에서는 항상 undefined입니다.
   */
  | {
      ok: false;
      kind: 'http';
      retryable: false;
      status: number;
      code: string | null;
      detail?: Cafe24ErrorDetail;
    }
  /**
   * 요청이 카페24에 반영됐는지 확인할 수 없는 상태.
   * 쓰기 요청에서만 나오고, 다시 보내면 중복 등록될 수 있으므로 절대 자동 재시도하지 않습니다.
   */
  | { ok: false; kind: 'unknown_result'; retryable: false; status: number | null };

export type Cafe24AdminResult<T> = { ok: true; data: T; status: number } | Cafe24AdminFailure;

export interface Cafe24AdminRequest {
  /** 예: '/api/v2/admin/products' */
  path: string;
  searchParams?: Record<string, string>;
  /** 기본값 'GET'. 기존 호출부는 그대로 GET으로 동작합니다. */
  method?: 'GET' | 'POST';
  /** POST 전용. JSON으로 직렬화해 보냅니다. 값은 로그에 남기지 않습니다. */
  body?: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 요청 사이 간격을 지키기 위한 직렬 게이트.
 * 동시에 여러 호출이 들어와도 최소 간격 이상 벌어지도록 순서를 세웁니다.
 */
let rateGate: Promise<void> = Promise.resolve();
let nextAllowedAt = 0;

function acquireRateSlot(): Promise<void> {
  const slot = rateGate.then(async () => {
    const delay = nextAllowedAt - Date.now();
    if (delay > 0) await sleep(delay);
    nextAllowedAt = Date.now() + CAFE24_MIN_REQUEST_INTERVAL_MS;
  });

  rateGate = slot.catch(() => undefined);
  return slot;
}

function mapTokenFailure(reason: UsableTokenFailureReason): Cafe24AdminFailure {
  switch (reason) {
    case 'config_error':
      return { ok: false, kind: 'config_error', retryable: false };
    case 'not_connected':
      return { ok: false, kind: 'not_connected', retryable: false };
    case 'store_error':
      return { ok: false, kind: 'store_error', retryable: false };
    case 'reauth_required':
      return { ok: false, kind: 'reauth_required', retryable: false };
    case 'network':
      return { ok: false, kind: 'network', retryable: true };
    case 'cafe24_unavailable':
      return { ok: false, kind: 'server_error', retryable: true, status: 503 };
    default:
      return { ok: false, kind: 'token_error', retryable: false };
  }
}

/** Retry-After와 카페24 레이트리밋 헤더에서 대기 시간을 계산합니다. */
function resolveRetryDelayMs(headers: Headers): number | null {
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter.trim());
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }

  // 카페24는 자원이 소진됐을 때만 Remain 헤더를 내려줍니다.
  for (const name of ['x-cafe24-call-remain', 'x-cafe24-time-remain']) {
    const raw = headers.get(name);
    if (!raw) continue;
    const seconds = Number(raw.trim());
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  }

  return null;
}

function retryAfterSecondsOf(headers: Headers): number | null {
  const ms = resolveRetryDelayMs(headers);
  return ms === null ? null : Math.ceil(ms / 1000);
}

/**
 * Admin API를 호출하고 JSON 본문을 돌려줍니다.
 *
 * method를 생략하면 GET입니다. POST는 위 주석의 재시도 규칙을 따릅니다.
 * 요청 본문은 어떤 경우에도 로그에 남기지 않고, 성공 응답 본문도 남기지 않습니다.
 * 거절 응답은 상태 코드와 짧은 오류 코드만 남기고, 개발 환경에서만 정리된 오류 요약(detail)을 함께 돌려줍니다.
 */
export async function callCafe24Admin<T>(request: Cafe24AdminRequest): Promise<Cafe24AdminResult<T>> {
  const method = request.method ?? 'GET';
  const isWrite = method === 'POST';

  let forceRefresh = false;
  let retriedAfterUnauthorized = false;
  let rateLimitRetries = 0;

  for (;;) {
    const token = await getUsableAccessToken(forceRefresh ? { forceRefresh: true } : {});
    if (!token.ok) return mapTokenFailure(token.reason);
    forceRefresh = false;

    const url = new URL(`${buildApiBaseUrl(token.mallId)}${request.path}`);
    for (const [key, value] of Object.entries(request.searchParams ?? {})) {
      url.searchParams.set(key, value);
    }

    await acquireRateSlot();

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: 'application/json',
          ...(isWrite ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(isWrite ? { body: JSON.stringify(request.body ?? {}) } : {}),
        cache: 'no-store',
        signal: AbortSignal.timeout(CAFE24_API_TIMEOUT_MS),
      });
    } catch {
      // 쓰기 요청은 서버에 닿았는지 알 수 없으므로 재시도 가능한 network로 내리지 않습니다.
      if (isWrite) {
        console.error('[cafe24/api] 쓰기 요청 결과 확인 불가 (network) path:', request.path);
        return { ok: false, kind: 'unknown_result', retryable: false, status: null };
      }

      console.error('[cafe24/api] 요청 실패 kind: network path:', request.path);
      return { ok: false, kind: 'network', retryable: true };
    }

    /**
     * 토큰이 서버에서 먼저 무효화된 경우. 강제 갱신 후 딱 한 번만 다시 시도합니다.
     * 401은 카페24가 요청을 처리하기 전에 거절한 것이므로 POST도 안전하게 다시 보낼 수 있습니다.
     */
    if (response.status === 401 && !retriedAfterUnauthorized) {
      retriedAfterUnauthorized = true;
      forceRefresh = true;
      continue;
    }

    if (response.status === 429) {
      const waitMs = resolveRetryDelayMs(response.headers);
      const canRetry =
        !isWrite &&
        rateLimitRetries < CAFE24_MAX_RATE_LIMIT_RETRIES &&
        waitMs !== null &&
        waitMs <= CAFE24_MAX_RETRY_AFTER_MS;

      if (canRetry) {
        rateLimitRetries += 1;
        await sleep(waitMs);
        continue;
      }

      console.error('[cafe24/api] 호출 제한 초과 path:', request.path);
      return {
        ok: false,
        kind: 'rate_limited',
        retryable: true,
        retryAfterSeconds: retryAfterSecondsOf(response.headers),
      };
    }

    let parsed: unknown = null;
    let parseFailed = false;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
      parseFailed = true;
    }

    if (response.status >= 500) {
      console.error('[cafe24/api] 카페24 서버 오류 status:', response.status, 'path:', request.path);

      // 5xx는 처리 도중에 끊긴 것일 수 있어 쓰기 요청에서는 성공 여부를 단정할 수 없습니다.
      if (isWrite) {
        return { ok: false, kind: 'unknown_result', retryable: false, status: response.status };
      }
      return { ok: false, kind: 'server_error', retryable: true, status: response.status };
    }

    if (!response.ok) {
      const code = extractCafe24ErrorCode(parsed);
      console.error('[cafe24/api] 요청 거절 status:', response.status, 'code:', code ?? '-');

      if (!isCafe24DebugEnabled()) {
        return { ok: false, kind: 'http', retryable: false, status: response.status, code };
      }

      const detail = extractCafe24ErrorDetail(parsed, response.status, code);

      /**
       * 읽기 요청에는 우리 데이터가 실리지 않으므로 여기서 바로 남깁니다.
       * 쓰기 요청은 보낸 리뷰 값이 오류 문장에 섞여 있을 수 있어,
       * 그 값을 정확히 지울 수 있는 호출부(등록 라우트)가 남깁니다.
       */
      if (!isWrite) {
        console.error(
          '[cafe24/api] 요청 거절 상세 (개발 전용) path:',
          request.path,
          formatCafe24ErrorDetailForLog(detail)
        );
      }

      return { ok: false, kind: 'http', retryable: false, status: response.status, code, detail };
    }

    // 성공 상태인데 본문을 읽지 못한 쓰기 요청은 무엇이 만들어졌는지 확인할 수 없습니다.
    if (isWrite && parseFailed) {
      console.error('[cafe24/api] 쓰기 응답 본문 해석 실패 status:', response.status);
      return { ok: false, kind: 'unknown_result', retryable: false, status: response.status };
    }

    return { ok: true, data: (parsed ?? {}) as T, status: response.status };
  }
}
