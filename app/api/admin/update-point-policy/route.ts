import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/app/utils/supabase/server';

// PAGE_META와 동일한 page_type 화이트리스트
const ALLOWED_PAGE_TYPES = new Set([
  'ANALYSIS',
  'RELATED',
  'BLOG',
  'INDEX_CHECK',
  'JISIKIN',
  'TOTAL',
  'KEYWORD_VOLUME',
  'KEYWORD_GENERATOR',
  'PLACE_RANK',
  'AI_BLOG',
  'AI_PRESS',
  'REVIEW_AI',
  'POST_XRAY',
  'AI_INSIGHT',
  'SHOPPING',
  'SEO_TITLE',
  'SEO_CHECK',
  'SHOPPING_RANK',
  'GOOGLE',
  'YOUTUBE',
]);

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
    const { page_type, point_cost } = body;

    // page_type 화이트리스트 검증
    if (!page_type || !ALLOWED_PAGE_TYPES.has(page_type)) {
      return NextResponse.json({ error: '허용되지 않는 page_type입니다.' }, { status: 400 });
    }

    // point_cost 숫자 및 0 이상 정수 검증
    if (
      typeof point_cost !== 'number' ||
      !Number.isInteger(point_cost) ||
      point_cost < 0
    ) {
      return NextResponse.json({ error: 'point_cost는 0 이상의 정수여야 합니다.' }, { status: 400 });
    }

    // ============================================================
    // [본 처리] 검증 통과 후 service_role 클라이언트로 DB 업데이트
    // ============================================================
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: updateError } = await supabaseAdmin
      .from('point_policies')
      .update({ point_cost })
      .eq('page_type', page_type);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('포인트 단가 업데이트 에러:', error);
    return NextResponse.json({ error: err.message ?? '알 수 없는 오류' }, { status: 500 });
  }
}
