import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import { loadGoogleReviewFeed } from '@/app/lib/google-reviews/feedSource';
import { CAFE24_NO_STORE_HEADERS, cafe24FailureResponse } from '@/app/lib/cafe24/failureResponse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Google 상품평 피드 관리자 미리보기 (읽기 전용).
 *
 * - 관리자만 호출할 수 있고 GET만 제공합니다. 공개 피드 주소가 아닙니다.
 *   Google이 가져가는 주소는 Basic 인증을 쓰는 /google-product-reviews.xml입니다.
 * - 카페24 게시판을 읽기만 하고 게시글을 만들거나 고치지 않습니다.
 * - 기존 네이버 리뷰 업로드 경로와 코드를 공유하지 않습니다. (공통 호출기만 재사용)
 * - 게시판을 끝까지 읽지 못하면 일부 XML을 내보내지 않고 오류로 끊습니다.
 * - 로그에는 건수만 남깁니다. 리뷰 본문·작성자는 남기지 않습니다.
 *
 * 성공하면 Google Product Review Feeds 2.4 XML을 그대로 돌려줍니다.
 * 포함·제외 건수는 XML 맨 앞 주석으로 함께 보여 줍니다. (운영용 피드에는 넣지 않습니다)
 */

const LOG_LABEL = 'google-reviews/preview';

function errorJson(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status, headers: CAFE24_NO_STORE_HEADERS });
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.message },
      { status: admin.status, headers: CAFE24_NO_STORE_HEADERS }
    );
  }

  // 미리보기에서만 진단 주석을 함께 보여 줍니다.
  const loaded = await loadGoogleReviewFeed({ summaryComment: true, logLabel: LOG_LABEL });

  if (!loaded.ok) {
    switch (loaded.kind) {
      case 'config_error':
        return errorJson(
          '카페24 연동 설정이 올바르지 않습니다. 관리자에게 문의해 주세요.',
          'config_error',
          500
        );

      case 'store_error':
        return errorJson(
          '연결 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
          'store_error',
          500
        );

      case 'not_connected':
        return errorJson(
          '카페24가 아직 연결되지 않았습니다. 먼저 카페24를 연결해 주세요.',
          'not_connected',
          409
        );

      case 'reauth_required':
        return errorJson(
          '카페24 연결 정보를 확인할 수 없습니다. 연결을 해제한 뒤 다시 연결해 주세요.',
          'reauth_required',
          409
        );

      case 'incomplete_scan':
        return errorJson(
          `게시판을 끝까지 읽지 못해 피드를 만들지 않았습니다. (확인한 글 ${loaded.scannedArticleCount}건) 일부만 담긴 피드는 Google에서 삭제된 리뷰로 처리될 수 있어 중단했습니다.`,
          'incomplete_scan',
          502
        );

      default:
        return cafe24FailureResponse(loaded.failure, '리뷰 게시글 조회');
    }
  }

  return new NextResponse(loaded.feed.xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Robots-Tag': 'noindex',
      ...CAFE24_NO_STORE_HEADERS,
    },
  });
}
