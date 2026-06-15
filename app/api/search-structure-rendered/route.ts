// app/api/search-structure-rendered/route.ts
// Puppeteer 기반 렌더링 화면 분석 실험 API
// 목적: 실제 모바일 브라우저로 렌더링된 네이버 검색결과에서 화면 단락 제목 추출 가능성 검증
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/app/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export interface RenderedSection {
  order: number;
  title: string;           // 실제 화면 단락 제목 (없으면 "제목 없는 단락")
  type: string;            // 분류 코드
  classification: string;  // 분류명
  isEstimated: boolean;
  evidence: string;
  visibleTextSample: string;
  itemCountEstimate: number;
  countLabel: string;      // 고객용 개수 표시 (예: "감지 항목 49개")
  sampleLinks: string[];
  visualY?: number;        // 내부용: visual heading y좌표 (UI 미노출)
}

export interface RenderedSearchResult {
  keyword: string;
  base: string;
  searchedAt: string;
  method: 'puppeteer_rendered';
  sections: RenderedSection[];
  debugNote?: string;
  elapsedMs: number;
  qualityStatus: 'normal' | 'low_confidence';
  qualityReasons: string[];
  usage?: {
    limit: number;
    used: number;
    remaining: number;
    scope: 'anonymous' | 'free_user' | 'admin';
  };
}

// ─────────────────────────────────────────────
// 브라우저 실행 (프록시 선택적 적용)
// ─────────────────────────────────────────────

async function launchRenderedBrowser() {
  const PROXY_HOST = process.env.PROXY_HOST;
  const PROXY_PORT = process.env.PROXY_PORT;
  const hasProxy = !!(PROXY_HOST && PROXY_PORT);

  const isProduction = process.env.NODE_ENV === 'production';
  const executablePath = isProduction
    ? (process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable')
    : undefined;

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--disable-blink-features=AutomationControlled',
  ];

  if (hasProxy) {
    args.push(`--proxy-server=http://${PROXY_HOST}:${PROXY_PORT}`);
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath as string | undefined,
    args,
    timeout: 20000,
  });

  return { browser, hasProxy };
}

async function setupRenderedPage(page: any, hasProxy: boolean) {
  const PROXY_USER = process.env.PROXY_USER;
  const PROXY_PASS = process.env.PROXY_PASS;

  if (hasProxy && PROXY_USER && PROXY_PASS) {
    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });
  }

  // 모바일 뷰포트 (iPhone 14 Pro 기준)
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  );
}

// ─────────────────────────────────────────────
// 섹션 분류 로직 (Node.js 컨텍스트)
// ─────────────────────────────────────────────

const CR_NAME_CLASSIFY: Record<string, { classification: string; type: string }> = {
  plink:      { classification: '파워링크/광고',        type: 'ad' },
  view:       { classification: 'VIEW (블로그/콘텐츠)',  type: 'view' },
  blog:       { classification: '블로그',               type: 'blog' },
  news:       { classification: '뉴스',                 type: 'news' },
  shopping:   { classification: '쇼핑',                 type: 'shopping' },
  image:      { classification: '이미지',               type: 'image' },
  video:      { classification: '동영상/클립',           type: 'video' },
  kin:        { classification: '지식iN',               type: 'kin' },
  cafe:       { classification: '카페',                 type: 'cafe' },
  place:      { classification: '플레이스',              type: 'place' },
  influencer: { classification: '인플루언서 콘텐츠',      type: 'influencer' },
  web:        { classification: '사이트/웹문서',          type: 'web' },
  ai:         { classification: 'AI 브리핑',             type: 'ai_briefing' },
  smart:      { classification: '스마트블록',             type: 'smart_block' },
  price:      { classification: '가격비교/스토어',         type: 'price' },
  map:        { classification: '플레이스/지도',           type: 'place' },
  book:       { classification: '네이버 도서',            type: 'book' },
  opentalk:   { classification: '오픈톡',                type: 'community' },
  open_talk:  { classification: '오픈톡',                type: 'community' },
  community:  { classification: '오픈톡',                type: 'community' },
};

interface RawSectionData {
  titleText: string;
  fullText: string;
  links: string[];
  itemCount: number;          // 전체 li 수 (감지 항목)
  directItemCount: number;    // 최상위 ul/ol 직계 li 수 (화면 노출 추정)
  priceProductCount?: number; // 가격비교 상품 후보 수 (shopping 링크·가격 텍스트 신호 기반)
  dataAttrs: { crName: string; id: string; className: string };
  y: number;               // 문서 기준 절대 y 좌표 (시각적 순서 정렬용)
  visualY?: number;        // visual heading extractor가 감지한 제목 요소의 y좌표
}

// 화면 좌표 기반 단락 제목 후보
interface VisualHeading {
  text: string;
  y: number;
  crName: string;
}

// 외부 도메인 링크 수 계산 (naver.com 제외, 탭/페이지네이션 링크 제외)
function countExternalLinks(links: string[]): number {
  return links.filter(l => {
    if (l.includes('ssc=tab') || /[?&]page=[2-9]/.test(l)) return false;
    try {
      const absUrl = l.startsWith('http') ? l : `https://m.search.naver.com${l}`;
      return !new URL(absUrl).hostname.includes('naver.com');
    } catch { return false; }
  }).length;
}

// ─────────────────────────────────────────────
// 플레이스 오탐 방지 helper
// 검색 탭·옵션·네비게이션용 place/map 링크는 실제 장소 결과가 아니므로
// 별도 분류하여 플레이스 판정에서 제외한다.
// ─────────────────────────────────────────────

function isSearchTabOrUtilityLink(link: string): boolean {
  const l = String(link || '').toLowerCase();
  return (
    l.includes('ssc=tab') ||
    l.includes('mtb_opt') ||
    l.includes('sm=mtb') ||
    /[?&]where=m_(map|place)/.test(l) ||
    /[?&]where=(map|place)/.test(l) ||
    (
      /\/search(?:2)?\/search\.naver/.test(l) &&
      (
        l.includes('플레이스') ||
        l.includes('지도') ||
        l.includes('place') ||
        l.includes('map')
      )
    )
  );
}

function isRealPlaceResultLink(link: string): boolean {
  const l = String(link || '').toLowerCase();
  if (!l) return false;
  if (isSearchTabOrUtilityLink(l)) return false;
  return (
    /m\.place\.naver\.com\/(place|restaurant|hospital|hairshop|accommodation|attraction)\//.test(l) ||
    /place\.naver\.com\/(place|restaurant|hospital|hairshop|accommodation|attraction)\//.test(l) ||
    /map\.naver\.com\/p\/entry\/place\//.test(l)
  );
}

function hasStrongPlaceTextSignal(text: string): boolean {
  const t = String(text || '');
  return (
    t.includes('방문자리뷰') ||
    t.includes('블로그리뷰') ||
    /영업\s*(중|종료|전|시작)/.test(t) ||
    t.includes('네이버예약') ||
    t.includes('예약하기') ||
    t.includes('길찾기') ||
    t.includes('거리뷰') ||
    t.includes('내 업체 등록하기')
  );
}

function getPlaceSignals(
  titleText: string,
  fullText: string,
  links: string[],
  dataAttrs: { crName: string; id?: string; className?: string }
): {
  placeLinks: string[];
  hasPlaceLink: boolean;
  hasPlaceTextSignal: boolean;
  hasPlaceCrName: boolean;
  hasPlaceTitleSignal: boolean;
  hasStrongPlaceSignal: boolean;
} {
  const placeLinks = links.filter(isRealPlaceResultLink);
  const hasPlaceLink = placeLinks.length > 0;
  const hasPlaceTextSignal = hasStrongPlaceTextSignal(fullText);
  const hasPlaceCrName = dataAttrs.crName === 'place' || dataAttrs.crName === 'map';

  const trimmedTitle = String(titleText || '').trim();
  const hasPlaceTitleSignal =
    /^(플레이스|지도)$/.test(trimmedTitle) ||
    trimmedTitle.includes('장소') ||
    trimmedTitle.includes('업체');

  const hasPlaceContentSignal =
    (hasPlaceLink && hasPlaceTextSignal) ||
    placeLinks.length >= 2 ||
    (hasPlaceTitleSignal && (hasPlaceLink || hasPlaceTextSignal));

  const hasStrongPlaceSignal =
    hasPlaceContentSignal ||
    (hasPlaceCrName && (hasPlaceLink || hasPlaceTextSignal || hasPlaceTitleSignal));

  return {
    placeLinks,
    hasPlaceLink,
    hasPlaceTextSignal,
    hasPlaceCrName,
    hasPlaceTitleSignal,
    hasStrongPlaceSignal,
  };
}

function classifySection(
  raw: RawSectionData,
  keyword: string
): { type: string; classification: string; isEstimated: boolean; evidence: string } {
  const { titleText, fullText, links, dataAttrs } = raw;

  // ── 0. 최우선 특수 섹션 패턴 ─────────────────────────────────
  // titleText/data-cr-name/place-link 판정보다 반드시 먼저 확인한다.
  // 이 블록에서 반환하면 이후 단계는 실행되지 않는다.
  //
  // 핵심 이유:
  //   titleText가 "플레이스"이고 fullText에 "님을 위한 장소 추천"이 있어도
  //   step1(titleText "플레이스" 감지)이 먼저 반환하면 fullText가 무시됨.
  //   → fullText를 titleText보다 먼저 확인해 오분류 방지.

  // ─ 개인화 장소 추천
  if (
    /님을\s*위한\s*장소\s*추천/.test(fullText) ||
    /님을\s*위한\s*장소\s*추천/.test(titleText) ||
    titleText.includes('장소 추천') ||
    titleText.includes('맑은날') ||
    titleText.includes('내 또래') ||
    titleText.includes('점심인기')
  ) {
    return { type: 'place_recommendation', classification: '개인화 장소 추천', isEstimated: false, evidence: '개인화 장소 추천 패턴 (최우선 감지)' };
  }
  // ─ 새로 오픈했어요
  if (fullText.includes('새로 오픈했어요') || titleText.includes('새로 오픈했어요')) {
    return { type: 'place_new', classification: '신규 오픈 장소', isEstimated: false, evidence: '신규 오픈 장소 패턴 (최우선 감지)' };
  }
  // ─ 오픈톡: titleText / fullText 전체 / 링크 URL (talk.naver, opentalk) 어디서든 감지
  const hasOpentalkLink = links.some(
    l => l.includes('talk.naver.com') ||
         /opentalk/i.test(l) ||
         /open[_-]talk/i.test(l)
  );
  if (
    titleText.includes('오픈톡') ||
    fullText.includes('오픈톡') ||
    fullText.toLowerCase().includes('opentalk') ||
    hasOpentalkLink
  ) {
    return { type: 'community', classification: '커뮤니티/오픈톡', isEstimated: false, evidence: '오픈톡 패턴 (최우선 감지)' };
  }
  // ─ 관련 브랜드 콘텐츠
  if (
    titleText.includes('관련 브랜드 콘텐츠') ||
    fullText.includes('관련 브랜드 콘텐츠') ||
    fullText.includes('브랜드 콘텐츠 더보기')
  ) {
    return { type: 'brand_content', classification: '브랜드 콘텐츠', isEstimated: false, evidence: '브랜드 콘텐츠 패턴 (최우선 감지)' };
  }
  // ─ 쇼핑 브랜드 광고 캐러셀 (네이버 쇼핑 브랜드 광고 스마트블록)
  //   titleText "지금 볼만한 브랜드" / className "sp_nshop_brand" / fullText "검색어 관련광고" 중 하나로 감지
  if (
    titleText.includes('지금 볼만한 브랜드') ||
    fullText.includes('지금 볼만한 브랜드') ||
    dataAttrs.className.includes('sp_nshop_brand') ||
    (fullText.includes('검색어 관련광고') && (
      dataAttrs.className.includes('nshop') ||
      dataAttrs.className.includes('brand') ||
      titleText.includes('브랜드')
    ))
  ) {
    return { type: 'brand_ad', classification: '쇼핑 브랜드 광고', isEstimated: false, evidence: '쇼핑 브랜드 광고 패턴 감지' };
  }

  // ── 광고 링크 보유 여부 (판정은 뒤로 미룸) ────────────────────
  const hasAdTrackerLink = links.some(
    l => l.includes('ader.naver.com') || l.includes('adcr.naver.com')
  );
  const hasAdText =
    fullText.includes('광고ⓘ') ||
    fullText.includes('파워링크') ||
    dataAttrs.crName === 'plink' ||
    dataAttrs.className.includes('ad_powerlink');

  // ── 플레이스 강한 근거 (광고 판정 이전에 미리 계산) ──────────
  // 단순 map/place 탭 링크만으로는 플레이스로 확정하지 않는다.
  const {
    hasPlaceLink,
    hasPlaceTextSignal,
    hasStrongPlaceSignal,
  } = getPlaceSignals(titleText, fullText, links, dataAttrs);

  // 장소 추천/신규 오픈/플레이스 광고 판정에서 쓰는 통합 장소 신호.
  const hasPlaceSignal = hasStrongPlaceSignal;

  // 1. 실제 단락 제목 텍스트 기반 확정 (렌더링 분석의 핵심 강점)
  //    — 광고 링크가 있더라도 제목이 명확하면 제목을 우선
  if (titleText) {
    const t = titleText;

    // ── 장소형 특수 섹션 (플레이스 제목보다 먼저 확인) ─────────
    if (/님을\s*위한\s*장소\s*추천/.test(t) || t.includes('장소 추천') || t.includes('맑은날') || t.includes('내 또래') || t.includes('점심인기')) {
      return { type: 'place_recommendation', classification: '개인화 장소 추천', isEstimated: false, evidence: `개인화 장소 추천 제목 감지: "${t}"` };
    }
    if (t.includes('새로 오픈했어요') || t.includes('새로 오픈')) {
      return { type: 'place_new', classification: '신규 오픈 장소', isEstimated: false, evidence: `신규 오픈 장소 제목 감지: "${t}"` };
    }
    if (t.includes('오픈톡')) {
      return { type: 'community', classification: '커뮤니티/오픈톡', isEstimated: false, evidence: `오픈톡 제목 감지: "${t}"` };
    }
    if (t.includes('관련 브랜드 콘텐츠') || t.includes('브랜드 콘텐츠 더보기')) {
      return { type: 'brand_content', classification: '브랜드 콘텐츠', isEstimated: false, evidence: `브랜드 콘텐츠 제목 감지: "${t}"` };
    }

    // 쇼핑/가격비교 제목은 내부에 광고 링크가 섞여도 광고가 아님
    if (t.includes('네이버 가격비교') || (t.includes('가격비교') && !t.includes('인기글'))) {
      return { type: 'price', classification: '네이버 가격비교', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if (t.includes('네이버플러스') || t.includes('플러스 스토어') || t.includes('스마트스토어')) {
      return { type: 'shopping', classification: '네이버플러스 스토어', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if (t.includes('인기글')) {
      return { type: 'content', classification: t, isEstimated: false, evidence: `인기글 단락 제목 감지: "${t}"` };
    }
    if (t.includes('함께 많이 찾는') || t.includes('많이 찾는')) {
      return { type: 'related', classification: '함께 많이 찾는', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if (t === 'VIEW' || (t.includes('블로그') && t.includes('콘텐츠'))) {
      return { type: 'view', classification: 'VIEW (블로그/콘텐츠)', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if (t.includes('블로그')) {
      return { type: 'blog', classification: '블로그', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if (t.includes('뉴스')) {
      return { type: 'news', classification: '뉴스', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if (t.includes('쇼핑') && !t.includes('인사이트')) {
      return { type: 'shopping', classification: '쇼핑', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if (t.includes('이미지')) {
      return { type: 'image', classification: '이미지', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if (t.includes('동영상') || t.includes('클립')) {
      return { type: 'video', classification: '동영상/클립', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if (t.includes('지식iN') || t.toLowerCase().includes('지식in')) {
      return { type: 'kin', classification: '지식iN', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if (t.includes('카페')) {
      return { type: 'cafe', classification: '카페', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if ((t.includes('플레이스') || t.includes('지도')) && hasStrongPlaceSignal) {
      return {
        type: 'place',
        classification: '플레이스',
        isEstimated: false,
        evidence: `단락 제목 + 실제 장소 신호 감지: "${t}"`,
      };
    }
    if (t.includes('네이버 도서') || (t.includes('도서') && links.some(l => l.includes('book.naver.com')))) {
      return { type: 'book', classification: '네이버 도서', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if (t.includes('인플루언서')) {
      return { type: 'influencer', classification: '인플루언서 콘텐츠', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if (t.includes('사이트') || t.includes('웹문서') || t.includes('웹사이트')) {
      return { type: 'web', classification: '사이트/웹문서', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    if (t.includes('AI 브리핑') || t.includes('AI답변') || t.includes('AI 답변')) {
      return { type: 'ai_briefing', classification: 'AI 브리핑', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
    // 키워드 포함 스마트블록: 공백 제거 정규화로 "LED 손전등 추천" 등 공백 포함 제목도 정확히 매칭
    const kwNorm = keyword.replace(/\s+/g, '');
    const tNorm  = t.replace(/\s+/g, '');
    if (keyword && (t.includes(keyword) || (kwNorm && tNorm.includes(kwNorm))) && !hasAdTrackerLink && !hasAdText) {
      return {
        type: 'smart_block',
        classification: '추천 콘텐츠',
        isEstimated: false,
        evidence: `키워드 포함 단락 제목: "${t}"`,
      };
    }

    // 단락 제목이 확인됐으나 위 패턴에 해당하지 않는 경우:
    // 제목 텍스트를 신뢰하고 smart_block으로 반환.
    // → fullText 기반 인플루언서/도서 오분류(예: LED 손전등 추천) 방지
    if (!hasAdTrackerLink && !hasAdText) {
      return { type: 'smart_block', classification: '스마트블록', isEstimated: false, evidence: `단락 제목 감지: "${t}"` };
    }
  }

  // 2. data-cr-name 매핑 (제목 미감지 시)
  if (dataAttrs.crName && CR_NAME_CLASSIFY[dataAttrs.crName]) {
    const mapped = CR_NAME_CLASSIFY[dataAttrs.crName];
    const isPlaceCrName = dataAttrs.crName === 'place' || dataAttrs.crName === 'map';

    // place/map은 상단 탭·옵션·숨은 네비게이션에서 섞일 수 있으므로
    // 실제 장소 링크/본문/제목 신호가 같이 있을 때만 확정한다.
    if (!isPlaceCrName || hasStrongPlaceSignal) {
      return {
        type: mapped.type,
        classification: mapped.classification,
        isEstimated: false,
        evidence: `data-cr-name="${dataAttrs.crName}" 감지`,
      };
    }
  }

  // 3. 실제 장소 결과 링크 + 본문 신호 강한 복합 감지
  if (hasStrongPlaceSignal) {
    return {
      type: 'place',
      classification: '플레이스',
      isEstimated: false,
      evidence: '실제 장소 결과 링크/본문 신호 감지',
    };
  }

  // 4. fullText 패턴 (렌더링 후 본문에서 추출)
  // ── 장소형 특수 섹션 fullText 감지 ─────────────────────────
  if (/님을\s*위한\s*장소\s*추천/.test(fullText) || (fullText.includes('장소 추천') && hasPlaceSignal)) {
    return { type: 'place_recommendation', classification: '개인화 장소 추천', isEstimated: false, evidence: '개인화 장소 추천 본문 텍스트 감지' };
  }
  if (fullText.includes('새로 오픈했어요') || (fullText.includes('내 업체 등록하기') && hasPlaceSignal)) {
    return { type: 'place_new', classification: '신규 오픈 장소', isEstimated: false, evidence: '신규 오픈 장소 본문 텍스트 감지' };
  }
  if (
    fullText.includes('오픈톡') ||
    fullText.toLowerCase().includes('opentalk') ||
    links.some(l => l.includes('talk.naver.com') || /opentalk/i.test(l) || /open[_-]talk/i.test(l))
  ) {
    return { type: 'community', classification: '커뮤니티/오픈톡', isEstimated: false, evidence: '오픈톡 본문/링크 감지' };
  }
  if (fullText.includes('관련 브랜드 콘텐츠') || fullText.includes('브랜드 콘텐츠 더보기')) {
    return { type: 'brand_content', classification: '브랜드 콘텐츠', isEstimated: false, evidence: '브랜드 콘텐츠 본문 텍스트 감지' };
  }

  // 네이버 도서 — fullText/link 기반 감지 (titleText 없을 때만 적용)
  // titleText가 있을 때는 제목 기반 분류를 신뢰하므로 여기서 오버라이드하지 않음
  if (
    !titleText && (
      fullText.includes('네이버 도서') ||
      links.some(l => l.includes('book.naver.com'))
    )
  ) {
    return { type: 'book', classification: '네이버 도서', isEstimated: false, evidence: '네이버 도서 본문/링크 감지' };
  }

  // 인플루언서 콘텐츠 — fullText/link 기반 감지 (titleText 없을 때만 적용)
  // titleText가 있으면 (예: "LED 손전등 추천") in.naver.com 링크가 있어도 오분류하지 않음
  if (
    !titleText && (
      fullText.includes('인플루언서 콘텐츠') ||
      fullText.includes('인플루언서') ||
      links.some(l => l.includes('in.naver.com'))
    )
  ) {
    return { type: 'influencer', classification: '인플루언서 콘텐츠', isEstimated: false, evidence: '인플루언서 콘텐츠 본문/링크 감지' };
  }

  if (fullText.includes('함께 많이 찾는') || fullText.includes('많이 찾는')) {
    return { type: 'related', classification: '함께 많이 찾는', isEstimated: false, evidence: '함께 많이 찾는 본문 텍스트 감지' };
  }
  const popularMatch = fullText.match(/['"]?([가-힣a-zA-Z\s'"]{2,20}인기글)/);
  if (popularMatch) {
    return { type: 'content', classification: popularMatch[1].trim(), isEstimated: false, evidence: `인기글 본문 텍스트 감지: "${popularMatch[1].trim()}"` };
  }
  if (fullText.includes('AI 브리핑') || fullText.includes('AI답변')) {
    return { type: 'ai_briefing', classification: 'AI 브리핑', isEstimated: false, evidence: 'AI 브리핑 본문 텍스트 감지' };
  }

  // 5. 광고 판정 — 실제 제목/본문 신호가 없을 때만 적용
  //    (쇼핑·스토어 섹션 내 광고 추적 링크를 광고로 오분류하는 문제 방지)
  //    장소형 근거(place 링크 / 텍스트 신호)가 있으면 광고로 분류하지 않음

  // ── 사이트/웹문서 보호: 외부 도메인 링크 2개 이상이고 명시적 광고 문구 없으면 광고 판정 면제 ──
  // 광고 추적 링크(ader/adcr)가 일부 섞여 있어도 실제 외부 사이트 링크가 주를 이루면 web으로 분류
  const externalLinkCount = countExternalLinks(links);
  const hasStrongWebSignal =
    externalLinkCount >= 2 &&
    dataAttrs.crName !== 'plink' &&
    !titleText.includes('파워링크') && !titleText.includes('광고') &&
    !fullText.includes('파워링크') && !fullText.includes('광고ⓘ');

  if ((hasAdTrackerLink || hasAdText) && hasStrongWebSignal) {
    return {
      type: 'web',
      classification: '사이트/웹문서',
      isEstimated: true,
      evidence: `외부 도메인 링크 ${externalLinkCount}개 포함 (광고 신호 혼재, 사이트/웹문서로 보호)`,
    };
  }

  if (hasAdTrackerLink) {
    if (hasPlaceSignal) {
      return { type: 'place_ad', classification: '플레이스 광고', isEstimated: false, evidence: '장소형 광고 (광고 추적 링크 + place 링크/텍스트 신호)' };
    }
    return {
      type: 'ad',
      classification: '파워링크/광고',
      isEstimated: true,
      evidence: '광고 추적 링크 감지 (ader.naver.com / adcr.naver.com)',
    };
  }
  if (hasAdText) {
    if (hasPlaceSignal) {
      return { type: 'place_ad', classification: '플레이스 광고', isEstimated: false, evidence: '장소형 광고 (광고 텍스트/클래스 + place 링크/텍스트 신호)' };
    }
    return {
      type: 'ad',
      classification: '파워링크/광고',
      isEstimated: false,
      evidence: '파워링크/광고 텍스트 또는 클래스 감지',
    };
  }

  // 6. 도메인 기반 추정
  if (links.some(l => l.includes('blog.naver.com') || l.includes('m.blog.naver.com'))) {
    return { type: 'blog', classification: '블로그 추정', isEstimated: true, evidence: 'blog.naver.com 링크 감지' };
  }
  if (links.some(l => l.includes('shopping.naver.com') || l.includes('smartstore.naver.com'))) {
    return { type: 'shopping', classification: '쇼핑 추정', isEstimated: true, evidence: 'shopping.naver.com 링크 감지' };
  }
  if (links.some(l => l.includes('news.naver.com'))) {
    return { type: 'news', classification: '뉴스 추정', isEstimated: true, evidence: 'news.naver.com 링크 감지' };
  }
  if (links.some(l => l.includes('cafe.naver.com'))) {
    return { type: 'cafe', classification: '카페 추정', isEstimated: true, evidence: 'cafe.naver.com 링크 감지' };
  }
  if (links.some(l => l.includes('kin.naver.com'))) {
    return { type: 'kin', classification: '지식iN 추정', isEstimated: true, evidence: 'kin.naver.com 링크 감지' };
  }
  if (links.some(l => l.includes('in.naver.com'))) {
    return { type: 'influencer', classification: '인플루언서 추정', isEstimated: true, evidence: 'in.naver.com 링크 감지' };
  }

  // 7. 외부 도메인 다수 → 사이트/웹문서 추정
  const contentLinks = links.filter(l => !l.includes('ssc=tab') && !/[?&]page=[2-9]/.test(l));
  const externalLinksCount = countExternalLinks(contentLinks);
  if (externalLinksCount >= 2) {
    return {
      type: 'web',
      classification: '사이트/웹문서',
      isEstimated: true,
      evidence: `외부 도메인 링크 ${externalLinksCount}개 포함`,
    };
  }

  // 8. 콘텐츠 링크 다수 → 스마트블록 추정
  if (contentLinks.length >= 3) {
    return {
      type: 'smart_block',
      classification: '스마트블록 추정',
      isEstimated: true,
      evidence: `콘텐츠 링크 ${contentLinks.length}개 포함, 단락 제목 미감지`,
    };
  }

  return { type: 'other', classification: '미분류', isEstimated: true, evidence: '분류 기준 미충족' };
}

// CSS/JS 잔여 텍스트를 제거해 샘플 품질 보정
function cleanTextSample(text: string, maxLen = 150): string {
  const cleaned = text
    .replace(/@keyframes\b[^{]*\{[\s\S]{0,600}?\}/g, ' ')
    .replace(/\bfunction\s*\w*\s*\([^)]*\)\s*\{[\s\S]{0,400}?\}/g, ' ')
    .replace(/\bdocument\.\w+/g, ' ')
    .replace(/\bwindow\.\w+/g, ' ')
    .replace(/opacity\s*:\s*[\d.]+/g, ' ')
    .replace(/margin-left\s*:\s*[\d.-]+[a-z%]*/gi, ' ')
    .replace(/\bscript\b/gi, ' ')
    .replace(/\bstyle\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned.slice(0, maxLen);
}

// ─────────────────────────────────────────────
// 단락 유형별 고객용 개수 라벨 생성
// ─────────────────────────────────────────────

function buildCountLabel(type: string, itemCount: number, directItemCount: number, priceProductCount = 0): string {
  // 화면 노출 추정: 최상위 직계 li (directItemCount)
  // 감지 항목: 전체 li (itemCount)
  const vis = directItemCount;
  const det = itemCount;

  switch (type) {
    case 'community':
    case 'ai_briefing':
    case 'brand_content':
    case 'brand_ad':
    case 'place_recommendation':
    case 'place_new':
      return '';

    case 'related':
      // 함께 많이 찾는: 추천어 개수
      if (vis > 0) return `추천어 ${vis}개`;
      if (det > 0) return `추천어 ${Math.min(det, 20)}개`;
      return '';

    case 'ad':
    case 'place_ad':
      // 광고: 직계 li가 신뢰도 높음
      if (vis > 0) return `광고 ${Math.min(vis, 10)}개`;
      if (det > 0) return `광고 ${Math.min(det, 10)}개`;
      return '';

    case 'price':
      if (priceProductCount > 0) return `감지 항목 ${Math.min(priceProductCount, 20)}개`;
      if (vis > 0) return `감지 항목 ${Math.min(vis, 20)}개`;
      if (det > 0) return `감지 항목 ${Math.min(det, 20)}개`;
      return '';

    case 'shopping':
      if (det > 0) return `감지 항목 ${det}개`;
      return '';

    case 'place':
      if (vis > 0) return `장소 ${Math.min(vis, 10)}개`;
      if (det > 0) return `장소 ${Math.min(det, 10)}개`;
      return '';

    case 'video':
      if (vis > 0) return `영상 ${Math.min(vis, 10)}개`;
      if (det > 0) return `영상 ${Math.min(det, 10)}개`;
      return '';

    case 'blog':
    case 'view':
    case 'content':
    case 'news':
    case 'cafe':
    case 'kin':
    case 'influencer': {
      const cnt = vis > 0 ? Math.min(vis, 10) : Math.min(det, 10);
      if (cnt === 0) return '';
      if (det > cnt * 3 && det > 10) return `콘텐츠 ${cnt}개 · 감지 항목 ${det}개`;
      return `콘텐츠 ${cnt}개`;
    }

    case 'web': {
      const cnt = vis > 0 ? Math.min(vis, 10) : Math.min(det, 10);
      return cnt > 0 ? `문서 ${cnt}개` : '';
    }

    case 'book': {
      const cnt = vis > 0 ? Math.min(vis, 10) : Math.min(det, 10);
      return cnt > 0 ? `감지 항목 ${cnt}개` : '';
    }

    case 'smart_block': {
      const cnt = vis > 0 ? Math.min(vis, 10) : Math.min(det, 10);
      return cnt > 0 ? `콘텐츠 ${cnt}개` : '';
    }

    default: {
      const cnt = vis > 0 ? Math.min(vis, 10) : Math.min(det, 10);
      return cnt > 0 ? `항목 ${cnt}개` : '';
    }
  }
}

function buildRenderedSections(rawSections: RawSectionData[], keyword: string): RenderedSection[] {
  const sections: RenderedSection[] = [];
  let order = 1;

  // y좌표 오름차순 정렬로 시각적 순서를 기준으로 사용
  // visualY(visual heading이 감지한 제목 요소의 y)가 있으면 우선 사용,
  // 없으면 DOM 섹션 컨테이너의 y를 사용. 99999(synthetic)는 맨 뒤.
  const effectiveY = (r: RawSectionData) => r.visualY ?? r.y ?? 99999;
  const orderedRaw = [...rawSections].sort((a, b) => effectiveY(a) - effectiveY(b));

  for (const raw of orderedRaw) {
    const { titleText, fullText, links, itemCount, directItemCount } = raw;

    // 비어있거나 너무 짧은 블록 제외
    if (!fullText || fullText.length < 10) continue;

    // 콘텐츠 신호 (보존 판단 기준)
    const hasContentSignal =
      fullText.includes('함께 많이 찾는') ||
      fullText.includes('인기글') ||
      fullText.includes('AI 브리핑');

    // 탭/옵션 블록 제외
    const tabLinks = links.filter(l => /ssc=tab|mtb_opt/.test(l));
    if (!hasContentSignal && tabLinks.length >= 3 && tabLinks.length >= links.length * 0.5) continue;

    // ── 페이지네이션 블록 제외 (강화) ──────────────────────────
    // 1) 링크 기반: page=2~9 링크가 50% 이상 (상대 URL 포함)
    if (!hasContentSignal && links.length >= 2) {
      const pageNavLinks = links.filter(l => /[?&]page=[2-9]/.test(l));
      if (pageNavLinks.length >= links.length * 0.5) continue;
    }
    // 2) 텍스트 기반: 이전/다음/숫자만 남는 블록
    if (!hasContentSignal && fullText.length < 120) {
      const stripped = fullText
        .replace(/이전페이지|다음페이지|이전|다음/g, '')
        .replace(/\d+/g, '')
        .replace(/\s+/g, '');
      if (stripped.length === 0) continue;
    }

    let classify = classifySection(raw, keyword);

    // 외부 도메인 링크 2개 이상 + 명시적 광고 문구 없으면 → 미분류/광고 블록을 사이트/웹문서로 보호
    const extLinkCount = countExternalLinks(links);
    if (
      (classify.type === 'other' || classify.type === 'ad') &&
      extLinkCount >= 2 &&
      raw.dataAttrs.crName !== 'plink' &&
      !raw.titleText.includes('파워링크') && !raw.titleText.includes('광고') &&
      !raw.fullText.includes('파워링크') && !raw.fullText.includes('광고ⓘ')
    ) {
      classify = {
        type: 'web',
        classification: '사이트/웹문서',
        isEstimated: true,
        evidence: `외부 도메인 링크 ${extLinkCount}개 포함 (사이트/웹문서로 보호)`,
      };
    }

    // other 타입에 링크도 없으면 버림
    if (classify.type === 'other' && links.length === 0) continue;

    // ── 표시 제목 결정 ────────────────────────────────────────
    // 우선순위: 타입별 고정 라벨 > 실제 단락 제목 > 타입 기반 기본값 > "제목 없는 단락"
    let displayTitle: string;
    if (classify.type === 'ad') {
      displayTitle = '파워링크 / 광고';
    } else if (classify.type === 'place_ad') {
      displayTitle = '플레이스 광고';
    } else if (classify.type === 'related') {
      displayTitle = '함께 많이 찾는';
    } else if (classify.type === 'place_recommendation') {
      displayTitle = '개인화 장소 추천';
    } else if (classify.type === 'place_new') {
      displayTitle = '새로 오픈했어요';
    } else if (classify.type === 'brand_ad') {
      displayTitle = '쇼핑 브랜드 광고';
    } else if (classify.type === 'community') {
      displayTitle = titleText || '오픈톡';
    } else if (classify.type === 'brand_content') {
      displayTitle = titleText || '관련 브랜드 콘텐츠';
    } else if (classify.type === 'book') {
      // DOM에서 "네이버도서"처럼 붙여 추출되는 경우 띄어쓰기 정규화
      const rawBookTitle = titleText || '네이버 도서';
      displayTitle = rawBookTitle.replace(/네이버도서/g, '네이버 도서');
    } else if (classify.type === 'influencer') {
      // 주제 신호(뷰티 등)가 있으면 더 구체적인 제목 사용
      // DOM에서 "뷰티인플루언서" 등이 붙여 추출되는 경우 띄어쓰기 정규화
      const beautySignal = fullText.includes('뷰티');
      const rawInflTitle = titleText || (beautySignal ? '뷰티 인플루언서 콘텐츠' : '인플루언서 콘텐츠');
      displayTitle = rawInflTitle
        .replace(/뷰티인플루언서/g, '뷰티 인플루언서')
        .replace(/인플루언서콘텐츠/g, '인플루언서 콘텐츠');
    } else if (titleText) {
      displayTitle = titleText;
    } else if (classify.type === 'web') {
      displayTitle = '사이트 / 웹문서';
    } else {
      displayTitle = '제목 없는 단락';
    }

    // ── ① 플레이스 우선 보정 (광고 안전망보다 반드시 먼저) ────────
    // place_recommendation / place_new / community / brand_content 는 보호하고
    // 실제 장소 신호(링크+본문)가 강할 때만 '플레이스'로 고정.
    // 단순 탭/옵션 링크만 있는 경우에는 플레이스로 강제하지 않는다.
    const placeSignalsForDisplay = getPlaceSignals(titleText, fullText, links, raw.dataAttrs);
    const hasPlaceDomainLink = placeSignalsForDisplay.hasPlaceLink;
    const hasPlaceBodySignal = placeSignalsForDisplay.hasPlaceTextSignal;

    const isSpecialPlaceType =
      classify.type === 'place_recommendation' ||
      classify.type === 'place_new' ||
      classify.type === 'community' ||
      classify.type === 'brand_content' ||
      classify.type === 'place_ad';

    const shouldForcePlaceTitle =
      !isSpecialPlaceType &&
      (
        classify.type === 'place' ||
        (
          classify.classification.includes('플레이스') &&
          placeSignalsForDisplay.hasStrongPlaceSignal
        ) ||
        (
          hasPlaceDomainLink &&
          hasPlaceBodySignal
        ) ||
        (
          /플레이스\s*my/i.test(displayTitle) &&
          placeSignalsForDisplay.hasStrongPlaceSignal
        )
      );

    if (shouldForcePlaceTitle) {
      displayTitle = '플레이스';
    }

    // ── ② 광고 단락 최종 강제 보정 ──────────────────────────────
    // 플레이스 보정(①)이 먼저 실행되므로 '플레이스'는 여기서 보호됨.
    // 특수 장소형 타입(isSpecialPlaceType)도 광고로 덮어쓰지 않음.
    const hasRawAdLink = links.some(
      l => l.includes('ader.naver.com') || l.includes('adcr.naver.com')
    );
    const isAdSafeTitle =
      displayTitle === '플레이스' ||
      displayTitle === '개인화 장소 추천' ||
      displayTitle === '새로 오픈했어요' ||
      displayTitle === '오픈톡' ||
      displayTitle.includes('브랜드 콘텐츠') ||
      displayTitle === '쇼핑 브랜드 광고' ||
      displayTitle.includes('네이버 가격비교') ||
      displayTitle.includes('네이버플러스') ||
      displayTitle.includes('인기글') ||
      displayTitle === '함께 많이 찾는' ||
      displayTitle === '사이트 / 웹문서' ||
      displayTitle === '제목 없는 단락' ||
      displayTitle.includes('인플루언서') ||
      displayTitle === '네이버 도서' ||
      classify.type === 'web' ||
      classify.type === 'brand_ad' ||
      isSpecialPlaceType;

    if (hasRawAdLink && !isAdSafeTitle) {
      displayTitle = '파워링크 / 광고';
    }

    const absoluteLinks = links
      .map(l => l.startsWith('http') ? l : `https://m.search.naver.com${l}`)
      .filter(l => l.startsWith('http'))
      .slice(0, 5);

    // visualY가 DOM y와 다를 때: 화면 위치 기반으로 순서가 보정된 섹션
    const usedVisualY = raw.visualY !== undefined && raw.visualY !== raw.y;
    const evidence = usedVisualY
      ? classify.evidence + ' · 화면 위치 기준으로 순서 반영'
      : classify.evidence;

    sections.push({
      order: order++,
      title: displayTitle,
      type: classify.type,
      classification: classify.classification,
      isEstimated: classify.isEstimated,
      evidence,
      visibleTextSample: cleanTextSample(fullText),
      itemCountEstimate: itemCount,
      countLabel: buildCountLabel(classify.type, itemCount, directItemCount, raw.priceProductCount || 0),
      sampleLinks: absoluteLinks,
      visualY: raw.visualY,
    });
  }

  // ── 플레이스 섹션 전역 중복 제거 ────────────────────────────────
  // 첫 번째 '플레이스' 섹션(type=place, title='플레이스')만 유지.
  // 이후 등장하는 동일 타입/제목 섹션은 모두 제거(연속/비연속 무관).
  // '플레이스 광고'(place_ad) 및 특수 장소 타입은 영향받지 않음.
  const deduplicated: RenderedSection[] = [];
  let seenFirstPlace = false;
  for (const section of sections) {
    if (section.type === 'place' && section.title === '플레이스') {
      if (seenFirstPlace) continue;
      seenFirstPlace = true;
    }
    deduplicated.push(section);
  }

  // ── '오픈톡' 위치 보정 ────────────────────────────────────────────
  // community(오픈톡) 섹션은 video(네이버 클립) 다음, brand_content 이전으로 보정.
  // 이미 올바른 위치(클립 바로 다음)이면 이동하지 않음.
  const communityIdx = deduplicated.findIndex(s => s.type === 'community');
  if (communityIdx !== -1) {
    const clipIdx = deduplicated.findIndex(s => s.type === 'video');
    const brandIdx = deduplicated.findIndex(s => s.type === 'brand_content');
    if (clipIdx !== -1 && communityIdx !== clipIdx + 1) {
      // 클립이 있고 오픈톡이 클립 바로 다음이 아닌 경우 이동
      const [otSection] = deduplicated.splice(communityIdx, 1);
      const newClipIdx = deduplicated.findIndex(s => s.type === 'video');
      deduplicated.splice(newClipIdx + 1, 0, otSection);
    } else if (clipIdx === -1 && brandIdx !== -1 && communityIdx > brandIdx) {
      // 클립 없이 브랜드 콘텐츠보다 뒤에 있으면 브랜드 콘텐츠 직전으로 이동
      const [otSection] = deduplicated.splice(communityIdx, 1);
      const newBrandIdx = deduplicated.findIndex(s => s.type === 'brand_content');
      if (newBrandIdx !== -1) deduplicated.splice(newBrandIdx, 0, otSection);
    }
  }

  // ── '함께 많이 찾는' 위치 보정 ────────────────────────────────
  // 1) 쇼핑형(네이버 가격비교 + 네이버플러스 스토어 모두 있는 경우):
  //    '함께 많이 찾는'을 '네이버플러스 스토어' 바로 다음으로 이동.
  //    이미 올바른 위치(스토어 바로 다음)이면 이동하지 않음.
  // 2) 비쇼핑 + 장소형: 사이트/웹문서 직전으로 이동 (기존 로직 유지).
  // 3) 그 외(다이어트 등 정보형): DOM 순서 그대로 유지.
  const relatedIdx = deduplicated.findIndex(s => s.type === 'related');
  if (relatedIdx > 0) {
    // 쇼핑형 판단: 네이버 가격비교 섹션 AND 네이버플러스 스토어 섹션 둘 다 존재
    const hasPriceSection = deduplicated.some(
      s => s.type === 'price' ||
           s.title.includes('네이버 가격비교') ||
           (s.title.includes('가격비교') && s.type !== 'content')
    );
    const hasStoreSection = deduplicated.some(
      s => s.title.includes('네이버플러스 스토어') ||
           s.title.includes('네이버플러스') ||
           s.title.includes('플러스 스토어')
    );
    // 혼합형 신호: 뉴스·이미지·플레이스·도서·인플루언서·정보형 섹션이 있으면
    // 쇼핑 중심이 아니므로 '함께 많이 찾는' 강제 이동을 적용하지 않음
    const isMixedType =
      deduplicated.some(s => s.type === 'news') ||
      deduplicated.some(s => s.type === 'image') ||
      deduplicated.some(s => s.type === 'place' || s.type === 'place_new' || s.type === 'place_recommendation') ||
      deduplicated.some(s => s.type === 'book') ||
      deduplicated.some(s => s.type === 'influencer' || s.type === 'brand_content') ||
      deduplicated.some(s => s.type === 'content' && (
        s.classification.includes('건강') ||
        s.classification.includes('의학') ||
        s.classification.includes('메이트')
      ));
    const isShoppingType = hasPriceSection && hasStoreSection && !isMixedType;

    if (isShoppingType) {
      // 쇼핑형: '함께 많이 찾는'을 '네이버플러스 스토어' 바로 다음으로 이동
      const storeIdx = deduplicated.findIndex(
        s => s.title.includes('네이버플러스 스토어') ||
             s.title.includes('네이버플러스') ||
             s.title.includes('플러스 스토어')
      );
      if (storeIdx !== -1 && relatedIdx !== storeIdx + 1) {
        const [relatedSection] = deduplicated.splice(relatedIdx, 1);
        // splice로 relatedSection 제거 후 storeIdx 인덱스 재조정
        const adjustedStoreIdx = storeIdx > relatedIdx ? storeIdx - 1 : storeIdx;
        deduplicated.splice(adjustedStoreIdx + 1, 0, relatedSection);
      }
    } else {
      // 비쇼핑형: 장소형인 경우 사이트/웹문서 직전으로 이동 (기존 로직 유지)
      const hasPlaceSignal = deduplicated.some(
        s => s.type === 'place' || s.type === 'place_new' ||
             s.type === 'place_ad' || s.type === 'place_recommendation'
      );
      if (hasPlaceSignal) {
        const firstWebIdx = deduplicated.findIndex(
          s => s.type === 'web' || s.classification.includes('사이트') || s.title.includes('사이트')
        );
        if (firstWebIdx !== -1 && relatedIdx > firstWebIdx) {
          const [relatedSection] = deduplicated.splice(relatedIdx, 1);
          deduplicated.splice(firstWebIdx, 0, relatedSection);
        }
      }
      // 정보형(다이어트 등): 아무것도 하지 않음 → DOM 순서 유지
    }
  }

  deduplicated.forEach((s, i) => { s.order = i + 1; });

  return deduplicated;
}

// ─────────────────────────────────────────────
// DOM 블록 추출 (page.evaluate 재사용 헬퍼)
// ─────────────────────────────────────────────

// page.evaluate 내부에서 실행되는 DOM 추출 로직 (직렬화 가능한 순수 함수)
const DOM_EXTRACT_FN = () => {
  const titleSelectors = [
    '.api_title', 'h2', 'h3', '.tit', 'strong.tit', '.title',
    '[class*="tit_section"]', '[class*="_title"]',
    '.sds-comps-text--type-headline2', '.section_title',
    '.tit_area .tit', '.title_area .title',
  ];
  const results: Array<{
    titleText: string;
    fullText: string;
    links: string[];
    itemCount: number;
    directItemCount: number;
    priceProductCount: number;
    dataAttrs: { crName: string; id: string; className: string };
    y: number;
  }> = [];

  const mainContainer =
    document.querySelector('#ct') ||
    document.querySelector('#main_pack') ||
    document.body;

  if (!mainContainer) return results;

  const containers = Array.from(
    mainContainer.querySelectorAll(':scope > section, :scope > div, :scope > article')
  ) as HTMLElement[];

  for (const container of containers) {
    const style = window.getComputedStyle(container);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) < 0.1
    ) continue;

    const rect = container.getBoundingClientRect();
    if (rect.height < 10) continue;

    let titleText = '';
    for (const sel of titleSelectors) {
      const el = container.querySelector(sel);
      if (el) {
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length > 0 && text.length < 80) {
          titleText = text;
          break;
        }
      }
    }

    const cloneNode = container.cloneNode(true) as HTMLElement;
    cloneNode.querySelectorAll('script, style, noscript').forEach((el: Element) => el.remove());
    // aria-label 속성 텍스트도 fullText에 포함 (오픈톡 버튼 aria-label 등)
    const ariaLabelText = Array.from(container.querySelectorAll('[aria-label]'))
      .map(el => el.getAttribute('aria-label') || '')
      .filter(t => t.length > 0 && t.length < 100)
      .join(' ');
    const rawText = (cloneNode.textContent || '').replace(/\s+/g, ' ').trim();
    const fullText = (ariaLabelText ? rawText + ' ' + ariaLabelText : rawText).replace(/\s+/g, ' ').trim();
    // href 외에 data-href / data-url 속성도 링크로 수집 (Naver SPA 패턴 대응)
    const hrefLinks = Array.from(container.querySelectorAll('a[href]'))
      .map(a => (a as HTMLAnchorElement).getAttribute('href') || '');
    const dataLinks = Array.from(container.querySelectorAll('[data-href],[data-url]'))
      .map(el => el.getAttribute('data-href') || el.getAttribute('data-url') || '');
    const isUtilityHref = (href: string) => {
      const h = String(href || '').toLowerCase();
      return (
        h.includes('ssc=tab') ||
        h.includes('mtb_opt') ||
        h.includes('sm=mtb') ||
        /[?&]where=m_(map|place)/.test(h) ||
        /[?&]where=(map|place)/.test(h)
      );
    };
    const links = [...hrefLinks, ...dataLinks]
      .filter(href =>
        href &&
        !href.startsWith('#') &&
        !href.startsWith('javascript') &&
        !isUtilityHref(href)
      )
      .slice(0, 20);

    const listItemCount = container.querySelectorAll('li').length;

    // 최상위 ul/ol의 직계 li만 카운트 (중첩 li 제외 → 화면 노출 카드 추정)
    let directItemCount = 0;
    const allLists = Array.from(container.querySelectorAll('ul, ol'));
    for (const list of allLists) {
      let isNested = false;
      let p = list.parentElement;
      while (p && p !== container) {
        if (p.tagName === 'LI') { isNested = true; break; }
        p = p.parentElement;
      }
      if (!isNested) {
        directItemCount += list.querySelectorAll(':scope > li').length;
      }
    }

    // ── 가격비교 상품 후보 수 계산 ─────────────────────────────────
    // 3단계 중복 제거:
    //   [A] 가시성 필터: getComputedStyle로 숨겨진 탭 패널 li 제외
    //   [B] ancestor 중복 제거: 후보 li가 다른 후보 li의 자손이면 제거
    //   [C] URL 정규화 key로 최종 중복 제거 (catalog ID / nvMid 추출)
    // relaxed 단계는 strict 결과 < 4개일 때만 실행 (fallback).
    const priceLinkDomains = [
      'shopping.naver.com', 'msearch.shopping.naver.com',
      'search.shopping.naver.com', 'smartstore.naver.com',
    ];
    const priceTextKeywords = ['원', '최저', '배송', '무료배송', '리뷰', '찜', '구매'];
    const allLiEls = Array.from(container.querySelectorAll('li')) as HTMLElement[];

    // 최상위 li만 선별 (li 안에 중첩된 li 제외)
    const topLiEls = allLiEls.filter(li => {
      let p = li.parentElement;
      while (p && p !== container) {
        if (p.tagName === 'LI') return false;
        p = p.parentElement;
      }
      return true;
    });

    // URL에서 안정적인 상품 식별자 추출 (tracking 파라미터 제거)
    const extractPriceKey = (href: string, fallbackText: string): string => {
      const catalogM = href.match(/\/catalog[\/=](\d+)/i);
      if (catalogM) return 'cat_' + catalogM[1];
      const nvMidM = href.match(/[?&]nvMid=([^&]+)/i);
      if (nvMidM) return 'mid_' + nvMidM[1];
      const prodM = href.match(/\/products?[\/=](\d+)/i);
      if (prodM) return 'prd_' + prodM[1];
      // URL base (쿼리 제거)
      const urlBase = href.split('?')[0].replace(/\/$/, '');
      if (urlBase.length > 15) return urlBase;
      // fallback: 상품명 정규화
      return fallbackText
        .replace(/[\d,]+원/g, '').replace(/배송|무료배송|리뷰|찜|구매|최저/g, '')
        .replace(/\s+/g, ' ').trim().slice(0, 25);
    };

    // [1] strict: 최상위 li 중 상품 후보 수집 (가시성 체크 포함)
    const candidateLiEls: HTMLElement[] = [];
    for (const li of topLiEls) {
      // [A] 숨겨진 li 제외 (탭 전환으로 display:none 된 패널의 li 등)
      const liStyle = window.getComputedStyle(li);
      if (liStyle.display === 'none' || liStyle.visibility === 'hidden') continue;

      const liHrefs = Array.from(li.querySelectorAll('a[href]'))
        .map(a => (a as HTMLAnchorElement).getAttribute('href') || '');
      const shopHref = liHrefs.find(h => priceLinkDomains.some(d => h.includes(d)));
      const liText = (li.textContent || '').replace(/\s+/g, ' ').slice(0, 150);
      const priceSignalCount = priceTextKeywords.filter(kw => liText.includes(kw)).length;
      if (!!shopHref || priceSignalCount >= 2) {
        candidateLiEls.push(li);
      }
    }

    // [B] ancestor 중복 제거: 후보 li가 다른 후보 li의 자손이면 제거
    const ancestorFiltered = candidateLiEls.filter(li =>
      !candidateLiEls.some(other => other !== li && other.contains(li))
    );

    // [C] URL 정규화 key로 최종 중복 제거
    const seenProductKeys = new Set<string>();
    for (const li of ancestorFiltered) {
      const liHrefs = Array.from(li.querySelectorAll('a[href]'))
        .map(a => (a as HTMLAnchorElement).getAttribute('href') || '');
      const shopHref = liHrefs.find(h => priceLinkDomains.some(d => h.includes(d))) || '';
      const liText = (li.textContent || '').replace(/\s+/g, ' ').slice(0, 100);
      const key = shopHref
        ? extractPriceKey(shopHref, liText)
        : liText.slice(0, 30);
      if (key) seenProductKeys.add(key);
    }
    let priceProductCount = seenProductKeys.size;

    // [2] relaxed 계산 — strict 결과가 4개 미만일 때만 실행
    // 리프 수준 li(자식 li에 가격 패턴 없음) 중 숫자 가격 패턴이 있는 것
    if (priceProductCount < 4) {
      const numPriceRe = /\d[\d,]+원/;
      const seenRelaxed = new Set<string>();
      let relaxedCount = 0;
      for (const li of allLiEls) {
        const liText = (li.textContent || '').replace(/\s+/g, ' ');
        if (!numPriceRe.test(liText)) continue;
        // 자식 li 중에도 같은 패턴이 있으면 이 li는 wrapper → skip
        const childHasPrice = Array.from(li.querySelectorAll('li'))
          .some(cl => numPriceRe.test((cl.textContent || '')));
        if (childHasPrice) continue;
        // 가격 외 실질 텍스트가 충분해야 상품명으로 볼 수 있음
        const nonPriceText = liText.replace(/[\d,]+원/g, '').replace(/\s+/g, ' ').trim();
        if (nonPriceText.length < 8) continue;
        const key = liText.slice(0, 40);
        if (!seenRelaxed.has(key)) {
          seenRelaxed.add(key);
          relaxedCount++;
        }
      }
      if (relaxedCount > priceProductCount) {
        priceProductCount = Math.min(relaxedCount, 20);
      }
    }

    const crNameEl = container.getAttribute('data-cr-name')
      ? container
      : container.querySelector('[data-cr-name]');
    const crName = crNameEl ? (crNameEl.getAttribute('data-cr-name') || '') : '';

    results.push({
      titleText,
      fullText: fullText.slice(0, 500),
      links,
      itemCount: listItemCount,
      directItemCount,
      priceProductCount,
      dataAttrs: {
        crName,
        id: container.id || '',
        className: (container.className || '').toString().slice(0, 150),
      },
      y: rect.top + window.scrollY,  // 문서 기준 절대 y 좌표
    });
  }
  // ── 오픈톡 보조 탐색 ─────────────────────────────────────────────────
  // 메인 루프(#ct 직계 자식)에서 오픈톡이 감지되지 않은 경우에만 실행.
  // 중첩 구조 대응: data-cr-name 속성 → 타이틀 텍스트 순으로 탐색.
  const opentalkInResults = results.some(
    r => r.fullText.includes('오픈톡') || r.titleText.includes('오픈톡') || r.dataAttrs.crName === 'opentalk'
  );
  if (!opentalkInResults) {
    // (1) data-cr-name 속성으로 직접 탐색
    let otEl: HTMLElement | null = (
      document.querySelector('[data-cr-name="opentalk"]') ||
      document.querySelector('[data-cr-name="open_talk"]')
    ) as HTMLElement | null;

    // (2) 타이틀 엘리먼트 텍스트로 탐색 (fallback)
    if (!otEl) {
      const titleCandidates = Array.from(
        document.querySelectorAll('.api_title, .section_title, h2, h3, strong')
      );
      const otTitle = titleCandidates.find(el => (el.textContent || '').trim() === '오픈톡');
      if (otTitle) {
        let parent: HTMLElement | null = otTitle.parentElement as HTMLElement | null;
        for (let i = 0; i < 6 && parent && parent !== mainContainer; i++) {
          const rect = parent.getBoundingClientRect();
          if (rect.height >= 60 && rect.width >= 150) { otEl = parent; break; }
          parent = parent.parentElement as HTMLElement | null;
        }
      }
    }

    if (otEl) {
      const otClone = otEl.cloneNode(true) as HTMLElement;
      otClone.querySelectorAll('script, style, noscript').forEach((s: Element) => s.remove());
      const otText = (otClone.textContent || '').replace(/\s+/g, ' ').trim();
      const otLinks = Array.from(otEl.querySelectorAll('a[href]'))
        .map(a => (a as HTMLAnchorElement).getAttribute('href') || '')
        .filter(h => h && !h.startsWith('#') && !h.startsWith('javascript'))
        .slice(0, 10);
      const crCheck = otEl.getAttribute('data-cr-name')
        ? otEl
        : otEl.querySelector('[data-cr-name]');
      results.push({
        titleText: '오픈톡',  // 명시 고정으로 오분류 방지
        fullText: otText.slice(0, 500),
        links: otLinks,
        itemCount: otEl.querySelectorAll('li').length,
        directItemCount: 0,
        priceProductCount: 0,
        dataAttrs: {
          crName: crCheck ? (crCheck.getAttribute('data-cr-name') || 'opentalk') : 'opentalk',
          id: otEl.id || '',
          className: otEl.className.toString().slice(0, 100),
        },
        y: otEl.getBoundingClientRect().top + window.scrollY,
      });
    }
  }

  return results;
};

// ─────────────────────────────────────────────
// 화면 좌표 기반 단락 제목 추출 (page.evaluate 직렬화 가능)
// 실제 화면에 보이는 heading 요소를 y좌표 오름차순으로 수집한다.
// ─────────────────────────────────────────────

const VISUAL_HEADING_FN = (): Array<{ text: string; y: number; crName: string }> => {
  const headingSelectors = [
    '.api_title', 'h2', 'h3',
    '.section_title', '.tit_area .tit', '.title_area .title',
    'strong.tit', '.sds-comps-text--type-headline2',
    '[class*="tit_section"]',
  ];
  const results: Array<{ text: string; y: number; crName: string }> = [];
  const seen = new Set<string>();

  for (const sel of headingSelectors) {
    const els = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    for (const el of els) {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 2 || text.length > 60) continue;
      if (seen.has(text)) continue;

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (parseFloat(style.opacity) < 0.1) continue;

      const rect = el.getBoundingClientRect();
      if (rect.height < 5 || rect.width < 10) continue;

      // 네비게이션·헤더·푸터 영역 제외
      let isNavArea = false;
      let p: HTMLElement | null = el.parentElement as HTMLElement | null;
      for (let i = 0; i < 8 && p; i++) {
        const tag = p.tagName.toLowerCase();
        if (tag === 'nav' || tag === 'footer' || tag === 'header') { isNavArea = true; break; }
        const role = p.getAttribute('role') || '';
        if (role === 'navigation' || role === 'banner') { isNavArea = true; break; }
        p = p.parentElement as HTMLElement | null;
      }
      if (isNavArea) continue;

      // 가장 가까운 data-cr-name 탐색
      let crName = '';
      let q: HTMLElement | null = el.parentElement as HTMLElement | null;
      for (let i = 0; i < 8 && q; i++) {
        const cr = q.getAttribute('data-cr-name');
        if (cr) { crName = cr; break; }
        q = q.parentElement as HTMLElement | null;
      }

      seen.add(text);
      results.push({ text, y: rect.top + window.scrollY, crName });
    }
  }

  return results.sort((a, b) => a.y - b.y);
};

// ─────────────────────────────────────────────
// visual heading → DOM 블록 titleText 보완
// titleText가 비어있는 DOM 블록에 가장 적합한 visual heading text를 매핑한다.
// ─────────────────────────────────────────────

function enrichWithVisualHeadings(
  rawBlocks: RawSectionData[],
  visualHeadings: VisualHeading[]
): void {
  for (const heading of visualHeadings) {
    // 이미 동일 텍스트를 가진 블록이 있으면 스킵
    if (rawBlocks.some(b => b.titleText === heading.text)) continue;

    // titleText가 비어있는 블록 중 최적 매칭 탐색
    let bestBlock: RawSectionData | null = null;
    let bestScore = 0;

    for (const block of rawBlocks) {
      if (block.titleText) continue; // 이미 제목 있는 블록은 건너뜀

      let score = 0;
      // data-cr-name 일치: 강한 신호
      if (heading.crName && block.dataAttrs.crName === heading.crName) score += 10;
      // fullText에 heading 텍스트 포함: 중간 신호
      if (block.fullText.includes(heading.text)) score += 5;
      // y 근접도 (절대 좌표 기준)
      const dist = Math.abs((block.y || 0) - heading.y);
      if (dist < 60)       score += 8;
      else if (dist < 150) score += 5;
      else if (dist < 350) score += 2;

      if (score > bestScore) {
        bestScore = score;
        bestBlock = block;
      }
    }

    // 최소 5점 이상 + 신뢰할 수 있는 경우에만 titleText 보완
    if (bestBlock && bestScore >= 5) {
      bestBlock.titleText = heading.text;
      bestBlock.visualY = heading.y;  // 화면 위치 기반 순서 보정용 y 좌표 보존
    }
  }
}

// ─────────────────────────────────────────────
// 수집 품질 판단
// ─────────────────────────────────────────────

function assessQuality(
  sections: RenderedSection[],
  flags: string[]
): { qualityStatus: 'normal' | 'low_confidence'; qualityReasons: string[] } {
  const reasons: string[] = [];
  const sectionCount = sections.length;
  const confirmedCount = sections.filter(s => !s.isEstimated && s.title !== '제목 없는 단락').length;
  const uniqueTypeCount = new Set(sections.map(s => s.type)).size;
  const hasTimeout = flags.includes('goto-timeout') || flags.includes('scroll-timeout');

  // 수집 중 타임아웃 발생
  if (hasTimeout) {
    reasons.push('검색 화면 일부만 감지되어 보완 분석이 필요할 수 있습니다.');
  }

  // 단락 수 부족 판단
  if (sectionCount <= 4) {
    // 4개 이하는 광고 전용 등 극히 단순한 결과가 아닌 이상 항상 보완 필요
    reasons.push('주요 단락 수가 적어 추가 확인이 필요할 수 있습니다.');
  } else if (sectionCount <= 5 && !hasTimeout) {
    // 5개일 때는 구조가 충실한지 판단
    const hasShoppingSection = sections.some(s =>
      ['price', 'shopping', 'brand_ad', 'shopping_estimated'].includes(s.type)
    );
    const hasContentSection = sections.some(s =>
      ['blog', 'view', 'content', 'influencer', 'related', 'video', 'brand_content'].includes(s.type) ||
      s.title.includes('인기글') ||
      s.title.includes('함께 많이 찾는')
    );
    const hasPlaceSection = sections.some(s =>
      ['place', 'place_ad', 'place_new', 'place_recommendation', 'place_estimated'].includes(s.type)
    );
    const hasMedicalContent = sections.some(s =>
      /건강|의학|의료|병원|치과|치아|교정/.test(`${s.title} ${s.classification}`)
    );

    // 구조가 충실한 케이스: 부족하지 않다고 판단
    const isStructuredResult =
      (hasShoppingSection && hasContentSection) ||     // 쇼핑+콘텐츠 구조
      (hasPlaceSection && hasMedicalContent) ||        // 장소+의료정보 구조 (부천치아교정 등)
      (hasPlaceSection && hasContentSection) ||        // 장소+콘텐츠 구조
      (uniqueTypeCount >= 4 && confirmedCount >= 3);   // 다양한 유형이 제목 확인까지 됨

    if (!isStructuredResult) {
      reasons.push('주요 단락 수가 적어 추가 확인이 필요할 수 있습니다.');
    }
  }

  // 단락 유형이 지나치게 제한적 (단락 수 부족 이유가 없는 경우에만 추가 체크)
  if (reasons.length === 0 && sectionCount >= 4 && uniqueTypeCount <= 2) {
    const isPlaceFocused = sections.every(s =>
      ['place', 'place_ad', 'place_new', 'place_recommendation', 'place_estimated', 'ad'].includes(s.type)
    );
    if (!isPlaceFocused) {
      reasons.push('현재 감지된 단락 유형이 제한적입니다.');
    }
  }

  return {
    qualityStatus: reasons.length > 0 ? 'low_confidence' : 'normal',
    qualityReasons: reasons,
  };
}

// ─────────────────────────────────────────────
// Puppeteer 기반 렌더링 수집 (구간별 누적 분석)
// ─────────────────────────────────────────────

async function fetchRenderedSearchStructure(keyword: string): Promise<{
  sections: RenderedSection[];
  debugNote: string;
  elapsedMs: number;
  flags: string[];
}> {
  const startedAt = Date.now();
  const MAX_ELAPSED_MS = 25000; // 25초 초과 시 조기 종료
  const MAX_SCROLL_STEPS = 9;   // 최대 스크롤 횟수
  const SCROLL_WAIT_MS  = 600;  // 스크롤 후 대기(ms)

  const { browser, hasProxy } = await launchRenderedBrowser();

  try {
    const page = await browser.newPage();
    await setupRenderedPage(page, hasProxy);

    // 전역 타임아웃: goto 15초, evaluate 15초
    page.setDefaultNavigationTimeout(15000);
    page.setDefaultTimeout(15000);

    // 불필요한 리소스 차단 (이미지, 폰트, 미디어)
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
      const type = req.resourceType();
      if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    const url = `https://m.search.naver.com/search.naver?where=m&sm=mtp_hty&query=${encodeURIComponent(keyword)}`;

    // ── 1단계: goto (15초, timeout되어도 body 있으면 계속) ────
    let gotoTimedOut = false;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (gotoErr: unknown) {
      const msg = gotoErr instanceof Error ? gotoErr.message : String(gotoErr);
      if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('navigation')) {
        gotoTimedOut = true;
        const hasBody = await page.evaluate(() => !!document.body).catch(() => false);
        if (!hasBody) throw gotoErr;
      } else {
        throw gotoErr;
      }
    }

    // 초기 렌더링 대기 (timeout 발생 시 짧게)
    await new Promise(resolve => setTimeout(resolve, gotoTimedOut ? 400 : 1000));

    // ── 누적 블록 수집 (중복 제거용 시그니처 Set) ─────────────
    const seenSigs = new Set<string>();
    const allRawBlocks: RawSectionData[] = [];

    const mergeBlocks = (blocks: RawSectionData[]) => {
      for (const block of blocks) {
        // 시그니처: titleText + fullText 앞 60자
        const sig = `${block.titleText}|||${block.fullText.slice(0, 60)}`;
        if (!seenSigs.has(sig)) {
          seenSigs.add(sig);
          allRawBlocks.push(block);
        }
      }
    };

    // ── 2단계: 초기 DOM 추출 ──────────────────────────────────
    const initialBlocks = await page.evaluate(DOM_EXTRACT_FN).catch(() => [] as RawSectionData[]);
    mergeBlocks(initialBlocks);

    // ── 3단계: 구간별 스크롤 + DOM 누적 수집 ─────────────────
    let scrollStep = 0;
    let timeoutInScroll = false;

    while (scrollStep < MAX_SCROLL_STEPS) {
      if (Date.now() - startedAt >= MAX_ELAPSED_MS) break;

      // 스크롤
      const scrollOk = await page.evaluate(() => {
        window.scrollBy(0, 800);
        return true;
      }).catch(() => false);

      if (!scrollOk) {
        timeoutInScroll = true;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, SCROLL_WAIT_MS));
      if (Date.now() - startedAt >= MAX_ELAPSED_MS) break;

      // 현재 뷰포트 기준 블록 수집
      const stepBlocks = await page.evaluate(DOM_EXTRACT_FN).catch(() => [] as RawSectionData[]);
      mergeBlocks(stepBlocks);
      scrollStep++;
    }

    // ── 오픈톡 body text 기반 보조 추출 ──────────────────────────────────────
    // DOM 구조상 큰 SECTION 안에 포함되어 독립 블록으로 추출이 안 되는 경우,
    // body.innerText 에서 직접 오픈톡 텍스트 위치를 찾아 RawSectionData 로 추가.
    // (추가된 블록은 buildRenderedSections 위치 보정에서 클립 다음으로 이동됨)
    const hasOpentalkInBlocks = allRawBlocks.some(
      b => b.titleText.includes('오픈톡') || b.fullText.includes('오픈톡') || b.dataAttrs.crName === 'opentalk'
    );
    if (!hasOpentalkInBlocks) {
      const otExtract = await page.evaluate(() => {
        const bodyText = (document.body && document.body.innerText) || '';
        if (!bodyText.includes('오픈톡')) return null;

        const clipIdx  = bodyText.indexOf('네이버 클립');
        const brandIdx = bodyText.indexOf('관련 브랜드 콘텐츠');
        const otIdx    = bodyText.indexOf('오픈톡');

        // 오픈톡이 클립 이후 또는 브랜드 콘텐츠 이전에 위치해야 유효
        const isPositioned = (clipIdx >= 0 && otIdx > clipIdx) ||
                             (brandIdx >= 0 && otIdx < brandIdx);
        if (!isPositioned) return null;

        // 오픈톡 신호 검증 (단순 텍스트 언급 아닌 실제 섹션 여부 확인)
        const snippet = bodyText.slice(otIdx, otIdx + 700);
        const hasSignal =
          snippet.includes('오픈톡 참여하기') ||
          snippet.includes('오늘 맛집') ||
          snippet.includes('어디 가지') ||
          /\d{1,3}(,\d{3})*명/.test(snippet);
        if (!hasSignal) return null;

        return snippet.replace(/\s+/g, ' ').trim().slice(0, 200);
      }).catch(() => null);

      if (otExtract) {
        allRawBlocks.push({
          titleText: '오픈톡',
          fullText: otExtract,
          links: [],
          itemCount: 0,
          directItemCount: 0,
          dataAttrs: { crName: 'opentalk', id: '', className: '' },
          y: 99999,  // 위치 보정 로직이 이동시키므로 dummy y 사용
        });
      }
    }

    // ── 화면 좌표 기반 제목 보완 (Visual Heading Extractor) ──────────────
    // DOM titleSelectors로 캡처되지 않은 단락 제목을 시각적 heading으로 보완.
    // titleText가 비어있는 DOM 블록에 y좌표/crName/fullText 기준으로 매핑.
    const visualHeadings = await page.evaluate(VISUAL_HEADING_FN).catch(() => [] as VisualHeading[]);
    enrichWithVisualHeadings(allRawBlocks, visualHeadings);

    // ── 4단계: 최종 섹션 빌드 ────────────────────────────────
    const sections = buildRenderedSections(allRawBlocks, keyword);
    const elapsedMs = Date.now() - startedAt;

    const flags: string[] = [];
    if (gotoTimedOut)    flags.push('goto-timeout');
    if (timeoutInScroll) flags.push('scroll-timeout');
    const flagNote = flags.length > 0 ? ` ⚠ [${flags.join(', ')}] 부분 DOM 분석` : '';

    const debugNote =
      `Puppeteer 렌더링 완료${flagNote} | 프록시: ${hasProxy ? '사용' : '미사용'}` +
      ` | 스크롤 ${scrollStep}/${MAX_SCROLL_STEPS}회` +
      ` | 누적 원시 블록: ${allRawBlocks.length}개 → 유효 섹션: ${sections.length}개` +
      ` | 소요: ${(elapsedMs / 1000).toFixed(1)}초`;

    return { sections, debugNote, elapsedMs, flags };
  } finally {
    try { await browser.close(); } catch { /* ignore */ }
  }
}

// ─────────────────────────────────────────────
// POST 핸들러 (무료 베타 · 일일 사용량 제한)
// ─────────────────────────────────────────────

// KST 기준 오늘 날짜 문자열 (use-free-count/route.ts와 동일 로직)
const getKSTDateString = (): string => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (9 * 3600000));
  return kst.toISOString().split('T')[0];
};

// 역할별 일일 무료 사용량 한도 (포인트 차감 없음)
const DAILY_LIMITS = {
  anonymous: 3,    // 비로그인
  free_user: 10,   // 로그인 일반
  admin: 30,       // 관리자
} as const;

export async function POST(request: Request) {
  let keyword = '';
  try {
    const body = await request.json();
    keyword = (body.keyword || '').trim();
  } catch {
    return NextResponse.json({ error: '요청 파싱 실패' }, { status: 400 });
  }

  if (!keyword) {
    return NextResponse.json({ error: '키워드를 입력해 주세요.' }, { status: 400 });
  }

  // ── 사용량 제한 체크 ───────────────────────────────────────────
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // IP 추출 (비로그인 사용자 식별)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const clientIp = (forwarded ? forwarded.split(',')[0].trim() : null) ?? realIp ?? null;

  // 로그인 사용자 확인 (실패해도 anonymous로 처리)
  let currentUser: { id: string; email?: string } | null = null;
  try {
    const supabaseServer = await createServerSupabaseClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (user) currentUser = { id: user.id, email: user.email };
  } catch { /* anonymous로 처리 */ }

  // 역할 판단
  let userScope: 'anonymous' | 'free_user' | 'admin' = 'anonymous';
  if (currentUser) {
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();
      userScope = profile?.role?.toLowerCase() === 'admin' ? 'admin' : 'free_user';
    } catch { userScope = 'free_user'; }
  }

  const dailyLimit = DAILY_LIMITS[userScope];

  // KST 오늘 날짜 범위 계산
  const kstToday = getKSTDateString();
  const kstStart = `${kstToday}T00:00:00+09:00`;
  const kstNextDayDate = new Date(`${kstToday}T00:00:00+09:00`);
  kstNextDayDate.setDate(kstNextDayDate.getDate() + 1);
  const kstEnd = kstNextDayDate.toISOString();

  let usedToday = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabaseAdmin
      .from('free_usage_history')
      .select('*', { count: 'exact', head: true })
      .eq('page_type', 'SEARCH_STRUCTURE')
      .gte('created_at', kstStart)
      .lt('created_at', kstEnd);

    if (currentUser) {
      query = query.eq('user_id', currentUser.id);
    } else if (clientIp) {
      query = query.eq('ip_address', clientIp);
    }

    const { count } = await query;
    usedToday = count ?? 0;
  } catch { /* DB 장애 시 제한 없이 통과 */ }

  if (usedToday >= dailyLimit) {
    const errorMessage =
      userScope === 'anonymous'
        ? '오늘의 무료 분석 횟수를 모두 사용했습니다. 로그인하거나 내일 다시 이용해 주세요.'
        : userScope === 'admin'
        ? '오늘의 검색결과 구성 분석 이용 한도를 모두 사용했습니다. 잠시 후 다시 이용해 주세요.'
        : '오늘의 무료 분석 횟수를 모두 사용했습니다. 내일 다시 이용해 주세요.';
    return NextResponse.json(
      { error: errorMessage, limit: dailyLimit, remaining: 0 },
      { status: 429 }
    );
  }

  // ── Puppeteer 분석 실행 ───────────────────────────────────────
  try {
    const { sections, debugNote, elapsedMs, flags } = await fetchRenderedSearchStructure(keyword);
    const { qualityStatus, qualityReasons } = assessQuality(sections, flags);

    // 사용량 기록 (fire-and-forget: 실패해도 응답 반환)
    supabaseAdmin.from('free_usage_history').insert({
      user_type: currentUser ? 'member' : 'guest',
      user_id: currentUser?.id ?? null,
      email: currentUser?.email ?? null,
      page_type: 'SEARCH_STRUCTURE',
      page_name: '검색결과 구성 분석',
      keyword,
      summary: `검색결과 구성 분석 무료 베타 (${userScope})`,
      ip_address: clientIp,
      remaining_free_count: null,
      status: 'success',
    }).then(() => {}, () => {});

    const usageInfo = {
      limit: dailyLimit,
      used: usedToday + 1,
      remaining: Math.max(0, dailyLimit - usedToday - 1),
      scope: userScope,
    };

    const result: RenderedSearchResult = {
      keyword,
      base: '모바일 네이버 통합검색 (Puppeteer 렌더링)',
      searchedAt: new Date().toISOString(),
      method: 'puppeteer_rendered',
      sections,
      debugNote,
      elapsedMs,
      qualityStatus,
      qualityReasons,
      usage: usageInfo,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[search-structure-rendered] 오류:', err);
    const rawMsg = err instanceof Error ? err.message : String(err);
    const isTimeout =
      rawMsg.toLowerCase().includes('timeout') ||
      rawMsg.toLowerCase().includes('navigation');
    const userMessage = isTimeout
      ? `네이버 검색 페이지 로딩 시간이 초과되었습니다 (30초). 잠시 후 다시 시도해 주세요. (${rawMsg.slice(0, 80)})`
      : `렌더링 분석 실패: ${rawMsg}`;
    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}
