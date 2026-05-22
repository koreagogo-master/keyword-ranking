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

// page_type → 한글 이름 매핑 (free_usage_history.page_name 용)
const PAGE_NAME_MAP: Record<string, string> = {
    'ANALYSIS': '키워드 정밀 분석',
    'RELATED': '연관 키워드 조회',
    'BLOG': '블로그 순위 확인',
    'INDEX_CHECK': '블로그 노출 진단',
    'JISIKIN': '지식인 순위 확인',
    'TOTAL': '통검 노출/순위 확인',
    'GOOGLE': '구글 키워드 분석',
    'YOUTUBE': '유튜브 트렌드',
    'SHOPPING': '쇼핑 인사이트',
    'SHOPPING_RANK': '상품 노출 순위 분석',
    'SEO_TITLE': '쇼핑 상품명 최적화',
    'SEO_CHECK': '내 상품명 진단',
    'KEYWORD_VOLUME': '키워드별 조회수',
    'PLACE_RANK': '플레이스 순위 조회',
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
        const { userId, itemCount, pageType, keyword } = await request.json();

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

            // ============================================================
            // [기록] 무료 사용 성공 시 free_usage_history insert
            // insert 실패가 발생해도 검색 자체는 막지 않습니다.
            // ============================================================
            try {
                const resolvedPageType = (typeof pageType === 'string' && pageType.trim()) ? pageType.trim() : 'UNKNOWN';
                const resolvedKeyword = (typeof keyword === 'string' && keyword.trim()) ? keyword.trim() : null;
                const resolvedPageName = PAGE_NAME_MAP[resolvedPageType] ?? null;

                // IP 추출: x-forwarded-for → x-real-ip → null 순서
                const forwarded = request.headers.get('x-forwarded-for');
                const realIp = request.headers.get('x-real-ip');
                const ipAddress = (forwarded ? forwarded.split(',')[0].trim() : null) ?? realIp ?? null;

                const { error: insertError } = await supabaseAdmin.from('free_usage_history').insert({
                    user_type: 'member',
                    user_id: sessionUser.id,
                    email: sessionUser.email ?? null,
                    page_type: resolvedPageType,
                    page_name: resolvedPageName,
                    keyword: resolvedKeyword,
                    summary: `회원 무료 검색 ${count}회 사용`,
                    ip_address: ipAddress,
                    remaining_free_count: newCount,
                    status: 'success',
                });
                if (insertError) {
                    console.error('free_usage_history insert 실패 (검색은 정상 처리됨):', insertError);
                }
            } catch (insertErr) {
                console.error('free_usage_history insert 예외 발생 (검색은 정상 처리됨):', insertErr);
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
