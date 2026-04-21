// app/api/auth/naver/callback/route.ts
// 역할: 네이버 로그인 콜백 처리 → 토큰 발급 → 프로필 조회 → Supabase 유저 생성/확인 → 리디렉션

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // request.url에서 현재 환경의 origin을 동적으로 추출
  // (로컬: http://localhost:3000 / 라이브: https://tmgad.com)
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const callbackUrl = `${origin}/api/auth/naver/callback`;
  // 에러 리디렉션용 baseUrl도 동일하게 사용
  const baseUrl = origin;

  // A. code, state 유효성 검사
  if (!code || !state) {
    console.error('[Naver Callback] code 또는 state 값이 없습니다.');
    return NextResponse.redirect(`${baseUrl}/?error=naver_auth_failed`);
  }

  try {
    // B. 네이버 Access Token 발급
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID!,
      client_secret: process.env.NAVER_CLIENT_SECRET!,
      code,
      state,
      redirect_uri: callbackUrl,
    });

    const tokenResponse = await fetch(
      `https://nid.naver.com/oauth2.0/token?${tokenParams.toString()}`,
      { method: 'GET' }
    );

    if (!tokenResponse.ok) {
      throw new Error(`네이버 토큰 발급 실패: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken: string = tokenData.access_token;

    if (!accessToken) {
      throw new Error('access_token이 응답에 없습니다.');
    }

    // C. 네이버 회원 프로필 조회 (이메일, 이름, 프로필 사진)
    const profileResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error(`네이버 프로필 조회 실패: ${profileResponse.status}`);
    }

    const profileData = await profileResponse.json();
    const naverProfile = profileData.response as {
      email: string;
      name: string;
      profile_image?: string;
      id: string;
    };

    const { email, name, profile_image, id: naverId } = naverProfile;

    if (!email) {
      throw new Error('네이버 프로필에서 이메일을 가져올 수 없습니다.');
    }

    // D. Supabase Admin 클라이언트 (Service Role Key)로 유저 확인/생성
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 기존 가입자 확인 (이메일 기준)
    const { data: existingUsers, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      throw new Error(`유저 목록 조회 실패: ${listError.message}`);
    }

    const existingUser = existingUsers.users.find(
      (u) => u.email === email
    );

    let userId: string;

    if (existingUser) {
      // 기존 유저: ID 재사용
      userId = existingUser.id;
    } else {
      // 신규 유저 생성
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            full_name: name,
            avatar_url: profile_image ?? '',
            provider: 'naver',
            naver_id: naverId,
          },
        });

      if (createError || !newUser.user) {
        throw new Error(`Supabase 유저 생성 실패: ${createError?.message}`);
      }

      userId = newUser.user.id;
    }

    // E. 매직링크(action_link)로 세션 쿠키를 자동으로 굽고 메인 페이지로 리디렉션
    // redirectTo를 명시해야 Supabase가 현재 환경(로컬/라이브)의 메인 페이지로 정확히 이동함
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          redirectTo: `${origin}/auth/naver/processing`,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[Naver Callback] 매직링크 생성 실패:', linkError?.message);
      // 링크 생성 실패 시 로그인 페이지로 안전하게 이동
      return NextResponse.redirect(`${baseUrl}/login`);
    }

    // Supabase가 직접 생성한 action_link로 리디렉션
    // → Supabase가 알아서 세션 쿠키를 굽고 메인 페이지로 이동시켜 줌
    return NextResponse.redirect(linkData.properties.action_link);

  } catch (error) {
    console.error('[Naver Callback Error]', error);
    return NextResponse.redirect(`${baseUrl}/?error=naver_auth_failed`);
  }
}
