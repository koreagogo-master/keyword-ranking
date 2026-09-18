import type { DuplicateCheckInput } from './duplicateCheck';
import type { ReviewPayloadSource } from './reviewPayload';

/**
 * 등록 전 최종 확인·실제 등록 요청 본문 검증기 (서버 전용).
 *
 * 화면에 표시된 숫자나 클라이언트가 계산한 후보 목록을 그대로 믿지 않고
 * 여기서 형식·리뷰글번호·상품 매칭·필수 항목을 다시 확인합니다.
 * 검증에 실패한 값은 어떤 경우에도 로그·응답에 원문으로 남기지 않고 짧은 코드만 돌려줍니다.
 */

/** 중복 검사와 같은 상한을 씁니다. (한 엑셀에서 처리하는 최대 리뷰 수) */
export const MAX_REVIEWS_PER_REQUEST = 500;

const MAX_NAVER_REVIEW_ID_LENGTH = 64;
const MAX_CONTENT_LENGTH = 5_000;
const MAX_WRITER_LENGTH = 200;
const MAX_REGISTERED_AT_LENGTH = 64;
const MAX_PRODUCT_NAME_LENGTH = 500;
const MAX_IMAGE_RAW_LENGTH = 5_000;

export type ValidationFailure = { ok: false; message: string; code: string };

function isPlainString(value: unknown): value is string {
  return typeof value === 'string';
}

function parseProductNo(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** 중복 검사와 같은 여섯 개 필드를 검증합니다. */
function validateCommonFields(record: Record<string, unknown>): DuplicateCheckInput | ValidationFailure {
  const naverReviewId = isPlainString(record.naverReviewId) ? record.naverReviewId.trim() : '';
  if (!naverReviewId || naverReviewId.length > MAX_NAVER_REVIEW_ID_LENGTH) {
    return {
      ok: false,
      message: '리뷰글번호가 없거나 형식이 올바르지 않은 리뷰가 있습니다.',
      code: 'invalid_naver_review_id',
    };
  }

  const cafe24ProductNo = parseProductNo(record.cafe24ProductNo);
  if (cafe24ProductNo === null) {
    return {
      ok: false,
      message: '카페24 상품번호가 확정되지 않은 리뷰가 있습니다.',
      code: 'invalid_product_no',
    };
  }

  if (!isPlainString(record.content) || record.content.length > MAX_CONTENT_LENGTH) {
    return { ok: false, message: '리뷰 본문 형식이 올바르지 않거나 너무 깁니다.', code: 'invalid_content' };
  }

  if (!isPlainString(record.writer) || record.writer.length > MAX_WRITER_LENGTH) {
    return { ok: false, message: '작성자 형식이 올바르지 않거나 너무 깁니다.', code: 'invalid_writer' };
  }

  if (!isPlainString(record.registeredAt) || record.registeredAt.length > MAX_REGISTERED_AT_LENGTH) {
    return { ok: false, message: '작성일 형식이 올바르지 않거나 너무 깁니다.', code: 'invalid_registered_at' };
  }

  const ratingRaw = record.rating;
  if (ratingRaw !== null && !(typeof ratingRaw === 'number' && Number.isFinite(ratingRaw))) {
    return { ok: false, message: '평점 형식이 올바르지 않은 리뷰가 있습니다.', code: 'invalid_rating' };
  }

  return {
    naverReviewId,
    cafe24ProductNo,
    content: record.content,
    rating: ratingRaw === null ? null : (ratingRaw as number),
    writer: record.writer,
    registeredAt: record.registeredAt,
  };
}

function isValidationFailure(value: unknown): value is ValidationFailure {
  return typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === false;
}

/** 요청 본문에서 `reviews` 배열만 꺼냅니다. */
function readReviewArray(
  body: unknown,
  maxCount: number
): { ok: true; raw: unknown[] } | ValidationFailure {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: '요청 형식이 올바르지 않습니다.', code: 'invalid_body' };
  }

  const raw = (body as Record<string, unknown>).reviews;
  if (!Array.isArray(raw)) {
    return { ok: false, message: '등록할 리뷰 목록이 없습니다.', code: 'invalid_reviews' };
  }

  if (raw.length === 0) {
    return { ok: false, message: '등록할 리뷰가 한 건도 없습니다.', code: 'empty_reviews' };
  }

  if (raw.length > maxCount) {
    return {
      ok: false,
      message: `한 번에 보낼 수 있는 리뷰는 최대 ${maxCount.toLocaleString()}건입니다.`,
      code: 'too_many_reviews',
    };
  }

  return { ok: true, raw };
}

/**
 * 등록 전 최종 확인용 검증.
 * 중복 검사와 같은 여섯 개 필드만 확인하고 게시글 등록용 값은 요구하지 않습니다.
 */
export function validateDuplicateCheckReviews(
  body: unknown,
  maxCount: number = MAX_REVIEWS_PER_REQUEST
): { ok: true; reviews: DuplicateCheckInput[] } | ValidationFailure {
  const list = readReviewArray(body, maxCount);
  if (!list.ok) return list;

  const reviews: DuplicateCheckInput[] = [];
  const seen = new Set<string>();

  for (const item of list.raw) {
    if (!item || typeof item !== 'object') {
      return { ok: false, message: '리뷰 항목 형식이 올바르지 않습니다.', code: 'invalid_review' };
    }

    const parsed = validateCommonFields(item as Record<string, unknown>);
    if (isValidationFailure(parsed)) return parsed;

    if (seen.has(parsed.naverReviewId)) {
      return {
        ok: false,
        message: '같은 리뷰글번호가 요청 안에 두 번 이상 들어 있습니다.',
        code: 'duplicate_naver_review_id',
      };
    }
    seen.add(parsed.naverReviewId);

    reviews.push(parsed);
  }

  return { ok: true, reviews };
}

/** 실제 등록용 검증. 게시글 제목·첨부에 쓰는 값까지 함께 확인합니다. */
export function validateRegisterReviews(
  body: unknown,
  maxCount: number
): { ok: true; reviews: ReviewPayloadSource[] } | ValidationFailure {
  const list = readReviewArray(body, maxCount);
  if (!list.ok) return list;

  const reviews: ReviewPayloadSource[] = [];
  const seen = new Set<string>();

  for (const item of list.raw) {
    if (!item || typeof item !== 'object') {
      return { ok: false, message: '리뷰 항목 형식이 올바르지 않습니다.', code: 'invalid_review' };
    }

    const record = item as Record<string, unknown>;
    const parsed = validateCommonFields(record);
    if (isValidationFailure(parsed)) return parsed;

    if (seen.has(parsed.naverReviewId)) {
      return {
        ok: false,
        message: '같은 리뷰글번호가 요청 안에 두 번 이상 들어 있습니다.',
        code: 'duplicate_naver_review_id',
      };
    }
    seen.add(parsed.naverReviewId);

    if (!isPlainString(record.productName) || record.productName.length > MAX_PRODUCT_NAME_LENGTH) {
      return {
        ok: false,
        message: '상품명 형식이 올바르지 않거나 너무 깁니다.',
        code: 'invalid_product_name',
      };
    }

    if (!isPlainString(record.imageRaw) || record.imageRaw.length > MAX_IMAGE_RAW_LENGTH) {
      return {
        ok: false,
        message: '이미지 정보 형식이 올바르지 않거나 너무 깁니다.',
        code: 'invalid_image',
      };
    }

    reviews.push({ ...parsed, productName: record.productName, imageRaw: record.imageRaw });
  }

  return { ok: true, reviews };
}

/** 화면이 보낸 이전 검사 결과 한 건 (최종 확인에서 지금 결과와 비교합니다) */
export interface ExpectedResultInput {
  naverReviewId: string;
  status: 'duplicate' | 'needs_review' | 'new';
  matchedCafe24ArticleNo: number | null;
  candidateCount: number;
  adminDecision: 'duplicate' | 'new' | null;
}

/** 최종 확인 요청의 `expected` 배열을 검증합니다. */
export function validateExpectedResults(
  body: unknown
): { ok: true; expected: Map<string, ExpectedResultInput> } | ValidationFailure {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: '요청 형식이 올바르지 않습니다.', code: 'invalid_body' };
  }

  const raw = (body as Record<string, unknown>).expected;
  if (!Array.isArray(raw)) {
    return { ok: false, message: '이전 검사 결과가 없습니다.', code: 'invalid_expected' };
  }

  const expected = new Map<string, ExpectedResultInput>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { ok: false, message: '이전 검사 결과 형식이 올바르지 않습니다.', code: 'invalid_expected' };
    }

    const record = item as Record<string, unknown>;

    const naverReviewId = isPlainString(record.naverReviewId) ? record.naverReviewId.trim() : '';
    if (!naverReviewId || naverReviewId.length > MAX_NAVER_REVIEW_ID_LENGTH) {
      return { ok: false, message: '이전 검사 결과의 리뷰글번호가 올바르지 않습니다.', code: 'invalid_expected' };
    }

    const status = record.status;
    if (status !== 'duplicate' && status !== 'needs_review' && status !== 'new') {
      return { ok: false, message: '이전 검사 결과의 판정값이 올바르지 않습니다.', code: 'invalid_expected' };
    }

    const matchedCafe24ArticleNo =
      record.matchedCafe24ArticleNo === null
        ? null
        : typeof record.matchedCafe24ArticleNo === 'number' &&
            Number.isInteger(record.matchedCafe24ArticleNo)
          ? record.matchedCafe24ArticleNo
          : undefined;

    if (matchedCafe24ArticleNo === undefined) {
      return { ok: false, message: '이전 검사 결과의 게시글번호가 올바르지 않습니다.', code: 'invalid_expected' };
    }

    const candidateCount = record.candidateCount;
    if (typeof candidateCount !== 'number' || !Number.isInteger(candidateCount) || candidateCount < 0) {
      return { ok: false, message: '이전 검사 결과의 후보 수가 올바르지 않습니다.', code: 'invalid_expected' };
    }

    const decision = record.adminDecision;
    if (decision !== null && decision !== 'duplicate' && decision !== 'new') {
      return { ok: false, message: '관리자 판정값이 올바르지 않습니다.', code: 'invalid_expected' };
    }

    expected.set(naverReviewId, {
      naverReviewId,
      status,
      matchedCafe24ArticleNo,
      candidateCount,
      adminDecision: decision,
    });
  }

  return { ok: true, expected };
}
