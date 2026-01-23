'use server';

// [변경 1] 우리가 만든 공통 프록시 도구 가져오기
import { launchProxyBrowser, setupPage } from '@/app/lib/puppeteerHelper';

interface RankResult {
  success: boolean;
  message: string;
  data?: {
    keyword: string;
    isMainExposed: boolean;
    tabRank: number;
    title: string;
    date: string; 
    url: string;
  };
}

export async function checkNaverKinRank(keyword: string, targetTitleSnippet: string): Promise<RankResult> {
  let browser;
  try {
    // [변경 2] 복잡한 설정 없이 공통 함수로 브라우저 실행
    browser = await launchProxyBrowser();

    const [mainResult, tabResult] = await Promise.all([
      checkMainExposure(browser, keyword),           
      checkTabRank(browser, keyword, targetTitleSnippet) 
    ]);

    return {
      success: true,
      message: '분석 완료',
      data: {
        keyword: keyword,
        isMainExposed: mainResult,
        tabRank: tabResult.rank,
        title: tabResult.title,
        date: tabResult.date,
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

// [로봇 1] 통합검색 노출 확인
async function checkMainExposure(browser: any, keyword: string): Promise<boolean> {
  const page = await browser.newPage();
  
  // [변경 3] 페이지 설정 적용 (인증 + 모바일 위장)
  await setupPage(page);

  const targetUrl = `https://m.search.naver.com/search.naver?sm=mtb_hty.top&ssc=tab.m.all&query=${encodeURIComponent(keyword)}`;

  try {
    // 기존의 setViewport, setUserAgent는 setupPage 안에 있으므로 생략
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const hasKinSection = await page.evaluate(() => {
      const allHeaders = Array.from(document.querySelectorAll('h2, strong, span, div.title'));
      return allHeaders.some(el => el.textContent?.trim() === '지식iN');
    });

    return hasKinSection;
  } catch (e) {
    return false;
  } finally {
    await page.close();
  }
}

// [로봇 2] 지식iN 탭 순위 + 날짜 확인
async function checkTabRank(browser: any, keyword: string, targetTitleSnippet: string) {
  const page = await browser.newPage();

  // [변경 4] 페이지 설정 적용 (인증 + 모바일 위장)
  await setupPage(page);

  const targetUrl = `https://m.search.naver.com/search.naver?sm=mtb_hty.top&where=m_kin&ssc=tab.m_kin.all&query=${encodeURIComponent(keyword)}`;

  try {
    // 기존의 setViewport, setUserAgent는 setupPage 안에 있으므로 생략
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 800));

    // --- 아래부터는 기존 분석 로직(파란색 글씨, 날짜 계산) 그대로 유지 ---
    const extractedData = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const titles = [];
      const dates = []; 
      const processed = new Set();

      for (const el of Array.from(allElements)) {
        if ((el as HTMLElement).offsetParent === null) continue;
        
        const text = el.textContent?.trim() || '';
        if (text.length < 1) continue; 
        if (processed.has(el)) continue;

        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        
        const fontSize = parseFloat(style.fontSize);
        const color = style.color || '';
        const rgbMatch = color.match(/\d+/g);
        
        let isRealBlue = false;
        if (rgbMatch && rgbMatch.length >= 3) {
            const r = parseInt(rgbMatch[0]);
            const g = parseInt(rgbMatch[1]);
            const b = parseInt(rgbMatch[2]);
            if (b > g + 40 && b > r + 40) isRealBlue = true;
        }

        // 1. [제목] 찾기
        const isTitleSize = fontSize >= 16.5 && fontSize <= 17.5;
        if (isTitleSize && isRealBlue) {
             if (rect.top > 0) {
                 titles.push({
                    text: text,
                    y: rect.top + window.scrollY,
                    date: '-' 
                });
                processed.add(el);
            }
        }

        // 2. [날짜] 찾기
        const isDateSize = fontSize >= 11 && fontSize <= 15;
        
        if (isDateSize && !isRealBlue) {
            const absoluteDate = /\d{4}\.\d{2}\.\d{2}/.test(text);
            const relativeDate = /\d+(분|시간|일|주|달|개월|년)\s*전/.test(text);

            if (absoluteDate || relativeDate) {
                 if (rect.top > 0) {
                     dates.push({
                        text: text, 
                        y: rect.top + window.scrollY
                     });
                     processed.add(el); 
                }
            }
        }
      }

      titles.sort((a, b) => a.y - b.y);
      dates.sort((a, b) => a.y - b.y);

      // 제목 중복 제거
      const finalTitles = [];
      let lastY = -999;
      for (const item of titles) {
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

      // 제목 + 날짜 매칭
      for (const title of finalTitles) {
          const matchedDate = dates.find(d => d.y > title.y && d.y - title.y < 200);
          if (matchedDate) {
              title.date = matchedDate.text;
          }
      }

      return finalTitles;
    });

    const normalize = (text: string) => text.replace(/[^a-zA-Z0-9가-힣]/g, '').toLowerCase();
    const targetNormal = normalize(targetTitleSnippet);

    for (let i = 0; i < extractedData.length; i++) {
        if (i >= 30) break;
        if (normalize(extractedData[i].text).includes(targetNormal)) {
            return { 
                rank: i + 1, 
                title: extractedData[i].text, 
                date: extractedData[i].date, 
                url: targetUrl 
            };
        }
    }

    return { rank: 0, title: '순위 내 없음', date: '-', url: targetUrl };

  } catch (e) {
    console.error('Tab Rank Check Error:', e);
    return { rank: 0, title: '에러 발생', date: '-', url: targetUrl };
  } finally {
    await page.close();
  }
}