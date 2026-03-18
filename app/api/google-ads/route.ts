import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { keyword: rawKeyword } = await request.json();

  if (!rawKeyword) return NextResponse.json({ error: '키워드가 없습니다.' }, { status: 400 });

  // 띄어쓰기를 강제로 붙이는(모든 공백 제거) 처리 
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

    if (!accessToken) {
      console.error("❌ 구글 API 토큰 발급 실패:", tokenData);
      return NextResponse.json({ error: '토큰 발급 실패' }, { status: 401 });
    }

    console.log(`🔍 구글 API 최종 호출 (v19): URL(${customerId}), Keyword(${keyword})`);
    
    // 🌟 핵심 해결: 최신 v19 버전 + 정확한 /keywordPlanIdeas 경로 적용!
    const response = await fetch(
      `https://googleads.googleapis.com/v19/customers/${customerId}/keywordPlanIdeas:generateKeywordIdeas`,
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
      keyword,
      monthlySearchVolume: searchVolume || 0
    });

  } catch (error) {
    console.error('❌ 구글 서버 통신 에러:', error);
    return NextResponse.json({ error: '서버 에러 발생' }, { status: 500 });
  }
}