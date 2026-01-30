import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // 1. 원본 키워드 받기
  const { keyword: rawKeyword } = await request.json();

  if (!rawKeyword) return NextResponse.json({ error: '키워드가 없습니다.' }, { status: 400 });

  // ✅ 띄어쓰기를 강제로 붙이는(모든 공백 제거) 처리 추가
  // "치아 교정" -> "치아교정"으로 변환됩니다.
  const keyword = rawKeyword.replace(/\s+/g, '').trim();

  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, '').trim();
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim();

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: refreshToken!,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 🔍 로그에서도 변환된 키워드를 확인합니다.
    console.log(`🔍 구글 API 최종 호출: URL(${customerId}), Keyword(${keyword})`);
    
    const response = await fetch(
      `https://googleads.googleapis.com/v19/customers/${customerId}:generateKeywordIdeas`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken!,
        },
        body: JSON.stringify({
          keywordSeed: { keywords: [keyword] },
          language: "languageConstants/1012",
          geoTargetConstants: ["geoTargetConstants/2410"],
          keywordPlanNetwork: "GOOGLE_SEARCH"
        }),
      }
    );

    const resText = await response.text();
    if (!response.ok) {
      console.error(`❌ 구글 API 상세 에러 (${response.status}):`, resText);
      return NextResponse.json({ error: '조회 실패', details: resText }, { status: response.status });
    }

    const data = JSON.parse(resText);
    
    const hasData = data.results && data.results.length > 0;
    const searchVolume = hasData ? data.results[0].keywordIdeaMetrics?.avgMonthlySearches : 0;

    console.log(`📊 구글 분석 결과: ${keyword} -> ${searchVolume}건`);

    return NextResponse.json({ 
      source: 'Google Ads',
      keyword: keyword,
      monthlySearchVolume: Number(searchVolume) || 0 
    });

  } catch (error: any) {
    console.error('❌ 서버 에러:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}