import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const storeName = searchParams.get('storeName');

  if (!keyword || !storeName) {
    return NextResponse.json({ success: false, error: '키워드와 스토어명이 필요합니다.' });
  }

  try {
    const clientId = process.env.NAVER_SEARCH_CLIENT_ID || ''; 
    const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET || '';

    if (!clientId || !clientSecret) {
       return NextResponse.json({ success: false, error: '네이버 API 키가 설정되지 않았습니다.' });
    }

    const targetStore = storeName.replace(/\s+/g, '').toLowerCase();
    const inferredBrand = targetStore.replace(/(몰|스토어|상회|샵|shop|마트|컴퍼니|기업|공식|본사)$/g, '');
    
    let matchedItems: any[] = [];
    let allPrices: number[] = []; // 🌟 200개 상품의 모든 가격을 수집할 장바구니

    const checkMatch = (item: any) => {
      const isStoreMatch = item.mallName.replace(/\s+/g, '').toLowerCase() === targetStore;
      const isCatalogMatch = inferredBrand && item.mallName === '네이버' && (
        item.title.replace(/\s+/g, '').toLowerCase().includes(inferredBrand) ||
        (item.brand && item.brand.replace(/\s+/g, '').toLowerCase().includes(inferredBrand)) ||
        (item.maker && item.maker.replace(/\s+/g, '').toLowerCase().includes(inferredBrand))
      );
      return isStoreMatch || isCatalogMatch;
    };

    // 1페이지 (1~100위)
    const url1 = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(keyword)}&display=100&start=1`;
    const res1 = await fetch(url1, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret } });
    const data1 = await res1.json();

    if (data1.items) {
      data1.items.forEach((item: any, index: number) => {
        allPrices.push(Number(item.lprice)); // 🌟 가격 수집
        if (checkMatch(item)) matchedItems.push({ rank: index + 1, item: item });
      });
    }

    // 2페이지 (101~200위)
    const url2 = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(keyword)}&display=100&start=101`;
    const res2 = await fetch(url2, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret } });
    const data2 = await res2.json();

    if (data2.items) {
      data2.items.forEach((item: any, index: number) => {
        allPrices.push(Number(item.lprice)); // 🌟 가격 수집
        if (checkMatch(item)) matchedItems.push({ rank: index + 101, item: item });
      });
    }

    // 🌟 수집된 가격 중에서 최저가와 최고가 추출 (광고성 1원, 10원 단위 등은 제외하기 위해 안전하게 처리 가능하나 일단 전체 기준)
    const validPrices = allPrices.filter(price => price > 0);
    const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
    const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : 0;

    // 🌟 결과에 최저가, 최고가 데이터도 함께 던져줍니다.
    return NextResponse.json({ success: true, items: matchedItems, minPrice, maxPrice });

  } catch (error) {
    console.error("순위 추적 API 에러:", error);
    return NextResponse.json({ success: false, error: '순위 데이터를 불러오지 못했습니다.' });
  }
}