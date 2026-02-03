import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { fetchAllNaverData, getNaverHeaders } from './modules/0_NaverFetch';
import { estimateRecent30, parseYYYYMMDD, parsePubDate } from './modules/1_Estimator';
import { calculateGenderRatio, calculateWeeklyTrend, calculateMonthlyTrend } from './modules/2_TrendStats';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // ✅ 키워드에서 모든 띄어쓰기를 제거하여 검색 효율을 높입니다.
  const keyword = (searchParams.get('keyword') || '').replace(/\s+/g, '').trim();

  if (!keyword) return NextResponse.json({ error: '키워드를 입력해주세요.' }, { status: 400 });

  try {
    const ts = Date.now().toString();
    const config = {
      searchHeaders: getNaverHeaders(process.env.NAVER_SEARCH_CLIENT_ID!, process.env.NAVER_SEARCH_CLIENT_SECRET!),
      adHeaders: {
        'X-Timestamp': ts,
        'X-API-KEY': process.env.NAVER_AD_ACCESS_LICENSE!,
        'X-Customer': process.env.NAVER_AD_CUSTOMER_ID!,
        'X-Signature': crypto.createHmac('sha256', process.env.NAVER_AD_SECRET_KEY!).update(`${ts}.GET./keywordstool`).digest('base64')
      },
      now: new Date(),
      endDate: new Date().toISOString().split('T')[0],
      start30Days: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      startDate: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]
    };

    // 0_NaverFetch.ts에서 수정된 fetchAllNaverData를 호출합니다. (재시도 로직 포함)
    const [adData, blogData, cafeData, kinData, newsData, dlTotal, dlFemale, dlMale, dlMonthly] = await fetchAllNaverData(keyword, config);

    const keywordStat = adData.keywordList?.find((item: any) => String(item.relKeyword || '').replace(/\s+/g, '') === keyword.replace(/\s+/g, ''));
    const totalSearch = (Number(keywordStat?.monthlyPcQcCnt) || 0) + (Number(keywordStat?.monthlyMobileQcCnt) || 0);

    const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
    const blogEst = estimateRecent30(Number(blogData.total), blogData.items || [], (it: any) => parseYYYYMMDD(it?.postdate), thirtyDaysAgo);
    const cafeEst = estimateRecent30(Number(cafeData.total), cafeData.items || [], (it: any) => null, thirtyDaysAgo);
    const kinEst = estimateRecent30(Number(kinData.total), kinData.items || [], (it: any) => parsePubDate(it?.pubDate), thirtyDaysAgo);
    const newsEst = estimateRecent30(Number(newsData.total), newsData.items || [], (it: any) => parsePubDate(it?.pubDate), thirtyDaysAgo);

    return NextResponse.json({
      searchCount: { pc: Number(keywordStat?.monthlyPcQcCnt) || 0, mobile: Number(keywordStat?.monthlyMobileQcCnt) || 0, total: totalSearch },
      contentCount: { blog: Number(blogData.total), cafe: Number(cafeData.total), kin: Number(kinData.total), news: Number(newsData.total), total: Number(blogData.total) + Number(cafeData.total) + Number(kinData.total) + Number(newsData.total) },
      content30: { 
        blog: blogEst.estimated, blogLimit: blogEst.isLimit,
        cafe: cafeEst.estimated, cafeLimit: cafeEst.isLimit,
        kin: kinEst.estimated, news: newsEst.estimated 
      },
      ratios: {
        device: { pc: totalSearch > 0 ? Math.round(((Number(keywordStat?.monthlyPcQcCnt) || 0) / totalSearch) * 100) : 0, mobile: totalSearch > 0 ? Math.round(((Number(keywordStat?.monthlyMobileQcCnt) || 0) / totalSearch) * 100) : 0 },
        gender: calculateGenderRatio(dlFemale, dlMale),
      },
      monthlyTrend: calculateMonthlyTrend(dlMonthly),
      weeklyTrend: calculateWeeklyTrend(dlTotal),
      relatedKeywords: adData.keywordList?.slice(0, 200) || [],
    });

  } catch (error: any) {
    // ❌ 에러 발생 시 로그를 남기고 클라이언트에 상세 내용을 전달합니다.
    console.error(`❌ API 호출 오류 (${keyword}):`, error.message);
    
    // 네이버 429(Too Many Requests) 에러인 경우 사용자 친화적인 메시지를 보냅니다.
    const isRateLimit = error.message.includes('429');
    
    return NextResponse.json(
      { 
        error: isRateLimit ? '네이버 API 호출량이 많아 잠시 제한되었습니다. 잠시 후 자동으로 다시 시도됩니다.' : '데이터를 가져오는 중 오류가 발생했습니다.',
        detail: error.message 
      }, 
      { status: isRateLimit ? 429 : 500 }
    );
  }
}