import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/app/utils/supabase/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ANSWER_LENGTH = 5000;

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
    const { inquiryId, answerText } = body;

    // inquiryId UUID 형식 검증
    if (!inquiryId || typeof inquiryId !== 'string' || !UUID_REGEX.test(inquiryId)) {
      return NextResponse.json({ error: '유효하지 않은 inquiryId 형식입니다.' }, { status: 400 });
    }

    // answerText 문자열 및 비어 있지 않음 검증
    if (typeof answerText !== 'string' || answerText.trim() === '') {
      return NextResponse.json({ error: '답변 내용을 입력해 주세요.' }, { status: 400 });
    }

    // answerText 길이 제한
    if (answerText.trim().length > MAX_ANSWER_LENGTH) {
      return NextResponse.json(
        { error: `답변은 ${MAX_ANSWER_LENGTH.toLocaleString()}자 이하여야 합니다.` },
        { status: 400 }
      );
    }

    // ============================================================
    // [본 처리] 검증 통과 후 service_role 클라이언트로 update
    // ============================================================
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('inquiries')
      .update({
        answer: answerText.trim(),
        status: '답변완료',
        answered_at: now,
      })
      .eq('id', inquiryId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, answered_at: now });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('문의 답변 저장 에러:', error);
    return NextResponse.json({ error: err.message ?? '알 수 없는 오류' }, { status: 500 });
  }
}
