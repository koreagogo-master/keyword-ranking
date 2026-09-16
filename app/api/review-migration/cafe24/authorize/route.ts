import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { adminGuardResponse, requireAdmin } from '@/app/lib/requireAdmin';
import {
  CAFE24_STATE_COOKIE,
  CAFE24_STATE_COOKIE_PATH,
  CAFE24_STATE_MAX_AGE_SECONDS,
  loadCafe24Config,
} from '@/app/lib/cafe24/config';
import { buildAuthorizeUrl } from '@/app/lib/cafe24/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 카페24 OAuth 인증 시작.
 * 관리자만 호출할 수 있고, CSRF 방지용 state를 만들어 httpOnly 쿠키에 저장한 뒤
 * 카페24 인증 화면으로 리디렉트합니다. state 값은 로그에 남기지 않습니다.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return adminGuardResponse(admin);
  }

  const loaded = loadCafe24Config();
  if (!loaded.ok) {
    console.error('[cafe24/authorize] 설정 오류:', loaded.reason);
    return NextResponse.json(
      { error: '카페24 연동 설정이 올바르지 않습니다. 관리자에게 문의해 주세요.' },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(32).toString('base64url');
  const response = NextResponse.redirect(buildAuthorizeUrl(loaded.config, state));

  response.cookies.set(CAFE24_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: CAFE24_STATE_MAX_AGE_SECONDS,
    path: CAFE24_STATE_COOKIE_PATH,
  });

  return response;
}
