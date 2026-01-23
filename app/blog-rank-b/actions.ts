'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
// [중요] 방금 만든 공통 도구를 가져옵니다.
import { launchProxyBrowser, setupPage } from '@/app/lib/puppeteerHelper';

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
  try {
    // 1. 사용자 인증 (Supabase)
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
    
    // 2. 브라우저 실행 (공통 도구 사용)
    const browser = await launchProxyBrowser();

    // 3. 페이지 생성 및 설정 (공통 도구 사용 - 프록시 인증/모바일 설정 등)
    const page = await browser.newPage();
    await setupPage(page);

    // 4. 네이버 접속
    const searchUrl = `https://m.search.naver.com/search.naver?ssc=tab.m_blog.all&where=m_blog&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(keyword)}`;
    
    try {
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (e) {
        await browser.close();
        return { success: false, message: '네이버 접속 시간 초과 (프록시 재시도 필요)' };
    }

    const screenshotBase64 = await page.screenshot({ encoding: 'base64' });

    // 5. 스크롤 (데이터 로딩)
    for (let i = 0; i < 3; i++) { 
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 6. 데이터 분석 로직 (기존 로직 유지)
    const cleanString = (str: string) => str.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase();
    const targets = targetNicknames.split(',').map(n => cleanString(n)).filter(n => n.length > 0);

    const foundItems = await page.evaluate((targets) => {
      const cleanStringInBrowser = (str: string | null) => str ? str.replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase() : '';
      const dateRegex = /(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}|\d+(?:시간|분|일|주|개월|년)\s*전|어제|방금\s*전)/;
      const allElements = Array.from(document.querySelectorAll('a, span, strong, b, em, div, p, h3, h4'));
      const items: any[] = [];
      for (const el of allElements) {
          const text = el.textContent?.trim() || '';
          if (text.length < 1 || ['네이버', 'NAVER', '블로그'].includes(text)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) continue; 
          let href = ''; const anchor = el.closest('a'); if (anchor && anchor.href) href = anchor.href;
          const normalizedText = cleanStringInBrowser(text);
          const isDate = !targets.some((t: string) => normalizedText.includes(t)) && dateRegex.test(text) && text.length < 30;
          items.push({ text: text, y: rect.top, fontSize: parseFloat(window.getComputedStyle(el).fontSize), isBold: window.getComputedStyle(el).fontWeight === 'bold', href: href, isDate: isDate });
      }
      items.sort((a, b) => a.y - b.y);
      const uniqueDates: any[] = []; const dateItems = items.filter(i => i.isDate);
      if (dateItems.length > 0) { uniqueDates.push(dateItems[0]); for (let i = 1; i < dateItems.length; i++) { if (dateItems[i].y - dateItems[i-1].y > 10) uniqueDates.push(dateItems[i]); } }
      const myRankings: any[] = []; let currentRank = 0;
      for (const dateItem of uniqueDates) {
          currentRank++;
          const dateMatch = dateItem.text.match(dateRegex);
          const cleanDate = dateMatch ? dateMatch[0] : dateItem.text;
          const titleCandidates = items.filter(i => i.y > dateItem.y - 100 && i.y < dateItem.y + 120 && !i.isDate);
          let title = '', url = '', maxScore = -9999;
          for (const t of titleCandidates) {
              if (['설정시작'].some(k => t.text.includes(k))) continue;
              let score = t.fontSize * 10 + (t.isBold ? 30 : 0) - (t.text.length < 2 ? 50 : 0);
              if (score > maxScore) { maxScore = score; title = t.text; if (t.href) url = t.href; }
          }
          if (!url) { const link = titleCandidates.find(t => t.href && t.href.startsWith('http')); if (link) url = link.href; }
          const nickCandidates = items.filter(i => Math.abs(i.y - dateItem.y) < 50 && !i.isDate && i.fontSize < 16);
          let author = '';
          for (const n of nickCandidates) {
              let clean = n.text.replace(/Keep|통계/g, '').trim().replace(dateRegex, '').replace(/^\.+|\.+$/g, '');
              if (clean.length > 1 && (!title || clean !== title)) {
                  const normalizedClean = cleanStringInBrowser(clean);
                  if (targets.some((t: string) => normalizedClean === t)) { author = clean; break; }
                  if (!author) author = clean;
              }
          }
          author = author || '(알수없음)';
          const normalizedAuthor = cleanStringInBrowser(author);
          if (targets.some((t: string) => normalizedAuthor === t)) {
            myRankings.push({ rank: currentRank, title: title || '제목 없음', author: author, date: cleanDate, url: url, section: '블로그탭' });
          }
          if (currentRank >= 30) break; 
      }
      return myRankings; 
    }, targets);

    await browser.close();

    if (foundItems.length > 0) {
      return { success: true, message: `총 ${foundItems.length}건 발견`, data: foundItems, screenshot: screenshotBase64 };
    } else {
      return { success: false, message: '순위 밖 (이미지는 나옴)', screenshot: screenshotBase64 };
    }

  } catch (error: any) {
    console.error('Server Error:', error);
    return { success: false, message: `오류 발생: ${error.message || error}` };
  }
}