'use server';

import puppeteer from 'puppeteer';

interface RankResult {
  success: boolean;
  message: string;
  data?: {
    keyword: string;
    isMainExposed: boolean; // 통검 노출 여부
    tabRank: number;        // 지식iN 탭 순위
    title: string;
    url: string;
  };
}

export async function checkNaverKinRank(keyword: string, targetTitleSnippet: string): Promise<RankResult> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true, // 실전용 (창 안 띄움)
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // 병렬 처리를 위해 Promise.all 사용
    // 두 개의 작업을 동시에 시작하고, 둘 다 끝날 때까지 기다립니다.
    const [mainResult, tabResult] = await Promise.all([
      checkMainExposure(browser, keyword),           // 로봇 1: 통합검색 확인
      checkTabRank(browser, keyword, targetTitleSnippet) // 로봇 2: 지식iN 탭 순위 확인
    ]);

    return {
      success: true,
      message: '분석 완료',
      data: {
        keyword: keyword,
        isMainExposed: mainResult, // 통검 노출 여부 (true/false)
        tabRank: tabResult.rank,   // 탭 순위
        title: tabResult.title,    // 찾은 제목
        url: tabResult.url
      }
    };

  } catch (error) {
    console.error('Total Error:', error);
    return { success: false, message: '에러 발생' };
  } finally {
    if (browser) await browser.close();
  }
}

// ---------------------------------------------------------
// [로봇 1] 통합검색(메인)에 '지식iN' 섹션이 있는지 확인하는 함수
// ---------------------------------------------------------
async function checkMainExposure(browser: any, keyword: string): Promise<boolean> {
  const page = await browser.newPage();
  // 모바일 통합검색 URL
  const targetUrl = `https://m.search.naver.com/search.naver?sm=mtb_hty.top&ssc=tab.m.all&query=${encodeURIComponent(keyword)}`;

  try {
    await page.setViewport({ width: 390, height: 844 });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
    
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // "지식iN" 섹션이 있는지 확인
    // 방법: 페이지 내의 헤더(h2, strong 등) 중에 "지식iN"이라는 글자가 포함된 섹션이 있는지 체크
    const hasKinSection = await page.evaluate(() => {
      // 네이버 모바일은 보통 api_title_area 등의 클래스를 쓰지만 변동이 심함.
      // 가장 확실한 건 '지식iN' 텍스트를 가진 제목 요소가 존재하는지 찾는 것.
      const allHeaders = Array.from(document.querySelectorAll('h2, strong, span, div.title'));
      return allHeaders.some(el => el.textContent?.trim() === '지식iN');
    });

    return hasKinSection;

  } catch (e) {
    console.error('Main Exposure Check Error:', e);
    return false;
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------
// [로봇 2] 지식iN 탭 순위를 확인하는 함수 (기존 로직: Strict Blue)
// ---------------------------------------------------------
async function checkTabRank(browser: any, keyword: string, targetTitleSnippet: string) {
  const page = await browser.newPage();
  const targetUrl = `https://m.search.naver.com/search.naver?sm=mtb_hty.top&where=m_kin&ssc=tab.m_kin.all&query=${encodeURIComponent(keyword)}`;

  try {
    await page.setViewport({ width: 390, height: 844 });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
    
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // 스크롤 초기화
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 800));

    const extractedTitles = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const results = [];
      const processed = new Set();

      for (const el of Array.from(allElements)) {
        if ((el as HTMLElement).offsetParent === null) continue;
        
        const text = el.textContent?.trim() || '';
        if (text.length < 1) continue; 
        if (processed.has(el)) continue;

        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // 1. 폰트 크기 (16.5 ~ 17.5px)
        const fontSizeStr = style.fontSize; 
        const fontSize = parseFloat(fontSizeStr);
        const isSizeMatch = fontSize >= 16.5 && fontSize <= 17.5;

        // 2. 엄격한 색상 필터 (Strict Blue)
        const color = style.color || ''; 
        let isRealBlue = false;
        const rgbMatch = color.match(/\d+/g);
        if (rgbMatch && rgbMatch.length >= 3) {
            const r = parseInt(rgbMatch[0]);
            const g = parseInt(rgbMatch[1]);
            const b = parseInt(rgbMatch[2]);
            // 파랑이 압도적으로 높아야 함
            if (b > g + 40 && b > r + 40) {
                isRealBlue = true;
            }
        }

        if (isSizeMatch && isRealBlue) {
             if (rect.top > 0) {
                 results.push({
                    text: text,
                    y: rect.top + window.scrollY
                });
                processed.add(el);
            }
        }
      }

      results.sort((a, b) => a.y - b.y);

      // 중복 제거
      const finalTitles = [];
      let lastY = -999;
      for (const item of results) {
          if (Math.abs(item.y - lastY) < 30) {
              const lastItem = finalTitles[finalTitles.length - 1];
              if (item.text.length > lastItem.text.length) {
                  lastItem.text = item.text;
              }
          } else {
              finalTitles.push(item);
              lastY = item.y;
          }
      }
      return finalTitles;
    });

    // 순위 매칭
    const normalize = (text: string) => text.replace(/[^a-zA-Z0-9가-힣]/g, '').toLowerCase();
    const targetNormal = normalize(targetTitleSnippet);

    for (let i = 0; i < extractedTitles.length; i++) {
        if (i >= 30) break;
        if (normalize(extractedTitles[i].text).includes(targetNormal)) {
            return { rank: i + 1, title: extractedTitles[i].text, url: targetUrl };
        }
    }

    return { rank: 0, title: '순위 내 없음', url: targetUrl };

  } catch (e) {
    console.error('Tab Rank Check Error:', e);
    return { rank: 0, title: '에러 발생', url: targetUrl };
  } finally {
    await page.close();
  }
}