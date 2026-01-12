'use server';

import puppeteer from 'puppeteer';

interface RankResult {
  success: boolean;
  message: string;
  data?: {
    totalRank: number;
    title: string;
    author: string;
    date: string;
    url: string;
    section: string;
  };
}

export async function checkNaverBlogRank(keyword: string, targetNickname: string): Promise<RankResult> {
  console.log(`\n========== [블로그 탭 순위 체크(Type B): ${keyword}] ==========`);

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

    for (let i = 0; i < 5; i++) { 
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const { foundData } = await page.evaluate((targetNick) => {
      const normalize = (text: string | null) => text ? text.replace(/\s+/g, '').toLowerCase().trim() : '';
      const targetNormal = normalize(targetNick);

      const dateRegex = /(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}|\d+(?:시간|분|일|주|개월|년)\s*전|어제|방금\s*전)/;
      
      let cutOffY = 999999; 

      // [수정 1] 위험한 필터 단어 제거
      // '이미지', '동영상', '쇼핑', '뉴스', '지도' 등이 제목에 포함될 경우 글 자체가 누락되는 문제 방지
      const TRASH_KEYWORDS = [
          '설정시작', '설정끝', '년(Year)', '월(Month)', '일(Day)', 
          '직접입력', '옵션', '펼치기', '접기', '초기화', 
          '19901991', '20002001', '기간', '전체', '정렬', '관련도순', 
          '최신순', '지식iN', 
          '도움말', '자동완성', '로그인',
          '함께 보면 좋은', '관련 출처', '지식백과', '추천 콘텐츠', '비슷한 글', '인기글',
          'Naver', 'naver', 'NAVER', '네이버', '블로그', '카페', 'Blog', '더보기' 
      ];
      
      const elements = Array.from(document.querySelectorAll('a, span, strong, div.title, p, h3, h4, li, div'));
      
      let candidates: any[] = [];
      const processedElements = new Set();

      for (const el of elements) {
          const text = el.textContent?.trim() || '';
          if (text.length < 2) continue;
          if (processedElements.has(el)) continue;
          if (el.children.length > 2 && text.length > 100) continue; 
          
          if (TRASH_KEYWORDS.some(k => text.includes(k))) continue;
          
          // '네이버' 단어는 메뉴바 등에서 많이 나오지만, 제목에 '네이버'가 들어갈 수도 있으므로
          // 정확히 '네이버' 또는 'NAVER' 만 있는 경우에만 거릅니다.
          if (text === '네이버' || text === 'NAVER') continue;

          const rect = el.getBoundingClientRect();
          
          if (rect.width < 1 || rect.height < 1) continue;
          if (rect.width < 10) continue; 
          if (rect.top >= cutOffY) continue;

          const style = window.getComputedStyle(el);
          const fontSize = parseFloat(style.fontSize);
          const fontWeight = style.fontWeight;
          const isBold = fontWeight === 'bold' || parseInt(fontWeight) >= 600;

          let href = '';
          const anchor = el.tagName === 'A' ? el : el.closest('a');
          if (anchor && (anchor as HTMLAnchorElement).href) {
             href = (anchor as HTMLAnchorElement).href;
          }

          candidates.push({
              text: text,
              y: rect.top,
              fontSize: fontSize,
              isBold: isBold,
              hasDate: dateRegex.test(text),
              isUrl: href.length > 0, 
              href: href,
              element: el
          });
          processedElements.add(el);
      }

      candidates.sort((a, b) => a.y - b.y);

      const groups: any[] = [];
      let currentGroup: any = null;
      const GROUP_THRESHOLD = 50; 

      for (const item of candidates) {
          if (item.isUrl && item.text.includes('http') && !normalize(item.text).includes(targetNormal)) continue;

          if (!currentGroup || (item.y - currentGroup.baseY > GROUP_THRESHOLD)) {
              if (currentGroup && currentGroup.hasDate) {
                  groups.push(currentGroup);
              }
              currentGroup = {
                  baseY: item.y,
                  hasDate: item.hasDate,
                  items: [item]
              };
          } else {
              currentGroup.items.push(item);
              if (item.hasDate) currentGroup.hasDate = true;
          }
      }
      if (currentGroup && currentGroup.hasDate) {
          groups.push(currentGroup);
      }

      let realRank = 0;
      let found = null;

      for (const group of groups) {
          if (!group.hasDate) continue;

          realRank++;
          
          let title = '';
          let author = '(알수없음)';
          let dateStr = '(날짜없음)';
          let finalUrl = '';
          
          let maxScore = -9999;
          let maxFontSize = 0;
          let dateItemY = -1; 

          for (const item of group.items) {
             const dMatch = item.text.match(dateRegex);
             if (dMatch) {
                 dateStr = dMatch[0];
                 dateItemY = item.y;
                 let cleanText = item.text.replace(dMatch[0], '').trim();
                 
                 // [수정 2] 닉네임 뒤 'Keep', '통계' 등 불필요한 텍스트 제거
                 cleanText = cleanText.replace(/Keep|통계/g, '').trim();
                 cleanText = cleanText.replace(/^\.+|\.+$/g, ''); // 앞뒤 점(.) 제거

                 if (cleanText.length > 1) author = cleanText;
                 break; 
             }
          }

          for (const item of group.items) {
              if (dateItemY !== -1 && item.y < dateItemY - 5) continue;
              if (item.fontSize > maxFontSize) maxFontSize = item.fontSize;
          }

          for (const item of group.items) {
              if (dateItemY !== -1 && item.y < dateItemY - 5) continue;

              let score = item.fontSize * 10;
              if (item.isBold) score += 20;

              if (item.text.match(dateRegex)) score -= 1000;
              if (item.text.includes('|')) score -= 100;
              if (!item.href || item.href === '') score -= 50;
              if (item.fontSize < maxFontSize - 1) score -= 50;

              if (score > maxScore) {
                  maxScore = score;
                  title = item.text;
                  if (item.href) finalUrl = item.href;
              }
          }

          if (!finalUrl) {
            const linkItem = group.items.find((i:any) => 
                i.href && 
                i.href.startsWith('http') && 
                !i.text.match(dateRegex) &&
                (dateItemY === -1 || i.y >= dateItemY - 5)
            );
            
            if (linkItem) {
                finalUrl = linkItem.href;
                if (!title || title === '') title = linkItem.text; 
            }
          }
          
          // [수정 3] 제목에서 불필요한 'Keep' 텍스트 제거 (혹시 제목에 붙었을 경우 대비)
          if (title) {
             title = title.replace(/Keep/g, '').trim();
          }

          const fullText = group.items.map((i:any) => i.text).join(' ');
          
          if (normalize(fullText).includes(targetNormal)) {
               found = { 
                  totalRank: realRank, 
                  title: title, 
                  author: author, 
                  date: dateStr,
                  url: finalUrl,
                  section: '블로그탭'
              };
              break; 
          }
      }

      return { foundData: found };
    }, targetNickname);

    if (foundData) {
      return { success: true, message: `성공! ${foundData.totalRank}위`, data: foundData };
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