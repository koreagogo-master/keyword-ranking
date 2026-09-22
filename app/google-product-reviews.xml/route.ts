import { NextResponse } from 'next/server';
import {
  FEED_AUTH_CHALLENGE,
  resolveFeedCredentials,
  verifyFeedBasicAuth,
} from '@/app/lib/google-reviews/feedAuth';
import { loadGoogleReviewFeed } from '@/app/lib/google-reviews/feedSource';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Google Merchant Center가 가져가는 상품평 피드 (읽기 전용).
 *
 *   https://tmgad.com/google-product-reviews.xml
 *
 * - 로그인 세션을 쓸 수 없는 경로라 HTTP Basic 인증으로 보호합니다.
 *   인증정보를 설정하지 않았으면 피드를 공개하지 않고 503으로 막습니다.
 * - 요청마다 카페24 게시판 전체를 다시 읽어 그 시점의 리뷰로 XML을 만듭니다.
 *   저장해 둔 스냅샷이 없으므로 오래된 리뷰가 나갈 일이 없습니다.
 * - 게시판을 끝까지 읽지 못하면 일부 XML을 내보내지 않고 오류로 끊습니다.
 * - 운영용 응답에는 진단 주석을 넣지 않습니다. (관리자 미리보기에만 넣습니다)
 * - 로그에는 건수만 남깁니다. 리뷰 본문·작성자·인증정보는 남기지 않습니다.
 */

const LOG_LABEL = 'google-reviews/feed';

/** 모든 응답에 붙이는 헤더. 중간 캐시가 오래된 리뷰를 돌려주지 않게 합니다. */
const FEED_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex',
} as const;

function textResponse(body: string, status: number, headers: Record<string, string> = {}) {
  return new NextResponse(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...FEED_HEADERS,
      ...headers,
    },
  });
}

export async function GET(request: Request) {
  const credentials = resolveFeedCredentials();

  /**
   * 인증정보가 없으면 인증 요구 헤더도 보내지 않습니다.
   * 아직 쓸 수 없는 주소라는 뜻이지, 인증을 시도하라는 뜻이 아니기 때문입니다.
   */
  if (!credentials) {
    console.error(`[${LOG_LABEL}] 피드 인증정보가 설정되지 않아 응답하지 않았습니다.`);
    return textResponse('Feed is not configured.', 503);
  }

  if (!verifyFeedBasicAuth(request.headers.get('authorization'), credentials)) {
    // 어느 쪽이 틀렸는지, 어떤 값이 들어왔는지는 남기지 않습니다.
    console.error(`[${LOG_LABEL}] 인증 실패`);
    return textResponse('Authentication required.', 401, {
      'WWW-Authenticate': FEED_AUTH_CHALLENGE,
    });
  }

  // 운영용 피드에는 진단 주석을 넣지 않습니다.
  const loaded = await loadGoogleReviewFeed({ summaryComment: false, logLabel: LOG_LABEL });

  if (!loaded.ok) {
    if (loaded.kind === 'incomplete_scan') {
      return textResponse('Review feed is temporarily incomplete.', 503);
    }

    if (loaded.kind === 'config_error') {
      return textResponse('Feed is not configured.', 503);
    }

    return textResponse('Review feed is temporarily unavailable.', 503);
  }

  return new NextResponse(loaded.feed.xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...FEED_HEADERS,
    },
  });
}
