import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { keyword: rawKeyword } = await request.json();

  if (!rawKeyword) return NextResponse.json({ error: '키워드가 없습니다.' }, { status: 400 });

  const keyword = rawKeyword.trim();

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

    const response = await fetch(
      `https://googleads.googleapis.com/v23/customers/${customerId}:generateKeywordIdeas`,
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
    
    // 🌟 [추가] 터미널에 구글이 준 데이터 개수를 출력해 봅니다.
    console.log(`[디버그] "${keyword}" 구글 응답 데이터 개수:`, data.results?.length || 0);

    if (!hasData) return NextResponse.json({ success: true, keywords: [] });

    if (!hasData) return NextResponse.json({ success: true, keywords: [] });

    const formattedKeywords = data.results.map((idea: any) => {
      const metrics = idea.keywordIdeaMetrics || {};
      const lowBid = metrics.lowTopOfPageBidMicros ? Math.round(metrics.lowTopOfPageBidMicros / 1000000) : 0;
      const highBid = metrics.highTopOfPageBidMicros ? Math.round(metrics.highTopOfPageBidMicros / 1000000) : 0;
      
      let compText = "알 수 없음";
      if (metrics.competition === 'HIGH') compText = "높음";
      else if (metrics.competition === 'MEDIUM') compText = "중간";
      else if (metrics.competition === 'LOW') compText = "낮음";

      return {
        keyword: idea.text,
        searchVolume: metrics.avgMonthlySearches || 0,
        competition: compText,
        // 🌟 [추가된 부분] 구글 API에서 넘겨주는 경쟁도 지수(0~100)를 프론트엔드로 전달합니다.
        competitionIndex: metrics.competitionIndex !== undefined ? metrics.competitionIndex : undefined,
        cpcLow: lowBid,
        cpcHigh: highBid,
      };
    });

    return NextResponse.json({ success: true, keywords: formattedKeywords });

  } catch (error: any) {
    console.error('❌ 서버 에러:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}