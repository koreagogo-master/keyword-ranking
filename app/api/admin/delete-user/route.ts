import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
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