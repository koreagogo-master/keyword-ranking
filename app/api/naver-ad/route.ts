import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ error: '키워드가 필요합니다.' }, { status: 400 });
  }

  const customerId = process.env.NAVER_AD_CUSTOMER_ID;
  const apiKey = process.env.NAVER_AD_ACCESS_LICENSE;
  const secretKey = process.env.NAVER_AD_SECRET_KEY;

  if (!customerId || !apiKey || !secretKey) {
    return NextResponse.json({ error: '검색광고 API 키가 설정되지 않았습니다.' }, { status: 500 });
  }

  // 네이버 검색광고 API 필수 암호화 서명(Signature) 생성
  const timestamp = Date.now().toString();
  const method = 'GET';
  const path = '/keywordstool';
  const message = `${timestamp}.${method}.${path}`;
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('base64');

  try {
    const response = await fetch(`https://api.naver.com/keywordstool?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`, {
      method: 'GET',
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': apiKey,
        'X-Customer': customerId,
        'X-Signature': signature,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '네이버 검색광고 API 호출 실패');
    }

    // 정확히 일치하는 키워드 데이터 찾기 (띄어쓰기 무시)
    const exactMatch = data.keywordList?.find(
      (k: any) => k.relKeyword.replace(/\s+/g, '') === keyword.replace(/\s+/g, '')
    );

    let totalSearchVolume = 0;

    if (exactMatch) {
      // 네이버는 검색량이 10 미만일 경우 "< 10" 이라는 문자열을 반환하므로 숫자로 변환 처리
      const pc = typeof exactMatch.monthlyPcQcCnt === 'number' ? exactMatch.monthlyPcQcCnt : 10;
      const mobile = typeof exactMatch.monthlyMobileQcCnt === 'number' ? exactMatch.monthlyMobileQcCnt : 10;
      totalSearchVolume = pc + mobile;
    }

    return NextResponse.json({ success: true, searchVolume: totalSearchVolume });

  } catch (error: any) {
    console.error("Naver Ad API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}