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
    const { data: { user: sessionUser }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !sessionUser) {
      return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 💡 핵심 수정: 빌드 에러 방지를 위해 DB 연결을 함수 내부로 이동했습니다!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') || null;

    const body = await request.json();
    const { paymentKey, orderId, amount, userId } = body;

    // ============================================================
    // [보안 2단계] body.userId와 세션 user.id 일치 여부 확인
    // body의 userId가 실제 로그인한 사용자와 다르면 403을 반환합니다.
    // 이로써 타인 계정에 포인트를 적립하는 것을 서버에서 차단합니다.
    // ============================================================
    if (userId && userId !== sessionUser.id) {
      return NextResponse.json({ success: false, message: '요청 사용자 정보가 일치하지 않습니다.' }, { status: 403 });
    }

    // 이후 모든 DB 작업은 body.userId가 아닌 세션의 실제 user.id를 사용합니다.
    const verifiedUserId = sessionUser.id;

    const secretKey = process.env.TOSS_SECRET_KEY || '';
    const encryptedSecretKey = Buffer.from(secretKey + ':').toString('base64');

    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encryptedSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ success: false, message: data.message }, { status: 400 });
    }

    const numAmount = Number(amount);
    let planId = 'starter';
    let basePoints = numAmount;
    let bonusPoints = 0;

    if (numAmount === 30000) {
      planId = 'pro';
      bonusPoints = 6000;
    } else if (numAmount === 50000) {
      planId = 'agency';
      bonusPoints = 10000;
    }

    await supabase.from('payments').insert({
      user_id: verifiedUserId,
      order_id: orderId,
      payment_key: paymentKey,
      plan_id: planId,
      amount: numAmount,
      status: 'DONE',
      method: data.method || '카드',
      receipt_url: data.receipt?.url || null
    });

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', verifiedUserId).single();
    if (profile) {
      await supabase.from('profiles').update({
        purchased_points: (profile.purchased_points || 0) + basePoints,
        bonus_points: (profile.bonus_points || 0) + bonusPoints,
        total_purchased_points: (profile.total_purchased_points || 0) + basePoints
      }).eq('id', verifiedUserId);
    }

    await supabase.from('point_history').insert({
      user_id: verifiedUserId,
      change_type: '충전',
      change_amount: basePoints + bonusPoints,
      page_type: '결제',
      description: `요금제 결제 (${planId.toUpperCase()})`,
      ip_address: ip
    });

    return NextResponse.json({ success: true, data: data });

  } catch (error) {
    console.error('결제 승인 및 DB 업데이트 에러:', error);
    return NextResponse.json({ success: false, message: '서버 통신 중 에러가 발생했습니다.' }, { status: 500 });
  }
}