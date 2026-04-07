// app/api/scrape-product/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');
  const storeName = searchParams.get('storeName');

  if (!keyword || !storeName) {
    return NextResponse.json({ error: '키워드와 스토어명을 모두 입력해주세요.' }, { status: 400 });
  }

  try {
    const clientId = process.env.NAVER_SEARCH_CLIENT_ID || ''; 
    const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET || '';

    if (!clientId || !clientSecret) {
       return NextResponse.json({ error: '네이버 API 키가 서버에 설정되지 않았습니다.' }, { status: 500 });
    }

    const targetStore = storeName.replace(/\s+/g, '').toLowerCase();
    const searchQuery = `${storeName} ${keyword}`;

    const url1 = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(searchQuery)}&display=100&start=1`;
    const res1 = await fetch(url1, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret } });
    const data1 = await res1.json();

    let items = data1.items || [];

    if (items.length === 0) {
      throw new Error(`'${storeName} ${keyword}' 검색 결과가 없습니다.`);
    }

    const inferredBrand = targetStore.replace(/(몰|스토어|상회|샵|shop|마트|컴퍼니|기업|공식|본사)$/g, '');

    const foundItems = items.filter((item: any) => {
      const isStoreMatch = item.mallName.replace(/\s+/g, '').toLowerCase() === targetStore;
      const cleanTitle = item.title.replace(/\s+/g, '').toLowerCase();
      const isCatalogMatch = item.mallName === '네이버' && (cleanTitle.includes(targetStore) || cleanTitle.includes(inferredBrand));
      return isStoreMatch || isCatalogMatch;
    });

    if (foundItems.length === 0) {
      throw new Error(`'${storeName}' 스토어에서 '${keyword}' 관련 상품을 찾을 수 없습니다.`);
    }

    const uniqueMap = new Map();
    foundItems.forEach((item: any) => {
      const cleanTitle = item.title.replace(/<[^>]*>?/gm, '');
      if (!uniqueMap.has(cleanTitle)) {
        uniqueMap.set(cleanTitle, { ...item, cleanTitle });
      }
    });

    const cleanedProducts = Array.from(uniqueMap.values()).map((item: any) => ({
      title: item.cleanTitle,
      image: item.image,
      lprice: item.lprice,
      link: item.link // 🌟 상품 URL 링크 데이터 추가!
    }));

    return NextResponse.json({ products: cleanedProducts });

  } catch (error: any) {
    console.error(`❌ 공식 API 검색 오류:`, error.message);
    return NextResponse.json(
      { error: error.message || '상품 정보를 가져오는 데 실패했습니다.' },
      { status: 500 }
    );
  }
}