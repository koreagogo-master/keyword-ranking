import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // 💡 핵심 수정: 빌드 에러 방지를 위해 DB 연결을 함수 내부로 이동했습니다!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') || null;

    const body = await request.json();
    const { paymentKey, orderId, amount, userId } = body;

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

    if (!userId) throw new Error('사용자 ID가 없습니다.');

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
      user_id: userId,
      order_id: orderId,
      payment_key: paymentKey,
      plan_id: planId,
      amount: numAmount,
      status: 'DONE',
      method: data.method || '카드',
      receipt_url: data.receipt?.url || null
    });

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profile) {
      await supabase.from('profiles').update({
        purchased_points: (profile.purchased_points || 0) + basePoints,
        bonus_points: (profile.bonus_points || 0) + bonusPoints,
        total_purchased_points: (profile.total_purchased_points || 0) + basePoints
      }).eq('id', userId);
    }

    await supabase.from('point_history').insert({
      user_id: userId,
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