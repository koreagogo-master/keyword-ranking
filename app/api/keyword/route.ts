import { NextResponse } from 'next/server';
import crypto from 'crypto';

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();

  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    const msg = json?.errorMessage || json?.message || text || `HTTP ${res.status}`;
    throw new Error(`${res.status} ${res.statusText} - ${msg}`);
  }
  return json;
}

function toYmd(date: Date) {
  return date.toISOString().split('T')[0];
}

/** yyyymmdd(예: 20260128) → Date */
function parseYYYYMMDD(s?: string) {
  if (!s || typeof s !== 'string' || s.length !== 8) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Kin 및 News의 pubDate(예: "Tue, 28 Jan 2026 10:30:00 +0900") 파싱 */
function parsePubDate(s?: string) {
  if (!s || typeof s !== 'string') return null;
  const dt = new Date(s);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

/**
 * ✅ 개선된 30일 추정치 계산 로직
 * @param isPrecise 뉴스/지식인처럼 시간 단위(ms) 정밀 계산 여부
 */
function estimateRecent30(total: number, items: any[], getDate: (it: any) => Date | null, start30: Date, isPrecise: boolean = false) {
  const sampleSize = Array.isArray(items) ? items.length : 0;
  if (total <= 0 || sampleSize <= 0) {
    return { estimated: 0, isLimit: false };
  }

  const newestDate = getDate(items[0]);
  const oldestDate = getDate(items[sampleSize - 1]);

  if (!newestDate || !oldestDate) {
    return { estimated: 0, isLimit: false };
  }

  const isSampleSpanOver30Days = oldestDate < start30;

  if (isSampleSpanOver30Days) {
    let recentCount = 0;
    for (const it of items) {
      const dt = getDate(it);
      if (dt && dt >= start30) recentCount++;
    }
    return { estimated: recentCount, isLimit: false };
  } else {
    const diffTime = Math.abs(newestDate.getTime() - oldestDate.getTime());
    let diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    let isLimit = false;
    // 블로그/카페(isPrecise=false)인데 하루(100개) 안에 다 올라온 경우 천장 처리
    if (!isPrecise && diffDays < 1) {
      diffDays = 1;
      isLimit = true;
    }
    // 뉴스/지식인(isPrecise=true)은 초 단위 분해능을 사용하여 천장 없이 계산
    if (isPrecise && diffDays < 0.0001) diffDays = 0.0001; 

    const dailyRate = sampleSize / diffDays;
    const estimated = Math.min(total, Math.round(dailyRate * 30));

    return { estimated, isLimit };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = (searchParams.get('keyword') || '').trim();

  if (!keyword) {
    return NextResponse.json({ error: '키워드를 입력해주세요.' }, { status: 400 });
  }

  try {
    const NAVER_ID = process.env.NAVER_SEARCH_CLIENT_ID!;
    const NAVER_SECRET = process.env.NAVER_SEARCH_CLIENT_SECRET!;
    const AD_CUSTOMER_ID = process.env.NAVER_AD_CUSTOMER_ID!;
    const AD_ACCESS_LICENSE = process.env.NAVER_AD_ACCESS_LICENSE!;
    const AD_SECRET_KEY = process.env.NAVER_AD_SECRET_KEY!;

    const searchHeaders = {
      'X-Naver-Client-Id': NAVER_ID,
      'X-Naver-Client-Secret': NAVER_SECRET,
      'Content-Type': 'application/json',
    };

    const method = 'GET';
    const uri = '/keywordstool';
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac('sha256', AD_SECRET_KEY)
      .update(`${timestamp}.${method}.${uri}`)
      .digest('base64');

    const adHeaders = {
      'X-Timestamp': timestamp,
      'X-API-KEY': AD_ACCESS_LICENSE,
      'X-Customer': AD_CUSTOMER_ID,
      'X-Signature': signature,
    };

    const now = new Date();
    const endDate = toYmd(now);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const start30Days = toYmd(thirtyDaysAgo);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    const startDate = toYmd(oneYearAgo);

    const sampleDisplay = 100;

    const [
      adData,
      blogData,
      cafeData,
      kinData,
      newsData,
      dlTotal,
      dlFemale,
      dlMale,
      dlMonthly,
    ] = await Promise.all([
      fetchJson(`https://api.searchad.naver.com${uri}?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`, { headers: adHeaders }),
      fetchJson(`https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=${sampleDisplay}&start=1&sort=date`, { headers: searchHeaders }),
      fetchJson(`https://openapi.naver.com/v1/search/cafearticle.json?query=${encodeURIComponent(keyword)}&display=${sampleDisplay}&start=1&sort=date`, { headers: searchHeaders }),
      fetchJson(`https://openapi.naver.com/v1/search/kin.json?query=${encodeURIComponent(keyword)}&display=${sampleDisplay}&start=1&sort=date`, { headers: searchHeaders }),
      fetchJson(`https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=${sampleDisplay}&start=1&sort=date`, { headers: searchHeaders }),
      fetchJson('https://openapi.naver.com/v1/datalab/search', { method: 'POST', headers: searchHeaders, body: JSON.stringify({ startDate: start30Days, endDate, timeUnit: 'date', keywordGroups: [{ groupName: keyword, keywords: [keyword] }] }) }),
      fetchJson('https://openapi.naver.com/v1/datalab/search', { method: 'POST', headers: searchHeaders, body: JSON.stringify({ startDate: start30Days, endDate, timeUnit: 'date', keywordGroups: [{ groupName: keyword, keywords: [keyword] }], gender: 'f' }) }),
      fetchJson('https://openapi.naver.com/v1/datalab/search', { method: 'POST', headers: searchHeaders, body: JSON.stringify({ startDate: start30Days, endDate, timeUnit: 'date', keywordGroups: [{ groupName: keyword, keywords: [keyword] }], gender: 'm' }) }),
      fetchJson('https://openapi.naver.com/v1/datalab/search', { method: 'POST', headers: searchHeaders, body: JSON.stringify({ startDate, endDate, timeUnit: 'month', keywordGroups: [{ groupName: keyword, keywords: [keyword] }] }) }),
    ]);

    const keywordStat = adData.keywordList?.find((item: any) => String(item.relKeyword || '').replace(/\s+/g, '') === keyword.replace(/\s+/g, ''));
    const pcCount = Number(keywordStat?.monthlyPcQcCnt) || 0;
    const moCount = Number(keywordStat?.monthlyMobileQcCnt) || 0;
    const totalSearch = pcCount + moCount;

    const blogTotal = Number(blogData.total) || 0;
    const cafeTotal = Number(cafeData.total) || 0;
    const kinTotal = Number(kinData.total) || 0;
    const newsTotal = Number(newsData.total) || 0;

    const blogItems = Array.isArray(blogData.items) ? blogData.items : [];
    const cafeItems = Array.isArray(cafeData.items) ? cafeData.items : [];
    const kinItems = Array.isArray(kinData.items) ? kinData.items : [];
    const newsItems = Array.isArray(newsData.items) ? newsData.items : [];

    // ✅ 플랫폼 특성에 따른 계산 (isPrecise 옵션 적용)
    const blogEst = estimateRecent30(blogTotal, blogItems, (it) => parseYYYYMMDD(it?.postdate), thirtyDaysAgo, false);
    const cafeEst = estimateRecent30(cafeTotal, cafeItems, (it) => parseYYYYMMDD(it?.postdate), thirtyDaysAgo, false);
    const kinEst = estimateRecent30(kinTotal, kinItems, (it) => parsePubDate(it?.pubDate), thirtyDaysAgo, true);
    const newsEst = estimateRecent30(newsTotal, newsItems, (it) => parsePubDate(it?.pubDate), thirtyDaysAgo, true);

    const femaleSum = dlFemale?.results?.[0]?.data?.reduce((acc: number, cur: any) => acc + Number(cur.ratio || 0), 0) || 0;
    const maleSum = dlMale?.results?.[0]?.data?.reduce((acc: number, cur: any) => acc + Number(cur.ratio || 0), 0) || 0;
    const genderBase = femaleSum + maleSum;
    const femaleRatio = genderBase > 0 ? Math.round((femaleSum / genderBase) * 100) : 50;
    const maleRatio = 100 - femaleRatio;

    const daySums = [0, 0, 0, 0, 0, 0, 0];
    dlTotal?.results?.[0]?.data?.forEach((item: any) => {
      daySums[new Date(item.period).getDay()] += Number(item.ratio || 0);
    });
    const weeklySum = daySums.reduce((a, b) => a + b, 0) || 1;
    const weeklyTrend = daySums.map((v) => Math.round((v / weeklySum) * 100));

    const monthlyResults = dlMonthly?.results?.[0]?.data || [];
    const monthlySum = monthlyResults.reduce((acc: number, cur: any) => acc + Number(cur.ratio || 0), 0) || 1;
    const monthlyTrend = monthlyResults.map((item: any) => ({
      label: (String(item.period).split('-')[1] || '') + '월',
      value: Math.round((Number(item.ratio || 0) / monthlySum) * 100),
    }));

    return NextResponse.json({
      searchCount: { pc: pcCount, mobile: moCount, total: totalSearch },
      contentCount: { 
        blog: blogTotal, cafe: cafeTotal, kin: kinTotal, news: newsTotal, 
        total: blogTotal + cafeTotal + kinTotal + newsTotal 
      },
      content30: { 
        blog: blogEst.estimated, blogLimit: blogEst.isLimit,
        cafe: cafeEst.estimated, cafeLimit: cafeEst.isLimit,
        kin: kinEst.estimated, 
        news: newsEst.estimated
      },
      ratios: {
        device: { pc: totalSearch > 0 ? Math.round((pcCount / totalSearch) * 100) : 0, mobile: totalSearch > 0 ? Math.round((moCount / totalSearch) * 100) : 0 },
        gender: { male: maleRatio, female: femaleRatio },
      },
      monthlyTrend,
      weeklyTrend,
      relatedKeywords: adData.keywordList?.slice(0, 200) || [],
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error?.message || '데이터 로드 실패' }, { status: 500 });
  }
}