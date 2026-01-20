'use server';

import puppeteer from 'puppeteer';

interface RankItem {
  rank: number;
  title: string;
  author: string;
  date: string;
  url: string;
}

interface RankResult {
  success: boolean;
  message: string;
  data?: RankItem[]; 
}

export async function checkNaverBlogRank(keyword: string, targetNicknames: string): Promise<RankResult> {
  // 특수문자 제거 함수
  const cleanString = (str: string) => str.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase();
  
  const targets = targetNicknames.split(',').map(n => cleanString(n)).filter(n => n.length > 0);
  
  console.log(`\n========== [DEBUG: 폰트 크기 필터 추가] ==========`);
  console.log(`검색 키워드: ${keyword}`);
  console.log(`찾을 닉네임(정제됨): ${targets.join(', ')}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    );

    const searchUrl = `https://m.search.naver.com/search.naver?ssc=tab.m_blog.all&where=m_blog&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(keyword)}`;
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // 스크롤 다운
    for (let i = 0; i < 5; i++) { 
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 스크롤 초기화
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 500));

    // 데이터 추출
    const foundItems = await page.evaluate((targets) => {
      const cleanStringInBrowser = (str: string | null) => 
        str ? str.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase() : '';
      
      const dateRegex = /(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}|\d+(?:시간|분|일|주|개월|년)\s*전|어제|방금\s*전)/;
      const TRASH_KEYWORDS = [
          '설정시작', '설정끝', '년(Year)', '월(Month)', '일(Day)', '직접입력', '옵션', '펼치기', '접기', 
          '초기화', '기간', '전체', '정렬', '관련도순', '최신순', '지식iN', '도움말', '자동완성', 
          '로그인', '함께 보면 좋은', '관련 출처', '지식백과', '추천 콘텐츠', '비슷한 글', '인기글', 
          'Naver', 'naver', 'NAVER', '네이버', '블로그', '카페', 'Blog', '더보기', 'Keep', '통계', '이미지', '동영상'
      ];

      const allElements = Array.from(document.querySelectorAll('a, span, strong, b, em, div, p, h3, h4'));
      const items: any[] = [];

      for (const el of allElements) {
          const text = el.textContent?.trim() || '';
          if (text.length < 1) continue;
          if (text === '네이버' || text === 'NAVER' || text === '블로그') continue;

          const rect = el.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) continue; 
          
          const style = window.getComputedStyle(el);
          
          let href = '';
          const anchor = el.tagName === 'A' ? el : el.closest('a');
          if (anchor && (anchor as HTMLAnchorElement).href) {
             href = (anchor as HTMLAnchorElement).href;
          }

          // [안전장치] 타겟 닉네임이 포함된 텍스트는 날짜로 분류 금지
          const normalizedText = cleanStringInBrowser(text);
          const containsTarget = targets.some((t: string) => normalizedText.includes(t));
          const isDate = !containsTarget && dateRegex.test(text) && text.length < 30;

          items.push({
              text: text,
              y: rect.top,
              x: rect.left,
              fontSize: parseFloat(style.fontSize),
              isBold: style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600,
              href: href,
              isDate: isDate
          });
      }

      items.sort((a, b) => a.y - b.y);

      // 날짜 그룹핑
      const dateItems = items.filter(i => i.isDate);
      const uniqueDates: any[] = [];
      if (dateItems.length > 0) {
        uniqueDates.push(dateItems[0]);
        for (let i = 1; i < dateItems.length; i++) {
            if (dateItems[i].y - dateItems[i-1].y > 10) { 
                uniqueDates.push(dateItems[i]);
            }
        }
      }

      const myRankings: any[] = [];
      let currentRank = 0;

      for (const dateItem of uniqueDates) {
          currentRank++;

          const dateMatch = dateItem.text.match(dateRegex);
          const cleanDate = dateMatch ? dateMatch[0] : dateItem.text;

          // 제목 찾기
          const titleCandidates = items.filter(i => 
              i.y > dateItem.y - 100 &&     
              i.y < dateItem.y + 120 &&   
              !i.isDate
          );

          let title = '';
          let url = '';
          let maxScore = -9999;

          for (const t of titleCandidates) {
              if (TRASH_KEYWORDS.some(k => t.text.includes(k))) continue;
              
              let score = t.fontSize * 10;
              if (t.isBold) score += 30;
              if (t.text.length < 2) score -= 50; 

              if (score > maxScore) {
                  maxScore = score;
                  title = t.text;
                  if (t.href) url = t.href;
              }
          }

          if (!url) {
              const link = titleCandidates.find(t => t.href && t.href.startsWith('http'));
              if (link) url = link.href;
          }

          // [작성자 찾기 핵심 수정]
          const nickCandidates = items.filter(i => 
              Math.abs(i.y - dateItem.y) < 50 &&  // 같은 줄(높이)
              !i.isDate &&                        // 날짜 아님
              i.fontSize < 16                     // [NEW] 폰트 크기가 16px 미만이어야 함 (제목 오인식 방지)
          );
          
          let bestMatchAuthor = '';
          let firstFoundAuthor = '';

          for (const n of nickCandidates) {
              let clean = n.text.replace(/Keep|통계/g, '').trim();
              
              clean = clean.replace(dateRegex, '').trim();
              clean = clean.replace(/^\.+|\.+$/g, '');

              if (clean.length > 1) {
                  // 제목과 똑같은 텍스트라면 제외 (한번 더 안전장치)
                  if (title && clean === title) continue;

                  if (!firstFoundAuthor) firstFoundAuthor = clean;

                  // 특수문자 제거 후 비교
                  const normalizedClean = cleanStringInBrowser(clean);
                  const isTarget = targets.some((t: string) => normalizedClean.includes(t));

                  if (isTarget) {
                      bestMatchAuthor = clean; 
                      break; 
                  }
              }
          }

          let author = bestMatchAuthor || firstFoundAuthor || '(알수없음)';

          // 최종 검증
          const normalizedAuthor = cleanStringInBrowser(author);
          const isMyPost = targets.some((t: string) => normalizedAuthor.includes(t));

          if (isMyPost) {
            myRankings.push({
              rank: currentRank,
              title: title || '제목 없음',
              author: author,
              date: cleanDate,
              url: url,
              section: '블로그탭'
            });
          }

          if (currentRank >= 30) break; 
      }

      return myRankings; 

    }, targets);

    if (foundItems.length > 0) {
      return { 
        success: true, 
        message: `총 ${foundItems.length}건 발견`, 
        data: foundItems
      };
    } else {
      return { success: false, message: '순위 밖' };
    }

  } catch (error) {
    console.error('Error:', error);
    return { success: false, message: 'Error' };
  } finally {
    if (browser) await browser.close();
  }
}