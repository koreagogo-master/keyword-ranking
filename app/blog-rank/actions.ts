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

export async function checkNaverRank(keyword: string, targetNickname: string): Promise<RankResult> {
  // 개발자님 요청: "눈에 안 보이는 데이터 삭제" -> 너비(Width) 필터링 적용
  console.log(`\n========== [Final Filter: 좁은 카드(가짜 순위) 제거] ==========`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true, 
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    // 모바일 뷰포트 (아이폰 12 Pro 기준: 390px)
    await page.setViewport({ width: 390, height: 844 });
    
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    );

    const searchUrl = `https://m.search.naver.com/search.naver?where=m&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(keyword)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('⬇️ 스크롤 다운 중...');
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const { foundData } = await page.evaluate((targetNick) => {
      const normalize = (text: string | null) => text ? text.replace(/\s+/g, '').toLowerCase().trim() : '';
      const targetNormal = normalize(targetNick);

      const dateRegex = /(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}|\d+(?:시간|분|일|주|개월|년)\s*전|어제|방금\s*전)/;
      const urlRegex = /([a-zA-Z0-9-]+\.(com|co\.kr|net)|www\.)/;

      // 1. 차단선(Cut-off) 로직 유지
      const stopKeywords = ['함께 보면 좋은', '함께 볼만한', '추천 콘텐츠', '비슷한 글', '다른 글'];
      let cutOffY = 999999; 

      const allElements = document.querySelectorAll('h2, h3, h4, span, div, strong');
      for (const el of allElements) {
          const text = el.textContent?.trim() || '';
          if (stopKeywords.some(k => text.includes(k))) {
              const rect = el.getBoundingClientRect();
              if (rect.top > 100 && rect.top < cutOffY) {
                  cutOffY = rect.top; 
              }
          }
      }
      
      const TRASH_KEYWORDS = [
          '설정시작', '설정끝', '년(Year)', '월(Month)', '일(Day)', 
          '직접입력', '옵션', '펼치기', '접기', '초기화', 
          '19901991', '20002001', '기간', '전체', '정렬', '관련도순', 
          '최신순', '이미지', '동영상', '쇼핑', '뉴스', '지식iN', 
          '지도', '도움말', '자동완성', '로그인',
          '함께 보면 좋은', '관련 출처', '지식백과', '추천 콘텐츠', '비슷한 글', '인기글',
          'Naver', 'naver', 'NAVER', '네이버', '블로그', '카페', 'Blog', '더보기'
      ];
      
      const SECTION_HEADERS = ['인기글', '스마트블록', 'VIEW', '블로그', '카페', '지식백과', '함께 보면 좋은'];

      const elements = Array.from(document.querySelectorAll('a, span, strong, div.title, p, h3, h4, li, div'));
      
      let candidates: any[] = [];
      const processedElements = new Set();

      for (const el of elements) {
          const text = el.textContent?.trim() || '';
          if (text.length < 2) continue;
          if (processedElements.has(el)) continue;
          if (el.children.length > 2 && text.length > 100) continue; 
          
          if (TRASH_KEYWORDS.some(k => text.includes(k))) continue;
          if (text.toLowerCase() === 'naver' || text === '네이버') continue;

          const rect = el.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) continue;

          // [핵심 수정] 너비(Width) 필터 적용
          // 화면 너비(390px) 기준으로, 메인 글은 보통 340px 이상 차지합니다.
          // 추천 카드나 썸네일 옆 텍스트는 폭이 좁습니다.
          // 안전하게 280px 미만인 요소는 "메인 순위 글이 아니다"라고 판단하고 버립니다.
          if (rect.width < 280) continue;

          // 차단선 아래 무시
          if (rect.top >= cutOffY) continue;

          const style = window.getComputedStyle(el);
          const fontSize = parseFloat(style.fontSize);
          const fontWeight = style.fontWeight;
          const isBold = fontWeight === 'bold' || parseInt(fontWeight) >= 600;

          candidates.push({
              text: text,
              y: rect.top,
              fontSize: fontSize,
              isBold: isBold,
              hasDate: dateRegex.test(text),
              isUrl: urlRegex.test(text),
              element: el
          });
          processedElements.add(el);
      }

      candidates.sort((a, b) => a.y - b.y);

      const groups: any[] = [];
      let currentGroup: any = null;
      const GROUP_THRESHOLD = 100;

      for (const item of candidates) {
          if (item.isUrl && !normalize(item.text).includes(targetNormal)) continue;

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
          realRank++;
          
          let title = '';
          let author = '(알수없음)';
          let dateStr = '(날짜없음)';
          let maxScore = -9999;
          let maxFontSize = 0;

          group.items.forEach((i: any) => {
              if (i.fontSize > maxFontSize) maxFontSize = i.fontSize;
          });

          for (const item of group.items) {
              const dMatch = item.text.match(dateRegex);
              if (dMatch) {
                  dateStr = dMatch[0];
                  const cleanText = item.text.replace(dMatch[0], '').trim();
                  const potentialAuthor = cleanText.replace(/^[.|·\s]+|[.|·\s]+$/g, '');
                  if (potentialAuthor.length > 1 && potentialAuthor.length < 50) {
                      author = potentialAuthor;
                  }
              }

              let score = item.fontSize * 10;
              if (item.isBold) score += 20;
              if (item.text.includes('|')) score -= 50;
              if (dMatch) score -= 100;
              if (SECTION_HEADERS.includes(item.text)) score = -9999;
              
              if (group.items.some((i:any) => i.text.includes('함께 보면 좋은'))) {
                  score = -99999;
              }

              if (item.fontSize < maxFontSize - 1) score -= 50;
              const relativeY = item.y - group.baseY;
              score -= relativeY * 0.5; 

              if (score > maxScore) {
                  maxScore = score;
                  title = item.text;
              }
          }

          if (author === '(알수없음)') {
              const candidates = group.items.filter((i:any) => 
                  !i.text.match(dateRegex) && i.text !== title && i.fontSize < maxFontSize && !i.text.includes('|')
              );
              if (candidates.length > 0) author = candidates[0].text;
          }

          const fullText = group.items.map((i:any) => i.text).join(' ');
          
          if (TRASH_KEYWORDS.some(k => fullText.includes(k))) continue;

          if (normalize(fullText).includes(targetNormal)) {
               found = { 
                  totalRank: realRank, 
                  title: title, 
                  author: author, 
                  date: dateStr,
                  url: '', 
                  section: '통합검색' 
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