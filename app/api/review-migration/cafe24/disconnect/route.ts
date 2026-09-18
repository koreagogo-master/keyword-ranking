import { NextResponse, type NextRequest } from 'next/server';
import { adminGuardResponse, requireAdmin } from '@/app/lib/requireAdmin';
import { loadCafe24Config } from '@/app/lib/cafe24/config';
import { revokeAccessToken } from '@/app/lib/cafe24/oauth';
import { isSameOrigin } from '@/app/lib/cafe24/sameOrigin';
import { buildAad, decryptToken, deleteTokenRow, getTokenRow } from '@/app/lib/cafe24/tokenStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 연결 해제. POST만 허용합니다. 토큰 값은 응답·로그에 담지 않습니다. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    console.error('[cafe24/disconnect] 출처 검증 실패');
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 403 });
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return adminGuardResponse(admin);
  }

  const loaded = loadCafe24Config();
  if (!loaded.ok) {
    console.error('[cafe24/disconnect] 설정 오류:', loaded.reason);
    return NextResponse.json(
      { error: '카페24 연동 설정이 올바르지 않습니다. 관리자에게 문의해 주세요.' },
      { status: 500 }
    );
  }
  const config = loaded.config;

  const found = await getTokenRow(config.mallId);
  if (!found.ok) {
    console.error('[cafe24/disconnect] 조회 실패:', found.reason);
    return NextResponse.json(
      { error: '연결 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }

  const row = found.data;
  if (!row) {
    // 이미 연결이 없는 상태이므로 성공으로 처리합니다.
    return NextResponse.json({ connected: false, revoked: false });
  }

  // 가능하면 access token을 복호화해 카페24에 폐기를 요청합니다.
  const accessToken =
    row.key_version === 1
      ? decryptToken(
          { ct: row.access_token_ct, iv: row.access_token_iv, tag: row.access_token_tag },
          config.encryptionKey,
          buildAad(row.mall_id, row.shop_no, 'access')
        )
      : null;

  let revoked = false;

  if (accessToken) {
    const result = await revokeAccessToken(config, accessToken);

    if (!result.ok && result.retryable) {
      // 네트워크·일시 장애로 보이므로 행을 남겨 두고 재시도할 수 있게 합니다.
      console.error('[cafe24/disconnect] 폐기 실패(재시도 가능)');
      return NextResponse.json(
        { error: '카페24에 연결 해제를 요청하지 못했습니다. 잠시 후 다시 시도해 주세요.', retryable: true },
        { status: 503 }
      );
    }

    if (!result.ok) {
      console.error('[cafe24/disconnect] 폐기 실패 status:', result.status, 'code:', result.code ?? '-');
      return NextResponse.json(
        { error: '카페24가 연결 해제 요청을 거절했습니다. 잠시 후 다시 시도해 주세요.', retryable: false },
        { status: 502 }
      );
    }

    // 폐기 성공 또는 '이미 폐기됨'이 확인된 경우에만 로컬 행을 지웁니다.
    revoked = !result.alreadyRevoked;
  } else {
    // 복호화에 실패하면 이 토큰은 더 이상 사용할 수 없으므로 로컬 행만 정리합니다.
    console.error('[cafe24/disconnect] access token 복호화 실패 — 로컬 연결 정보만 삭제합니다.');
  }

  const deleted = await deleteTokenRow(row.mall_id, row.shop_no);
  if (!deleted.ok) {
    console.error('[cafe24/disconnect] 삭제 실패:', deleted.reason);
    return NextResponse.json(
      { error: '연결 정보를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.', retryable: true },
      { status: 500 }
    );
  }

  return NextResponse.json({ connected: false, revoked });
}
