import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ error: '키워드를 입력해주세요.' }, { status: 400 });
  }

  try {
    // 1. 네이버 광고 API 설정
    const AD_API_URL = 'https://api.naver.com/keywordstool';
    const AD_CUSTOMER_ID = process.env.NAVER_AD_CUSTOMER_ID!;
    const AD_ACCESS_LICENSE = process.env.NAVER_AD_ACCESS_LICENSE!;
    const AD_SECRET_KEY = process.env.NAVER_AD_SECRET_KEY!;

    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac('sha256', AD_SECRET_KEY)
      .update(`${timestamp}.GET./keywordstool`)
      .digest('base64');

    const adResponse = await fetch(`${AD_API_URL}?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`, {
      method: 'GET',
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': AD_ACCESS_LICENSE,
        'X-Customer': AD_CUSTOMER_ID,
        'X-Signature': signature,
      },
    });
    const adData = await adResponse.json();

    // 입력한 키워드와 정확히 일치하는 데이터 찾기
    const keywordStat = adData.keywordList?.find((item: any) => 
      item.relKeyword.replace(/\s+/g, "") === keyword.replace(/\s+/g, "")
    );

    // 2. 네이버 검색 API 설정 (문서수)
    const SEARCH_CLIENT_ID = process.env.NAVER_SEARCH_CLIENT_ID!;
    const SEARCH_CLIENT_SECRET = process.env.NAVER_SEARCH_CLIENT_SECRET!;
    const SEARCH_API_URL = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=1`;

    const searchResponse = await fetch(SEARCH_API_URL, {
      headers: {
        'X-Naver-Client-Id': SEARCH_CLIENT_ID,
        'X-Naver-Client-Secret': SEARCH_CLIENT_SECRET,
      },
    });
    const searchData = await searchResponse.json();

    // 3. 데이터 가공 및 경쟁 강도 계산
    const pcCount = Number(keywordStat?.monthlyPcQcCnt) || 0;
    const mobileCount = Number(keywordStat?.monthlyMobileQcCnt) || 0;
    const totalSearch = pcCount + mobileCount;
    const totalDocs = Number(searchData.total) || 0;
    
    // 경쟁 강도 = 문서수 / 총 검색량 (소수점 2자리)
    const compRate = totalSearch > 0 ? (totalDocs / totalSearch).toFixed(2) : "0";

    return NextResponse.json({
      keyword: keyword,
      monthlyPcQcCnt: pcCount,
      monthlyMobileQcCnt: mobileCount,
      totalPostCount: totalDocs,
      competitionRate: compRate,
      relatedKeywords: adData.keywordList || [] // 연관 키워드 리스트 추가
    });

  } catch (error) {
    return NextResponse.json({ error: '데이터 처리 중 오류 발생' }, { status: 500 });
  }
}