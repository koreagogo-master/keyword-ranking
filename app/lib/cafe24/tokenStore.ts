import crypto from 'crypto';
import {
  ACCESS_TOKEN_TTL_MS,
  CAFE24_KEY_VERSION,
  REFRESH_TOKEN_TTL_MS,
} from './config';
import { createCafe24SupabaseAdmin } from './supabaseAdmin';

/**
 * 카페24 토큰 암호화 저장소.
 *
 * - AES-256-GCM, 토큰마다 별도 IV(12바이트)·별도 auth tag
 * - 평문 토큰은 DB에 저장하지 않고, 로그·응답에도 남기지 않습니다.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TABLE = 'cafe24_oauth_tokens';

export interface EncryptedValue {
  ct: string;
  iv: string;
  tag: string;
}

/** AAD는 다른 몰/샵/용도의 암호문을 서로 바꿔치기할 수 없도록 묶어 줍니다. */
export function buildAad(mallId: string, shopNo: number, purpose: 'access' | 'refresh'): string {
  return `${mallId}:${shopNo}:${purpose}`;
}

export function encryptToken(plaintext: string, key: Buffer, aad: string): EncryptedValue {
  // 암호화할 때마다 새 IV를 만듭니다. (IV 재사용 금지)
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));

  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return {
    ct: ct.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

/** 복호화 실패(키 불일치·변조 등)는 예외 대신 null로 돌려줍니다. */
export function decryptToken(value: EncryptedValue, key: Buffer, aad: string): string | null {
  try {
    const iv = Buffer.from(value.iv, 'base64');
    if (iv.length !== IV_BYTES) return null;

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'));

    const plain = Buffer.concat([
      decipher.update(Buffer.from(value.ct, 'base64')),
      decipher.final(),
    ]);

    return plain.toString('utf8');
  } catch {
    return null;
  }
}

export interface Cafe24TokenRow {
  id: string;
  mall_id: string;
  shop_no: number;
  scopes: string[] | null;
  key_version: number;
  access_token_ct: string;
  access_token_iv: string;
  access_token_tag: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string;
}

/** 화면에 보여 줘도 되는 컬럼만 모은 목록 (암호문·IV·tag 제외) */
export type Cafe24ConnectionStatusRow = Pick<
  Cafe24TokenRow,
  'mall_id' | 'shop_no' | 'scopes' | 'access_token_expires_at' | 'refresh_token_expires_at'
>;

const STATUS_COLUMNS = 'mall_id, shop_no, scopes, access_token_expires_at, refresh_token_expires_at';
const FULL_COLUMNS = `id, ${STATUS_COLUMNS}, key_version, access_token_ct, access_token_iv, access_token_tag`;

export type StoreResult<T> = { ok: true; data: T } | { ok: false; reason: 'no_admin_client' | 'db_error' };

/** 연결 상태 표시에 필요한 정보만 조회합니다. (암호문·IV·tag 제외) */
export async function getConnectionStatus(
  mallId: string
): Promise<StoreResult<Cafe24ConnectionStatusRow | null>> {
  const supabase = createCafe24SupabaseAdmin();
  if (!supabase) return { ok: false, reason: 'no_admin_client' };

  const { data, error } = await supabase
    .from(TABLE)
    .select(STATUS_COLUMNS)
    .eq('mall_id', mallId)
    .order('shop_no', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, reason: 'db_error' };

  return { ok: true, data: (data as unknown as Cafe24ConnectionStatusRow | null) ?? null };
}

/** 연결 해제를 위해 암호문까지 포함한 행을 조회합니다. */
export async function getTokenRow(mallId: string): Promise<StoreResult<Cafe24TokenRow | null>> {
  const supabase = createCafe24SupabaseAdmin();
  if (!supabase) return { ok: false, reason: 'no_admin_client' };

  const { data, error } = await supabase
    .from(TABLE)
    .select(FULL_COLUMNS)
    .eq('mall_id', mallId)
    .order('shop_no', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, reason: 'db_error' };

  return { ok: true, data: (data as unknown as Cafe24TokenRow | null) ?? null };
}

export interface SaveTokensInput {
  mallId: string;
  shopNo: number;
  connectedBy: string;
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  encryptionKey: Buffer;
  /** 토큰 응답을 받은 시각 */
  issuedAt: Date;
}

/**
 * (mall_id, shop_no) 고유키 기준 단일 upsert로 교체합니다.
 * 삭제 후 삽입하지 않으므로 중간에 연결이 비는 구간이 없습니다.
 */
export async function saveTokens(input: SaveTokensInput): Promise<StoreResult<null>> {
  const supabase = createCafe24SupabaseAdmin();
  if (!supabase) return { ok: false, reason: 'no_admin_client' };

  const { mallId, shopNo, encryptionKey, issuedAt } = input;

  const access = encryptToken(input.accessToken, encryptionKey, buildAad(mallId, shopNo, 'access'));
  const refresh = encryptToken(input.refreshToken, encryptionKey, buildAad(mallId, shopNo, 'refresh'));

  const now = new Date().toISOString();

  // 재연결 시 최초 연결 시각을 잃지 않도록 기존 created_at을 그대로 넘겨줍니다.
  const { data: existing } = await supabase
    .from(TABLE)
    .select('created_at')
    .eq('mall_id', mallId)
    .eq('shop_no', shopNo)
    .maybeSingle();

  const createdAt = (existing as { created_at?: string } | null)?.created_at ?? now;

  const { error } = await supabase.from(TABLE).upsert(
    {
      mall_id: mallId,
      shop_no: shopNo,
      connected_by: input.connectedBy,
      access_token_ct: access.ct,
      access_token_iv: access.iv,
      access_token_tag: access.tag,
      refresh_token_ct: refresh.ct,
      refresh_token_iv: refresh.iv,
      refresh_token_tag: refresh.tag,
      key_version: CAFE24_KEY_VERSION,
      scopes: input.scopes,
      access_token_expires_at: new Date(issuedAt.getTime() + ACCESS_TOKEN_TTL_MS).toISOString(),
      refresh_token_expires_at: new Date(issuedAt.getTime() + REFRESH_TOKEN_TTL_MS).toISOString(),
      created_at: createdAt,
      updated_at: now,
    },
    { onConflict: 'mall_id,shop_no' }
  );

  if (error) return { ok: false, reason: 'db_error' };

  return { ok: true, data: null };
}

export async function deleteTokenRow(mallId: string, shopNo: number): Promise<StoreResult<null>> {
  const supabase = createCafe24SupabaseAdmin();
  if (!supabase) return { ok: false, reason: 'no_admin_client' };

  const { error } = await supabase.from(TABLE).delete().eq('mall_id', mallId).eq('shop_no', shopNo);

  if (error) return { ok: false, reason: 'db_error' };

  return { ok: true, data: null };
}
