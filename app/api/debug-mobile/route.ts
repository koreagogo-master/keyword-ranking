// app/api/debug-mobile/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

type SectionItem = { 
  name: string; 
  count: number; 
  isSide?: boolean; 
  subItems?: string[]; 
  subName?: string; 
  isAd?: boolean;   
};

/**
 * 섹션명 정규화 함수
 */
function normalizeName(raw: string) {
  const t = (raw || '')
    .replace(/도움말|열기|닫기|바로가기/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (t === '사이트' || t === '웹사이트' || t === '웹사이트 더보기') return '사이트';
  if (t.includes('파워링크')) return '파워링크';
  if (t.includes('플레이스')) return '플레이스';
  if (t.includes('함께 많이 찾는')) return '함께 많이 찾는';
  if (t.includes('함께 보면 좋은')) return '함께 보면 좋은';
  if (t.replace(/\s/g, '') === '건강·의학 인기글') return '건강·의학 인기글';
  if (t.includes('어학사전')) return '어학사전';

  return t;
}

function isHidden($el: cheerio.Cheerio<any>) {
  if ($el.attr('aria-hidden') === 'true') return true;
  const style = ($el.attr('style') || '').toLowerCase();
  if (style.includes('display:none')) return true;
  return false;
}

function pushUnique(out: SectionItem[], item: SectionItem) {
  if (!item.name) return;
  if (!out.some((s) => s.name === item.name && s.subName === item.subName)) {
    out.push(item);
  }
}

async function fetchMobileDebug(keyword: string): Promise<SectionItem[]> {
  const url = `https://m.search.naver.com/search.naver?where=m&sm=mtp_hty&query=${encodeURIComponent(keyword)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
      cache: 'no-store',
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const out: SectionItem[] = [];
    const mainChildren = $('#ct').children();

    mainChildren.each((_, el) => {
      const $el = $(el);
      if (isHidden($el)) return;

      const fullText = $el.text().replace(/\s+/g, ' ').trim();
      if (!fullText || fullText === '정렬 기간' || fullText.includes('검색 옵션 유지')) return;

      let name = '';
      let subName = '';
      let isAd = false;
      let count = 0;
      let subItems: string[] = [];

      const className = ($el.attr('class') || '').trim();
      const id = ($el.attr('id') || '').trim();

      const titleWrap = $el.find('.title_wrap').first();
      const hasAdLabel = titleWrap.find('span.sub').text().includes('광고');
      const isOrganicSite = className.includes('fds-web-list-root') || $el.find('.fds-web-list-root').length > 0;

      // [어학사전 전용 체크] 캡처본 기반 SDS 헤더 텍스트 정밀 검사
      const sdsHeaderText = $el.find('.sds-comps-header-title, .sds-comps-text').text().replace(/\s+/g, '');

      // 1. [연관 검색어]
      if (className.includes('rel_search') || id.includes('nx_related_keywords') || fullText.startsWith('연관')) {
        name = '연관 검색어';
        $el.find('.api_pure_text, a').each((_, a) => {
          const txt = $(a).text().trim();
          if (txt && !['신고', '도움말'].includes(txt)) subItems.push(txt);
        });
      }
      // 2. [어학사전] - 누락 방지를 위해 최상단으로 순위 격상
      else if (sdsHeaderText.includes('어학사전') || fullText.startsWith('어학사전')) {
        name = '어학사전';
      }
      // 3. [광고]
      else if (id.includes('power_link') || className.includes('ad_powerlink') || $el.find('.ad_item, .lst_type_ad').length > 0 || hasAdLabel) {
        isAd = true;
        if (titleWrap.length > 0) {
          name = titleWrap.find('h2.title').text().trim();
          subName = titleWrap.find('span.sub').text().trim();
        } else {
          const headerArea = $el.find('.api_title_area, .tit_area, .ad_header').first();
          name = headerArea.find('.api_title, .tit').text().trim();
          subName = headerArea.find('.sub, .api_sub_title, .ad_help').text().trim();
        }
        if (!name) name = '파워링크';
        count = $el.find('.ad_item, li[class*="ad_"]').length || 0;
      }
      // 4. [플레이스]
      else if (className.includes('sp_nplace') || className.includes('nx_place') || id.includes('loc_main_pack') || $el.find('.place_section, ._list_place').length > 0) {
        name = '플레이스';
      }
      // 5. [사이트]
      else if (className.includes('sp_nwebsite') || id.includes('nx_website') || isOrganicSite) {
        name = '사이트';
      }
      // 6. [기타 고정 섹션]
      else if (fullText.includes('함께 많이 찾는')) name = '함께 많이 찾는';
      else if (fullText.includes('함께 보면 좋은')) name = '함께 보면 좋은';
      else if (fullText.replace(/\s/g, '').includes('건강·의학 인기글')) name = '건강·의학 인기글';

      // 7. 일반 제목 추출 (위에서 걸러지지 않은 경우)
      if (!name) {
        const titleEl = $el.find('.api_title, .tit, h2, .sds-comps-text').first();
        const titleText = titleEl.text().replace(/\s+/g, ' ').trim();
        if (titleText) {
          name = normalizeName(titleText);
        }
      }

      if (!name || ['검색', '정렬', '기간', '신고', '도움말'].includes(name)) return;

      pushUnique(out, { name, count, isSide: false, subItems, subName, isAd });
    });

    return out;
  } catch (e) {
    console.error('Mobile Debug Error:', e);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') || '';
  const mobile = await fetchMobileDebug(keyword);
  return NextResponse.json({ mobile });
}