import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // 💡 데이터베이스 연결 도구 추가

// 💡 관리자 권한으로 Supabase 연결 (RLS 보안 규칙 무시하고 강제 기록)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // 💡 프론트엔드에서 넘겨준 userId 받기
    const { paymentKey, orderId, amount, userId } = body;

    // 1. 토스 결제 승인 요청
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

    // ==========================================
    // 🚀 2. 결제 성공! 이제 3개 장부에 꼼꼼히 기록합니다.
    // ==========================================
    if (!userId) throw new Error('사용자 ID가 없습니다.');

    const numAmount = Number(amount);
    let planId = 'starter';
    let basePoints = numAmount; // 결제 금액 1:1 비율
    let bonusPoints = 0;

    // 요금제별 보너스 포인트 자동 계산기
    if (numAmount === 30000) {
      planId = 'pro';
      bonusPoints = 6000;
    } else if (numAmount === 50000) {
      planId = 'agency';
      bonusPoints = 10000;
    }

    // [장부 1] payments 테이블 (관리자용 결제 내역) 추가
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

    // [장부 2] profiles 테이블 (유저의 현재 포인트 지갑) 업데이트
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profile) {
      await supabase.from('profiles').update({
        purchased_points: (profile.purchased_points || 0) + basePoints,
        bonus_points: (profile.bonus_points || 0) + bonusPoints,
        total_purchased_points: (profile.total_purchased_points || 0) + basePoints
      }).eq('id', userId);
    }

    // [장부 3] point_history 테이블 (마이페이지 이용 내역) 추가
    await supabase.from('point_history').insert({
      user_id: userId,
      change_type: '충전',
      change_amount: basePoints + bonusPoints,
      page_type: '결제',
      description: `요금제 결제 (${planId.toUpperCase()})`
    });

    return NextResponse.json({ success: true, data: data });

  } catch (error) {
    console.error('결제 승인 및 DB 업데이트 에러:', error);
    return NextResponse.json({ success: false, message: '서버 통신 중 에러가 발생했습니다.' }, { status: 500 });
  }
}