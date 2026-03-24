import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // 프론트엔드에서 보낸 결제 정보(영수증 번호, 주문 번호, 금액)를 받습니다.
    const body = await request.json();
    const { paymentKey, orderId, amount } = body;

    // 대표님의 토스페이먼츠 테스트 시크릿 키
    const secretKey = 'test_sk_26DlbXAaV0KDy62QpwDz3qY50Q9R';
    
    // 토스페이먼츠 규격에 맞게 시크릿 키를 암호화(Base64)
    const encryptedSecretKey = Buffer.from(secretKey + ':').toString('base64');

    // 토스 서버로 "이 고객이 10,000원 결제했다는데, 정상 결제 맞니?" 하고 확인(승인) 요청
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encryptedSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    });

    const data = await response.json();

    // 1. 토스에서 거절한 경우 (잔액 부족, 금액 조작 등)
    if (!response.ok) {
      return NextResponse.json({ success: false, message: data.message }, { status: 400 });
    }

    // 2. 토스에서 최종 승인된 경우 (결제 완료)
    return NextResponse.json({ success: true, data: data });

  } catch (error) {
    console.error('결제 승인 API 에러:', error);
    return NextResponse.json({ success: false, message: '서버 통신 중 에러가 발생했습니다.' }, { status: 500 });
  }
}