// app/api/section-order/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// subItems 속성 추가
type SectionItem = { name: string; count: number; isSide?: boolean; subItems?: string[] };

function normalizeName(raw: string) {
  const t = (raw || '')
    .replace(/도움말|열기|닫기|광고|바로가기/g, '') // 일반 섹션에서 불필요한 단어 제거
    .replace(/\s+/g, ' ')
    .trim();

  // 네이밍 통일 (경쟁사/네이버 표기 기준)
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
  // [웹사이트]는 키워드에 따라 중복 노출될 수 있으므로 중복 체크 없이 추가합니다.
  if (item.name === '웹사이트') {
    out.push(item);
  } else if (!out.some((s) => s.name === item.name)) {
    out.push(item);
  }
}

/**
 * 네이버 PC 통합검색에서 섹션 순서를 최대한 안정적으로 추출합니다.
 */
async function fetchSectionOrderPC(keyword: string): Promise<SectionItem[]> {
  const url = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(
    keyword,
  )}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, reply Gecko) Chrome/140.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    const out: SectionItem[] = [];
    const roots = ['#main_pack', '#sub_pack'];

    for (const root of roots) {
      const children = $(root).children();

      children.each((_, el) => {
        const $el = $(el);
        if (isHidden($el)) return;

        const fullText = $el.text().replace(/\s+/g, ' ').trim();

        if ($el.hasClass('api_flicking_wrap')) {
          const hasShortText = fullText.includes('함께 보는') && fullText.includes('숏텐츠');
          if (!hasShortText) return;
        }

        if ($el.hasClass('api_filter_tag') || $el.hasClass('api_tab')) return;

        const id = ($el.attr('id') || '').trim();
        const className = ($el.attr('class') || '').trim();

        let name = '';
        let count = 0;
        let subItems: string[] = []; 

        const isSide = root === '#sub_pack';

        if (id === 'nx_powerlink' || className.includes('nx_powerlink')) {
          name = '파워링크';
          count = $el.find('ul.lst_type > li').length || $el.find('li.ad_item').length || 0;
        }
        else if (className.includes('nx_place') || $el.find('._map_root, .place_section, .list_place').length > 0) {
          name = '플레이스';
          count = $el.find('ul.list_place > li').length || $el.find('li._item').length || 0;
        }
        else if (className.includes('sp_nwebsite') || $el.find('.sp_nwebsite, .link_tit, .bx.web_item').length > 0 || (!$el.find('h2, .api_title, .tit').length && $el.find('a[href^="http"]').length > 0)) {
          if (id !== 'nx_related_keywords' && !className.includes('n_promotion')) {
            name = '웹사이트';
          }
        }

        if (!name) {
          if (fullText.includes('함께 보는') && fullText.includes('숏텐츠')) {
            name = '함께 보는 엔터 종합 숏텐츠';
          } else {
            const titleText = $el.find('h2').first().text().trim() || $el.find('.api_title').first().text().trim() || $el.find('.tit').first().text().trim();
            if (titleText) name = normalizeName(titleText);
            else if (fullText.includes('함께 많이 찾는')) name = '함께 많이 찾는';
            else if (fullText.includes('함께 보면 좋은')) name = '함께 보면 좋은';
          }
        }

        name = normalizeName(name);

        if (name === '연관 검색어') {
          $el.find('a').each((_, subEl) => {
            const subText = $(subEl).text().trim();
            if (subText && !['신고','도움말','검색어제안 기능 닫기','더보기','열기'].includes(subText)) {
              subItems.push(subText);
            }
          });
        }

        if (name !== '파워링크' && name !== '플레이스') count = 0;

        if (isSide) {
          if (name !== '함께 보는 엔터 종합 숏텐츠' && name !== '연관 검색어') return;
        }

        if (!name) return;
        pushUnique(out, { name, count, isSide, subItems });
      });
    }
    return out;
  } catch (e) {
    console.error('Scraping Error:', e);
    return [];
  }
}

/**
 * 네이버 Mobile 통합검색에서 섹션 순서를 추출합니다. (SDS 구조 및 광고 명칭 수정 반영)
 */
async function fetchSectionOrderMobile(keyword: string): Promise<SectionItem[]> {
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

    const sections = $('#ct > section, #ct > div');

    sections.each((_, el) => {
      const $el = $(el);
      if (isHidden($el)) return;

      const fullText = $el.text().replace(/\s+/g, ' ').trim();
      
      if (fullText === '정렬 기간' || fullText.includes('검색 옵션 유지')) return;
      if ($el.find('.api_filter_tag, .api_tab').length > 0) return;

      let name = '';
      let count = 0;
      let subItems: string[] = [];

      const className = ($el.attr('class') || '').trim();
      const id = ($el.attr('id') || '').trim();

      // 1. SDS 디자인 시스템 텍스트 우선 확인 (함께 많이 찾는, 함께 보면 좋은 대응)
      const sdsTitle = $el.find('.sds-comps-text').first().text().replace(/\s+/g, ' ').trim();
      
      if (sdsTitle.includes('함께 많이 찾는')) {
        name = '함께 많이 찾는';
      } else if (sdsTitle.includes('함께 보면 좋은')) {
        name = '함께 보면 좋은';
      } 
      // 2. 광고 섹션 (줄바꿈 제거하여 "[키워드] 관련 광고" 전체 보존)
      else if (id.includes('power_link') || className.includes('ad_powerlink') || $el.find('.lst_type_ad, .ad_item').length > 0) {
        const adTitle = $el.find('.api_title, .tit').first().text().replace(/\s+/g, ' ').trim();
        name = adTitle || '파워링크'; 
        count = $el.find('.ad_item').length || 0;
      } 
      // 3. 연관 검색어 ("연관" 시작 대응)
      else if (className.includes('rel_search') || fullText.startsWith('연관')) {
        name = '연관 검색어';
        $el.find('.api_pure_text, a').each((_, subEl) => {
          const subText = $(subEl).text().trim();
          if (subText && !['신고','도움말'].includes(subText)) subItems.push(subText);
        });
      }
      // 4. 사이트 (알려주신 구조 기반 감지 로직 강화)
      else if (className.includes('sp_nwebsite') || $el.find('.nxt_web, .web_item, .link_tit, .link_url').length > 0) {
        name = '사이트';
      }

      // 제목 태그 기반 최종 이름 확인
      if (!name) {
        const titleElement = $el.find('.api_title, .tit, h2, .sds-comps-text').first();
        const titleText = titleElement.text().replace(/\s+/g, ' ').trim();
        if (titleText) name = titleText;
      }

      // 광고 문구("관련 광고") 보존을 위해 광고 섹션이 아닐 때만 정규화 적용
      if (name && !name.includes('광고')) {
        name = normalizeName(name);
      }

      if (!name || name === '검색' || name === '정렬' || name === '기간') return;
      
      if (name.includes('광고') || name === '파워링크') {
        if (out.some(s => s.name.includes('광고') || s.name === '파워링크')) return;
      }

      pushUnique(out, { name, count, isSide: false, subItems });
    });

    return out;
  } catch (e) {
    console.error('Mobile Scraping Error:', e);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = (searchParams.get('keyword') || '').trim();

  if (!keyword) {
    return NextResponse.json({ error: '키워드 누락' }, { status: 400 });
  }

  const [pc, mobile] = await Promise.all([
    fetchSectionOrderPC(keyword),
    fetchSectionOrderMobile(keyword)
  ]);

  return NextResponse.json({
    pc,
    mobile,
  });
}