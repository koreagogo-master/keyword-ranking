import { NextResponse } from 'next/server';
import {
  REFRESH_TOKEN_HEADER,
  resolveRefreshToken,
  verifyRefreshToken,
} from '@/app/lib/google-reviews/refreshAuth';
import { refreshGoogleReviewFeedSnapshot } from '@/app/lib/google-reviews/refreshSnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 예약 스냅샷 갱신 (Cloud Scheduler 전용).
 *
 *   POST https://tmgad.com/api/google-reviews/snapshot/refresh
 *   X-Feed-Refresh-Token: <GOOGLE_REVIEW_FEED_REFRESH_TOKEN>
 *
 * - Cloud Run 서비스가 --allow-unauthenticated라 자체 공유 비밀로 보호합니다.
 * - Cloud Scheduler는 교차 출처이므로 isSameOrigin()을 적용하지 않습니다.
 *   대신 GET을 제공하지 않고 토큰 헤더가 있는 POST만 받습니다.
 * - source는 항상 'scheduled'이고 force는 항상 false입니다.
 *   예약 경로에서는 리뷰 수 급감 검사를 **우회할 수 없습니다.**
 * - 갱신이 실패해도 직전 정상 스냅샷은 그대로 제공됩니다.
 * - 응답과 로그에는 건수와 짧은 코드만 남깁니다.
 */

const LOG_LABEL = 'google-reviews/snapshot-refresh';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const expected = resolveRefreshToken();

  /**
   * 토큰을 설정하지 않았으면 인증을 시도하라고 안내하지 않습니다.
   * 아직 쓸 수 없는 주소라는 뜻이기 때문입니다.
   */
  if (!expected) {
    console.error(`[${LOG_LABEL}] 갱신 토큰이 설정되지 않아 실행하지 않았습니다.`);
    return json({ error: 'not_configured' }, 503);
  }

  if (!verifyRefreshToken(request.headers.get(REFRESH_TOKEN_HEADER), expected)) {
    // 어떤 값이 들어왔는지는 남기지 않습니다.
    console.error(`[${LOG_LABEL}] 인증 실패`);
    return json({ error: 'unauthorized' }, 401);
  }

  const result = await refreshGoogleReviewFeedSnapshot({
    source: 'scheduled',
    force: false,
    createdBy: null,
  });

  if (!result.ok) {
    /**
     * 잠금 실패는 오류가 아닙니다. 다른 갱신이 이미 같은 일을 하고 있다는 뜻이라
     * Cloud Scheduler가 재시도하지 않도록 409로 구분해 돌려줍니다.
     */
    if (result.kind === 'locked') {
      return json({ ok: false, code: 'locked' }, 409);
    }

    return json({ ok: false, code: result.errorKind }, 502);
  }

  return json(
    {
      ok: true,
      reviewCount: result.snapshot.reviewCount,
      excludedCount: result.snapshot.excludedCount,
      byteSize: result.snapshot.byteSize,
      generatedAt: result.snapshot.generatedAt,
    },
    200
  );
}
