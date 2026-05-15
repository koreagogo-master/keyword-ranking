import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/app/utils/supabase/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    // ============================================================
    // [보안 1단계] 요청 쿠키로 현재 로그인 사용자 확인
    // ============================================================
    const supabaseServer = await createServerSupabaseClient();
    const { data: { user: requestingUser }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !requestingUser) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // ============================================================
    // [보안 2단계] profiles.role이 'admin'인지 서버에서 검증
    // ============================================================
    const { data: requestingProfile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', requestingUser.id)
      .single();

    if (profileError || !requestingProfile || requestingProfile.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    // ============================================================
    // [보안 3단계] 요청 body 검증 — id UUID 형식 확인
    // ============================================================
    const { id } = await request.json();

    if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: '유효하지 않은 id 형식입니다.' }, { status: 400 });
    }

    // ============================================================
    // [본 처리] 검증 통과 후 service_role 클라이언트로 delete
    // ============================================================
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: deleteError } = await supabaseAdmin
      .from('notices')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('공지사항 삭제 에러:', error);
    return NextResponse.json({ error: err.message ?? '알 수 없는 오류' }, { status: 500 });
  }
}
