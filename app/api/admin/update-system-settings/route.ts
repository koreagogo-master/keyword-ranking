import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/app/utils/supabase/server';

const MAX_THRESHOLD = 1_000_000;

function isValidThreshold(value: unknown): boolean {
  let num: number;
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string' && /^\d+$/.test(value)) {
    num = Number(value);
  } else {
    return false;
  }
  return Number.isInteger(num) && num >= 0 && num <= MAX_THRESHOLD;
}

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
    // [보안 3단계] 요청 body 검증 — 허용된 2개 키만 고정 처리
    // 임의 setting_key를 body로 받아 그대로 upsert하지 않습니다.
    // ============================================================
    const body = await request.json();
    const { alert_threshold_low, alert_threshold_mid } = body;

    if (!isValidThreshold(alert_threshold_low)) {
      return NextResponse.json(
        { error: 'alert_threshold_low는 0 이상 1,000,000 이하의 정수여야 합니다.' },
        { status: 400 }
      );
    }

    if (!isValidThreshold(alert_threshold_mid)) {
      return NextResponse.json(
        { error: 'alert_threshold_mid는 0 이상 1,000,000 이하의 정수여야 합니다.' },
        { status: 400 }
      );
    }

    // ============================================================
    // [본 처리] 검증 통과 후 service_role 클라이언트로 upsert
    // 허용된 2개 setting_key만 고정으로 upsert합니다.
    // ============================================================
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: upsertError } = await supabaseAdmin
      .from('system_settings')
      .upsert([
        { setting_key: 'alert_threshold_low', setting_value: String(alert_threshold_low) },
        { setting_key: 'alert_threshold_mid', setting_value: String(alert_threshold_mid) },
      ], { onConflict: 'setting_key' });

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('시스템 설정 업데이트 에러:', error);
    return NextResponse.json({ error: err.message ?? '알 수 없는 오류' }, { status: 500 });
  }
}
