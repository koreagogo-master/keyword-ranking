import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import { fetchReviewIdentifierStats } from '@/app/lib/cafe24/reviews';
import { CAFE24_NO_STORE_HEADERS, cafe24FailureResponse } from '@/app/lib/cafe24/failureResponse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 기존 카페24 리뷰의 naverpay_review_id 보관 현황 확인 (읽기 전용).
 *
 * - 관리자만 호출할 수 있고 GET만 제공합니다.
 * - 게시글을 만들거나 고치지 않습니다.
 * - 응답에는 통계만 담습니다. 리뷰 본문·작성자·주문번호·naverpay_review_id 값은
 *   응답에도 로그에도 남기지 않습니다.
 *
 * 성공 응답:
 *   { boardNo, totalArticles, articlesWithNaverReviewId,
 *     articlesWithoutNaverReviewId, coveragePercent, fetchedAt, truncated }
 *
 * 이 결과로 기존 리뷰에 식별자가 얼마나 남아 있는지 확인하고
 * 다음 단계의 중복 검사 방식을 결정합니다.
 */

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.message },
      { status: admin.status, headers: CAFE24_NO_STORE_HEADERS }
    );
  }

  const result = await fetchReviewIdentifierStats();
  if (!result.ok) {
    return cafe24FailureResponse(result, '리뷰 게시글 조회');
  }

  return NextResponse.json(
    {
      boardNo: result.boardNo,
      totalArticles: result.totalArticles,
      articlesWithNaverReviewId: result.articlesWithNaverReviewId,
      articlesWithoutNaverReviewId: result.articlesWithoutNaverReviewId,
      coveragePercent: result.coveragePercent,
      fetchedAt: new Date().toISOString(),
      // 8,000건 상한에 걸려 일부만 확인한 경우 true
      truncated: result.truncated,
    },
    { headers: CAFE24_NO_STORE_HEADERS }
  );
}
