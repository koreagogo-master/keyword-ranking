import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/app/utils/supabase/server';

// KST 기준 오늘 날짜 문자열 (usePoint.ts와 동일한 로직)
const getKSTDateString = () => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kst = new Date(utc + (9 * 3600000));
    return kst.toISOString().split('T')[0];
};

export async function POST(request: Request) {
    try {
        // ============================================================
        // [보안 1단계] 요청 쿠키로 현재 로그인 사용자 확인
        // ============================================================
        const supabaseServer = await createServerSupabaseClient();
        const { data: { user: sessionUser }, error: authError } = await supabaseServer.auth.getUser();

        if (authError || !sessionUser) {
            return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
        }

        // ============================================================
        // [본 처리] body 파싱 및 검증
        // ============================================================
        const { userId, itemCount } = await request.json();

        // [보안 2단계] body의 userId와 세션 user.id 일치 검증
        // 자신의 무료 횟수만 차감할 수 있습니다.
        if (!userId || userId !== sessionUser.id) {
            return NextResponse.json({ error: '본인 계정만 사용할 수 있습니다.' }, { status: 403 });
        }

        // [보안 3단계] itemCount 유효성 검증: 1 이상의 정수만 허용
        const count = Number(itemCount);
        if (!Number.isInteger(count) || count < 1) {
            return NextResponse.json({ error: '유효하지 않은 횟수입니다. 1 이상의 정수를 입력해주세요.' }, { status: 400 });
        }

        // service_role 클라이언트로 profiles 조회 및 업데이트
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('free_search_count, last_free_reset_date')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: '사용자 정보를 불러올 수 없습니다.' }, { status: 500 });
        }

        const today = getKSTDateString();
        let currentFreeCount = profile.free_search_count ?? 0;
        let lastResetDate = profile.last_free_reset_date;

        // 날짜가 바뀐 경우 무료 횟수를 5로 초기화
        if (lastResetDate !== today) {
            currentFreeCount = 5;
            lastResetDate = today;
        }

        // 무료 횟수가 충분한 경우: 차감 후 저장
        if (currentFreeCount >= count) {
            const newCount = currentFreeCount - count;

            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({
                    free_search_count: newCount,
                    last_free_reset_date: lastResetDate,
                })
                .eq('id', userId);

            if (updateError) {
                return NextResponse.json({ error: `무료 횟수 차감 실패: ${updateError.message}` }, { status: 500 });
            }

            return NextResponse.json({ success: true, newCount });
        }

        // 무료 횟수 부족: 날짜가 바뀐 경우 초기화 상태는 저장해 둠
        if (profile.last_free_reset_date !== today) {
            await supabaseAdmin
                .from('profiles')
                .update({
                    free_search_count: 5,
                    last_free_reset_date: today,
                })
                .eq('id', userId);
        }

        return NextResponse.json({ success: false, reason: 'exhausted' });

    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('무료 횟수 차감 에러:', error);
        return NextResponse.json({ error: err.message ?? '알 수 없는 오류' }, { status: 500 });
    }
}
