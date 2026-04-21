// app/api/auth/naver/route.ts
// 역할: 네이버 OAuth 인증 페이지로 리디렉션

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_NAVER_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_NAVER_CLIENT_ID 환경변수가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  // Cloud Run 프록시 환경 대응: x-forwarded-host 헤더를 우선 사용
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const baseUrl = host.includes('tmgad.com') ? 'https://tmgad.com' : 'http://localhost:3000';
  const callbackUrl = `${baseUrl}/api/auth/naver/callback`;

  // CSRF 방지를 위한 state 값 (랜덤 문자열)
  const state = Math.random().toString(36).substring(2, 15);

  // 네이버 OAuth 인증 URL 구성
  const naverAuthUrl = new URL('https://nid.naver.com/oauth2.0/authorize');
  naverAuthUrl.searchParams.set('response_type', 'code');
  naverAuthUrl.searchParams.set('client_id', clientId);
  naverAuthUrl.searchParams.set('redirect_uri', callbackUrl);
  naverAuthUrl.searchParams.set('state', state);

  // 네이버 인증 페이지로 리디렉션
  return NextResponse.redirect(naverAuthUrl.toString());
}
