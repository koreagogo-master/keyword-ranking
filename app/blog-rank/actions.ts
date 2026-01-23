'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
// [변경 1] 우리가 만든 공통 프록시 도구 가져오기
import { launchProxyBrowser, setupPage } from '@/app/lib/puppeteerHelper';

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

// ==================================================================
// 1. [블로그 탭] 순위 확인 (로그인 체크 + 프록시)
// ==================================================================
export async function checkNaverBlogRank(keyword: string, targetNickname: string): Promise<RankResult> {
  // [보안 1] 로그인 체크 시작
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: '로그인이 필요한 서비스입니다.' };
  // [보안 1] 로그인 체크 끝

  console.log(`\n========== [블로그 탭(Blog Tab) 순위 체크] ==========`);
  console.log(`검색 키워드: ${keyword}`);

  let browser;
  try {
    browser = await launchProxyBrowser();
    const page = await browser.newPage();
    await setupPage(page);

    const searchUrl = `https://m.search.naver.com/search.naver?ssc=tab.m_blog.all&where=m_blog&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(keyword)}`;
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    for (let i = 0; i < 5; i++) { 
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const crawledData = await page.evaluate((targetNick) => {
      const normalize = (text: string | null) => text ? text.replace(/\s+/g, '').toLowerCase().trim() : '';
      const targetNormal = normalize(targetNick);
      
      const dateRegex = /(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}|\d+(?:시간|분|일|주|개월|년)\s*전|어제|방금\s*전)/;

      const TRASH_KEYWORDS = [
          '설정시작', '설정끝', '년(Year)', '월(Month)', '일(Day)', '직접입력', '옵션', '펼치기', '접기', 
          '초기화', '기간', '전체', '정렬', '관련도순', '최신순', '지식iN', '도움말', '자동완성', 
          '로그인', '함께 보면 좋은', '관련 출처', '지식백과', '추천 콘텐츠', '비슷한 글', '인기글', 
          'Naver', 'naver', 'NAVER', '네이버', '블로그', '카페', 'Blog', '더보기', 'Keep', '통계', '이미지', '동영상'
      ];

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
              isDate: dateRegex.test(text) && text.length < 30
          });
      }

      items.sort((a, b) => a.y - b.y);

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

          const dateMatch = dateItem.text.match(dateRegex);
          const cleanDate = dateMatch ? dateMatch[0] : dateItem.text;

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
              date: cleanDate,
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

    if (crawledData.topList && crawledData.topList.length > 0) {
        console.log(`\n------------------------------------------------`);
        console.log(`🔎 [블로그탭 상위 7위 리스트]`);
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

// ==================================================================
// 2. [통합검색] 순위 확인 (로그인 체크 + 프록시)
// ==================================================================
export async function checkNaverRank(keyword: string, targetNickname: string): Promise<RankResult> {
  // [보안 2] 로그인 체크 시작
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: '로그인이 필요한 서비스입니다.' };
  // [보안 2] 로그인 체크 끝

  console.log(`\n========== [통합검색: 그룹핑 유지 + Global 제목 탐색] ==========`);
  console.log(`검색 키워드: ${keyword}`);

  let browser;
  try {
    browser = await launchProxyBrowser();
    const page = await browser.newPage();
    await setupPage(page);

    const searchUrl = `https://m.search.naver.com/search.naver?where=m&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(keyword)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('⬇️ 스크롤 다운 중...');
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const { foundData } = await page.evaluate((targetNick) => {
      const normalize = (text: string | null) => text ? text.replace(/\s+/g, '').toLowerCase().trim() : '';
      const targetNormal = normalize(targetNick);

      const dateRegex = /(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}|\d+(?:시간|분|일|주|개월|년)\s*전|어제|방금\s*전)/;
      const urlRegex = /([a-zA-Z0-9-]+\.(com|co\.kr|net)|www\.)/;

      const stopKeywords = ['함께 보면 좋은', '함께 볼만한', '추천 콘텐츠', '비슷한 글', '다른 글'];
      let cutOffY = 999999; 

      const allTags = document.querySelectorAll('h2, h3, h4, span, div, strong');
      for (const el of allTags) {
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
          '지도', '도움말', '자동완성', '로그인', '더보기'
      ];

      const elements = Array.from(document.querySelectorAll('a, span, strong, div.title, p, h3, h4, li, div'));
      
      let candidates: any[] = [];
      const processedElements = new Set();

      for (const el of elements) {
          const text = el.textContent?.trim() || '';
          if (text.length < 2) continue;
          if (processedElements.has(el)) continue;
          
          if (TRASH_KEYWORDS.some(k => text.includes(k))) continue;
          if (text.toLowerCase() === 'naver' || text === '네이버') continue;

          const rect = el.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) continue;
          if (rect.width < 280) continue; // 좁은 카드 필터링
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

      // 2. 그룹화
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

      // 3. 순위 루프
      for (const group of groups) {
          realRank++;
          
          let title = '';
          let author = '(알수없음)';
          let dateStr = '(날짜없음)';
          let maxScore = -9999;

          const dateItem = group.items.find((i: any) => i.hasDate);
          
          if (dateItem) {
              const dMatch = dateItem.text.match(dateRegex);
              if (dMatch) {
                  dateStr = dMatch[0];
                  const cleanText = dateItem.text.replace(dMatch[0], '').trim();
                  const potentialAuthor = cleanText.replace(/^[.|·\s]+|[.|·\s]+$/g, '');
                  if (potentialAuthor.length > 1 && potentialAuthor.length < 50) {
                      author = potentialAuthor;
                  }
              }
          }

          let titleCandidates: any[] = [];
          
          if (dateItem) {
              titleCandidates = candidates.filter((c: any) => 
                  c.y > dateItem.y &&             
                  c.y < dateItem.y + 120 &&       
                  !c.hasDate                      
              );
          }

          for (const item of titleCandidates) {
              let score = item.fontSize * 10; 
              if (item.isBold) score += 20;   
              
              if (item.text.includes('|')) score -= 100; 
              if (item.text.length > 80) score -= 20; 
              if (item.text.includes('함께 보면 좋은')) score = -9999;

              if (score > maxScore) {
                  maxScore = score;
                  title = item.text;
              }
          }

          if (author === '(알수없음)' && dateItem) {
              const cands = candidates.filter(i => 
                  Math.abs(i.y - dateItem.y) < 20 && 
                  !i.hasDate && 
                  i.text !== title && 
                  !i.text.includes('|') &&
                  i.text.length < 20
              );
              if (cands.length > 0) author = cands[0].text;
          }

          const fullText = group.items.map((i:any) => i.text).join(' ');
          
          if (normalize(fullText).includes(targetNormal) || normalize(author).includes(targetNormal)) {
               found = { 
                  totalRank: realRank, 
                  title: title || '제목 없음', 
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