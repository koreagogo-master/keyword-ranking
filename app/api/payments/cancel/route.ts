import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 관리자 권한으로 DB 연결 (보안 우회하여 강제로 데이터 수정)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const { paymentKey, reason } = await req.json();

    if (!paymentKey) {
      return NextResponse.json({ error: '결제키(paymentKey)가 누락되었습니다.' }, { status: 400 });
    }

    // ==========================================
    // 1. 우리 장부에서 결제 내역 조회 (누구의 포인트를 뺏을지, 얼마인지 파악)
    // ==========================================
    const { data: paymentRecord, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('payment_key', paymentKey)
      .single();

    if (fetchError || !paymentRecord) {
      return NextResponse.json({ error: 'DB에서 결제 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (paymentRecord.status === 'CANCELED') {
      return NextResponse.json({ error: '이미 취소된 결제입니다.' }, { status: 400 });
    }

    // ==========================================
    // 2. 토스페이먼츠 환불 API 호출
    // ==========================================
    const secretKey = process.env.TOSS_SECRET_KEY || '';
    if (!secretKey) throw new Error("서버에 토스 시크릿 키가 설정되어 있지 않습니다.");
    
    const basicToken = Buffer.from(`${secretKey}:`).toString('base64');

    const tossResponse = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cancelReason: reason || '관리자 직권 취소' }),
    });

    const tossData = await tossResponse.json();

    if (!tossResponse.ok) {
      throw new Error(tossData.message || '토스 환불 요청에 실패했습니다.');
    }

    // ==========================================
    // 3. 토스 환불 성공! 이제 우리 장부 3곳 마이너스(-) 처리
    // ==========================================
    const userId = paymentRecord.user_id;
    const amount = paymentRecord.amount;
    let basePoints = amount;
    let bonusPoints = 0;

    // 요금제별 보너스 포인트 역계산 (보너스로 준 포인트도 같이 뺏어옵니다)
    if (amount === 30000) bonusPoints = 6000;
    else if (amount === 50000) bonusPoints = 10000;

    const totalDeduct = basePoints + bonusPoints;

    // [장부 1] payments 테이블 상태 업데이트 ('DONE' -> 'CANCELED')
    await supabase.from('payments').update({ status: 'CANCELED' }).eq('payment_key', paymentKey);

    // [장부 2] profiles 포인트 차감 (마이너스가 되지 않도록 최소 0으로 방어)
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profile) {
      await supabase.from('profiles').update({
        purchased_points: Math.max(0, (profile.purchased_points || 0) - basePoints),
        bonus_points: Math.max(0, (profile.bonus_points || 0) - bonusPoints),
        total_purchased_points: Math.max(0, (profile.total_purchased_points || 0) - basePoints)
      }).eq('id', userId);
    }

    // [장부 3] point_history 차감 기록 (마이페이지에 표시될 내역)
    await supabase.from('point_history').insert({
      user_id: userId,
      change_type: '환불',
      change_amount: -totalDeduct,
      page_type: '결제취소',
      description: `요금제 환불 처리 (${paymentRecord.plan_id?.toUpperCase() || '알수없음'})`
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("환불 처리 중 에러:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}