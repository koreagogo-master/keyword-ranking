import { NextResponse } from 'next/server';
import { launchProxyBrowser, setupPage } from '@/app/lib/puppeteerHelper';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ error: '키워드가 필요합니다.' }, { status: 400 });
  }

  let browser;
  try {
    browser = await launchProxyBrowser();
    const page = await browser.newPage();
    await setupPage(page);

    // 강력한 모바일 위장 (Stealth Mode)
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"Android"',
      'Upgrade-Insecure-Requests': '1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
    });

    const mobileUrl = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&pagingSize=40`;
    await page.goto(mobileUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const isDataLoaded = await page.waitForSelector('#__NEXT_DATA__', { timeout: 10000 }).then(() => true).catch(() => false);

    if (!isDataLoaded) {
       throw new Error(`모바일 우회 실패. 프록시 IP가 차단되었습니다.`);
    }

    const nextDataJson = await page.evaluate(() => {
      const scriptTag = document.getElementById('__NEXT_DATA__');
      return scriptTag ? scriptTag.innerText : null;
    });

    const parsedData = JSON.parse(nextDataJson as string);

    // 🌟 딥 서치 알고리즘: JSON 전체를 뒤져서 상품 데이터를 싹쓸이합니다. (네이버 구조 변경 무력화)
    const extractedProducts: any[] = [];
    const extractProducts = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      
      // 모바일/PC 상관없이 제목과 리뷰 속성을 가진 객체를 찾음
      const title = obj.productTitle || obj.tit;
      const reviews = obj.reviewCount ?? obj.reviewCnt;
      
      if (title && reviews !== undefined) {
        extractedProducts.push(obj);
      } else {
        Object.values(obj).forEach(extractProducts);
      }
    };
    
    extractProducts(parsedData);

    const detailsMap: Record<string, any> = {};
    
    // 기존 코드 위치 찾기: extractedProducts.forEach((product: any) => { ...
    extractedProducts.forEach((product: any) => {
      const title = product.productTitle || product.tit || '';
      const cleanTitle = title.replace(/[^가-힣a-zA-Z0-9]/g, '');
      
      if (cleanTitle) {
        detailsMap[cleanTitle] = {
          reviews: product.reviewCount ?? product.reviewCnt ?? 0,
          purchases: product.keepCount ?? product.keepCnt ?? 0,
          regDate: product.openDate ? `${String(product.openDate).substring(0, 4)}.${String(product.openDate).substring(4, 6)}` : '-', 
          // 🌟 평점(Rating) 추출 로직 추가
          rating: product.scoreInfo ?? product.reviewScore ?? 0,
        };
      }
    });

    await browser.close();

    return NextResponse.json({ success: true, details: detailsMap });

  } catch (error: any) {
    if (browser) await browser.close();
    console.error("Detail Proxy Crawling Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}