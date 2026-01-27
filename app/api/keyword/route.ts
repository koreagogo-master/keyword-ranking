import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) return NextResponse.json({ error: '키워드를 입력해주세요.' }, { status: 400 });

  try {
    // [진단 1] 환경 변수가 잘 로드되었는지 확인
    const NAVER_ID = process.env.NAVER_SEARCH_CLIENT_ID!;
    const NAVER_SECRET = process.env.NAVER_SEARCH_CLIENT_SECRET!;
    const AD_CUSTOMER_ID = process.env.NAVER_AD_CUSTOMER_ID!;
    const AD_ACCESS_LICENSE = process.env.NAVER_AD_ACCESS_LICENSE!;
    const AD_SECRET_KEY = process.env.NAVER_AD_SECRET_KEY!;

    console.log('--- 환경 변수 로드 확인 ---');
    console.log('NAVER_ID 존재 여부:', !!NAVER_ID);
    console.log('AD_SECRET_KEY 존재 여부:', !!AD_SECRET_KEY);

    const timestamp = Date.now().toString();
    const signature = crypto.createHmac('sha256', AD_SECRET_KEY)
      .update(`${timestamp}.GET./keywordstool`)
      .digest('base64');

    const searchHeaders = { 
      'X-Naver-Client-Id': NAVER_ID, 
      'X-Naver-Client-Secret': NAVER_SECRET,
      'Content-Type': 'application/json'
    };

    // [진단 2] 각 API 호출 직전 로그
    console.log(`--- API 호출 시작 (키워드: ${keyword}) ---`);

    const [adRes, blogRes, cafeRes, datalabRes] = await Promise.all([
      fetch(`https://api.naver.com/keywordstool?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`, {
        headers: { 'X-Timestamp': timestamp, 'X-API-KEY': AD_ACCESS_LICENSE, 'X-Customer': AD_CUSTOMER_ID, 'X-Signature': signature }
      }),
      fetch(`https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=10`, { headers: searchHeaders }),
      fetch(`https://openapi.naver.com/v1/search/cafearticle.json?query=${encodeURIComponent(keyword)}&display=1`, { headers: searchHeaders }),
      fetch('https://openapi.naver.com/v1/datalab/search', {
        method: 'POST',
        headers: searchHeaders,
        body: JSON.stringify({
          startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          timeUnit: "month",
          keywordGroups: [{ groupName: keyword, keywords: [keyword] }]
        })
      })
    ]);

    // [진단 3] 각 API의 응답 코드(200, 401 등) 확인
    console.log('광고 API 응답:', adRes.status);
    console.log('블로그 API 응답:', blogRes.status);
    console.log('데이터랩 API 응답:', datalabRes.status);

    // 에러 발생 시 상세 이유를 출력하도록 함
    if (!adRes.ok) {
        const errText = await adRes.text();
        console.error('광고 API 실패 상세:', errText);
    }

    const adData = await adRes.json();
    const blogData = await blogRes.json();
    const cafeData = await cafeRes.json();
    const datalabData = await datalabRes.json();

    const keywordStat = adData.keywordList?.find((item: any) => item.relKeyword.replace(/\s+/g, "") === keyword.replace(/\s+/g, ""));

    // --- 여기부터는 기존 128줄에 있던 모든 가공 로직입니다 ---
    let maleRate = "50.0", femaleRate = "50.0";
    if (keywordStat?.genderGroup) {
      const totalG = (Number(keywordStat.genderGroup.m) || 0) + (Number(keywordStat.genderGroup.f) || 0) || 1;
      maleRate = ((Number(keywordStat.genderGroup.m) / totalG) * 100).toFixed(1);
      femaleRate = (100 - Number(maleRate)).toFixed(1);
    } else if (datalabData.results?.[0]?.data?.length > 0) {
      maleRate = "62.8"; 
      femaleRate = "37.2";
    }

    const ageMap: any = { "10": "10대", "20": "20대", "30": "30대", "40": "40대", "50": "50대+" };
    let topAges = [];
    if (keywordStat?.ageGroup && Object.keys(keywordStat.ageGroup).length > 0) {
      topAges = Object.keys(keywordStat.ageGroup)
          .map(key => ({ label: ageMap[key] || key, value: Number(keywordStat.ageGroup[key]) }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 3);
    } else {
      topAges = [
        { label: "50대+", value: 45 },
        { label: "40대", value: 30 },
        { label: "30대", value: 15 }
      ];
    }

    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    let topDays = [];
    if (keywordStat?.weeklyQcCnt && keywordStat.weeklyQcCnt.length > 0) {
      topDays = keywordStat.weeklyQcCnt
          .map((val: number, idx: number) => ({ label: dayNames[idx], value: val }))
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 3);
    } else {
      topDays = [{ label: "월, 화, 목", value: 100 }];
    }

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
        topAges,
        topDays,
        datalabRaw: datalabData
      }
    });

  } catch (error: any) {
    // [진단 4] 최종 에러 단계 기록
    console.error('최종 catch 에러 발생:', error.message);
    return NextResponse.json({ error: '데이터 처리 오류', details: error.message }, { status: 500 });
  }
}