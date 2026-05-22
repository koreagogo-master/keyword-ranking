import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// page_type → 한글 이름 매핑 (use-free-count/route.ts와 동일)
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
        const { pageType, keyword } = await request.json();

        const resolvedPageType =
            typeof pageType === 'string' && pageType.trim() ? pageType.trim() : 'UNKNOWN';
        const resolvedKeyword =
            typeof keyword === 'string' && keyword.trim() ? keyword.trim() : null;
        const resolvedPageName = PAGE_NAME_MAP[resolvedPageType] ?? null;

        // IP 추출: x-forwarded-for → x-real-ip → null (Cloud Run 환경 대응)
        const forwarded = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const ipAddress = (forwarded ? forwarded.split(',')[0].trim() : null) ?? realIp ?? null;

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: insertError } = await supabaseAdmin.from('free_usage_history').insert({
            user_type: 'guest',
            user_id: null,
            email: null,
            page_type: resolvedPageType,
            page_name: resolvedPageName,
            keyword: resolvedKeyword,
            summary: '비회원 무료 체험 사용',
            ip_address: ipAddress,
            remaining_free_count: null,
            status: 'success',
        });

        if (insertError) {
            console.error('비회원 free_usage_history insert 실패 (검색은 정상 처리됨):', insertError);
        }

        // insert 성공 여부와 무관하게 항상 200 반환 (검색 흐름을 막지 않기 위해)
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('비회원 무료 사용 기록 API 오류 (검색은 정상 처리됨):', error);
        return NextResponse.json({ ok: false }, { status: 200 });
    }
}
