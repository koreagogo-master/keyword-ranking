import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import { runDuplicateCheck, type DuplicateCheckInput } from '@/app/lib/cafe24/duplicateCheck';
import { CAFE24_NO_STORE_HEADERS, cafe24FailureResponse } from '@/app/lib/cafe24/failureResponse';
import { fetchExistingReviewRecords } from '@/app/lib/cafe24/reviews';
import { isSameOrigin } from '@/app/lib/cafe24/sameOrigin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 등록 전 기존 카페24 리뷰 중복 검사 (읽기 전용).
 *
 * - 관리자만 호출할 수 있고 POST만 제공합니다. 동일 출처 검증을 함께 걸어 둡니다.
 * - 카페24와 Supabase에 아무것도 쓰지 않습니다. 게시글을 만들거나 고치지 않습니다.
 * - 클라이언트가 보낸 값은 모두 서버에서 다시 검증합니다.
 * - 리뷰 본문·작성자·리뷰글번호·비교용 해시는 로그에 남기지 않고,
 *   기존 리뷰의 본문·작성자·주문번호·naverpay_review_id 값도 응답에 넣지 않습니다.
 */

const MAX_REVIEWS = 500;
const MAX_NAVER_REVIEW_ID_LENGTH = 64;
const MAX_CONTENT_LENGTH = 5_000;
const MAX_WRITER_LENGTH = 200;
const MAX_REGISTERED_AT_LENGTH = 64;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: CAFE24_NO_STORE_HEADERS });
}

/** 잘못된 요청. 어떤 값이 문제였는지는 남기지 않고 무엇을 고쳐야 하는지만 알려 줍니다. */
function badRequest(message: string, code: string) {
  return jsonResponse({ error: message, code, retryable: false }, 400);
}

function isPlainString(value: unknown): value is string {
  return typeof value === 'string';
}

function parseProductNo(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  return Number.isInteger(value) && value > 0 ? value : null;
}

type ValidationResult =
  | { ok: true; reviews: DuplicateCheckInput[] }
  | { ok: false; message: string; code: string };

/** 요청 본문을 검증해 비교에 쓸 목록으로 바꿉니다. 입력 원문은 어디에도 기록하지 않습니다. */
function validateRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: '요청 형식이 올바르지 않습니다.', code: 'invalid_body' };
  }

  const raw = (body as Record<string, unknown>).reviews;
  if (!Array.isArray(raw)) {
    return { ok: false, message: '검사할 리뷰 목록이 없습니다.', code: 'invalid_reviews' };
  }

  if (raw.length === 0) {
    return { ok: false, message: '검사할 리뷰가 한 건도 없습니다.', code: 'empty_reviews' };
  }

  if (raw.length > MAX_REVIEWS) {
    return {
      ok: false,
      message: `한 번에 검사할 수 있는 리뷰는 최대 ${MAX_REVIEWS.toLocaleString()}건입니다.`,
      code: 'too_many_reviews',
    };
  }

  const reviews: DuplicateCheckInput[] = [];
  const seenIds = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { ok: false, message: '리뷰 항목 형식이 올바르지 않습니다.', code: 'invalid_review' };
    }

    const record = item as Record<string, unknown>;

    const naverReviewId = isPlainString(record.naverReviewId) ? record.naverReviewId.trim() : '';
    if (!naverReviewId || naverReviewId.length > MAX_NAVER_REVIEW_ID_LENGTH) {
      return {
        ok: false,
        message: '리뷰글번호가 없거나 형식이 올바르지 않은 리뷰가 있습니다.',
        code: 'invalid_naver_review_id',
      };
    }

    if (seenIds.has(naverReviewId)) {
      return {
        ok: false,
        message: '같은 리뷰글번호가 요청 안에 두 번 이상 들어 있습니다. 엑셀의 중복 행을 정리해 주세요.',
        code: 'duplicate_naver_review_id',
      };
    }
    seenIds.add(naverReviewId);

    const cafe24ProductNo = parseProductNo(record.cafe24ProductNo);
    if (cafe24ProductNo === null) {
      return {
        ok: false,
        message: '카페24 상품번호가 올바르지 않은 리뷰가 있습니다.',
        code: 'invalid_product_no',
      };
    }

    const content = isPlainString(record.content) ? record.content : '';
    if (!isPlainString(record.content) || content.length > MAX_CONTENT_LENGTH) {
      return {
        ok: false,
        message: '리뷰 본문 형식이 올바르지 않거나 너무 깁니다.',
        code: 'invalid_content',
      };
    }

    const writer = isPlainString(record.writer) ? record.writer : '';
    if (!isPlainString(record.writer) || writer.length > MAX_WRITER_LENGTH) {
      return {
        ok: false,
        message: '작성자 형식이 올바르지 않거나 너무 깁니다.',
        code: 'invalid_writer',
      };
    }

    const registeredAt = isPlainString(record.registeredAt) ? record.registeredAt : '';
    if (!isPlainString(record.registeredAt) || registeredAt.length > MAX_REGISTERED_AT_LENGTH) {
      return {
        ok: false,
        message: '작성일 형식이 올바르지 않거나 너무 깁니다.',
        code: 'invalid_registered_at',
      };
    }

    const ratingRaw = record.rating;
    if (ratingRaw !== null && !(typeof ratingRaw === 'number' && Number.isFinite(ratingRaw))) {
      return {
        ok: false,
        message: '평점 형식이 올바르지 않은 리뷰가 있습니다.',
        code: 'invalid_rating',
      };
    }

    reviews.push({
      naverReviewId,
      cafe24ProductNo,
      content,
      rating: ratingRaw === null ? null : (ratingRaw as number),
      writer,
      registeredAt,
    });
  }

  return { ok: true, reviews };
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    console.error('[cafe24/duplicate-check] 출처 검증 실패');
    return jsonResponse({ error: '잘못된 요청입니다.', code: 'forbidden_origin' }, 403);
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return jsonResponse({ error: admin.message, code: admin.code }, admin.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('요청 본문을 읽지 못했습니다.', 'invalid_json');
  }

  const validated = validateRequest(body);
  if (!validated.ok) {
    console.error('[cafe24/duplicate-check] 요청 검증 실패 code:', validated.code);
    return badRequest(validated.message, validated.code);
  }

  const existing = await fetchExistingReviewRecords();
  if (!existing.ok) {
    return cafe24FailureResponse(existing, '리뷰 게시글 조회');
  }

  // 게시판을 끝까지 확인하지 못했으면 신규 여부를 장담할 수 없으므로 전체를 실패로 돌립니다.
  if (existing.truncated) {
    return jsonResponse(
      {
        error:
          '기존 카페24 리뷰를 끝까지 확인하지 못해 중복 검사를 완료할 수 없습니다. 게시판 글이 조회 상한(8,000건)을 넘었습니다. 관리자에게 문의해 주세요.',
        code: 'scan_truncated',
        retryable: false,
      },
      409
    );
  }

  const results = runDuplicateCheck(validated.reviews, existing.reviews);

  const summary = { duplicate: 0, needsReview: 0, new: 0 };
  for (const result of results) {
    if (result.status === 'duplicate') summary.duplicate += 1;
    else if (result.status === 'needs_review') summary.needsReview += 1;
    else summary.new += 1;
  }

  return jsonResponse({
    ok: true,
    boardNo: existing.boardNo,
    scannedArticleCount: existing.scannedArticleCount,
    checkedReviewCount: results.length,
    summary,
    results,
    fetchedAt: new Date().toISOString(),
  });
}
