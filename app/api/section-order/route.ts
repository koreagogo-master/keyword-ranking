// app/api/section-order/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// subItems 속성 추가
type SectionItem = { name: string; count: number; isSide?: boolean; subItems?: string[] };

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

        // [정정] 숏텐츠 구역(api_flicking_wrap) 감지 로직 강화
        if ($el.hasClass('api_flicking_wrap')) {
          const hasShortText = fullText.includes('함께 보는') && fullText.includes('숏텐츠');
          if (!hasShortText) {
            return;
          }
        }

        if ($el.hasClass('api_filter_tag') || $el.hasClass('api_tab')) {
          return;
        }

        const id = ($el.attr('id') || '').trim();
        const className = ($el.attr('class') || '').trim();

        let name = '';
        let count = 0;
        let subItems: string[] = []; 

        const isSide = root === '#sub_pack';

        // 1) 파워링크
        if (id === 'nx_powerlink' || className.includes('nx_powerlink')) {
          name = '파워링크';
          count =
            $el.find('ul.lst_type > li').length ||
            $el.find('li.ad_item').length ||
            0;
        }

        // 2) 플레이스
        else if (
          className.includes('nx_place') ||
          $el.find('._map_root, .place_section, .list_place').length > 0
        ) {
          name = '플레이스';
          count =
            $el.find('ul.list_place > li').length ||
            $el.find('li._item').length ||
            0;
        }

        // 3) 웹사이트 (사용자 지시사항 반영: 타이틀 없음 + URL 존재 특징 기반)
        else if (
          className.includes('sp_nwebsite') || 
          $el.find('.sp_nwebsite, .link_tit, .bx.web_item').length > 0 ||
          (!$el.find('h2, .api_title, .tit').length && $el.find('a[href^="http"]').length > 0)
        ) {
          // 연관검색어 등 특정 제외 ID가 아닐 때만 웹사이트로 인정
          if (id !== 'nx_related_keywords' && !className.includes('n_promotion')) {
            name = '웹사이트';
          }
        }

        // 4) 그 외 스마트블록(타이틀 기반)
        if (!name) {
          // [정정] 핵심 키워드 조합으로 숏텐츠 섹션명 확정
          if (fullText.includes('함께 보는') && fullText.includes('숏텐츠')) {
            name = '함께 보는 엔터 종합 숏텐츠';
          } else {
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
        }

        name = normalizeName(name);

        // [연관 검색어] 하위 텍스트 추출 로직 (유지)
        if (name === '연관 검색어') {
          $el.find('a').each((_, subEl) => {
            const subText = $(subEl).text().trim();
            if (subText && subText !== '신고' && subText !== '도움말' && subText !== '검색어제안 기능 닫기' && subText !== '더보기' && subText !== '열기') {
              subItems.push(subText);
            }
          });
        }

        if (name !== '파워링크' && name !== '플레이스') count = 0;

        // [정정] 우측 영역(Side) 필터링: 숏텐츠와 연관검색어만 허용
        if (isSide) {
          const isShortContent = (name === '함께 보는 엔터 종합 숏텐츠');
          const isRelatedSearch = (name === '연관 검색어');
          
          if (!isShortContent && !isRelatedSearch) {
            return;
          }
        }

        // 최종 제외 규칙 (빈 이름만 제외)
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