import { createHash } from 'node:crypto';
import { resolveMallId } from '../cafe24/config';
import { loadGoogleReviewFeed } from './feedSource';
import { resolveFailedRetentionDays, resolveMinRetainRatio } from './snapshotConfig';
import {
  SNAPSHOT_LOCK_TTL_MS,
  acquireSnapshotLock,
  insertFailedRun,
  insertReadySnapshot,
  pruneSnapshots,
  readLatestReadyMeta,
  releaseSnapshotLock,
  type ReadySnapshotMeta,
  type SnapshotSource,
} from './snapshotStore';
import { validateSnapshotXml, type SnapshotRejectReason } from './snapshotValidate';

/**
 * Google 상품평 피드 스냅샷 갱신기 (서버 전용).
 *
 * 세 진입점(예약·업로드 완료 후·관리자 수동)이 모두 이 함수 하나를 씁니다.
 * 진입점마다 검증 규칙이 갈라지면 어떤 경로로 만든 스냅샷이냐에 따라
 * 안전성이 달라지므로, 규칙은 여기 한 곳에만 둡니다.
 *
 * 가장 중요한 성질: **실패하면 아무것도 바꾸지 않습니다.**
 * 갱신은 UPDATE가 아니라 INSERT라서, 중간에 실패하면 새 행이 생기지 않고
 * 직전 정상 스냅샷이 그대로 남아 계속 제공됩니다.
 *
 * 로그에는 건수와 짧은 코드만 남깁니다. 리뷰 본문·작성자·인증정보는 남기지 않습니다.
 */

const LOG_LABEL = 'google-reviews/snapshot';

export type RefreshFailureKind =
  /** 다른 갱신이 진행 중 */
  | 'locked'
  /** 카페24 수집 단계에서 실패 */
  | 'collect'
  /** XML은 만들었지만 검증에서 거부 */
  | 'validate'
  /** 저장 단계에서 실패 */
  | 'store';

export type RefreshSnapshotResult =
  | { ok: true; snapshot: ReadySnapshotMeta }
  | { ok: false; kind: RefreshFailureKind; errorKind: string };

export interface RefreshSnapshotOptions {
  source: SnapshotSource;
  /**
   * true면 리뷰 수 급감 검사 하나만 건너뜁니다.
   * 관리자 수동 경로에서만 넘어옵니다. 예약 경로는 항상 false입니다.
   */
  force: boolean;
  /** 수동 갱신을 실행한 관리자. 예약 갱신은 null */
  createdBy: string | null;
}

/**
 * loadGoogleReviewFeed()의 실패를 짧은 고정 코드로 바꿉니다.
 * 카페24 응답 원문이나 오류 문장은 넣지 않습니다.
 */
function describeCollectFailure(
  loaded: Extract<Awaited<ReturnType<typeof loadGoogleReviewFeed>>, { ok: false }>
): string {
  if (loaded.kind === 'cafe24') return `cafe24:${loaded.failure.kind}`;
  return loaded.kind;
}

function rejectionCode(reason: SnapshotRejectReason): string {
  return `validate:${reason}`;
}

/**
 * 카페24 게시판을 전부 다시 읽어 새 스냅샷을 만듭니다.
 *
 *   잠금 → 수집 → 검증 → INSERT → 정리 → 잠금 해제
 *
 * 검증까지 통과한 경우에만 INSERT가 일어나고, 그 INSERT가 곧 교체입니다.
 */
export async function refreshGoogleReviewFeedSnapshot(
  options: RefreshSnapshotOptions
): Promise<RefreshSnapshotResult> {
  const mallId = resolveMallId();

  if (!mallId) {
    // 몰 식별값이 없으면 실패 기록조차 남길 수 없습니다. (mall_id가 NOT NULL)
    console.error(`[${LOG_LABEL}] 설정 오류: invalid_mall_id`);
    return { ok: false, kind: 'collect', errorKind: 'config_error' };
  }

  /**
   * 갱신 잠금.
   *
   * Cloud Run 인스턴스가 여러 개일 때 예약 갱신과 업로드 후 갱신이 겹치면
   * 카페24 초당 2회 제한을 넘겨 429를 맞습니다.
   * 잠금을 얻지 못하면 카페24를 아예 부르지 않고 물러납니다.
   */
  const lock = await acquireSnapshotLock(SNAPSHOT_LOCK_TTL_MS);

  if (!lock.ok) {
    console.error(`[${LOG_LABEL}] 잠금 조회 실패:`, lock.reason);
    return { ok: false, kind: 'store', errorKind: `lock:${lock.reason}` };
  }

  if (!lock.acquired) {
    console.log(`[${LOG_LABEL}] 다른 갱신이 진행 중이라 건너뜀 source:`, options.source);
    return { ok: false, kind: 'locked', errorKind: 'locked' };
  }

  try {
    return await runRefresh(mallId, options);
  } finally {
    /**
     * 정리는 갱신의 성공·실패와 무관하게 합니다.
     *
     * 성공 경로에만 두면 갱신이 계속 실패하는 동안(예: 카페24 연결이 끊긴 채 방치)
     * 실패 기록만 매일 쌓이고 정리는 한 번도 돌지 않습니다.
     * 잠금을 쥐고 있는 지금 하는 것이 다른 실행과 겹치지 않아 안전합니다.
     */
    await pruneSnapshotsBestEffort();

    // 같은 lock_owner일 때만 해제됩니다. 실패해도 TTL이 지나면 자동으로 풀립니다.
    await releaseSnapshotLock(lock.owner);
  }
}

/**
 * 오래된 기록을 정리합니다. 실패해도 갱신 결과를 바꾸지 않습니다.
 *
 * finally에서 부르므로 여기서 예외가 새어 나가면 원래 반환값을 덮어씁니다.
 * 그래서 어떤 오류도 밖으로 던지지 않습니다.
 *
 * 로그에는 저장소가 돌려준 짧은 코드와 건수만 남깁니다.
 * 인증정보·리뷰 내용·외부 오류 원문은 남기지 않습니다.
 */
async function pruneSnapshotsBestEffort(): Promise<void> {
  try {
    const pruned = await pruneSnapshots(resolveFailedRetentionDays());

    if (!pruned.ok) {
      console.error(`[${LOG_LABEL}] 오래된 기록 정리 실패:`, pruned.reason);
      return;
    }

    if (pruned.data.deletedReady > 0 || pruned.data.deletedFailed > 0) {
      console.log(
        `[${LOG_LABEL}] 정리 완료 ready:`,
        pruned.data.deletedReady,
        'failed:',
        pruned.data.deletedFailed
      );
    }
  } catch {
    // 오류 객체는 외부 원문을 담을 수 있으므로 남기지 않습니다.
    console.error(`[${LOG_LABEL}] 오래된 기록 정리 중 예외가 발생했습니다.`);
  }
}

async function runRefresh(
  mallId: string,
  options: RefreshSnapshotOptions
): Promise<RefreshSnapshotResult> {
  const { source, force, createdBy } = options;

  /**
   * 1. 수집 + XML 생성.
   *
   * 관리자 미리보기와 같은 함수를 씁니다.
   * 덕분에 미리보기와 스냅샷의 리뷰 판정 규칙이 자동으로 일치합니다.
   * 운영 피드로 나갈 XML이므로 진단 주석은 넣지 않습니다.
   */
  const loaded = await loadGoogleReviewFeed({ summaryComment: false, logLabel: LOG_LABEL });

  if (!loaded.ok) {
    const errorKind = describeCollectFailure(loaded);
    const scannedArticleCount = loaded.kind === 'incomplete_scan' ? loaded.scannedArticleCount : null;

    console.error(`[${LOG_LABEL}] 수집 실패 source:`, source, 'reason:', errorKind);

    await recordFailure({
      mallId,
      boardNo: null,
      source,
      errorKind,
      scannedArticleCount,
      createdBy,
    });

    return { ok: false, kind: 'collect', errorKind };
  }

  // 2. 직전 스냅샷의 리뷰 수. 급감 검사의 기준값입니다.
  const previous = await readLatestReadyMeta();

  if (!previous.ok) {
    console.error(`[${LOG_LABEL}] 직전 스냅샷 조회 실패:`, previous.reason);
    return { ok: false, kind: 'store', errorKind: `read:${previous.reason}` };
  }

  // 3. 검증. 하나라도 걸리면 저장하지 않으므로 직전 스냅샷이 그대로 남습니다.
  const validated = validateSnapshotXml({
    xml: loaded.feed.xml,
    includedCount: loaded.feed.includedCount,
    previousReviewCount: previous.data?.reviewCount ?? null,
    minRetainRatio: resolveMinRetainRatio(),
    force,
  });

  if (!validated.ok) {
    const errorKind = rejectionCode(validated.reason);

    console.error(
      `[${LOG_LABEL}] 검증 거부 source:`,
      source,
      'reason:',
      validated.reason,
      'included:',
      loaded.feed.includedCount,
      'previous:',
      previous.data?.reviewCount ?? '-'
    );

    await recordFailure({
      mallId,
      boardNo: loaded.boardNo,
      source,
      errorKind,
      scannedArticleCount: loaded.scannedArticleCount,
      createdBy,
    });

    return { ok: false, kind: 'validate', errorKind };
  }

  // 4. 저장. 이 INSERT가 곧 교체입니다.
  const sha256 = createHash('sha256').update(loaded.feed.xml, 'utf8').digest('hex');

  const inserted = await insertReadySnapshot({
    mallId,
    boardNo: loaded.boardNo,
    xml: loaded.feed.xml,
    byteSize: validated.byteSize,
    sha256,
    reviewCount: loaded.feed.includedCount,
    excludedCount: loaded.feed.excludedCount,
    verifiedPurchaseCount: loaded.feed.verifiedPurchaseCount,
    scannedArticleCount: loaded.scannedArticleCount,
    candidateCount: loaded.candidateCount,
    exclusions: loaded.feed.exclusions,
    source,
    createdBy,
  });

  if (!inserted.ok) {
    console.error(`[${LOG_LABEL}] 저장 실패:`, inserted.reason);
    return { ok: false, kind: 'store', errorKind: `insert:${inserted.reason}` };
  }

  console.log(
    `[${LOG_LABEL}] 갱신 완료 source:`,
    source,
    'reviews:',
    inserted.data.reviewCount,
    'excluded:',
    inserted.data.excludedCount,
    'bytes:',
    inserted.data.byteSize
  );

  // 오래된 기록 정리는 성공·실패와 무관하게 호출부의 finally에서 합니다.
  return { ok: true, snapshot: inserted.data };
}

/** 실패 기록 남기기. 이 기록이 실패해도 원래 실패 사유를 덮어쓰지 않습니다. */
async function recordFailure(input: {
  mallId: string;
  boardNo: number | null;
  source: SnapshotSource;
  errorKind: string;
  scannedArticleCount: number | null;
  createdBy: string | null;
}): Promise<void> {
  const recorded = await insertFailedRun(input);

  if (!recorded.ok) {
    console.error(`[${LOG_LABEL}] 실패 기록을 남기지 못했습니다:`, recorded.reason);
  }
}
