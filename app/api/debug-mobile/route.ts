// app/api/debug-mobile/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

type SectionItem = { name: string; count: number; isSide?: boolean; subItems?: string[] };

/**
 * [원본 보존] 사용자님의 정규화 로직 (단 한 글자도 수정하지 않음)
 */
function normalizeName(raw: string) {
  const t = (raw || '')
    .replace(/도움말|열기|닫기|광고|바로가기/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (t === '사이트' || t === '웹사이트' || t === '웹사이트 더보기') return '웹사이트';
  if (t.includes('파워링크')) return '파워링크';
  if (t.includes('플레이스')) return '플레이스';
  if (t.includes('함께 많이 찾는')) return '함께 많이 찾는';
  if (t.includes('함께 보면 좋은')) return '함께 보면 좋은';
  if (t.replace(/\s/g, '') === '건강·의학인기글') return '건강·의학 인기글';

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
  if (item.name === '웹사이트') {
    out.push(item);
  } else if (!out.some((s) => s.name === item.name)) {
    out.push(item);
  }
}

/**
 * [정밀 분석] SDS 구조 및 사이트 분류 강화 버전
 */
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

    // #ct의 직계 자식들을 순서대로 탐색
    const mainChildren = $('#ct').children();

    mainChildren.each((_, el) => {
      const $el = $(el);
      if (isHidden($el)) return;

      // 섹션 내부의 모든 텍스트를 하나로 합침
      const fullText = $el.text().replace(/\s+/g, ' ').trim();
      if (!fullText || fullText === '정렬 기간' || fullText.includes('검색 옵션 유지')) return;

      let name = '';
      let count = 0;
      let subItems: string[] = [];

      // 1. [함께... 섹션] 섹션 내부 어디에든 해당 문구가 있으면 즉시 할당
      if (fullText.includes('함께 많이 찾는')) {
        name = '함께 많이 찾는';
      } else if (fullText.includes('함께 보면 좋은')) {
        name = '함께 보면 좋은';
      } 
      // 2. [사이트] 구조 우선 확인 (한국미스미 등 상호명보다 '사이트' 명칭 고정)
      else if ($el.hasClass('sp_nwebsite') || $el.find('.link_url, .web_item, .nxt_web, .link_tit').length > 0) {
        name = '사이트';
      }
      // 3. [광고] 줄바꿈 및 광고 단어 보존 로직
      else if ($el.attr('id')?.includes('power_link') || $el.find('.ad_item, .lst_type_ad').length > 0) {
        // 제목 영역(.api_title 등)의 텍스트를 가져와서 정규화 없이 사용
        const adTitleRaw = $el.find('.api_title, .tit').first().text().replace(/\s+/g, ' ').trim();
        name = adTitleRaw || '파워링크'; 
        count = $el.find('.ad_item').length || 0;
      } 

      // 4. 위에서 이름이 정해지지 않은 경우에만 제목 태그 탐색
      if (!name) {
        const titleEl = $el.find('.sds-comps-text, .api_title, .tit, h2').first();
        const titleText = titleEl.text().replace(/\s+/g, ' ').trim();
        if (titleText) {
          name = normalizeName(titleText);
        }
      }

      // 5. 연관검색어 처리
      if ($el.hasClass('rel_search') || fullText.startsWith('연관')) {
        if (!name) name = '연관 검색어';
        $el.find('a').each((_, a) => {
          const txt = $(a).text().trim();
          if (txt && !['신고','도움말'].includes(txt)) subItems.push(txt);
        });
      }

      // 최종 정규화: 광고 문구와 사이트라는 이름은 보존
      if (name && !name.includes('광고') && name !== '사이트') {
        name = normalizeName(name);
      }

      if (!name || ['검색','정렬','기간'].includes(name)) return;
      
      // 광고 섹션 중복 방지
      if (name.includes('광고') || name === '파워링크') {
        if (out.some(s => s.name.includes('광고') || s.name === '파워링크')) return;
      }

      pushUnique(out, { name, count, isSide: false, subItems });
    });

    return out;
  } catch (e) {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') || '';
  const mobile = await fetchMobileDebug(keyword);
  return NextResponse.json({ mobile });
}