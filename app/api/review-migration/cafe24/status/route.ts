import { NextResponse } from 'next/server';
import { adminGuardResponse, requireAdmin } from '@/app/lib/requireAdmin';
import { resolveMallId } from '@/app/lib/cafe24/config';
import { getConnectionStatus } from '@/app/lib/cafe24/tokenStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 카페24 연결 상태 조회.
 * 토큰을 복호화하지 않고, 화면 표시에 필요한 정보만 돌려줍니다.
 * 암호문·IV·tag·토큰은 절대 응답에 포함하지 않습니다.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return adminGuardResponse(admin);
  }

  const mallId = resolveMallId();
  if (!mallId) {
    console.error('[cafe24/status] 설정 오류: invalid_mall_id');
    return NextResponse.json(
      { error: '카페24 연동 설정이 올바르지 않습니다. 관리자에게 문의해 주세요.' },
      { status: 500 }
    );
  }

  const result = await getConnectionStatus(mallId);
  if (!result.ok) {
    console.error('[cafe24/status] 조회 실패:', result.reason);
    return NextResponse.json(
      { error: '연결 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }

  const row = result.data;
  if (!row) {
    return NextResponse.json({ connected: false, mallId });
  }

  return NextResponse.json({
    connected: true,
    mallId: row.mall_id,
    shopNo: row.shop_no,
    scopes: row.scopes ?? [],
    accessTokenExpiresAt: row.access_token_expires_at,
    refreshTokenExpiresAt: row.refresh_token_expires_at,
  });
}
