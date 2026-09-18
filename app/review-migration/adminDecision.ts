/**
 * 4단계 중복 검사 결과에 대한 관리자 판정 계산.
 *
 * 서버 판정 결과(DuplicateCheckResultItem.status)는 절대 바꾸지 않고,
 * 별도의 관리자 판정 값(AdminDecisionMap)과 합쳐서 화면에 보여 줄 값만 여기서 계산합니다.
 *
 * React·DOM에 의존하지 않는 순수 함수만 두어 화면과 확인 스크립트가 같은 계산을 쓰게 합니다.
 */
import type {
  AdminDecisionMap,
  AdminDuplicateDecision,
  DuplicateCheckResultItem,
  DuplicateStatus,
} from './types';

/** 요약 카드·필터에 쓰는 상태별 건수 (상품 매칭 건너뜀은 검사 대상 밖이라 여기 없습니다) */
export interface DuplicateStatusCounts {
  duplicate: number;
  needsReview: number;
  new: number;
}

/**
 * 관리자가 직접 판정할 수 있는 행인지 확인합니다.
 *
 * naverpay_review_id 일치로 서버가 처음부터 duplicate로 판정한 행과
 * 후보가 없어 new로 판정한 행은 관리자가 손대지 않습니다.
 */
export function canAdminDecide(item: DuplicateCheckResultItem): boolean {
  return item.status === 'needs_review';
}

/** 관리자 판정을 반영한 최종 상태. 관리자 판정이 없으면 서버 판정 그대로입니다. */
export function resolveDuplicateStatus(
  item: DuplicateCheckResultItem,
  decisions: AdminDecisionMap
): DuplicateStatus {
  if (!canAdminDecide(item)) return item.status;
  return decisions[item.naverReviewId] ?? 'needs_review';
}

/** 현재 결과에 실제로 적용된 관리자 판정만 골라 냅니다. (지난 결과의 값이 섞이지 않게) */
export function resolveAdminDecision(
  item: DuplicateCheckResultItem,
  decisions: AdminDecisionMap
): AdminDuplicateDecision | null {
  if (!canAdminDecide(item)) return null;
  return decisions[item.naverReviewId] ?? null;
}

/**
 * 상태별 건수를 실시간으로 셉니다.
 *
 * - duplicate: 서버 duplicate + 관리자 중복 확정
 * - needsReview: 서버 needs_review 중 아직 관리자 판정이 없는 건
 * - new: 서버 new + 관리자 신규 유지
 *
 * 세 값의 합은 항상 결과 전체 건수와 같아서 '검사 대상' 수치는 판정에 따라 변하지 않습니다.
 */
export function countDuplicateStatuses(
  results: DuplicateCheckResultItem[],
  decisions: AdminDecisionMap
): DuplicateStatusCounts {
  const counts: DuplicateStatusCounts = { duplicate: 0, needsReview: 0, new: 0 };

  for (const item of results) {
    const status = resolveDuplicateStatus(item, decisions);
    if (status === 'duplicate') counts.duplicate += 1;
    else if (status === 'needs_review') counts.needsReview += 1;
    else counts.new += 1;
  }

  return counts;
}

/** 아직 관리자 판정이 없는 '확인 필요' 리뷰글번호. 전체 선택과 일괄 처리 대상입니다. */
export function pendingNeedsReviewIds(
  results: DuplicateCheckResultItem[],
  decisions: AdminDecisionMap
): string[] {
  return results
    .filter((item) => resolveDuplicateStatus(item, decisions) === 'needs_review')
    .map((item) => item.naverReviewId);
}

/** 현재 결과에 적용된 관리자 판정 건수. 0이면 초기화 버튼을 감춥니다. */
export function countAdminDecisions(
  results: DuplicateCheckResultItem[],
  decisions: AdminDecisionMap
): number {
  return results.filter((item) => resolveAdminDecision(item, decisions) !== null).length;
}

/**
 * 다음 단계에서 실제로 등록할 후보.
 *
 * 서버 판정이 new이거나 관리자가 신규 유지로 판정한 건만 포함하고,
 * 서버 duplicate · 관리자 중복 확정 · 미판정 확인 필요는 모두 제외합니다.
 * 상품 매칭 건너뜀과 리뷰글번호 없음·파일 내 중복은 애초에 검사 대상에 들어오지 않아 여기에도 없습니다.
 */
export function registrationCandidateIds(
  results: DuplicateCheckResultItem[],
  decisions: AdminDecisionMap
): string[] {
  return results
    .filter((item) => resolveDuplicateStatus(item, decisions) === 'new')
    .map((item) => item.naverReviewId);
}

/** 선택한 리뷰들에 같은 판정을 한 번에 적용합니다. 판정할 수 없는 행은 무시합니다. */
export function applyAdminDecisions(
  results: DuplicateCheckResultItem[],
  decisions: AdminDecisionMap,
  targetIds: Iterable<string>,
  decision: AdminDuplicateDecision
): AdminDecisionMap {
  const decidable = new Set(
    results.filter((item) => canAdminDecide(item)).map((item) => item.naverReviewId)
  );

  const next: AdminDecisionMap = { ...decisions };
  for (const id of targetIds) {
    if (decidable.has(id)) next[id] = decision;
  }

  return next;
}

/** 한 건의 관리자 판정만 지워 원래 '확인 필요' 상태로 되돌립니다. */
export function clearAdminDecision(
  decisions: AdminDecisionMap,
  naverReviewId: string
): AdminDecisionMap {
  if (!(naverReviewId in decisions)) return decisions;

  const next: AdminDecisionMap = { ...decisions };
  delete next[naverReviewId];
  return next;
}
