'use server';

import puppeteer from 'puppeteer';

interface RankResult {
  success: boolean;
  message: string;
  data?: any;
}

export async function checkNaverKinRank(keyword: string, targetTitleSnippet: string): Promise<RankResult> {
  const targetUrl = `https://m.search.naver.com/search.naver?sm=mtb_hty.top&where=m_kin&ssc=tab.m_kin.all&oquery=&query=${encodeURIComponent(keyword)}`;
  
  console.log(`\n========== [Final Last] 필터 완전 제거 (있는 그대로 출력) ==========`);
  console.log(`URL: ${targetUrl}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false, 
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(() => window.scrollBy(0, 1000));
    await new Promise(resolve => setTimeout(resolve, 1500));

    const extractedTitles = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      
      // 화면 상단 "전체" 탭 위치 찾기 (못 찾으면 180px)
      const anchorEl = allElements.find(el => {
          const t = el.textContent?.trim() || '';
          return t.includes('전체') && el.getBoundingClientRect().top < 300;
      });

      let startY = 180;
      if (anchorEl) {
          startY = anchorEl.getBoundingClientRect().bottom;
      }

      const results = [];
      const processed = new Set();

      for (const el of allElements) {
        if ((el as HTMLElement).offsetParent === null) continue;

        const text = el.textContent?.trim() || '';
        // "Q." 같은 짧은 것도 제목의 일부이므로 1글자 이상이면 다 가져옴
        if (text.length < 1) continue; 

        const rect = el.getBoundingClientRect();
        
        // 검색 결과 영역 (상단 메뉴 제외)
        if (rect.top <= startY) continue; 
        if (rect.top > 6000) continue;

        // [최소한의 잡음 제거] - 이건 남겨야 본문을 피합니다
        const className = el.className.toLowerCase();
        if (text.includes('Keep') || text.includes('저장') || 
            text.includes('답변') || text.includes('질문자') || 
            text === '신고' || text === '옵션' || 
            text.includes('도움말') || text.includes('공유')) continue;

        // 이미 수집한 텍스트 건너뛰기
        if (processed.has(text)) continue;

        results.push({
            text: text,
            y: rect.top
        });
        processed.add(text);
      }

      // 화면 위치순 정렬
      results.sort((a, b) => a.y - b.y);

      return results;
    });

    console.log('------------------------------------------------');
    console.log(`🔎 [무가공 데이터 출력]`);
    
    // 상위 30개 출력 (조각난 텍스트들이 순서대로 나오는지 확인)
    for (let i = 0; i < extractedTitles.length; i++) {
        if (i >= 30) break;
        console.log(`[No.${i+1}] (Y:${Math.round(extractedTitles[i].y)}) ${extractedTitles[i].text}`);
    }
    console.log('------------------------------------------------');

    return { success: true, message: '완료' };

  } catch (error) {
    console.error('Error:', error);
    return { success: false, message: '에러' };
  } finally {
    if (browser) await browser.close();
  }
}