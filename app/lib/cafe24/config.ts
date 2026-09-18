/**
 * 카페24 리뷰 이전 OAuth 설정 로더.
 *
 * - 환경변수는 반드시 요청 처리 중에 읽습니다. (모듈 최상단에서 throw 하지 않습니다)
 * - 값 자체는 어떤 경우에도 로그·응답에 남기지 않고, 짧은 실패 코드만 돌려줍니다.
 */

/** 인증 URL·토큰 URL 호스트를 만들기 전에 통과해야 하는 mall_id 형식 */
const MALL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}$/;

/** 요청 권한 목록. URL에는 공백으로 이어 붙여 넣습니다. (쉼표 금지) */
export const CAFE24_SCOPES = [
  'mall.read_application',
  'mall.write_application',
  'mall.read_community',
  'mall.write_community',
  'mall.read_product',
  'mall.read_store',
] as const;

export const CAFE24_SCOPE_STRING = CAFE24_SCOPES.join(' ');

/** state 저장용 쿠키 (리뷰 이전 기능 전용 이름) */
export const CAFE24_STATE_COOKIE = 'cafe24_review_oauth_state';

/**
 * authorize(/api/review-migration/cafe24/authorize)에서 심고
 * callback(/review-migration/oauth/callback)에서 읽고 지워야 하므로
 * 두 경로를 모두 포함하는 '/'를 사용합니다.
 */
export const CAFE24_STATE_COOKIE_PATH = '/';

/** state 쿠키 수명 (초) */
export const CAFE24_STATE_MAX_AGE_SECONDS = 600;

/** 카페24 규격: access token 2시간, refresh token 2주 */
export const ACCESS_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** 만료 직전 호출이 실패하지 않도록 이 시간만큼 남으면 미리 갱신합니다. */
export const ACCESS_TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** refresh token이 이만큼도 안 남았으면 갱신을 시도하지 않고 재연결을 안내합니다. */
export const REFRESH_TOKEN_MIN_REMAINING_MS = 60 * 1000;

/** 토큰 암호화 키 버전 (키 교체 시 증가) */
export const CAFE24_KEY_VERSION = 1;

/** Admin API 요청 타임아웃 */
export const CAFE24_API_TIMEOUT_MS = 15_000;

/**
 * 카페24 Leaky Bucket은 1초에 2회씩 비워집니다.
 * 초당 2회를 넘지 않도록 요청 사이 최소 간격을 둡니다.
 */
export const CAFE24_MIN_REQUEST_INTERVAL_MS = 500;

/** 429를 만났을 때 대기할 수 있는 최대 시간과 재시도 횟수 */
export const CAFE24_MAX_RETRY_AFTER_MS = 5_000;
export const CAFE24_MAX_RATE_LIMIT_RETRIES = 2;

/** 상품 목록 조회: limit 최대값은 공식 문서 기준 100입니다. */
export const CAFE24_PRODUCTS_PAGE_LIMIT = 100;

/** 무한 반복 방지용 최대 페이지 수 (100 * 300 = 30,000개) */
export const CAFE24_PRODUCTS_MAX_PAGES = 300;

/** 게시글 목록 조회: limit 최대값은 공식 문서 기준 100입니다. */
export const CAFE24_ARTICLES_PAGE_LIMIT = 100;

/**
 * 게시글은 offset 방식으로만 훑습니다.
 * 카페24 offset 상한과 같은 8,000건에서 멈추고 truncated로 알려 줍니다.
 */
export const CAFE24_ARTICLES_MAX_COUNT = 8_000;

/** 카페24 기본 상품후기 게시판 번호 */
export const CAFE24_DEFAULT_REVIEW_BOARD_NO = 4;

/**
 * 리뷰 게시판 번호는 CAFE24_REVIEW_BOARD_NO 환경변수를 씁니다.
 * 값이 없거나 형식이 잘못됐으면 기본 상품후기 게시판(4)을 사용합니다.
 * 이 값은 URL 경로에 들어가므로 정수만 통과시킵니다.
 */
export function resolveReviewBoardNo(): number {
  const raw = process.env.CAFE24_REVIEW_BOARD_NO?.trim() ?? '';
  if (!/^\d{1,5}$/.test(raw)) return CAFE24_DEFAULT_REVIEW_BOARD_NO;

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : CAFE24_DEFAULT_REVIEW_BOARD_NO;
}

export type Cafe24ConfigError =
  | 'config_missing'
  | 'invalid_mall_id'
  | 'invalid_redirect_uri'
  | 'invalid_encryption_key';

export interface Cafe24Config {
  mallId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: Buffer;
  /** https://{mall_id}.cafe24api.com */
  apiBaseUrl: string;
}

/**
 * 환경변수의 mall_id만 사용합니다. query·body로 들어온 값은 절대 쓰지 않습니다.
 * 형식 검사를 통과한 값만 호스트 생성에 사용합니다.
 */
export function resolveMallId(): string | null {
  const mallId = process.env.CAFE24_REVIEW_MALL_ID?.trim() ?? '';
  return MALL_ID_PATTERN.test(mallId) ? mallId : null;
}

export function buildApiBaseUrl(mallId: string): string {
  return `https://${mallId}.cafe24api.com`;
}

/**
 * Base64로 인코딩된 32바이트 키를 Buffer로 변환합니다.
 * 길이가 정확히 32바이트가 아니면 사용하지 않습니다. 값은 로그에 남기지 않습니다.
 */
export function resolveEncryptionKey(): Buffer | null {
  const raw = process.env.CAFE24_REVIEW_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return null;

  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    return null;
  }

  return key.length === 32 ? key : null;
}

/** 고정된 환경변수 redirect URI만 사용합니다. */
function resolveRedirectUri(): string | null {
  const raw = process.env.CAFE24_REVIEW_REDIRECT_URI?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function loadCafe24Config(): { ok: true; config: Cafe24Config } | { ok: false; reason: Cafe24ConfigError } {
  const clientId = process.env.CAFE24_REVIEW_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.CAFE24_REVIEW_CLIENT_SECRET?.trim() ?? '';

  if (!clientId || !clientSecret) {
    return { ok: false, reason: 'config_missing' };
  }

  const mallId = resolveMallId();
  if (!mallId) {
    return { ok: false, reason: 'invalid_mall_id' };
  }

  const redirectUri = resolveRedirectUri();
  if (!redirectUri) {
    return { ok: false, reason: 'invalid_redirect_uri' };
  }

  const encryptionKey = resolveEncryptionKey();
  if (!encryptionKey) {
    return { ok: false, reason: 'invalid_encryption_key' };
  }

  return {
    ok: true,
    config: {
      mallId,
      clientId,
      clientSecret,
      redirectUri,
      encryptionKey,
      apiBaseUrl: buildApiBaseUrl(mallId),
    },
  };
}

/** 응답의 shop_no가 문자열일 수 있으므로 안전하게 정수로 바꿉니다. 실패 시 null */
export function toShopNo(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}
