import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/app/utils/supabase/server';

const ALLOWED_GRADES = ['free', 'starter', 'pro', 'agency'] as const;
type AllowedGrade = typeof ALLOWED_GRADES[number];

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
        // [보안 2단계] 요청자의 profiles.role이 'admin'인지 확인
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
        // [본 처리] 위 검증을 통과한 경우에만 등급 수정 실행
        // ============================================================
        const { userId, grade } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: '대상 유저 ID가 필요합니다.' }, { status: 400 });
        }

        // [보안 3단계] grade 허용값 화이트리스트 검증
        if (!ALLOWED_GRADES.includes(grade as AllowedGrade)) {
            return NextResponse.json({
                error: `허용되지 않은 등급입니다. 허용 값: ${ALLOWED_GRADES.join(', ')}`
            }, { status: 400 });
        }

        // service_role 클라이언트로 실제 업데이트 수행
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ grade })
            .eq('id', userId);

        if (updateError) {
            return NextResponse.json({ error: `등급 수정 실패: ${updateError.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('등급 수정 에러:', error);
        return NextResponse.json({ error: err.message ?? '알 수 없는 오류' }, { status: 500 });
    }
}
