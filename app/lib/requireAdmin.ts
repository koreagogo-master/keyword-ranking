import { NextResponse } from 'next/server';
import { createClient as createServerSupabaseClient } from '@/app/utils/supabase/server';

/**
 * 관리자 검증 공통 헬퍼.
 *
 * 기존 관리자 API(app/api/admin/toggle-pin/route.ts)와 같은 기준을 사용합니다.
 *  1) 요청 쿠키의 세션으로 auth.getUser() 확인
 *  2) 해당 사용자의 profiles.role을 서버에서 직접 조회
 *  3) role을 소문자로 바꿔 'admin'과 비교
 *
 * 요청 body/query로 전달된 사용자 ID·role은 절대 사용하지 않습니다.
 */

export type AdminGuardFailure = {
  ok: false;
  status: 401 | 403;
  /** 사용자 화면에 그대로 보여 줄 수 있는 한국어 메시지 */
  message: string;
  /** 리디렉트 URL 등에 붙일 수 있는 짧고 민감하지 않은 코드 */
  code: 'unauthorized' | 'forbidden';
};

export type AdminGuardResult = { ok: true; userId: string } | AdminGuardFailure;

export async function requireAdmin(): Promise<AdminGuardResult> {
  const supabaseServer = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabaseServer.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, message: '로그인이 필요합니다.', code: 'unauthorized' };
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role?.toLowerCase() !== 'admin') {
    return { ok: false, status: 403, message: '관리자 권한이 필요합니다.', code: 'forbidden' };
  }

  return { ok: true, userId: user.id };
}

/** 관리자 검증 실패를 JSON 응답으로 변환합니다. */
export function adminGuardResponse(failure: AdminGuardFailure) {
  return NextResponse.json({ error: failure.message }, { status: failure.status });
}
