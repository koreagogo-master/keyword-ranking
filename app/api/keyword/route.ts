import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) return NextResponse.json({ error: '키워드를 입력해주세요.' }, { status: 400 });

  try {
    const NAVER_ID = process.env.NAVER_SEARCH_CLIENT_ID!;
    const NAVER_SECRET = process.env.NAVER_SEARCH_CLIENT_SECRET!;
    const AD_CUSTOMER_ID = process.env.NAVER_AD_CUSTOMER_ID!;
    const AD_ACCESS_LICENSE = process.env.NAVER_AD_ACCESS_LICENSE!;
    const AD_SECRET_KEY = process.env.NAVER_AD_SECRET_KEY!;

    const timestamp = Date.now().toString();
    const signature = crypto.createHmac('sha256', AD_SECRET_KEY)
      .update(`${timestamp}.GET./keywordstool`)
      .digest('base64');

    const searchHeaders = { 
      'X-Naver-Client-Id': NAVER_ID, 
      'X-Naver-Client-Secret': NAVER_SECRET,
      'Content-Type': 'application/json'
    };

    const endDate = new Date().toISOString().split('T')[0];
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startDate = oneYearAgo.toISOString().split('T')[0];

    const [adRes, blogRes, cafeRes, dlTotalRes, dlMaleRes, dlFemaleRes, dlAgeRes] = await Promise.all([
      fetch(`https://api.naver.com/keywordstool?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`, {
        headers: { 'X-Timestamp': timestamp, 'X-API-KEY': AD_ACCESS_LICENSE, 'X-Customer': AD_CUSTOMER_ID, 'X-Signature': signature }
      }),
      fetch(`https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=10`, { headers: searchHeaders }),
      fetch(`https://openapi.naver.com/v1/search/cafearticle.json?query=${encodeURIComponent(keyword)}&display=1`, { headers: searchHeaders }),
      fetch('https://openapi.naver.com/v1/datalab/search', {
        method: 'POST', headers: searchHeaders,
        body: JSON.stringify({ startDate, endDate, timeUnit: "month", keywordGroups: [{ groupName: keyword, keywords: [keyword] }] })
      }),
      fetch('https://openapi.naver.com/v1/datalab/search', {
        method: 'POST', headers: searchHeaders,
        body: JSON.stringify({ startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], endDate, timeUnit: "date", keywordGroups: [{ groupName: keyword, keywords: [keyword] }], gender: "m" })
      }),
      fetch('https://openapi.naver.com/v1/datalab/search', {
        method: 'POST', headers: searchHeaders,
        body: JSON.stringify({ startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], endDate, timeUnit: "date", keywordGroups: [{ groupName: keyword, keywords: [keyword] }], gender: "f" })
      }),
      fetch('https://openapi.naver.com/v1/datalab/search', {
        method: 'POST', headers: searchHeaders,
        body: JSON.stringify({ startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], endDate, timeUnit: "date", keywordGroups: [{ groupName: keyword, keywords: [keyword] }], ages: ["1","2","3","4","5","6","7","8","9","10","11"] })
      })
    ]);

    const adData = adRes.ok ? await adRes.json() : { keywordList: [] };
    const blogData = await blogRes.json();
    const cafeData = await cafeRes.json();
    const dlTotal = await dlTotalRes.json();
    const dlMale = dlMaleRes.ok ? await dlMaleRes.json() : null;
    const dlFemale = dlFemaleRes.ok ? await dlFemaleRes.json() : null;
    const dlAge = dlAgeRes.ok ? await dlAgeRes.json() : null;

    const keywordStat = adData.keywordList?.find((item: any) => item.relKeyword.replace(/\s+/g, "") === keyword.replace(/\s+/g, ""));

    const pcCount = Number(keywordStat?.monthlyPcQcCnt) || 0;
    const moCount = Number(keywordStat?.monthlyMobileQcCnt) || 0;
    const totalSearchCount = pcCount + moCount;

    const monthsNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    const monthlyTrend = dlTotal.results?.[0]?.data?.map((d: any) => ({
      label: monthsNames[new Date(d.period).getMonth()],
      value: Number(d.ratio.toFixed(1))
    })) || [];

    let momentum = { change: "0", status: "steady", message: "변동없음" };
    if (monthlyTrend.length >= 2) {
      const last = monthlyTrend[monthlyTrend.length - 1].value;
      const prev = monthlyTrend[monthlyTrend.length - 2].value;
      const diff = last - prev;
      momentum = {
        change: Math.abs(diff).toFixed(1),
        status: diff > 0 ? "up" : diff < 0 ? "down" : "steady",
        message: diff > 0 ? "상승세" : diff < 0 ? "하락세" : "유지세"
      };
    }

    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayStats = [0, 0, 0, 0, 0, 0, 0];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    dlTotal?.results?.[0]?.data?.forEach((d: any) => {
      const dayIdx = new Date(d.period).getDay();
      dayStats[dayIdx] += d.ratio;
      dayCounts[dayIdx]++;
    });
    const weeklyTrend = dayNames.map((name, i) => ({
      label: name,
      value: dayCounts[i] > 0 ? Number((dayStats[i] / dayCounts[i]).toFixed(1)) : 0
    }));

    const mSum = dlMale?.results?.[0]?.data?.reduce((acc: number, curr: any) => acc + curr.ratio, 0) || 0;
    const fSum = dlFemale?.results?.[0]?.data?.reduce((acc: number, curr: any) => acc + curr.ratio, 0) || 0;
    const genderTotal = mSum + fSum;
    
    // (4) 성별 비율 - 데이터 없을 시 50:50으로 채우던 Fallback 삭제
    const genderRatio = genderTotal > 0 ? {
      female: Number(((fSum / genderTotal) * 100).toFixed(1)),
      male: Number(((mSum / genderTotal) * 100).toFixed(1))
    } : null;

    const ageData = dlAge?.results || [];
    const ageGroups = [
      { label: "10대", ids: ["1", "2"], val: 0 },
      { label: "20대", ids: ["3", "4"], val: 0 },
      { label: "30대", ids: ["5", "6"], val: 0 },
      { label: "40대", ids: ["7", "8"], val: 0 },
      { label: "50대+", ids: ["9", "10", "11"], val: 0 },
    ];
    ageGroups.forEach(group => {
      group.ids.forEach(id => {
        const match = ageData.find((r: any) => r.group === id);
        group.val += match?.data?.reduce((acc: number, curr: any) => acc + curr.ratio, 0) || 0;
      });
    });
    const ageTotal = ageGroups.reduce((acc, curr) => acc + curr.val, 0);
    const ageTrend = ageGroups.map(g => ({
      label: g.label,
      value: ageTotal > 0 ? Number(((g.val / ageTotal) * 100).toFixed(1)) : 0
    }));

    // (5) 핵심 타겟 & 최고 시점 - 데이터 없을 시 "30대", "5월"로 채우던 Fallback 삭제
    const topAge = (ageTotal > 0 && ageTrend.length > 0) ? ageTrend.reduce((p, c) => (p.value > c.value ? p : c)).label : null;
    const bestMonth = monthlyTrend.length > 0 ? monthlyTrend.reduce((p:any, c:any) => (p.value > c.value ? p : c)).label : null;

    return NextResponse.json({
      keyword,
      monthlyPcQcCnt: pcCount,
      monthlyMobileQcCnt: moCount,
      totalPostCount: Number(blogData.total) || 0,
      totalCafeCount: Number(cafeData.total) || 0,
      competitionRate: totalSearchCount > 0 ? (((Number(blogData.total) || 0) + (Number(cafeData.total) || 0)) / totalSearchCount).toFixed(2) : "0",
      relatedKeywords: adData.keywordList || [],
      blogList: blogData.items || [],
      analysis: {
        deviceMix: { 
          pc: totalSearchCount > 0 ? ((pcCount / totalSearchCount) * 100).toFixed(1) : 0, 
          mobile: totalSearchCount > 0 ? ((moCount / totalSearchCount) * 100).toFixed(1) : 0 
        },
        genderRatio,
        ageTrend,
        monthlyTrend,
        weeklyTrend,
        trendMomentum: momentum,
        coreTarget: { 
          gender: genderRatio ? (genderRatio.female > 50 ? "여성" : "남성") : "확인불가", 
          summary: topAge ? `${topAge} 중심` : "데이터 부족" 
        },
        seasonality: { bestMonth: bestMonth || "데이터 부족" }
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}