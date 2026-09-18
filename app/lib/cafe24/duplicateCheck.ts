import {
  compareReviewContent,
  normalizeReviewContent,
  normalizeReviewRating,
  normalizeReviewWriter,
  toKstDateString,
  toKstTimeString,
} from './reviewNormalize';
import type { ExistingReviewRecord } from './reviews';
import type {
  DuplicateCheckRequestReview,
  DuplicateCheckResultItem,
  DuplicateMatchedFields,
  DuplicateReason,
  DuplicateStatus,
} from '@/app/review-migration/types';

/**
 * 엑셀 리뷰 ↔ 기존 카페24 리뷰 중복 판정기 (서버 전용).
 *
 * 자동으로 '확실한 중복'이 되는 경우는 카페24에 저장된 naverpay_review_id가
 * 실제로 일치하는 한 가지뿐입니다.
 *
 * naverpay_review_id가 없는 과거 리뷰는 절대 자동 중복으로 처리하지 않고,
 * 아래 여섯 조건을 모두 만족할 때만 '확인 필요'로 표시해서 관리자가 직접 보게 합니다.
 *
 *   1차 작성 날짜(한국시간 YYYY-MM-DD) 일치
 *   2차 카페24 상품번호 일치
 *   3차 작성자 일치 (정규화 후 문자열 비교, 마스킹된 값은 보이는 그대로)
 *   4차 평점 일치 (양쪽 모두 1~5로 해석됐을 때만 비교)
 *   5차 작성시각 일치 (한국시간 HH:mm, 초는 보지 않음)
 *   6차 본문 유사도 30% 이상
 *
 * 퍼지 검색과 AI 유사도는 쓰지 않습니다. 본문 유사도는 결정적인 글자 2-gram Dice 계수입니다.
 * 본문·작성자·기존 naverpay_review_id 값은 결과에 담지 않고, 유사도 수치만 내보냅니다.
 */

/**
 * 상태·이유·응답 항목의 모양은 화면과 공유하는 타입을 그대로 씁니다.
 * (app/review-migration/types.ts — 타입만 가져오므로 런타임 의존성은 없습니다)
 */
export type { DuplicateReason, DuplicateStatus };

/** 중복 검사 대상 리뷰 한 건 (요청에서 검증을 통과한 값) */
export type DuplicateCheckInput = DuplicateCheckRequestReview;

export type DuplicateCheckResult = DuplicateCheckResultItem;

const WARNING_PRODUCT_MISMATCH =
  '같은 네이버 리뷰글번호가 다른 카페24 상품의 게시글에 이미 등록되어 있습니다. 상품 매칭을 확인해 주세요.';

const WARNING_EMPTY_CONTENT =
  '리뷰 본문이 비어 있어 기존 리뷰 본문과 비교하지 못했습니다. 등록 전에 직접 확인해 주세요.';

const WARNING_NO_DATE_OR_TIME =
  '작성일시를 해석하지 못해 기존 리뷰와 비교하지 못했습니다. 등록 전에 직접 확인해 주세요.';

/** 후보가 두 건 이상일 때 붙이는 안내. 같은 사람이 같은 상품을 여러 번 살 수 있습니다. */
function multipleCandidatesWarning(count: number, articleNo: number): string {
  return `조건을 만족하는 기존 게시글이 ${count.toLocaleString()}건입니다. 대표로 ${articleNo}번을 표시했으며 같은 상품을 여러 번 구매한 경우일 수 있으니 등록 전에 직접 확인해 주세요.`;
}

const NO_MATCH_FIELDS: DuplicateMatchedFields = {
  product: false,
  content: false,
  writer: null,
  date: null,
  rating: null,
  time: null,
};

interface NormalizedInput {
  input: DuplicateCheckInput;
  contentKey: string;
  contentLength: number;
  writerKey: string;
  dateKst: string | null;
  timeKst: string | null;
  rating: number | null;
}

/** 조건을 통과한 후보 한 건 */
interface ScoredCandidate {
  record: ExistingReviewRecord;
  fields: DuplicateMatchedFields;
  similarity: number;
}

/**
 * 1차·2차 조건(작성 날짜 + 상품번호)으로 후보를 좁히는 Map 키입니다.
 * 3차~6차는 이 키로 좁힌 작은 묶음 안에서만 순서대로 확인합니다.
 */
function candidateIndexKey(dateKst: string, productNo: number): string {
  return `${dateKst}:${productNo}`;
}

function normalizeInput(input: DuplicateCheckInput): NormalizedInput {
  const contentKey = normalizeReviewContent(input.content);

  return {
    input,
    contentKey,
    contentLength: contentKey.length,
    writerKey: normalizeReviewWriter(input.writer),
    dateKst: toKstDateString(input.registeredAt),
    timeKst: toKstTimeString(input.registeredAt),
    rating: normalizeReviewRating(input.rating),
  };
}

/** 양쪽에 값이 있을 때만 비교합니다. 한쪽이라도 비어 있으면 null */
function compareText(left: string, right: string): boolean | null {
  if (!left || !right) return null;
  return left === right;
}

function compareRating(left: number | null, right: number | null): boolean | null {
  if (left === null || right === null) return null;
  return left === right;
}

/**
 * 3차~6차 조건을 순서대로 확인합니다. 하나라도 어긋나면 후보가 아닙니다.
 *
 * - 작성자: 양쪽 모두 값이 있고 정규화 결과가 같아야 합니다.
 * - 평점: 양쪽 모두 1~5로 해석됐을 때만 같은 값인지 봅니다. 한쪽이 없으면 비교하지 않습니다.
 * - 작성시각: 양쪽 모두 한국시간 HH:mm으로 해석되고 같아야 합니다.
 * - 본문: 정규화된 본문의 유사도가 30% 이상이어야 합니다.
 */
function evaluateCandidate(
  normalized: NormalizedInput,
  record: ExistingReviewRecord
): ScoredCandidate | null {
  // 3차 작성자
  const writerMatched = compareText(normalized.writerKey, record.writerKey);
  if (writerMatched !== true) return null;

  // 4차 평점
  const ratingMatched = compareRating(normalized.rating, record.rating);
  if (ratingMatched === false) return null;

  // 5차 작성시각 (분 단위)
  if (!normalized.timeKst || !record.timeKst) return null;
  if (normalized.timeKst !== record.timeKst) return null;

  // 6차 본문 유사도
  const content = compareReviewContent(normalized.contentKey, record.contentNormalized);
  if (!content.passed) return null;

  return {
    record,
    similarity: content.similarity,
    fields: {
      product: true,
      content: true,
      writer: true,
      date: true,
      rating: ratingMatched,
      time: true,
    },
  };
}

/**
 * 화면에 대표로 보여 줄 후보 하나를 고릅니다.
 *
 * 자동 판정이 아니라 표시용이므로 기준을 결정적으로 고정합니다.
 * 유사도가 높은 쪽 → 같으면 게시글 번호가 작은 쪽입니다.
 */
function pickBest(candidates: ScoredCandidate[]): ScoredCandidate | null {
  let best: ScoredCandidate | null = null;

  for (const candidate of candidates) {
    if (!best) {
      best = candidate;
      continue;
    }

    if (candidate.similarity !== best.similarity) {
      if (candidate.similarity > best.similarity) best = candidate;
      continue;
    }

    if (candidate.record.articleNo < best.record.articleNo) best = candidate;
  }

  return best;
}

function newResult(
  naverReviewId: string,
  warning?: string
): DuplicateCheckResult {
  return {
    naverReviewId,
    status: 'new',
    reason: 'no_match',
    matchedCafe24ArticleNo: null,
    candidateCount: 0,
    matchedFields: NO_MATCH_FIELDS,
    ...(warning ? { warning } : {}),
  };
}

/**
 * 엑셀 리뷰 목록을 기존 카페24 리뷰와 비교합니다.
 *
 * 1순위 네이버 리뷰글번호 일치 → duplicate (자동 중복은 이 경우뿐입니다)
 * 2순위 날짜·상품번호·작성자·평점·분 단위 작성시각·본문 유사도 30% 이상 → needs_review
 * 그 외 → new
 */
export function runDuplicateCheck(
  inputs: DuplicateCheckInput[],
  existing: ExistingReviewRecord[]
): DuplicateCheckResult[] {
  const byNaverReviewId = new Map<string, ExistingReviewRecord[]>();
  const byDateAndProduct = new Map<string, ExistingReviewRecord[]>();

  for (const record of existing) {
    if (record.naverReviewId) {
      const bucket = byNaverReviewId.get(record.naverReviewId);
      if (bucket) bucket.push(record);
      else byNaverReviewId.set(record.naverReviewId, [record]);
    }

    // 1차·2차 조건을 만족할 수 없는 게시글은 인덱스에 넣지 않습니다.
    if (record.dateKst) {
      const key = candidateIndexKey(record.dateKst, record.productNo);
      const bucket = byDateAndProduct.get(key);
      if (bucket) bucket.push(record);
      else byDateAndProduct.set(key, [record]);
    }
  }

  return inputs.map((input) => {
    const normalized = normalizeInput(input);

    // 1순위 — 네이버 리뷰글번호가 이미 저장돼 있으면 상품이 달라도 중복입니다.
    const byId = byNaverReviewId.get(input.naverReviewId);
    if (byId && byId.length > 0) {
      // 게시글 번호가 작은 쪽을 대표로 씁니다. (결정적 기준)
      let matched = byId[0];
      for (const record of byId) {
        if (record.articleNo < matched.articleNo) matched = record;
      }

      const productMatched = matched.productNo === input.cafe24ProductNo;

      return {
        naverReviewId: input.naverReviewId,
        status: 'duplicate' as const,
        reason: 'naver_review_id' as const,
        matchedCafe24ArticleNo: matched.articleNo,
        candidateCount: byId.length,
        matchedFields: {
          product: productMatched,
          content: false,
          writer: compareText(normalized.writerKey, matched.writerKey),
          date: normalized.dateKst && matched.dateKst ? normalized.dateKst === matched.dateKst : null,
          rating: compareRating(normalized.rating, matched.rating),
          time: normalized.timeKst && matched.timeKst ? normalized.timeKst === matched.timeKst : null,
        },
        ...(productMatched ? {} : { warning: WARNING_PRODUCT_MISMATCH }),
      };
    }

    // 본문이 비어 있으면 유사도를 계산할 수 없어 자동 후보로 삼지 않습니다.
    if (!normalized.contentKey) {
      return newResult(input.naverReviewId, WARNING_EMPTY_CONTENT);
    }

    // 1차 작성 날짜 · 5차 작성시각을 해석할 수 없으면 비교하지 않습니다.
    if (!normalized.dateKst || !normalized.timeKst) {
      return newResult(input.naverReviewId, WARNING_NO_DATE_OR_TIME);
    }

    // 1차 + 2차 — 날짜와 상품번호로 후보를 좁힙니다.
    const sameDateAndProduct =
      byDateAndProduct.get(candidateIndexKey(normalized.dateKst, input.cafe24ProductNo)) ?? [];

    if (sameDateAndProduct.length === 0) {
      return newResult(input.naverReviewId);
    }

    // 3차 ~ 6차 — 좁혀진 묶음 안에서만 순서대로 확인합니다.
    const candidates: ScoredCandidate[] = [];
    for (const record of sameDateAndProduct) {
      const scored = evaluateCandidate(normalized, record);
      if (scored) candidates.push(scored);
    }

    const best = pickBest(candidates);
    if (!best) {
      return newResult(input.naverReviewId);
    }

    // 조건을 모두 만족해도 자동 중복으로 올리지 않고 관리자 확인 대상으로만 표시합니다.
    return {
      naverReviewId: input.naverReviewId,
      status: 'needs_review' as const,
      reason: 'legacy_possible_match' as const,
      matchedCafe24ArticleNo: best.record.articleNo,
      candidateCount: candidates.length,
      matchedFields: best.fields,
      contentSimilarity: best.similarity,
      ...(candidates.length > 1
        ? { warning: multipleCandidatesWarning(candidates.length, best.record.articleNo) }
        : {}),
    };
  });
}