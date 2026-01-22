'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import puppeteer from 'puppeteer';

// ==============================================================================
// [프록시 설정 완료] 회원님이 주신 정보가 적용되었습니다.
// ==============================================================================
const PROXY_HOST = 'proxy.smartproxy.net'; 
const PROXY_PORT = '3120';
const PROXY_USER = 'smart-tmgad01_area-KR';
const PROXY_PASS = 'bsh103501';
// ==============================================================================

interface RankItem {
  rank: number;
  title: string;
  author: string;
  date: string;
  url: string;
  section?: string;
}

interface RankResult {
  success: boolean;
  message: string;
  data?: RankItem[];
  screenshot?: string; 
}

export async function checkNaverBlogRank(keyword: string, targetNicknames: string): Promise<RankResult> {
  
  // [보안 검사: 로그인 및 등급 확인]
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: '로그인이 필요한 서비스입니다.' };

    const { data: profile } = await supabase.from('profiles').select('grade').eq('id', user.id).single();
    if (!profile || profile.grade === 'free') {
      return { success: false, message: '무료 등급 사용 불가. 유료 등급으로 전환해주세요.' };
    }
  } catch (err) {
    console.error('Auth Check Error:', err);
    return { success: false, message: '권한 확인 중 오류가 발생했습니다.' };
  }

  const cleanString = (str: string) => str.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase();
  const targets = targetNicknames.split(',').map(n => cleanString(n)).filter(n => n.length > 0);
  
  let browser;
  try {
    // [프록시를 적용하여 브라우저 실행]
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        // 프록시 서버 경유 설정
        `--proxy-server=http://${PROXY_HOST}:${PROXY_PORT}`, 
        '--disable-blink-features=AutomationControlled' 
      ],
    });

    const page = await browser.newPage();
    
    // [프록시 로그인]
    await page.authenticate({ 
      username: PROXY_USER, 
      password: PROXY_PASS 
    });

    await page.setViewport({ width: 390, height: 844 });
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    );

    const searchUrl = `https://m.search.naver.com/search.naver?ssc=tab.m_blog.all&where=m_blog&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(keyword)}`;
    
    // 접속 (타임아웃 60초)
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // [CCTV] 확인용 스크린샷 찍기 (디버깅용)
    await new Promise(resolve => setTimeout(resolve, 1500));
    const screenshotBase64 = await page.screenshot({ encoding: 'base64' });

    // 스크롤 다운 (데이터 로딩)
    for (let i = 0; i < 5; i++) { 
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 500));

    // [데이터 추출 로직]
    const foundItems = await page.evaluate((targets) => {
      const cleanStringInBrowser = (str: string | null) => str ? str.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase() : '';
      const dateRegex = /(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}|\d+(?:시간|분|일|주|개월|년)\s*전|어제|방금\s*전)/;
      
      const allElements = Array.from(document.querySelectorAll('a, span, strong, b, em, div, p, h3, h4'));
      const items: any[] = [];

      for (const el of allElements) {
          const text = el.textContent?.trim() || '';
          if (text.length < 1) continue;
          if (['네이버', 'NAVER', '블로그'].includes(text)) continue;

          const rect = el.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) continue; 
          
          let href = '';
          const anchor = el.tagName === 'A' ? el : el.closest('a');
          if (anchor && (anchor as HTMLAnchorElement).href) href = (anchor as HTMLAnchorElement).href;

          const style = window.getComputedStyle(el);
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

      const dateItems = items.filter(i => i.isDate);
      const uniqueDates: any[] = [];
      if (dateItems.length > 0) {
        uniqueDates.push(dateItems[0]);
        for (let i = 1; i < dateItems.length; i++) {
            if (dateItems[i].y - dateItems[i-1].y > 10) uniqueDates.push(dateItems[i]);
        }
      }

      const myRankings: any[] = [];
      let currentRank = 0;

      for (const dateItem of uniqueDates) {
          currentRank++;
          const dateMatch = dateItem.text.match(dateRegex);
          const cleanDate = dateMatch ? dateMatch[0] : dateItem.text;

          const titleCandidates = items.filter(i => i.y > dateItem.y - 100 && i.y < dateItem.y + 120 && !i.isDate);
          let title = '';
          let url = '';
          let maxScore = -9999;

          for (const t of titleCandidates) {
              if (['설정시작', '펼치기', '접기'].some(k => t.text.includes(k))) continue;
              let score = t.fontSize * 10 + (t.isBold ? 30 : 0) - (t.text.length < 2 ? 50 : 0);
              if (score > maxScore) { maxScore = score; title = t.text; if (t.href) url = t.href; }
          }
          if (!url) {
              const link = titleCandidates.find(t => t.href && t.href.startsWith('http'));
              if (link) url = link.href;
          }

          const nickCandidates = items.filter(i => Math.abs(i.y - dateItem.y) < 50 && !i.isDate && i.fontSize < 16);
          let author = '';
          
          for (const n of nickCandidates) {
              let clean = n.text.replace(/Keep|통계/g, '').trim().replace(dateRegex, '').replace(/^\.+|\.+$/g, '');
              if (clean.length > 1) {
                  if (title && clean === title) continue;
                  if (!author) author = clean;
                  const normalizedClean = cleanStringInBrowser(clean);
                  if (targets.some((t: string) => normalizedClean === t)) { author = clean; break; }
              }
          }
          author = author || '(알수없음)';
          const normalizedAuthor = cleanStringInBrowser(author);
          
          if (targets.some((t: string) => normalizedAuthor === t)) {
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
        message: `총 ${foundItems.length}건 발견 (프록시 성공)`, 
        data: foundItems,
        screenshot: screenshotBase64 // 성공 시에도 사진 함께 반환
      };
    } else {
      return { 
        success: false, 
        message: '순위 밖 (프록시는 작동함)', 
        screenshot: screenshotBase64 
      };
    }

  } catch (error) {
    console.error('Error:', error);
    return { success: false, message: 'Proxy Error (설정 확인 필요)' };
  } finally {
    if (browser) await browser.close();
  }
}