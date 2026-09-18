import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import { CAFE24_NO_STORE_HEADERS, cafe24FailureResponse } from '@/app/lib/cafe24/failureResponse';
import { fetchExistingReviewRecords, type AttachmentCaptureTarget } from '@/app/lib/cafe24/reviews';
import { isSameOrigin } from '@/app/lib/cafe24/sameOrigin';
import type { RegisterVerifyArticle } from '@/app/review-migration/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 등록 결과 확인 (읽기 전용).
 *
 * 게시판을 다시 읽어(GET) 이번에 등록한 리뷰글번호가 실제로 남아 있는지만 확인합니다.
 * 게시글을 만들거나 고치지 않고, 중복 검사도 다시 돌리지 않습니다.
 * (관리자 판정을 지우지 않기 위해 판정 결과를 건드리지 않습니다)
 *
 * includeArticleDetails를 넣으면 같은 목록 응답에서 그 게시글의 첨부 파일명·주소까지 읽어 돌려줍니다.
 * 카페24 공식 API에는 게시글 한 건을 번호로 조회하는 GET 상세 엔드포인트가 없고
 * article_no로 거르는 검색 파라미터도 문서에 없으므로,
 * 공식 목록 조회(GET /boards/{board_no}/articles)만 쓰고 서버 메모리에서 대상을 찾습니다.
 * 추가 요청이 없으므로 조회 횟수도 늘지 않습니다.
 */

const MAX_IDS = 500;
const MAX_ID_LENGTH = 64;

/** 첨부까지 확인할 수 있는 최대 건수. 시험 등록은 항상 1건입니다. */
const MAX_DETAIL_IDS = 3;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: CAFE24_NO_STORE_HEADERS });
}

function badRequest(message: string, code: string) {
  return jsonResponse({ error: message, code, retryable: false }, 400);
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    console.error('[cafe24/register-verify] 출처 검증 실패');
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

  const raw = (body as Record<string, unknown> | null)?.naverReviewIds;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_IDS) {
    return badRequest('확인할 리뷰글번호 목록이 올바르지 않습니다.', 'invalid_ids');
  }

  const includeArticleDetails =
    (body as Record<string, unknown> | null)?.includeArticleDetails === true;

  if (includeArticleDetails && raw.length > MAX_DETAIL_IDS) {
    return badRequest(
      `첨부까지 확인하는 조회는 한 번에 ${MAX_DETAIL_IDS}건까지만 가능합니다.`,
      'too_many_detail_ids'
    );
  }

  const requested: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    const value = typeof item === 'string' ? item.trim() : '';
    if (!value || value.length > MAX_ID_LENGTH) {
      return badRequest('리뷰글번호 형식이 올바르지 않습니다.', 'invalid_ids');
    }
    if (seen.has(value)) continue;
    seen.add(value);
    requested.push(value);
  }

  /**
   * 등록 응답이 알려 준 게시글번호.
   *
   * naverpay_review_id로 찾지 못했을 때만 쓰는 2순위 기준입니다.
   * 이 값으로 카페24에 검색 조건을 보내지는 않습니다. (문서에 없는 파라미터를 만들지 않습니다)
   */
  const articleNoHints = new Map<string, number>();

  if (includeArticleDetails) {
    const hints = (body as Record<string, unknown> | null)?.registeredArticleNos;

    if (hints !== undefined) {
      if (!Array.isArray(hints) || hints.length > MAX_DETAIL_IDS) {
        return badRequest('게시글번호 목록이 올바르지 않습니다.', 'invalid_article_nos');
      }

      for (const item of hints) {
        if (!item || typeof item !== 'object') {
          return badRequest('게시글번호 목록이 올바르지 않습니다.', 'invalid_article_nos');
        }

        const hint = item as Record<string, unknown>;
        const naverReviewId =
          typeof hint.naverReviewId === 'string' ? hint.naverReviewId.trim() : '';

        if (!seen.has(naverReviewId)) {
          return badRequest('확인 대상이 아닌 게시글번호가 있습니다.', 'invalid_article_nos');
        }

        const articleNo = hint.articleNo;
        if (typeof articleNo !== 'number' || !Number.isInteger(articleNo) || articleNo <= 0) {
          return badRequest('게시글번호 형식이 올바르지 않습니다.', 'invalid_article_nos');
        }

        articleNoHints.set(naverReviewId, articleNo);
      }
    }
  }

  /** 첨부까지 읽을 대상. 목록을 훑는 김에 함께 읽으므로 추가 요청이 없습니다. */
  const captureAttachmentsFor: AttachmentCaptureTarget[] = includeArticleDetails
    ? requested.map((naverReviewId) => ({
        naverReviewId,
        articleNo: articleNoHints.get(naverReviewId) ?? null,
      }))
    : [];

  const existing = await fetchExistingReviewRecords(
    captureAttachmentsFor.length > 0 ? { captureAttachmentsFor } : undefined
  );
  if (!existing.ok) {
    return cafe24FailureResponse(existing, '리뷰 게시글 조회');
  }

  // 게시판을 끝까지 읽지 못하면 "없다"고 단정할 수 없으므로 확인 결과를 내려주지 않습니다.
  if (existing.truncated) {
    return jsonResponse(
      {
        error:
          '기존 카페24 리뷰를 끝까지 확인하지 못해 등록 결과를 확인할 수 없습니다. 게시판 글이 조회 상한(8,000건)을 넘었습니다.',
        code: 'scan_truncated',
        retryable: false,
      },
      409
    );
  }

  const counts = new Map<string, number>();

  for (const record of existing.reviews) {
    if (!record.naverReviewId) continue;
    if (!seen.has(record.naverReviewId)) continue;
    counts.set(record.naverReviewId, (counts.get(record.naverReviewId) ?? 0) + 1);
  }

  const missingNaverReviewIds: string[] = [];
  const duplicatedNaverReviewIds: string[] = [];

  for (const naverReviewId of requested) {
    const count = counts.get(naverReviewId) ?? 0;
    if (count === 0) missingNaverReviewIds.push(naverReviewId);
    else if (count > 1) duplicatedNaverReviewIds.push(naverReviewId);
  }

  /**
   * 목록 응답에서 찾은 게시글의 첨부.
   * 첨부 항목을 하나도 읽지 못하면 attachmentsAvailable = false로 그대로 알립니다.
   */
  const articles: RegisterVerifyArticle[] | null = includeArticleDetails
    ? existing.capturedAttachments.map((captured) => ({
        naverReviewId: captured.naverReviewId,
        articleNo: captured.articleNo,
        matchedBy: captured.matchedBy,
        attachmentsAvailable: captured.attachments.length > 0,
        attachments: captured.attachments,
      }))
    : null;

  return jsonResponse({
    ok: true,
    boardNo: existing.boardNo,
    checkedAt: new Date().toISOString(),
    requestedCount: requested.length,
    foundCount: requested.length - missingNaverReviewIds.length,
    missingNaverReviewIds,
    duplicatedNaverReviewIds,
    ...(articles ? { articles } : {}),
  });
}

