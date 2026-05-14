import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/app/utils/supabase/server';

export async function POST(request: Request) {
    try {
        // ============================================================
        // [보안 1단계] 요청 쿠키로 현재 로그인 사용자 확인
        // 브라우저가 보낸 쿠키에서 세션을 읽어 실제 로그인 여부를 서버에서 검증합니다.
        // ============================================================
        const supabaseServer = await createServerSupabaseClient();
        const { data: { user: requestingUser }, error: authError } = await supabaseServer.auth.getUser();

        if (authError || !requestingUser) {
            return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
        }

        // ============================================================
        // [보안 2단계] 요청자의 profiles.role이 'admin'인지 확인
        // body의 userId가 아닌, 실제 세션 사용자의 role을 조회합니다.
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
        // [본 처리] 위 검증을 통과한 경우에만 삭제 대상 userId로 회원 삭제 실행
        // ============================================================
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: '유저 ID가 필요합니다.' }, { status: 400 });
        }

        // 🌟 최고 관리자 키(SERVICE_ROLE_KEY)를 사용하여 유저 완벽 강제 삭제
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY! // .env 파일에 이 키가 꼭 세팅되어 있어야 합니다!
        );

        // 1단계: FK 제약 조건 방지를 위해 관련 테이블 데이터 먼저 삭제
        //        (point_history 등이 user_id 참조 시 CASCADE 없으면 삭제 불가)
        await supabaseAdmin.from('point_history').delete().eq('user_id', userId);

        // 2단계: auth.users 삭제 → public.profiles는 CASCADE로 자동 삭제
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) throw error;

        return NextResponse.json({ success: true, message: '강제 탈퇴가 완료되었습니다.' });
    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('유저 삭제 에러:', error);
        return NextResponse.json({ error: err.message ?? '알 수 없는 오류' }, { status: 500 });
    }
}