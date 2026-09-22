import { randomUUID } from 'node:crypto';
import { createCafe24SupabaseAdmin } from '../cafe24/supabaseAdmin';
import type { FeedExclusionCount } from './buildFeed';

/**
 * Google 상품평 피드 스냅샷 저장소 (서버 전용).
 *
 * google_review_feed_snapshots는 RLS가 켜져 있고 정책이 하나도 없어서
 * service role 키로만 접근할 수 있습니다. 기존 cafe24_oauth_tokens와 같은 방식이고,
 * Supabase 클라이언트도 같은 헬퍼(createCafe24SupabaseAdmin)를 그대로 씁니다.
 *
 * 핵심 규칙: 갱신은 UPDATE가 아니라 INSERT입니다.
 * 성공한 실행만 status='ready'로 들어가고 피드는 그중 최신 행을 읽습니다.
 * 따라서 갱신이 실패하면 아무 일도 일어나지 않고 직전 스냅샷이 그대로 남습니다.
 *
 * 조회는 메타와 XML 두 단계로 나눕니다.
 * 886KB짜리 xml 컬럼을 매 요청마다 끌어오지 않기 위한 것입니다.
 */

const TABLE = 'google_review_feed_snapshots';
const LOCK_TABLE = 'google_review_feed_locks';
const LOCK_ID = 'snapshot';

/** 남겨 두는 정상 스냅샷 수. 이 개수를 넘는 오래된 ready 행만 정리합니다. */
export const SNAPSHOT_KEEP_READY_COUNT = 5;

/** 한 번의 정리에서 지우는 최대 행 수 (폭주 방지) */
const PRUNE_BATCH_LIMIT = 200;

/** tokenStore.ts와 같은 형태입니다. 예외 대신 판별 유니온으로 실패를 돌려줍니다. */
export type SnapshotStoreResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'no_admin_client' | 'db_error' };

export type SnapshotSource = 'scheduled' | 'after_upload' | 'manual';

/** 제공 가능한 스냅샷의 메타데이터. xml 본문은 들어 있지 않습니다. */
export interface ReadySnapshotMeta {
  id: string;
  mallId: string;
  boardNo: number;
  byteSize: number;
  sha256: string;
  reviewCount: number;
  excludedCount: number;
  verifiedPurchaseCount: number;
  scannedArticleCount: number;
  candidateCount: number;
  exclusions: FeedExclusionCount[];
  source: SnapshotSource;
  generatedAt: string;
}

/** 관리자 화면에 보여 주는 실행 이력 한 건 (성공·실패 공통) */
export interface SnapshotRunRecord {
  id: string;
  status: 'ready' | 'failed';
  source: SnapshotSource;
  reviewCount: number | null;
  excludedCount: number | null;
  byteSize: number | null;
  errorKind: string | null;
  generatedAt: string;
}

/**
 * 메타 조회용 컬럼 목록.
 * xml을 빼는 것이 이 모듈의 존재 이유이므로 여기에 xml을 추가하면 안 됩니다.
 */
const META_COLUMNS = [
  'id',
  'mall_id',
  'board_no',
  'byte_size',
  'sha256',
  'review_count',
  'excluded_count',
  'verified_purchase_count',
  'scanned_article_count',
  'candidate_count',
  'exclusions',
  'source',
  'generated_at',
].join(', ');

const RUN_COLUMNS = [
  'id',
  'status',
  'source',
  'review_count',
  'excluded_count',
  'byte_size',
  'error_kind',
  'generated_at',
].join(', ');

interface MetaRow {
  id: string;
  mall_id: string;
  board_no: number;
  byte_size: number;
  sha256: string;
  review_count: number;
  excluded_count: number | null;
  verified_purchase_count: number | null;
  scanned_article_count: number | null;
  candidate_count: number | null;
  exclusions: unknown;
  source: string;
  generated_at: string;
}

function toSource(raw: unknown): SnapshotSource {
  return raw === 'scheduled' || raw === 'after_upload' || raw === 'manual' ? raw : 'manual';
}

/** jsonb는 무엇이든 들어올 수 있으므로 형태를 확인한 항목만 남깁니다. */
function toExclusions(raw: unknown): FeedExclusionCount[] {
  if (!Array.isArray(raw)) return [];

  const parsed: FeedExclusionCount[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;

    const record = item as Record<string, unknown>;
    if (typeof record.reason !== 'string') continue;
    if (typeof record.label !== 'string') continue;
    if (typeof record.count !== 'number' || !Number.isFinite(record.count)) continue;

    parsed.push({
      reason: record.reason as FeedExclusionCount['reason'],
      label: record.label,
      count: record.count,
    });
  }

  return parsed;
}

function toMeta(row: MetaRow): ReadySnapshotMeta {
  return {
    id: row.id,
    mallId: row.mall_id,
    boardNo: row.board_no,
    byteSize: row.byte_size,
    sha256: row.sha256,
    reviewCount: row.review_count,
    excludedCount: row.excluded_count ?? 0,
    verifiedPurchaseCount: row.verified_purchase_count ?? 0,
    scannedArticleCount: row.scanned_article_count ?? 0,
    candidateCount: row.candidate_count ?? 0,
    exclusions: toExclusions(row.exclusions),
    source: toSource(row.source),
    generatedAt: row.generated_at,
  };
}

/**
 * 제공 가능한 최신 스냅샷의 메타데이터를 읽습니다. (xml 컬럼 제외)
 *
 * 피드 라우트가 매 요청마다 부르는 조회입니다.
 * 스냅샷이 하나도 없으면 ok: true, data: null입니다. (오류가 아닙니다)
 */
export async function readLatestReadyMeta(): Promise<SnapshotStoreResult<ReadySnapshotMeta | null>> {
  const supabase = createCafe24SupabaseAdmin();
  if (!supabase) return { ok: false, reason: 'no_admin_client' };

  const { data, error } = await supabase
    .from(TABLE)
    .select(META_COLUMNS)
    .eq('status', 'ready')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, reason: 'db_error' };

  const row = data as unknown as MetaRow | null;

  return { ok: true, data: row ? toMeta(row) : null };
}

/**
 * 스냅샷 한 건의 XML 본문만 읽습니다.
 *
 * 메모리 캐시가 비었거나 해시가 달라졌을 때만 호출합니다.
 * 정리 작업이 항상 최신 5개를 남기므로, 메타를 읽은 직후 그 행이 사라지는 경합은 없습니다.
 */
export async function readSnapshotXml(id: string): Promise<SnapshotStoreResult<string | null>> {
  const supabase = createCafe24SupabaseAdmin();
  if (!supabase) return { ok: false, reason: 'no_admin_client' };

  const { data, error } = await supabase
    .from(TABLE)
    .select('xml')
    .eq('id', id)
    .maybeSingle();

  if (error) return { ok: false, reason: 'db_error' };

  const row = data as { xml?: unknown } | null;

  return { ok: true, data: typeof row?.xml === 'string' ? row.xml : null };
}

/** 관리자 화면용 최근 실행 이력. xml 컬럼을 읽지 않습니다. */
export async function readRecentRuns(limit: number): Promise<SnapshotStoreResult<SnapshotRunRecord[]>> {
  const supabase = createCafe24SupabaseAdmin();
  if (!supabase) return { ok: false, reason: 'no_admin_client' };

  const { data, error } = await supabase
    .from(TABLE)
    .select(RUN_COLUMNS)
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (error) return { ok: false, reason: 'db_error' };

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;

  return {
    ok: true,
    data: rows.map((row) => ({
      id: String(row.id),
      status: row.status === 'ready' ? 'ready' : 'failed',
      source: toSource(row.source),
      reviewCount: typeof row.review_count === 'number' ? row.review_count : null,
      excludedCount: typeof row.excluded_count === 'number' ? row.excluded_count : null,
      byteSize: typeof row.byte_size === 'number' ? row.byte_size : null,
      errorKind: typeof row.error_kind === 'string' ? row.error_kind : null,
      generatedAt: String(row.generated_at),
    })),
  };
}

export interface InsertReadySnapshotInput {
  mallId: string;
  boardNo: number;
  xml: string;
  byteSize: number;
  sha256: string;
  reviewCount: number;
  excludedCount: number;
  verifiedPurchaseCount: number;
  scannedArticleCount: number;
  candidateCount: number;
  exclusions: readonly FeedExclusionCount[];
  source: SnapshotSource;
  createdBy: string | null;
}

/**
 * 정상 스냅샷을 새 행으로 추가합니다. **이 INSERT가 곧 교체입니다.**
 *
 * 기존 행을 지우거나 고치지 않으므로, 이 호출이 실패하면 직전 스냅샷이 그대로 남습니다.
 * INSERT는 원자적이라 중간에 프로세스가 죽어도 반쯤 쓰인 스냅샷이 남지 않습니다.
 */
export async function insertReadySnapshot(
  input: InsertReadySnapshotInput
): Promise<SnapshotStoreResult<ReadySnapshotMeta>> {
  const supabase = createCafe24SupabaseAdmin();
  if (!supabase) return { ok: false, reason: 'no_admin_client' };

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      status: 'ready',
      mall_id: input.mallId,
      board_no: input.boardNo,
      xml: input.xml,
      byte_size: input.byteSize,
      sha256: input.sha256,
      review_count: input.reviewCount,
      excluded_count: input.excludedCount,
      verified_purchase_count: input.verifiedPurchaseCount,
      scanned_article_count: input.scannedArticleCount,
      candidate_count: input.candidateCount,
      exclusions: input.exclusions,
      source: input.source,
      created_by: input.createdBy,
      generated_at: new Date().toISOString(),
    })
    .select(META_COLUMNS)
    .single();

  if (error || !data) return { ok: false, reason: 'db_error' };

  return { ok: true, data: toMeta(data as unknown as MetaRow) };
}

export interface InsertFailedRunInput {
  mallId: string;
  boardNo: number | null;
  source: SnapshotSource;
  /** 짧은 고정 코드만 넣습니다. 카페24 응답 원문·리뷰 내용은 넣지 않습니다. */
  errorKind: string;
  scannedArticleCount: number | null;
  createdBy: string | null;
}

/**
 * 실패한 실행을 기록만 남깁니다. xml은 넣지 않으므로 피드 조회 대상이 되지 않습니다.
 *
 * 이 기록이 없으면 갱신 실패가 아무 흔적 없이 지나가고,
 * 스냅샷이 조용히 늙는 것을 아무도 알아채지 못합니다.
 */
export async function insertFailedRun(
  input: InsertFailedRunInput
): Promise<SnapshotStoreResult<null>> {
  const supabase = createCafe24SupabaseAdmin();
  if (!supabase) return { ok: false, reason: 'no_admin_client' };

  const { error } = await supabase.from(TABLE).insert({
    status: 'failed',
    mall_id: input.mallId,
    // board_no는 NOT NULL이라, 게시판 번호를 알기 전에 실패했으면 0으로 남깁니다.
    board_no: input.boardNo ?? 0,
    source: input.source,
    error_kind: input.errorKind,
    scanned_article_count: input.scannedArticleCount,
    created_by: input.createdBy,
    generated_at: new Date().toISOString(),
  });

  if (error) return { ok: false, reason: 'db_error' };

  return { ok: true, data: null };
}

export interface PruneResult {
  deletedReady: number;
  deletedFailed: number;
}

/**
 * 오래된 기록을 정리합니다.
 *
 *  - ready : 최신 SNAPSHOT_KEEP_READY_COUNT개를 **반드시 남기고** 그 이후 것만 지웁니다.
 *            가장 최신 정상 스냅샷은 어떤 경우에도 삭제 대상에 들어가지 않습니다.
 *  - failed: 보존 기간이 지난 것만 지웁니다. (무기한 누적 방지)
 *
 * 정리 실패는 갱신 결과에 영향을 주지 않습니다. 호출부가 실패를 삼킵니다.
 */
export async function pruneSnapshots(
  failedRetentionDays: number
): Promise<SnapshotStoreResult<PruneResult>> {
  const supabase = createCafe24SupabaseAdmin();
  if (!supabase) return { ok: false, reason: 'no_admin_client' };

  // 1) 보관 개수를 넘는 오래된 정상 스냅샷
  const { data: staleReady, error: readyError } = await supabase
    .from(TABLE)
    .select('id')
    .eq('status', 'ready')
    .order('generated_at', { ascending: false })
    .range(SNAPSHOT_KEEP_READY_COUNT, SNAPSHOT_KEEP_READY_COUNT + PRUNE_BATCH_LIMIT - 1);

  if (readyError) return { ok: false, reason: 'db_error' };

  const staleIds = (staleReady ?? []).map((row) => String((row as { id: unknown }).id));

  if (staleIds.length > 0) {
    const { error } = await supabase.from(TABLE).delete().in('id', staleIds);
    if (error) return { ok: false, reason: 'db_error' };
  }

  // 2) 보존 기간이 지난 실패 기록
  const cutoff = new Date(Date.now() - failedRetentionDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleFailed, error: failedError } = await supabase
    .from(TABLE)
    .delete()
    .eq('status', 'failed')
    .lt('generated_at', cutoff)
    .select('id');

  if (failedError) return { ok: false, reason: 'db_error' };

  return {
    ok: true,
    data: { deletedReady: staleIds.length, deletedFailed: (staleFailed ?? []).length },
  };
}

// ──────────────────────────────────────────────────────────────
// 갱신 잠금
// ──────────────────────────────────────────────────────────────

/** 잠금 유효 기간. 갱신은 20초 내외라 넉넉하고, 프로세스가 죽어도 이만큼 뒤 자동 해제됩니다. */
export const SNAPSHOT_LOCK_TTL_MS = 10 * 60 * 1000;

export type AcquireLockResult =
  | { ok: true; acquired: true; owner: string }
  | { ok: true; acquired: false }
  | { ok: false; reason: 'no_admin_client' | 'db_error' };

/**
 * 갱신 잠금을 획득합니다.
 *
 * 비어 있거나(locked_until IS NULL) 기간이 지난 잠금만 가져갈 수 있는 조건부 UPDATE입니다.
 * 반영된 행이 0개면 다른 실행이 진행 중이라는 뜻입니다.
 *
 * 획득할 때 이번 실행만의 lock_owner를 기록합니다.
 * 해제할 때 이 값을 함께 비교하므로, TTL이 지나 다른 실행이 잠금을 가져간 뒤에
 * 뒤늦게 끝난 이전 실행이 남의 잠금을 풀어 버리는 일이 없습니다.
 */
export async function acquireSnapshotLock(ttlMs: number): Promise<AcquireLockResult> {
  const supabase = createCafe24SupabaseAdmin();
  if (!supabase) return { ok: false, reason: 'no_admin_client' };

  const owner = randomUUID();
  const now = new Date();
  const nowIso = now.toISOString();
  const lockedUntil = new Date(now.getTime() + ttlMs).toISOString();

  const { data, error } = await supabase
    .from(LOCK_TABLE)
    .update({ locked_until: lockedUntil, lock_owner: owner, updated_at: nowIso })
    .eq('id', LOCK_ID)
    // 값에 쉼표·괄호가 없는 ISO 8601이지만, 필터 파싱을 확실히 하려고 따옴표로 감쌉니다.
    .or(`locked_until.is.null,locked_until.lt."${nowIso}"`)
    .select('id');

  if (error) return { ok: false, reason: 'db_error' };

  if ((data?.length ?? 0) === 0) return { ok: true, acquired: false };

  return { ok: true, acquired: true, owner };
}

/**
 * 잠금을 해제합니다. **같은 lock_owner일 때만** 해제됩니다.
 *
 * 반환값을 호출부가 쓰지 않아도 되도록 실패해도 예외를 던지지 않습니다.
 * 해제하지 못해도 TTL이 지나면 자동으로 풀립니다.
 */
export async function releaseSnapshotLock(owner: string): Promise<void> {
  const supabase = createCafe24SupabaseAdmin();
  if (!supabase) return;

  await supabase
    .from(LOCK_TABLE)
    .update({ locked_until: null, lock_owner: null, updated_at: new Date().toISOString() })
    .eq('id', LOCK_ID)
    .eq('lock_owner', owner);
}
