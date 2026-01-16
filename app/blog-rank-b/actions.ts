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
  // 터미널 확인용 로그
  console.log(`\n========== [DEBUG: 작성일 순수 추출 모드] ==========`);
  console.log(`검색 키워드: ${keyword}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true, 
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    
    // 모바일 환경 에뮬레이션
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    );

    const searchUrl = `https://m.search.naver.com/search.naver?ssc=tab.m_blog.all&where=m_blog&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(keyword)}`;
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // 스크롤 다운 (7위권 데이터 확보)
    for (let i = 0; i < 5; i++) { 
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 데이터 추출 로직
    const crawledData = await page.evaluate((targetNick) => {
      const normalize = (text: string | null) => text ? text.replace(/\s+/g, '').toLowerCase().trim() : '';
      const targetNormal = normalize(targetNick);
      
      // 날짜 정규식 (형식: 2024.1.1. 또는 1시간 전 등)
      const dateRegex = /(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}|\d+(?:시간|분|일|주|개월|년)\s*전|어제|방금\s*전)/;

      // 제목 오인 방지 키워드
      const TRASH_KEYWORDS = [
          '설정시작', '설정끝', '년(Year)', '월(Month)', '일(Day)', '직접입력', '옵션', '펼치기', '접기', 
          '초기화', '기간', '전체', '정렬', '관련도순', '최신순', '지식iN', '도움말', '자동완성', 
          '로그인', '함께 보면 좋은', '관련 출처', '지식백과', '추천 콘텐츠', '비슷한 글', '인기글', 
          'Naver', 'naver', 'NAVER', '네이버', '블로그', '카페', 'Blog', '더보기', 'Keep', '통계', '이미지', '동영상'
      ];

      // 1. 모든 텍스트 요소 수집
      const allElements = Array.from(document.querySelectorAll('a, span, strong, div, p, h3, h4'));
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

          items.push({
              text: text,
              y: rect.top,
              x: rect.left,
              fontSize: parseFloat(style.fontSize),
              isBold: style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600,
              href: href,
              isDate: dateRegex.test(text) && text.length < 30 // 날짜 형식 포함 여부 체크
          });
      }

      // Y좌표 정렬
      items.sort((a, b) => a.y - b.y);

      // 2. 날짜(Date) 기준 앵커링
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

      const rankList: any[] = [];
      let currentRank = 0;

      for (const dateItem of uniqueDates) {
          currentRank++;

          // [수정 포인트] 날짜 텍스트에서 '진짜 날짜'만 정규식으로 추출
          // 예: "닉네임 1시간 전" -> "1시간 전"만 추출
          const dateMatch = dateItem.text.match(dateRegex);
          const cleanDate = dateMatch ? dateMatch[0] : dateItem.text;

          // [제목 찾기]
          let title = '';
          let url = '';
          let maxScore = -9999;
          
          const titleCandidates = items.filter(i => 
              i.y > dateItem.y + 2 &&     
              i.y < dateItem.y + 120 &&   
              !i.isDate
          );

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

          // [닉네임 찾기]
          let author = '(알수없음)';
          const nickCandidates = items.filter(i => 
              Math.abs(i.y - dateItem.y) < 15 &&  
              !i.isDate && 
              i.x < dateItem.x 
          );
          
          for (const n of nickCandidates) {
              let clean = n.text.replace(/Keep|통계/g, '').trim();
              clean = clean.replace(/^\.+|\.+$/g, '');
              if (clean.length > 1) {
                  author = clean;
                  break;
              }
          }

          rankList.push({
              rank: currentRank,
              title: title || '제목 없음',
              author: author,
              date: cleanDate, // 정제된 날짜만 사용
              url: url
          });

          if (currentRank >= 30) break; 
      }

      const foundItem = rankList.find(r => normalize(r.author).includes(targetNormal));
      const top7 = rankList.slice(0, 7);

      return {
          found: foundItem ? {
              totalRank: foundItem.rank,
              title: foundItem.title,
              author: foundItem.author,
              date: foundItem.date,
              url: foundItem.url,
              section: '블로그탭'
          } : null,
          topList: top7
      };

    }, targetNickname);

    // [터미널 출력]
    if (crawledData.topList && crawledData.topList.length > 0) {
        console.log(`\n------------------------------------------------`);
        console.log(`🔎 [최종 정제 결과 (제목만 추출)]`);
        crawledData.topList.forEach((item: any) => {
            console.log(`[${item.rank}위] ${item.title}`);
        });
        console.log(`------------------------------------------------\n`);
    } else {
        console.log('\n⚠️ 상위 랭킹 리스트를 찾지 못했습니다.\n');
    }

    if (crawledData.found) {
      return { success: true, message: `성공! ${crawledData.found.totalRank}위`, data: crawledData.found };
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