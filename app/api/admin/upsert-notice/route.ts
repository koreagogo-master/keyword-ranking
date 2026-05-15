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
    // [보안 3단계] 요청 body 검증
    // ============================================================
    const body = await request.json();
    const { id, title, content, is_pinned, created_at } = body;

    // id가 있으면 UUID 형식 검증
    if (id !== undefined && id !== null) {
      if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
        return NextResponse.json({ error: '유효하지 않은 id 형식입니다.' }, { status: 400 });
      }
    }

    // title 검증: 문자열, 비어 있지 않음, 150자 이하
    if (typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: '제목을 입력해 주세요.' }, { status: 400 });
    }
    if (title.trim().length > 150) {
      return NextResponse.json({ error: '제목은 150자 이하여야 합니다.' }, { status: 400 });
    }

    // content 검증: 문자열, 비어 있지 않음
    if (typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json({ error: '내용을 입력해 주세요.' }, { status: 400 });
    }

    // is_pinned 검증: boolean
    if (typeof is_pinned !== 'boolean') {
      return NextResponse.json({ error: 'is_pinned는 true 또는 false여야 합니다.' }, { status: 400 });
    }

    // created_at 검증: 유효한 날짜 문자열
    if (typeof created_at !== 'string' || isNaN(Date.parse(created_at))) {
      return NextResponse.json({ error: '유효하지 않은 날짜 형식입니다.' }, { status: 400 });
    }

    const submitDate = new Date(created_at).toISOString();

    // ============================================================
    // [본 처리] 검증 통과 후 service_role 클라이언트로 insert/update
    // ============================================================
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (id) {
      // id가 있으면 수정(update)
      const { error: updateError } = await supabaseAdmin
        .from('notices')
        .update({ title: title.trim(), content: content.trim(), is_pinned, created_at: submitDate })
        .eq('id', id);

      if (updateError) throw updateError;
    } else {
      // id가 없으면 등록(insert)
      const { error: insertError } = await supabaseAdmin
        .from('notices')
        .insert({ title: title.trim(), content: content.trim(), is_pinned, created_at: submitDate });

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('공지사항 저장 에러:', error);
    return NextResponse.json({ error: err.message ?? '알 수 없는 오류' }, { status: 500 });
  }
}
