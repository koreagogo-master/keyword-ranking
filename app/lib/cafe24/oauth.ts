import { CAFE24_SCOPE_STRING, type Cafe24Config } from './config';

/**
 * 카페24 OAuth 2.0 호출 모음.
 *
 * 이 모듈은 어떤 경우에도 client_id / client_secret / code / token 값을
 * 로그나 반환값의 오류 메시지에 담지 않습니다.
 */

const REQUEST_TIMEOUT_MS = 15_000;

export interface Cafe24TokenResult {
  accessToken: string;
  refreshToken: string;
  /** 카페24가 내려준 scope 목록 (없으면 요청한 scope로 대체) */
  scopes: string[];
  /** 문자열로 올 수 있으므로 원본 그대로 넘기고 호출부에서 정수 변환합니다 */
  rawShopNo: unknown;
  /** 응답의 mall_id. 저장된 연결과 같은 몰인지 확인하는 용도입니다. */
  rawMallId: unknown;
}

export type Cafe24OAuthFailure =
  | { ok: false; kind: 'network' }
  | { ok: false; kind: 'http'; status: number; code: string | null }
  | { ok: false; kind: 'invalid_response' };

export type Cafe24TokenExchangeResult = { ok: true; token: Cafe24TokenResult } | Cafe24OAuthFailure;

/** 카페24 오류 본문에서 민감하지 않은 코드 문자열만 뽑아냅니다. */
function extractErrorCode(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;

  const record = body as Record<string, unknown>;
  const candidate =
    (typeof record.error === 'string' ? record.error : null) ??
    (typeof record.code === 'string' ? record.code : null) ??
    (typeof (record.error as Record<string, unknown> | undefined)?.code === 'string'
      ? ((record.error as Record<string, unknown>).code as string)
      : null);

  if (!candidate) return null;

  // 예기치 않게 긴 문자열/원문이 흘러들어오지 않도록 형태를 제한합니다.
  return /^[A-Za-z0-9_.-]{1,64}$/.test(candidate) ? candidate : null;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

/**
 * 인증 URL을 만듭니다.
 * scope는 공백으로 이어 붙인 뒤 URLSearchParams가 인코딩하도록 맡깁니다.
 */
export function buildAuthorizeUrl(config: Cafe24Config, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    state,
    redirect_uri: config.redirectUri,
    scope: CAFE24_SCOPE_STRING,
  });

  return `${config.apiBaseUrl}/api/v2/oauth/authorize?${params.toString()}`;
}

/**
 * /api/v2/oauth/token 공통 호출.
 * grant_type만 다르고 인증 방식·응답 형식은 동일합니다.
 */
async function requestToken(
  config: Cafe24Config,
  body: URLSearchParams
): Promise<Cafe24TokenExchangeResult> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}/api/v2/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(config.clientId, config.clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, kind: 'network' };
  }

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    return { ok: false, kind: 'http', status: response.status, code: extractErrorCode(parsed) };
  }

  const payload = (parsed ?? {}) as Record<string, unknown>;
  const accessToken = typeof payload.access_token === 'string' ? payload.access_token : '';
  const refreshToken = typeof payload.refresh_token === 'string' ? payload.refresh_token : '';

  if (!accessToken || !refreshToken) {
    return { ok: false, kind: 'invalid_response' };
  }

  const scopes = Array.isArray(payload.scopes)
    ? payload.scopes.filter((item): item is string => typeof item === 'string')
    : CAFE24_SCOPE_STRING.split(' ');

  return {
    ok: true,
    token: {
      accessToken,
      refreshToken,
      scopes,
      rawShopNo: payload.shop_no,
      rawMallId: payload.mall_id,
    },
  };
}

/** authorization code를 access/refresh token으로 교환합니다. */
export async function exchangeCodeForToken(
  config: Cafe24Config,
  code: string
): Promise<Cafe24TokenExchangeResult> {
  return requestToken(
    config,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    })
  );
}

/**
 * refresh token으로 access token을 재발급합니다.
 *
 * 카페24는 재발급 시 refresh token도 함께 교체하고 기존 refresh token을 폐기하므로,
 * 호출부는 반드시 새로 받은 두 토큰을 같이 저장해야 합니다.
 */
export async function refreshAccessToken(
  config: Cafe24Config,
  refreshToken: string
): Promise<Cafe24TokenExchangeResult> {
  return requestToken(
    config,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
  );
}

export type Cafe24RevokeResult =
  /** 카페24가 폐기를 확인했거나, 이미 폐기·만료된 토큰임을 명확히 알려준 경우 */
  | { ok: true; alreadyRevoked: boolean }
  /** 네트워크 문제 등 재시도 가능한 실패 */
  | { ok: false; retryable: true }
  /** 재시도해도 같은 결과가 예상되는 실패 */
  | { ok: false; retryable: false; status: number; code: string | null };

/** access token을 카페24에서 폐기합니다. */
export async function revokeAccessToken(
  config: Cafe24Config,
  accessToken: string
): Promise<Cafe24RevokeResult> {
  const body = new URLSearchParams({
    token: accessToken,
    token_hint: 'access_token',
  });

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}/api/v2/oauth/revoke`, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(config.clientId, config.clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, retryable: true };
  }

  if (response.ok) {
    return { ok: true, alreadyRevoked: false };
  }

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  const code = extractErrorCode(parsed);

  // 이미 폐기·만료되어 카페24가 '유효하지 않은 토큰'이라고 명확히 답한 경우에는
  // 로컬 행을 지워도 안전합니다.
  const alreadyRevoked =
    response.status === 400 || response.status === 401
      ? code === null || /invalid|expired|revoke/i.test(code)
      : false;

  if (alreadyRevoked) {
    return { ok: true, alreadyRevoked: true };
  }

  // 5xx는 카페24 일시 장애일 수 있으므로 재시도 가능으로 처리합니다.
  if (response.status >= 500) {
    return { ok: false, retryable: true };
  }

  return { ok: false, retryable: false, status: response.status, code };
}
