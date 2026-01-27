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

    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    const start = new Date();
    start.setFullYear(now.getFullYear() - 1);
    start.setDate(1); 
    const startDate = start.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];

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
        body: JSON.stringify({ startDate: thirtyDaysAgo, endDate, timeUnit: "date", keywordGroups: [{ groupName: keyword, keywords: [keyword] }], gender: "m" })
      }),
      fetch('https://openapi.naver.com/v1/datalab/search', {
        method: 'POST', headers: searchHeaders,
        body: JSON.stringify({ startDate: thirtyDaysAgo, endDate, timeUnit: "date", keywordGroups: [{ groupName: keyword, keywords: [keyword] }], gender: "f" })
      }),
      fetch('https://openapi.naver.com/v1/datalab/search', {
        method: 'POST', headers: searchHeaders,
        body: JSON.stringify({ startDate, endDate, timeUnit: "month", keywordGroups: [{ groupName: keyword, keywords: [keyword] }], ages: ["1","2","3","4","5","6","7","8","9","10","11"] })
      })
    ]);

    const adData = adRes.ok ? await adRes.json() : { keywordList: [] };
    const blogData = await blogRes.json();
    const cafeData = await cafeRes.json();
    const dlTotal = dlTotalRes.ok ? await dlTotalRes.json() : null; 
    const dlMale = dlMaleRes.ok ? await dlMaleRes.json() : null;
    const dlFemale = dlFemaleRes.ok ? await dlFemaleRes.json() : null;
    const dlAge = dlAgeRes.ok ? await dlAgeRes.json() : null;

    const keywordStat = adData.keywordList?.find((item: any) => item.relKeyword.replace(/\s+/g, "") === keyword.replace(/\s+/g, ""));
    const pcCount = Number(keywordStat?.monthlyPcQcCnt) || 0;
    const moCount = Number(keywordStat?.monthlyMobileQcCnt) || 0;

    const rawData = dlTotal?.results?.[0]?.data || [];
    const monthlyTrend = rawData.slice(-12).map((d: any) => ({
      label: `${parseInt(d.period.split('-')[1])}월`,
      value: Number(d.ratio.toFixed(2))
    }));

    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayStats = [0, 0, 0, 0, 0, 0, 0];
    const combinedDaily = [...(dlMale?.results?.[0]?.data || []), ...(dlFemale?.results?.[0]?.data || [])];
    combinedDaily.forEach((d: any) => {
      const dayIdx = new Date(d.period).getDay();
      dayStats[dayIdx] += d.ratio;
    });
    const maxDay = Math.max(...dayStats) || 1;
    const weeklyTrend = dayNames.map((name, i) => ({
      label: name,
      value: Number(((dayStats[i] / maxDay) * 100).toFixed(1))
    }));

    const mSum = dlMale?.results?.[0]?.data?.reduce((acc: number, curr: any) => acc + curr.ratio, 0) || 0;
    const fSum = dlFemale?.results?.[0]?.data?.reduce((acc: number, curr: any) => acc + curr.ratio, 0) || 0;
    const genderRatio = (mSum + fSum) > 0 ? {
      female: Number(((fSum / (mSum + fSum)) * 100).toFixed(1)),
      male: Number(((mSum / (mSum + fSum)) * 100).toFixed(1))
    } : null;

    // [수정] 연령별 데이터 합산 로직 보강
    const ageRaw = dlAge?.results || [];
    const ageGroups = [
      { label: "10대", ids: ["1", "2"], val: 0 },
      { label: "20대", ids: ["3", "4"], val: 0 },
      { label: "30대", ids: ["5", "6"], val: 0 },
      { label: "40대", ids: ["7", "8"], val: 0 },
      { label: "50대+", ids: ["9", "10", "11"], val: 0 },
    ];
    
    ageGroups.forEach(group => {
      group.ids.forEach(id => {
        const found = ageRaw.find((r: any) => r.group === id);
        if (found && found.data) {
          group.val += found.data.reduce((acc: number, cur: any) => acc + (cur.ratio || 0), 0);
        }
      });
    });
    
    const ageTotal = ageGroups.reduce((acc, cur) => acc + cur.val, 0);
    const ageTrend = ageGroups.map(g => ({
      label: g.label,
      value: ageTotal > 0 ? Number(((g.val / ageTotal) * 100).toFixed(1)) : 0
    }));

    return NextResponse.json({
      keyword,
      monthlyPcQcCnt: pcCount,
      monthlyMobileQcCnt: moCount,
      totalPostCount: Number(blogData.total) || 0,
      totalCafeCount: Number(cafeData.total) || 0,
      relatedKeywords: adData.keywordList || [],
      blogList: blogData.items || [],
      analysis: {
        deviceMix: { 
          pc: (pcCount + moCount) > 0 ? ((pcCount / (pcCount + moCount)) * 100).toFixed(1) : 0, 
          mobile: (pcCount + moCount) > 0 ? ((moCount / (pcCount + moCount)) * 100).toFixed(1) : 0 
        },
        genderRatio, ageTrend, monthlyTrend, weeklyTrend
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}