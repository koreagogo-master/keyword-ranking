// app/api/section-order/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

type SectionItem = { name: string; count: number };

function normalizeName(raw: string) {
  const t = (raw || '')
    .replace(/도움말|열기|닫기|광고|바로가기/g, '')
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
  if (!out.some((s) => s.name === item.name)) out.push(item);
}

/**
 * 네이버 PC 통합검색에서 섹션 순서를 최대한 안정적으로 추출합니다.
 * - DOM 순서대로 main_pack / sub_pack 자식 섹션을 스캔
 * - 카운트는 경쟁사처럼 파워링크/플레이스만 (그 외 0)
 */
async function fetchSectionOrderPC(keyword: string): Promise<SectionItem[]> {
  const url = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(
    keyword,
  )}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
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

        // 결과 섹션이 아닌 UI/컨테이너 제외
        if (
          $el.hasClass('api_flicking_wrap') ||
          $el.hasClass('api_filter_tag') ||
          $el.hasClass('api_tab')
        ) {
          return;
        }

        const id = ($el.attr('id') || '').trim();
        const className = ($el.attr('class') || '').trim();
        const fullText = $el.text().replace(/\s+/g, ' ').trim();

        let name = '';
        let count = 0;

        // 1) 파워링크
        if (id === 'nx_powerlink' || className.includes('nx_powerlink')) {
          name = '파워링크';
          count =
            $el.find('ul.lst_type > li').length ||
            $el.find('li.ad_item').length ||
            $el.find('li').filter((_, li) => $(li).text().includes('광고')).length ||
            0;
        }

        // 2) 플레이스
        else if (
          className.includes('nx_place') ||
          $el.find('._map_root, .place_section, .place_section_content, .list_place').length > 0
        ) {
          name = '플레이스';
          count =
            $el.find('ul.list_place > li').length ||
            $el.find('li._item').length ||
            $el.find('li').filter((_, li) => $(li).find('a').length > 0).length ||
            0;
        }

        // 3) 웹사이트(일반 사이트 결과)
        else if (className.includes('sp_nwebsite') || $el.find('.sp_nwebsite, .link_tit').length > 0) {
          name = '웹사이트';
          count = 0;
        }

        // 4) 그 외 스마트블록(타이틀 기반)
        else {
          const titleText =
            $el.find('h2').first().text().trim() ||
            $el.find('.api_title').first().text().trim() ||
            $el.find('.tit').first().text().trim();

          if (titleText) {
            name = normalizeName(titleText);
          } else if (fullText.includes('함께 많이 찾는')) {
            name = '함께 많이 찾는';
          } else if (fullText.includes('함께 보면 좋은')) {
            name = '함께 보면 좋은';
          }
        }

        name = normalizeName(name);

        // 경쟁사처럼 카운트는 파워링크/플레이스만 유지
        if (name !== '파워링크' && name !== '플레이스') count = 0;

        // 최종 제외 규칙
        if (!name) return;
        if (['정렬', '옵션', '필터'].includes(name)) return;

        pushUnique(out, { name, count });
      });
    }

    return out;
  } catch (e) {
    console.error('Scraping Error:', e);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = (searchParams.get('keyword') || '').trim();

  if (!keyword) {
    return NextResponse.json({ error: '키워드 누락' }, { status: 400 });
  }

  const pc = await fetchSectionOrderPC(keyword);

  return NextResponse.json({
    pc,
    mobile: [],
  });
}
