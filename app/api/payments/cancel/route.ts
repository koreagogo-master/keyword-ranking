import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { paymentKey, reason } = await req.json();

    if (!paymentKey) {
      return NextResponse.json({ error: '결제키(paymentKey)가 누락되었습니다.' }, { status: 400 });
    }

    // 1. 토스페이먼츠 시크릿 키 준비 (환경변수에서 가져오기)
    const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY;
    if (!TOSS_SECRET_KEY) {
      throw new Error("서버에 토스 시크릿 키가 설정되어 있지 않습니다.");
    }

    // 토스 API 스펙에 맞게 시크릿 키를 Base64로 인코딩 (뒤에 콜론(:)을 꼭 붙여야 함)
    const basicToken = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');

    // 2. 토스페이먼츠 환불 API 호출
    const tossResponse = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cancelReason: reason || '관리자 직권 취소' }),
    });

    if (!tossResponse.ok) {
      const errorData = await tossResponse.json();
      throw new Error(errorData.message || '토스 환불 요청에 실패했습니다.');
    }

    // 3. Supabase DB의 payments 테이블 상태 업데이트 ('DONE' -> 'CANCELED')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: dbError } = await supabase
      .from('payments')
      .update({ status: 'CANCELED' })
      .eq('payment_key', paymentKey);

    if (dbError) {
      console.error("DB 업데이트 에러:", dbError);
      throw new Error("토스 환불은 성공했으나 DB 업데이트에 실패했습니다.");
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("환불 처리 중 에러:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}