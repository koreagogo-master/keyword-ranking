/**
 * 스냅샷 검증 (순수 함수 모듈).
 *
 * 네트워크·DB를 쓰지 않습니다. buildFeed.ts와 마찬가지로 네트워크 없이 그대로 검증할 수 있습니다.
 *
 * 여기를 통과한 XML만 저장됩니다. 하나라도 걸리면 저장하지 않으므로
 * 직전 정상 스냅샷이 그대로 계속 제공됩니다.
 *
 * Node 20에는 내장 XML 파서가 없고 이 작업에 새 패키지를 들이지 않기로 했으므로
 * 여기서는 구조 검사만 합니다. 요소 순서·XSD 적합성 검증은
 * scripts/verify-google-review-feed.mjs가 오프라인에서 계속 담당합니다.
 * (생성기 buildFeed.ts를 바꾸지 않으므로 그 보증은 그대로 유효합니다)
 */

/** XML 크기 하한. 이보다 작으면 리뷰가 실제로 담기지 않은 것입니다. */
export const MIN_SNAPSHOT_BYTES = 1024;

/** XML 크기 상한. 현재 886KB 내외이므로 20배 이상 여유가 있습니다. */
export const MAX_SNAPSHOT_BYTES = 20 * 1024 * 1024;

export type SnapshotRejectReason =
  | 'empty_feed'
  | 'bad_prolog'
  | 'bad_terminator'
  | 'missing_reviews_element'
  | 'review_count_mismatch'
  | 'unexpected_comment'
  | 'suspicious_size'
  | 'suspicious_shrink';

/** 화면·로그에 그대로 써도 되는 설명 (리뷰 내용이 들어가지 않습니다) */
export const SNAPSHOT_REJECT_LABELS: Readonly<Record<SnapshotRejectReason, string>> = {
  empty_feed: '리뷰가 한 건도 없음',
  bad_prolog: 'XML 선언이 올바르지 않음',
  bad_terminator: 'XML이 끝까지 만들어지지 않음',
  missing_reviews_element: 'reviews 요소가 없음',
  review_count_mismatch: 'XML의 리뷰 수가 집계와 다름',
  unexpected_comment: '운영 피드에 들어가면 안 되는 주석이 있음',
  suspicious_size: 'XML 크기가 정상 범위를 벗어남',
  suspicious_shrink: '직전 스냅샷보다 리뷰가 크게 줄어듦',
};

export interface ValidateSnapshotInput {
  xml: string;
  /** buildGoogleReviewFeed()가 돌려준 포함 건수 */
  includedCount: number;
  /** 직전 정상 스냅샷의 리뷰 수. 첫 스냅샷이면 null */
  previousReviewCount: number | null;
  /** 0~1. 직전 대비 이 비율 아래로 떨어지면 거부합니다. */
  minRetainRatio: number;
  /** 관리자 수동 갱신에서만 true. suspicious_shrink 하나만 건너뜁니다. */
  force: boolean;
}

export type ValidateSnapshotResult =
  | { ok: true; byteSize: number }
  | { ok: false; reason: SnapshotRejectReason; label: string };

const PROLOG = '<?xml version="1.0" encoding="UTF-8"?>';

/**
 * `<review>`와 `</review>`는 닫는 꺾쇠까지 포함한 정확한 문자열이라
 * `<review_id>`·`<review_timestamp>`·`<review_url ...>`·`</review_id>`와 겹치지 않습니다.
 */
function countOccurrences(text: string, needle: string): number {
  let count = 0;
  let index = text.indexOf(needle);

  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }

  return count;
}

function reject(reason: SnapshotRejectReason): ValidateSnapshotResult {
  return { ok: false, reason, label: SNAPSHOT_REJECT_LABELS[reason] };
}

/**
 * 저장해도 되는 XML인지 확인합니다.
 *
 * force는 suspicious_shrink 하나만 건너뜁니다.
 * 나머지 검사는 어떤 경로로도 우회할 수 없습니다.
 */
export function validateSnapshotXml(input: ValidateSnapshotInput): ValidateSnapshotResult {
  const { xml, includedCount } = input;

  // 리뷰가 한 건도 없는 피드는 Google이 모든 리뷰를 삭제된 것으로 처리합니다.
  if (!Number.isInteger(includedCount) || includedCount <= 0) return reject('empty_feed');

  if (!xml.startsWith(PROLOG)) return reject('bad_prolog');

  // 생성기는 항상 줄바꿈으로 끝냅니다. 중간에 끊긴 XML을 걸러 냅니다.
  if (!xml.endsWith('</feed>\n')) return reject('bad_terminator');

  if (!xml.includes('<reviews>') || !xml.includes('</reviews>')) {
    return reject('missing_reviews_element');
  }

  // 운영 피드에는 진단 주석을 넣지 않습니다. (summaryComment: false로 만들었는지 확인)
  if (xml.includes('<!--')) return reject('unexpected_comment');

  const openCount = countOccurrences(xml, '<review>');
  const closeCount = countOccurrences(xml, '</review>');

  if (openCount !== includedCount || closeCount !== includedCount) {
    return reject('review_count_mismatch');
  }

  const byteSize = Buffer.byteLength(xml, 'utf8');
  if (byteSize < MIN_SNAPSHOT_BYTES || byteSize > MAX_SNAPSHOT_BYTES) {
    return reject('suspicious_size');
  }

  /**
   * 리뷰 수 급감 검사.
   *
   * 카페24가 ok를 주면서도 일부 페이지를 빈 배열로 돌려주면
   * incomplete_scan에 걸리지 않고 통과합니다. 그때 여기서 잡힙니다.
   * 관리자가 리뷰를 의도적으로 대량 삭제한 경우에만 force로 통과시킵니다.
   */
  if (!input.force && typeof input.previousReviewCount === 'number' && input.previousReviewCount > 0) {
    const floorCount = Math.floor(input.previousReviewCount * input.minRetainRatio);
    if (includedCount < floorCount) return reject('suspicious_shrink');
  }

  return { ok: true, byteSize };
}
