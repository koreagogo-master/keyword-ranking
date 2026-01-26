// app/api/keyword/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) return NextResponse.json({ error: '키워드를 입력해주세요.' }, { status: 400 });

  try {
    const AD_API_URL = 'https://api.naver.com/keywordstool';
    const AD_CUSTOMER_ID = process.env.NAVER_AD_CUSTOMER_ID!;
    const AD_ACCESS_LICENSE = process.env.NAVER_AD_ACCESS_LICENSE!;
    const AD_SECRET_KEY = process.env.NAVER_AD_SECRET_KEY!;

    const timestamp = Date.now().toString();
    const signature = crypto.createHmac('sha256', AD_SECRET_KEY).update(`${timestamp}.GET./keywordstool`).digest('base64');

    const adRes = await fetch(`${AD_API_URL}?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`, {
      headers: { 'X-Timestamp': timestamp, 'X-API-KEY': AD_ACCESS_LICENSE, 'X-Customer': AD_CUSTOMER_ID, 'X-Signature': signature }
    });
    const adData = await adRes.json();
    const keywordStat = adData.keywordList?.find((item: any) => item.relKeyword.replace(/\s+/g, "") === keyword.replace(/\s+/g, ""));

    const SEARCH_CLIENT_ID = process.env.NAVER_SEARCH_CLIENT_ID!;
    const SEARCH_CLIENT_SECRET = process.env.NAVER_SEARCH_CLIENT_SECRET!;
    const headers = { 'X-Naver-Client-Id': SEARCH_CLIENT_ID, 'X-Naver-Client-Secret': SEARCH_CLIENT_SECRET };

    const blogRes = await fetch(`https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=10`, { headers });
    const blogData = await blogRes.json();
    const cafeRes = await fetch(`https://openapi.naver.com/v1/search/cafearticle.json?query=${encodeURIComponent(keyword)}&display=1`, { headers });
    const cafeData = await cafeRes.json();

    // --- 통계 엔진 고도화 로직 시작 ---
    // 1. 성별 비중 계산
    const genderData = keywordStat?.genderGroup || { m: 50, f: 50 };
    const totalG = (Number(genderData.m) || 0) + (Number(genderData.f) || 0) || 1;
    const maleRate = ((Number(genderData.m) || 0) / totalG * 100).toFixed(1);
    const femaleRate = (100 - Number(maleRate)).toFixed(1);

    // 2. 연령대 TOP 3 추출
    const ageMap: any = { "10": "10대", "20": "20대", "30": "30대", "40": "40대", "50": "50대+" };
    const ageGroup = keywordStat?.ageGroup || {};
    const topAges = Object.keys(ageGroup)
      .map(key => ({ label: ageMap[key] || key, value: Number(ageGroup[key]) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    // 3. 요일별 가중치 TOP 3 추출
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const weeklyData = keywordStat?.weeklyQcCnt || [0,0,0,0,0,0,0];
    const topDays = weeklyData
      .map((val: number, idx: number) => ({ label: dayNames[idx], value: val }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 3);
    // --- 통계 엔진 고도화 로직 끝 ---

    const pcCount = Number(keywordStat?.monthlyPcQcCnt) || 0;
    const mobileCount = Number(keywordStat?.monthlyMobileQcCnt) || 0;
    const totalSearch = pcCount + mobileCount;
    const totalDocs = (Number(blogData.total) || 0) + (Number(cafeData.total) || 0);
    const competitionRate = totalSearch > 0 ? (totalDocs / totalSearch).toFixed(2) : "0";

    return NextResponse.json({
      keyword,
      monthlyPcQcCnt: pcCount,
      monthlyMobileQcCnt: mobileCount,
      totalPostCount: Number(blogData.total) || 0,
      totalCafeCount: Number(cafeData.total) || 0,
      competitionRate,
      relatedKeywords: adData.keywordList || [],
      blogList: blogData.items || [],
      demographics: {
        maleRate,
        femaleRate,
        topAges: topAges.length > 0 ? topAges : [{label:"데이터없음", value:0}],
        topDays: topDays.length > 0 ? topDays : [{label:"데이터없음", value:0}]
      }
    });
  } catch (error) {
    return NextResponse.json({ error: '데이터 처리 오류' }, { status: 500 });
  }
}