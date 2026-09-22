import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import { CAFE24_NO_STORE_HEADERS } from '@/app/lib/cafe24/failureResponse';
import { readLatestReadyMeta, readRecentRuns } from '@/app/lib/google-reviews/snapshotStore';
import { resolveMaxAgeHours, snapshotAgeHours } from '@/app/lib/google-reviews/snapshotConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Google 상품평 피드 스냅샷 상태 (관리자 전용, 읽기 전용).
 *
 * 갱신 실패는 사용자에게 아무 증상도 만들지 않습니다. 피드는 계속 잘 나오니까요.
 * 스냅샷이 조용히 늙는 것을 알아챌 수 있는 유일한 수단이라 이 라우트를 둡니다.
 *
 * xml 컬럼은 읽지 않습니다. 메타데이터와 실행 이력만 돌려줍니다.
 * exclusions에는 고정 라벨과 건수만 들어 있어 리뷰 본문·작성자가 노출되지 않습니다.
 */

const RECENT_RUN_LIMIT = 10;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.message, code: admin.code },
      { status: admin.status, headers: CAFE24_NO_STORE_HEADERS }
    );
  }

  const [latest, runs] = await Promise.all([readLatestReadyMeta(), readRecentRuns(RECENT_RUN_LIMIT)]);

  if (!latest.ok) {
    return NextResponse.json(
      { error: '스냅샷 상태를 불러오지 못했습니다.', code: latest.reason },
      { status: 500, headers: CAFE24_NO_STORE_HEADERS }
    );
  }

  const maxAgeHours = resolveMaxAgeHours();
  const ageHours = latest.data ? snapshotAgeHours(latest.data.generatedAt) : null;

  return NextResponse.json(
    {
      ok: true,
      maxAgeHours,
      current: latest.data
        ? {
            generatedAt: latest.data.generatedAt,
            reviewCount: latest.data.reviewCount,
            excludedCount: latest.data.excludedCount,
            verifiedPurchaseCount: latest.data.verifiedPurchaseCount,
            scannedArticleCount: latest.data.scannedArticleCount,
            byteSize: latest.data.byteSize,
            boardNo: latest.data.boardNo,
            source: latest.data.source,
            exclusions: latest.data.exclusions,
            ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
            stale: ageHours !== null && ageHours > maxAgeHours,
          }
        : null,
      // 이력 조회가 실패해도 현재 상태 표시는 막지 않습니다.
      recentRuns: runs.ok ? runs.data : [],
    },
    { headers: CAFE24_NO_STORE_HEADERS }
  );
}
