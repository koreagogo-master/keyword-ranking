'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { launchProxyBrowser, setupPage } from '@/app/lib/puppeteerHelper';

interface SectionItem {
  order: number;
  name: string;
}

interface AnalysisResult {
  success: boolean;
  message: string;
  data?: {
    mobile: SectionItem[];
    pc: SectionItem[];
  };
}

export async function checkSectionOrder(keyword: string): Promise<AnalysisResult> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: '로그인이 필요합니다.' };

  let browser;
  try {
    browser = await launchProxyBrowser();
    
    // PC 분석 OFF (빈 배열)
    const pcData: SectionItem[] = []; 
    const mobileData = await getMobileSections(browser, keyword);

    return {
      success: true,
      message: '완료',
      data: {
        mobile: mobileData,
        pc: pcData
      }
    };

  } catch (error) {
    console.error(error);
    return { success: false, message: '분석 중 오류 발생' };
  } finally {
    if (browser) await browser.close();
  }
}

// ---------------------------------------------------------
// 📱 모바일 섹션 분석 (광고 하단 사이트 차단 + 중복 제거)
// ---------------------------------------------------------
async function getMobileSections(browser: any, keyword: string): Promise<SectionItem[]> {
  const page = await browser.newPage();
  await setupPage(page);

  try {
    const url = `https://m.search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 스크롤
    for (let i = 0; i < 8; i++) {
        await page.evaluate(() => window.scrollBy(0, 1500));
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    await new Promise(resolve => setTimeout(resolve, 500)); 

    const rawSections = await page.evaluate((keyword: string) => {
      const selector = '.api_subject_bx, .group_set, section.sc, .ad_section, div[data-gdid], .api_relation_bx, .place_section, .total_wrap, .sc_new';
      const elements = document.querySelectorAll(selector);
      
      const candidates: { y: number, name: string, height: number }[] = [];
      const processedElements = new Set();

      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.height < 5) return;
        if (processedElements.has(el)) return;
        processedElements.add(el);

        const fullText = el.textContent || '';
        const htmlContent = el.innerHTML || '';
        let title = '';

        // [1] 제목 추출
        const titleEl = el.querySelector('.title_head, .title_area, .head_title, h2, h3, .tit_sub, strong.tit');
        if (titleEl) title = titleEl.textContent?.trim() || '';

        title = title.replace(/MY/g, '').trim(); 
        if (title === '내 장소') title = '플레이스';

        if (fullText.includes('함께 많이 찾는')) title = '함께 많이 찾는';
        else if (fullText.includes('함께 보면 좋은')) title = '함께 보면 좋은';
        else if (fullText.includes('연관검색어')) title = '연관검색어';

        // [2] 광고 여부 판단
        const isAdText = fullText.includes('관련광고') || fullText.includes('PowerLink') || fullText.includes('파워링크');
        const isTitleKeyword = title.replace(/\s/g, '') === keyword.replace(/\s/g, ''); 

        // 광고 확정 로직
        if (isAdText || isTitleKeyword) {
            if (!title.includes('함께') && !title.includes('연관')) {
                title = `${keyword} 관련 광고`;
            }
        }
        if (el.classList.contains('ad_section') || el.querySelector('.ad_area')) {
             title = `${keyword} 관련 광고`;
        }

        // [3] 플레이스
        if (title !== `${keyword} 관련 광고`) {
            const isPlace = 
                title === '플레이스' ||
                el.querySelector('.map_area') || 
                el.querySelector('.api_map_wrap') || 
                htmlContent.includes('map.naver.com') || 
                (fullText.includes('내위치') && fullText.includes('거리순')) ||
                el.classList.contains('place_section');

            if (isPlace) title = '플레이스';
        }

        // [4] 사이트
        if (title !== '플레이스' && title !== `${keyword} 관련 광고`) {
            const hasOrganicTitle = el.querySelector('.total_tit') || el.querySelector('.nsite_tit') || el.querySelector('.link_site');
            const hasUrlArea = el.querySelector('.url_area');
            const urlRegex = /[a-zA-Z0-9-]+\.(com|co\.kr|net|org|kr)/i;
            const hasUrlText = urlRegex.test(fullText);
            
            // 광고 영역이 아닌 깨끗한 상태에서 URL 구조가 보일 때
            if ((hasOrganicTitle || hasUrlArea || hasUrlText) && !isAdText) {
                title = '홈페이지(사이트)';
            }
        }

        // [5] VIEW
        if (!title && (el.querySelector('.view_wrap') || el.classList.contains('sp_nreview'))) {
            title = 'VIEW(블로그/카페)';
        }

        if (title && !['메뉴', '검색결과', '제안', '이미지', '뉴스', '지식iN'].includes(title)) {
             candidates.push({ y: rect.top, name: title, height: rect.height });
        }
      });

      candidates.sort((a, b) => a.y - b.y);

      return candidates;
    }, keyword);

    // ----------------------------------------------------------------
    // [후처리 필터링] 사용자 요청 반영
    // 1. 광고 바로 밑에 나오는 사이트는 무시 (Ad debris filtering)
    // 2. 중복 섹션 제거 (Unique filtering)
    // ----------------------------------------------------------------
    
    const finalSections: SectionItem[] = [];
    const addedNames = new Set<string>(); // 중복 방지용
    let lastAddedName = '';

    for (const item of rawSections) {
        // [규칙 1] 바로 이전에 추가된 섹션이 '광고'인데, 현재 섹션이 '사이트'라면? -> 무시!
        // (광고 하단 서브링크가 사이트로 오인되는 것을 방지)
        const isLastAd = lastAddedName.includes('광고') || lastAddedName.includes('파워링크');
        const isCurrentSite = item.name === '홈페이지(사이트)';

        if (isLastAd && isCurrentSite) {
            continue; // 건너뛰기
        }

        // [규칙 2] 이미 추가된 섹션 이름이면 무시 (중복 제거)
        if (addedNames.has(item.name)) {
            continue;
        }

        // 유효한 섹션 등록
        finalSections.push({ order: finalSections.length + 1, name: item.name });
        addedNames.add(item.name);
        lastAddedName = item.name;
    }

    return finalSections;
  } catch (e) {
    console.error('Mobile Check Error:', e);
    return [];
  } finally {
    await page.close();
  }
}

async function getPcSections(browser: any, keyword: string): Promise<SectionItem[]> {
  return [];
}