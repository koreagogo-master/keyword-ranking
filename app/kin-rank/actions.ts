'use server';

import puppeteer from 'puppeteer';

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
    browser = await puppeteer.launch({
      headless: true, 
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

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
  const targetUrl = `https://m.search.naver.com/search.naver?sm=mtb_hty.top&ssc=tab.m.all&query=${encodeURIComponent(keyword)}`;

  try {
    await page.setViewport({ width: 390, height: 844 });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
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

// [로봇 2] 지식iN 탭 순위 + 날짜 확인 (상대 날짜 로직 추가됨)
async function checkTabRank(browser: any, keyword: string, targetTitleSnippet: string) {
  const page = await browser.newPage();
  const targetUrl = `https://m.search.naver.com/search.naver?sm=mtb_hty.top&where=m_kin&ssc=tab.m_kin.all&query=${encodeURIComponent(keyword)}`;

  try {
    await page.setViewport({ width: 390, height: 844 });
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 800));

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

        // 2. [날짜] 찾기 (로직 확장됨)
        // 조건: 11~15px + 파란색 아님
        const isDateSize = fontSize >= 11 && fontSize <= 15;
        
        if (isDateSize && !isRealBlue) {
            // [수정 포인트] 날짜 패턴 확장
            // 1. 절대 날짜: 2024.09.04.
            // 2. 상대 날짜: 2주 전, 3일 전, 1시간 전, 30분 전
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