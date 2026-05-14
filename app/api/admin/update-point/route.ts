import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/app/utils/supabase/server';

// 수정 가능한 포인트 컬럼을 화이트리스트로 고정합니다.
// 이 목록 외의 컬럼은 어떤 요청이 와도 서버에서 거부합니다.
const ALLOWED_COLUMNS = ['purchased_points', 'bonus_points', 'total_purchased_points'] as const;
type AllowedColumn = typeof ALLOWED_COLUMNS[number];

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
        // [본 처리] 위 검증을 통과한 경우에만 포인트 수정 실행
        // body의 userId는 포인트를 수정할 대상 회원 ID입니다.
        // ============================================================
        const { userId, column, newVal, label, memo } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: '대상 유저 ID가 필요합니다.' }, { status: 400 });
        }

        // [보안 3단계] 컬럼 화이트리스트 검증
        // 허용된 컬럼 외에는 어떤 값도 처리하지 않습니다.
        if (!ALLOWED_COLUMNS.includes(column as AllowedColumn)) {
            return NextResponse.json({
                error: `허용되지 않은 컬럼입니다. 허용 컬럼: ${ALLOWED_COLUMNS.join(', ')}`
            }, { status: 400 });
        }

        // [보안 4단계] 포인트 값 유효성 검증
        if (typeof newVal !== 'number' || isNaN(newVal) || newVal < 0) {
            return NextResponse.json({ error: '유효하지 않은 포인트 값입니다. 0 이상의 숫자를 입력해주세요.' }, { status: 400 });
        }

        // SUPABASE_SERVICE_ROLE_KEY는 실제 DB 처리에만 사용합니다.
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 현재 DB 값을 서버에서 직접 조회하여 diff를 계산합니다.
        // 클라이언트가 전달한 currentVal을 신뢰하지 않습니다.
        const { data: targetProfile, error: fetchError } = await supabaseAdmin
            .from('profiles')
            .select(column)
            .eq('id', userId)
            .single();

        if (fetchError || !targetProfile) {
            return NextResponse.json({ error: '대상 회원을 찾을 수 없습니다.' }, { status: 404 });
        }

        const currentVal = Number((targetProfile as unknown as Record<string, unknown>)[column]) || 0;
        const diff = newVal - currentVal;

        if (diff === 0) {
            return NextResponse.json({ success: true, message: '변경 사항이 없습니다.' });
        }

        // profiles 테이블 포인트 컬럼 업데이트
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ [column]: newVal })
            .eq('id', userId);

        if (updateError) {
            return NextResponse.json({ error: `포인트 수정 실패: ${updateError.message}` }, { status: 500 });
        }

        // point_history에 관리자 수동 수정 내역 기록
        const { error: historyError } = await supabaseAdmin.from('point_history').insert({
            user_id: userId,
            change_type: diff > 0 ? 'CHARGE' : 'USE',
            change_amount: diff,
            page_type: 'MANUAL',
            description: `[관리자 조정] ${label} : ${currentVal.toLocaleString()} -> ${newVal.toLocaleString()} | ${memo || '사유 없음'}`
        });

        if (historyError) {
            return NextResponse.json({
                error: `포인트는 변경되었지만 내역 기록에 실패했습니다: ${historyError.message}`
            }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('포인트 수정 에러:', error);
        return NextResponse.json({ error: err.message ?? '알 수 없는 오류' }, { status: 500 });
    }
}
