import {
  ACCESS_TOKEN_REFRESH_MARGIN_MS,
  CAFE24_KEY_VERSION,
  REFRESH_TOKEN_MIN_REMAINING_MS,
  loadCafe24Config,
  toShopNo,
  type Cafe24Config,
} from './config';
import { refreshAccessToken, type Cafe24OAuthFailure } from './oauth';
import {
  buildAad,
  decryptToken,
  getTokenRow,
  updateRefreshedTokens,
  type Cafe24TokenRow,
} from './tokenStore';

/**
 * 카페24 access token 확보기.
 *
 * - 만료 5분 전부터 선제적으로 갱신합니다.
 * - 같은 인스턴스 안에서는 single-flight로 중복 갱신을 막고,
 *   인스턴스가 여러 개일 때는 updated_at 기반 낙관적 동시성 제어로 막습니다.
 * - 토큰·비밀값은 반환값의 accessToken을 제외하고 어디에도(특히 로그에) 남기지 않습니다.
 */

export type UsableTokenFailureReason =
  /** 환경변수 설정이 올바르지 않음 */
  | 'config_error'
  /** 아직 카페24를 연결하지 않음 */
  | 'not_connected'
  /** DB 접근 실패 */
  | 'store_error'
  /** 자동 복구 불가 — 관리자가 다시 연결해야 함 */
  | 'reauth_required'
  /** 네트워크 오류 (재시도 가능) */
  | 'network'
  /** 카페24 서버 오류 (재시도 가능) */
  | 'cafe24_unavailable'
  /** 카페24가 거절한 그 밖의 응답 (재시도해도 같을 가능성이 높음) */
  | 'cafe24_error';

export type UsableTokenResult =
  | {
      ok: true;
      accessToken: string;
      mallId: string;
      shopNo: number;
      accessTokenExpiresAt: string;
    }
  | { ok: false; reason: UsableTokenFailureReason };

export interface GetUsableAccessTokenOptions {
  /** 401을 받은 뒤처럼, 남은 수명과 무관하게 무조건 갱신해야 할 때 사용합니다. */
  forceRefresh?: boolean;
}

/** mall_id별로 진행 중인 갱신 작업. 같은 인스턴스의 중복 갱신을 하나로 합칩니다. */
const inFlightRefresh = new Map<string, Promise<UsableTokenResult>>();

function runExclusive(
  key: string,
  task: () => Promise<UsableTokenResult>
): Promise<UsableTokenResult> {
  const existing = inFlightRefresh.get(key);
  if (existing) return existing;

  const started = (async () => task())().finally(() => {
    inFlightRefresh.delete(key);
  });

  inFlightRefresh.set(key, started);
  return started;
}

function remainingMs(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const parsed = Date.parse(isoDate);
  return Number.isNaN(parsed) ? null : parsed - Date.now();
}

/** 만료까지 여유(5분)가 남아 있는지 확인합니다. */
function isAccessTokenFresh(row: Cafe24TokenRow): boolean {
  const remaining = remainingMs(row.access_token_expires_at);
  return remaining !== null && remaining > ACCESS_TOKEN_REFRESH_MARGIN_MS;
}

/** 저장된 행이 지금 설정과 같은 연결인지 확인합니다. */
function validateRow(
  expectedMallId: string,
  row: Cafe24TokenRow
): { ok: true } | { ok: false; reason: UsableTokenFailureReason } {
  if (row.mall_id !== expectedMallId) {
    console.error('[cafe24/token] 저장된 연결의 mall_id가 현재 설정과 다릅니다.');
    return { ok: false, reason: 'reauth_required' };
  }

  if (!Number.isInteger(row.shop_no) || row.shop_no <= 0) {
    console.error('[cafe24/token] 저장된 연결의 shop_no가 올바르지 않습니다.');
    return { ok: false, reason: 'reauth_required' };
  }

  if (row.key_version !== CAFE24_KEY_VERSION) {
    console.error('[cafe24/token] 암호화 키 버전이 달라 토큰을 사용할 수 없습니다.');
    return { ok: false, reason: 'reauth_required' };
  }

  return { ok: true };
}

function decryptAccess(row: Cafe24TokenRow, key: Buffer): string | null {
  return decryptToken(
    { ct: row.access_token_ct, iv: row.access_token_iv, tag: row.access_token_tag },
    key,
    buildAad(row.mall_id, row.shop_no, 'access')
  );
}

function decryptRefresh(row: Cafe24TokenRow, key: Buffer): string | null {
  return decryptToken(
    { ct: row.refresh_token_ct, iv: row.refresh_token_iv, tag: row.refresh_token_tag },
    key,
    buildAad(row.mall_id, row.shop_no, 'refresh')
  );
}

function success(row: Cafe24TokenRow, accessToken: string): UsableTokenResult {
  return {
    ok: true,
    accessToken,
    mallId: row.mall_id,
    shopNo: row.shop_no,
    accessTokenExpiresAt: row.access_token_expires_at,
  };
}

/**
 * DB를 다시 읽어 바로 쓸 수 있는 access token이 있는지 확인합니다.
 * changedFrom을 주면 "그 값에서 실제로 바뀐 경우"에만 인정합니다.
 */
async function readUsableTokenFromDb(
  config: Cafe24Config,
  changedFrom?: { updatedAt: string | null }
): Promise<UsableTokenResult | null> {
  const found = await getTokenRow(config.mallId);
  if (!found.ok || !found.data) return null;

  const row = found.data;
  if (changedFrom && row.updated_at === changedFrom.updatedAt) return null;
  if (!validateRow(config.mallId, row).ok) return null;
  if (!isAccessTokenFresh(row)) return null;

  const accessToken = decryptAccess(row, config.encryptionKey);
  return accessToken ? success(row, accessToken) : null;
}

/** 갱신 요청이 실패했을 때의 분기 처리 */
async function handleRefreshFailure(
  config: Cafe24Config,
  row: Cafe24TokenRow,
  failure: Cafe24OAuthFailure
): Promise<UsableTokenResult> {
  if (failure.kind === 'network') {
    console.error('[cafe24/token] 갱신 실패 kind: network');
    return { ok: false, reason: 'network' };
  }

  if (failure.kind === 'invalid_response') {
    console.error('[cafe24/token] 갱신 실패 kind: invalid_response');
    return { ok: false, reason: 'cafe24_error' };
  }

  console.error('[cafe24/token] 갱신 실패 status:', failure.status, 'code:', failure.code ?? '-');

  if (failure.status >= 500) {
    return { ok: false, reason: 'cafe24_unavailable' };
  }

  // invalid_grant는 "이미 다른 요청이 이 refresh token을 써 버린" 경우일 수 있습니다.
  // 재연결을 안내하기 전에 DB가 그 사이에 갱신됐는지 먼저 확인합니다.
  const isInvalidGrant =
    failure.code === 'invalid_grant' || failure.status === 400 || failure.status === 401;

  if (isInvalidGrant) {
    const refreshedByOther = await readUsableTokenFromDb(config, { updatedAt: row.updated_at });
    if (refreshedByOther) {
      console.error('[cafe24/token] 다른 요청이 먼저 갱신한 토큰을 사용합니다.');
      return refreshedByOther;
    }
    return { ok: false, reason: 'reauth_required' };
  }

  return { ok: false, reason: 'cafe24_error' };
}

/**
 * 실제 갱신 작업. runExclusive 안에서만 호출됩니다.
 * staleRow는 갱신이 필요하다고 판단했을 때 읽은 행입니다.
 */
async function performRefresh(
  config: Cafe24Config,
  staleRow: Cafe24TokenRow
): Promise<UsableTokenResult> {
  // 순서를 기다리는 동안 다른 요청이 이미 갱신했을 수 있으므로 행을 다시 읽습니다.
  const found = await getTokenRow(config.mallId);
  if (!found.ok) return { ok: false, reason: 'store_error' };

  const row = found.data;
  if (!row) return { ok: false, reason: 'not_connected' };

  const validated = validateRow(config.mallId, row);
  if (!validated.ok) return validated;

  if (row.updated_at !== staleRow.updated_at && isAccessTokenFresh(row)) {
    const accessToken = decryptAccess(row, config.encryptionKey);
    if (accessToken) return success(row, accessToken);
  }

  const refreshRemaining = remainingMs(row.refresh_token_expires_at);
  if (refreshRemaining === null || refreshRemaining <= REFRESH_TOKEN_MIN_REMAINING_MS) {
    console.error('[cafe24/token] refresh token이 만료되어 재연결이 필요합니다.');
    return { ok: false, reason: 'reauth_required' };
  }

  const refreshToken = decryptRefresh(row, config.encryptionKey);
  if (!refreshToken) {
    console.error('[cafe24/token] refresh token 복호화 실패 — 재연결이 필요합니다.');
    return { ok: false, reason: 'reauth_required' };
  }

  const issuedAt = new Date();
  const refreshed = await refreshAccessToken(config, refreshToken);
  if (!refreshed.ok) {
    return handleRefreshFailure(config, row, refreshed);
  }

  const token = refreshed.token;

  // 응답이 저장된 연결과 같은 몰·샵인지 확인합니다.
  if (typeof token.rawMallId === 'string' && token.rawMallId.trim() !== row.mall_id) {
    console.error('[cafe24/token] 갱신 응답의 mall_id가 저장된 연결과 다릅니다.');
    return { ok: false, reason: 'reauth_required' };
  }

  const responseShopNo =
    token.rawShopNo === undefined || token.rawShopNo === null ? row.shop_no : toShopNo(token.rawShopNo);

  if (responseShopNo === null || responseShopNo !== row.shop_no) {
    console.error('[cafe24/token] 갱신 응답의 shop_no가 저장된 연결과 다릅니다.');
    return { ok: false, reason: 'reauth_required' };
  }

  const saved = await updateRefreshedTokens({
    rowId: row.id,
    mallId: row.mall_id,
    shopNo: row.shop_no,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    scopes: token.scopes.length > 0 ? token.scopes : row.scopes ?? [],
    encryptionKey: config.encryptionKey,
    issuedAt,
    expectedUpdatedAt: row.updated_at,
  });

  if (!saved.ok) {
    console.error('[cafe24/token] 갱신 토큰 저장 실패:', saved.reason);
    return { ok: false, reason: 'store_error' };
  }

  if (saved.data === 'stale') {
    // 다른 인스턴스가 먼저 저장했습니다. 저장된 최신 토큰을 우선 사용합니다.
    const current = await readUsableTokenFromDb(config);
    if (current) return current;
  }

  return success(row, token.accessToken);
}

/**
 * 바로 사용할 수 있는 access token을 돌려줍니다.
 * 남은 수명이 5분 미만이거나 forceRefresh가 켜져 있으면 갱신을 거칩니다.
 */
export async function getUsableAccessToken(
  options: GetUsableAccessTokenOptions = {}
): Promise<UsableTokenResult> {
  const loaded = loadCafe24Config();
  if (!loaded.ok) {
    console.error('[cafe24/token] 설정 오류:', loaded.reason);
    return { ok: false, reason: 'config_error' };
  }
  const config = loaded.config;

  const found = await getTokenRow(config.mallId);
  if (!found.ok) {
    console.error('[cafe24/token] 연결 정보 조회 실패:', found.reason);
    return { ok: false, reason: 'store_error' };
  }

  const row = found.data;
  if (!row) return { ok: false, reason: 'not_connected' };

  const validated = validateRow(config.mallId, row);
  if (!validated.ok) return validated;

  if (!options.forceRefresh && isAccessTokenFresh(row)) {
    const accessToken = decryptAccess(row, config.encryptionKey);
    if (accessToken) return success(row, accessToken);
    console.error('[cafe24/token] access token 복호화 실패 — 갱신을 시도합니다.');
  }

  return runExclusive(config.mallId, () => performRefresh(config, row));
}
