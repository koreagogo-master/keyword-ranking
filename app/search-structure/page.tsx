'use client';

import { useState, useRef, useEffect } from 'react';
import RankTabs from '@/components/RankTabs';
import { createClient } from '@/app/utils/supabase/client';
import { useAuth } from '@/app/contexts/AuthContext';
import { usePoint } from '@/app/hooks/usePoint';

// ─────────────────────────────────────────────
// 타입 정의 (API 응답 구조와 동일)
// ─────────────────────────────────────────────

interface RenderedSection {
  order: number;
  title: string;
  type: string;
  classification: string;
  isEstimated: boolean;
  evidence: string;
  visibleTextSample: string;
  itemCountEstimate: number;
  countLabel: string;
  sampleLinks: string[];
}

interface RenderedSearchResult {
  keyword: string;
  base: string;
  searchedAt: string;
  method: 'puppeteer_rendered';
  sections: RenderedSection[];
  debugNote?: string;
  elapsedMs?: number;
  qualityStatus?: 'normal' | 'low_confidence';
  qualityReasons?: string[];
  usage?: {
    limit: number;
    used: number;
    remaining: number;
    scope: 'anonymous' | 'free_user' | 'admin';
  };
}

// ─────────────────────────────────────────────
// 섹션 타입별 색상/배지
// ─────────────────────────────────────────────

const TYPE_META: Record<string, { color: string; bg: string; border: string; badge: string }> = {
  powerlink:            { color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-700' },
  ad:                   { color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-700' },
  brand_ad:             { color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700' },
  view:                 { color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700' },
  blog:                 { color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700' },
  blog_estimated:       { color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-600' },
  news:                 { color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     badge: 'bg-red-100 text-red-700' },
  news_estimated:       { color: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-200',     badge: 'bg-red-100 text-red-600' },
  shopping:             { color: 'text-green-700',   bg: 'bg-green-50',    border: 'border-green-200',   badge: 'bg-green-100 text-green-700' },
  shopping_estimated:   { color: 'text-green-600',   bg: 'bg-green-50',    border: 'border-green-200',   badge: 'bg-green-100 text-green-600' },
  image:                { color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200',  badge: 'bg-purple-100 text-purple-700' },
  video:                { color: 'text-pink-700',    bg: 'bg-pink-50',     border: 'border-pink-200',    badge: 'bg-pink-100 text-pink-700' },
  kin:                  { color: 'text-yellow-700',  bg: 'bg-yellow-50',   border: 'border-yellow-200',  badge: 'bg-yellow-100 text-yellow-700' },
  kin_estimated:        { color: 'text-yellow-600',  bg: 'bg-yellow-50',   border: 'border-yellow-200',  badge: 'bg-yellow-100 text-yellow-600' },
  cafe:                 { color: 'text-teal-700',    bg: 'bg-teal-50',     border: 'border-teal-200',    badge: 'bg-teal-100 text-teal-700' },
  cafe_estimated:       { color: 'text-teal-600',    bg: 'bg-teal-50',     border: 'border-teal-200',    badge: 'bg-teal-100 text-teal-600' },
  place:                { color: 'text-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-700' },
  place_estimated:      { color: 'text-indigo-600',  bg: 'bg-indigo-50',   border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-600' },
  place_ad:             { color: 'text-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-700' },
  place_new:            { color: 'text-indigo-600',  bg: 'bg-indigo-50',   border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-600' },
  place_recommendation: { color: 'text-indigo-600',  bg: 'bg-indigo-50',   border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-600' },
  influencer:           { color: 'text-rose-700',    bg: 'bg-rose-50',     border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700' },
  influencer_estimated: { color: 'text-rose-600',    bg: 'bg-rose-50',     border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-600' },
  web:                  { color: 'text-slate-700',   bg: 'bg-slate-50',    border: 'border-slate-200',   badge: 'bg-slate-100 text-slate-700' },
  web_estimated:        { color: 'text-slate-600',   bg: 'bg-slate-50',    border: 'border-slate-200',   badge: 'bg-slate-100 text-slate-600' },
  ai_briefing:          { color: 'text-violet-700',  bg: 'bg-violet-50',   border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-700' },
  smart_block:          { color: 'text-gray-700',    bg: 'bg-gray-50',     border: 'border-gray-200',    badge: 'bg-gray-100 text-gray-700' },
  price:                { color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  related:              { color: 'text-cyan-700',    bg: 'bg-cyan-50',     border: 'border-cyan-200',    badge: 'bg-cyan-100 text-cyan-700' },
  brand_content:        { color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200',  badge: 'bg-purple-100 text-purple-700' },
  community:            { color: 'text-teal-700',    bg: 'bg-teal-50',     border: 'border-teal-200',    badge: 'bg-teal-100 text-teal-700' },
  content:              { color: 'text-gray-700',    bg: 'bg-gray-50',     border: 'border-gray-200',    badge: 'bg-gray-100 text-gray-700' },
  book:                 { color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700' },
  other:                { color: 'text-gray-600',    bg: 'bg-gray-50',     border: 'border-gray-200',    badge: 'bg-gray-100 text-gray-600' },
};

function getTypeMeta(type: string) {
  return TYPE_META[type] ?? TYPE_META['other'];
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function cleanBaseLabel(base: string): string {
  return base
    .replace(/\s*\([^)]*[Pp]uppeteer[^)]*\)/g, '')
    .replace(/\s*\([^)]*렌더링[^)]*\)/g, '')
    .trim() || '모바일 네이버 통합검색';
}

// ─────────────────────────────────────────────
// 키워드 구조 규칙 기반 분석
// ─────────────────────────────────────────────

interface StructureAnalysis {
  keywordType: string;
  interpretation: string;
  priorityArea: { label: string; reason: string };
  strategy: string[];
  tools: string[];
}

const SHOPPING_TYPES = ['price', 'shopping', 'brand_ad', 'shopping_estimated'];
const PLACE_TYPES = ['place', 'place_ad', 'place_new', 'place_recommendation', 'place_estimated'];
const CONTENT_TYPES = ['blog', 'view', 'content', 'influencer', 'video', 'brand_content', 'blog_estimated', 'influencer_estimated'];
const INFO_TYPES = ['news', 'image', 'book', 'kin', 'news_estimated', 'kin_estimated'];
const AD_TYPES = ['ad', 'powerlink', 'brand_ad'];
const WEB_TYPES = ['web', 'web_estimated'];
// 의료 신호: 단락명/분류에서 감지 (보조 신호)
const MEDICAL_HINTS = ['건강', '의료', '병원', '치아', '교정', '의학', '진료', '치료', '검진', '건강·의학'];
// 강한 의료 키워드: 키워드 자체에 병원·의료·시술 의도가 있을 때만 장소+전문정보형 사용
const STRONG_MEDICAL_KEYWORD_HINTS = [
  '병원', '의원', '클리닉', '치과', '치아', '교정', '임플란트',
  '피부과', '성형', '한의원', '안과', '이비인후과', '정형외과',
  '재활', '요양', '의료', '진료', '검진', '수술', '시술', '라식', '라섹',
];

interface SectionSignals {
  hasShopping: boolean;
  hasPlace: boolean;
  hasContent: boolean;
  hasInfo: boolean;
  hasAd: boolean;
  hasWeb: boolean;
  hasMedical: boolean;
  /** 키워드 자체에 병원·의료·시술 의도가 있는지 (장소+전문정보형 분류 기준) */
  hasMedicalKeyword: boolean;
  topHasShopping: boolean;
  topHasPlace: boolean;
  topHasContent: boolean;
  topHasInfo: boolean;
  topHasAd: boolean;
  topHasWeb: boolean;
  topSections: RenderedSection[];
  /** 상위 5개 단락 기준 주요 신호 유형 수 (쇼핑/장소/콘텐츠/정보) */
  topMainSignalCount: number;
}

function hasTypeIn(sections: RenderedSection[], types: string[]): boolean {
  return sections.some(s => types.includes(s.type));
}

function getSectionLabel(section: RenderedSection): string {
  if (section.title && section.title !== '제목 없는 단락') return section.title;
  return section.classification;
}

function isContentLikeSection(section: RenderedSection): boolean {
  const text = `${section.title} ${section.classification}`;
  return CONTENT_TYPES.includes(section.type)
    || section.type === 'related'
    || /함께 많이 찾는|클립|인기글|인플루언서|메이트|라운지|블로그|오픈톡|추천 콘텐츠/.test(text);
}

function detectMedicalSignal(keyword: string, sections: RenderedSection[]): boolean {
  if (MEDICAL_HINTS.some(h => keyword.includes(h))) return true;
  return sections.some(s =>
    MEDICAL_HINTS.some(h => `${s.title} ${s.classification}`.includes(h))
  );
}

function detectStrongMedicalKeyword(keyword: string): boolean {
  return STRONG_MEDICAL_KEYWORD_HINTS.some(h => keyword.includes(h));
}

function extractSectionSignals(sections: RenderedSection[], keyword: string): SectionSignals {
  const topSections = sections.slice(0, 5);

  const hasShopping = hasTypeIn(sections, SHOPPING_TYPES);
  const hasPlace = hasTypeIn(sections, PLACE_TYPES);
  const hasContent = sections.some(isContentLikeSection);
  const hasInfo = hasTypeIn(sections, INFO_TYPES);
  const hasAd = hasTypeIn(sections, AD_TYPES);
  const hasWeb = hasTypeIn(sections, WEB_TYPES);
  const hasMedical = detectMedicalSignal(keyword, sections);
  const hasMedicalKeyword = detectStrongMedicalKeyword(keyword);

  const topHasShopping = hasTypeIn(topSections, SHOPPING_TYPES);
  const topHasPlace = hasTypeIn(topSections, PLACE_TYPES);
  const topHasContent = topSections.some(isContentLikeSection);
  const topHasInfo = hasTypeIn(topSections, INFO_TYPES);
  const topHasAd = hasTypeIn(topSections, AD_TYPES);
  const topHasWeb = hasTypeIn(topSections, WEB_TYPES);

  const topMainSignalCount = [topHasShopping, topHasPlace, topHasContent, topHasInfo].filter(Boolean).length;

  return {
    hasShopping, hasPlace, hasContent, hasInfo, hasAd, hasWeb, hasMedical, hasMedicalKeyword,
    topHasShopping, topHasPlace, topHasContent, topHasInfo, topHasAd, topHasWeb,
    topSections,
    topMainSignalCount,
  };
}

function uniqueLabels(labels: string[]): string[] {
  return labels.filter((label, index) => label && labels.indexOf(label) === index);
}

function formatQuotedList(labels: string[]): string {
  return labels.map(l => `"${l}"`).join(', ');
}

function getShoppingLabels(sections: RenderedSection[]): string[] {
  return uniqueLabels(
    sections.filter(s => SHOPPING_TYPES.includes(s.type)).map(getSectionLabel)
  ).slice(0, 2);
}

function getPlaceLabels(sections: RenderedSection[]): string[] {
  return uniqueLabels(
    sections.filter(s => PLACE_TYPES.includes(s.type)).map(getSectionLabel)
  ).slice(0, 2);
}

function getContentLabels(sections: RenderedSection[]): string[] {
  return uniqueLabels(
    sections.filter(isContentLikeSection).map(getSectionLabel)
  ).slice(0, 3);
}

function getInfoLabels(sections: RenderedSection[]): string[] {
  return uniqueLabels(
    sections.filter(s => INFO_TYPES.includes(s.type)).map(getSectionLabel)
  ).slice(0, 3);
}

// ── 해석 문장 생성 헬퍼 ──

function makeShoppingInterpretation(signals: SectionSignals): string {
  const top = signals.topSections;
  const shoppingLabels = getShoppingLabels(top);
  const contentLabels = getContentLabels(top);

  if (signals.hasContent && contentLabels.length > 0) {
    const shoppingText = shoppingLabels.length >= 2
      ? `${formatQuotedList(shoppingLabels)} 단락이`
      : shoppingLabels.length === 1
      ? `"${shoppingLabels[0]}" 단락이`
      : '쇼핑 단락이';
    return `상위에 ${shoppingText} 노출되고, ${formatQuotedList(contentLabels)} 단락도 함께 보여 상품 최적화와 콘텐츠 보완이 모두 필요합니다.`;
  }

  const adNote = signals.hasAd ? ' 광고 단락도 함께 노출됩니다.' : '';
  if (shoppingLabels.length >= 2) {
    return `상위에 ${formatQuotedList(shoppingLabels)} 단락이 노출되어 상품명, 가격, 리뷰 비교가 중요합니다.${adNote}`;
  }
  if (shoppingLabels.length === 1) {
    return `상위에 "${shoppingLabels[0]}" 단락이 노출되어 상품 정보와 스토어 최적화가 우선입니다.${adNote}`;
  }
  return `쇼핑 영역이 상위에 노출되어 상품명, 가격, 리뷰, 배송 조건 비교가 중요합니다.${adNote}`;
}

function makePlaceContentInterpretation(signals: SectionSignals): string {
  const top = signals.topSections;
  const placeLabels = getPlaceLabels(top);
  const contentLabels = getContentLabels(top);
  const placeText = placeLabels.length > 0 ? `"${placeLabels[0]}" 단락이` : '"플레이스" 단락이';
  const contentText = contentLabels.length > 0 ? `${formatQuotedList(contentLabels)} 단락도` : '클립·인기글 등 콘텐츠 단락도';
  return `${placeText} 상위에 노출되고, ${contentText} 함께 보여 장소 노출과 콘텐츠 공략이 모두 필요합니다.`;
}

function makePlaceInterpretation(signals: SectionSignals): string {
  const top = signals.topSections;
  const placeLabels = getPlaceLabels(top);
  const placeText = placeLabels.length > 0 ? `"${placeLabels[0]}" 단락이` : '"플레이스" 단락이';
  return `${placeText} 상위에 노출되어 업체 정보, 리뷰, 사진, 위치 정보 관리가 우선입니다.`;
}

function makeMedicalPlaceInterpretation(signals: SectionSignals): string {
  const top = signals.topSections;
  const placeLabels = getPlaceLabels(top);
  const placeText = placeLabels.length > 0 ? `"${placeLabels[0]}"` : '"플레이스"';
  return `${placeText}와 건강·의학 콘텐츠 단락이 함께 노출되어 병원 정보, 리뷰, 신뢰성 있는 전문 콘텐츠를 함께 점검해야 합니다.`;
}

function makeCompositeInterpretation(signals: SectionSignals): string {
  const top = signals.topSections;
  const contentLabels = getContentLabels(top).slice(0, 2);
  const infoLabels = getInfoLabels(top).slice(0, 1);
  const repLabels = uniqueLabels([...contentLabels, ...infoLabels]).slice(0, 2);

  const typeParts: string[] = [];
  if (signals.hasContent) typeParts.push('콘텐츠');
  if (signals.hasInfo) typeParts.push('정보성');
  if (signals.hasShopping) typeParts.push('쇼핑');

  if (repLabels.length >= 2) {
    return `${formatQuotedList(repLabels)} 등 ${typeParts.join('·')} 단락이 함께 노출되어 콘텐츠 신뢰도와 상품·정보 대응을 함께 점검해야 합니다.`;
  }
  if (typeParts.length >= 2) {
    return `${typeParts.join('·')} 영역이 함께 노출되어 콘텐츠 공략과 정보 탐색 대응을 함께 점검해야 합니다.`;
  }
  const topLabels = uniqueLabels(top.map(getSectionLabel)).slice(0, 2);
  if (topLabels.length >= 2) {
    return `${formatQuotedList(topLabels)} 등 여러 영역이 함께 노출되어 영역별 대응이 필요합니다.`;
  }
  return '다양한 영역이 함께 노출되어 영역별 대응이 필요합니다.';
}

function buildCompositePriorityLabel(signals: SectionSignals): string {
  const parts: string[] = [];
  if (signals.hasContent) parts.push('콘텐츠 공략');
  if (signals.hasInfo) parts.push('정보 탐색 대응');
  if (signals.hasShopping && !parts.includes('쇼핑 점검')) parts.push('쇼핑 점검');
  return parts.slice(0, 2).join(' + ') || '복합 영역 점검';
}

// ── 추천 공략 (strategy) ──

function buildShoppingStrategy(signals: SectionSignals): string[] {
  const lines = [
    '네이버 가격비교와 네이버플러스 스토어 노출을 먼저 점검하세요.',
    '상품명, 썸네일, 가격, 리뷰, 배송 조건을 경쟁 상품과 비교하세요.',
  ];
  if (signals.hasContent) {
    lines.push('클립, 인기글 등 콘텐츠 영역에 맞춘 콘텐츠 전략도 함께 준비하세요.');
  } else if (signals.hasAd) {
    lines.push('파워링크 또는 쇼핑 광고 노출 여부를 확인하고, 초기 유입 확보를 검토하세요.');
  } else {
    lines.push('연관 키워드를 상품명, 상세페이지에 자연스럽게 반영하세요.');
  }
  return lines.slice(0, 3);
}

function buildPlaceStrategy(signals: SectionSignals): string[] {
  const lines = [
    '플레이스 순위와 지도 노출 상태를 먼저 확인하세요.',
    '업체명, 카테고리, 리뷰, 사진, 방문자 반응을 경쟁 업체와 비교하세요.',
  ];
  if (signals.hasMedical) {
    lines.push('단순 홍보보다 신뢰성 있는 정보 콘텐츠와 플레이스 신뢰 요소를 함께 점검하세요.');
  } else if (signals.hasContent) {
    lines.push('블로그, 클립, 인플루언서, 인기글 영역에 맞춘 콘텐츠 전략을 검토하세요.');
  } else {
    lines.push('인근 경쟁 업체와 비교해 차별화 포인트를 명확히 하세요.');
  }
  return lines.slice(0, 3);
}

function buildContentStrategy(signals: SectionSignals): string[] {
  const lines = [
    '블로그, 클립, 인플루언서, 인기글 등 콘텐츠 영역에 맞춘 전략을 검토하세요.',
    '콘텐츠 작성 방향은 키워드 정밀 분석 결과와 함께 확인하세요.',
  ];
  if (signals.hasInfo) {
    lines.push('뉴스, 이미지, 도서 등 정보성 단락에서 노출 가능한 콘텐츠 방향도 함께 준비하세요.');
  } else {
    lines.push('실제 검색 단락에 맞춰 제목, 소재, 형식을 나눠 준비하세요.');
  }
  return lines.slice(0, 3);
}

function buildCompositeStrategy(signals: SectionSignals): string[] {
  const lines: string[] = [];
  if (signals.hasShopping) {
    lines.push('가격비교, 스토어 등 쇼핑 영역 노출을 점검하세요.');
  }
  if (signals.hasPlace) {
    lines.push('플레이스 순위와 지도 노출 상태를 확인하세요.');
  }
  if (signals.hasContent) {
    lines.push('블로그, 클립, 인기글 등 콘텐츠 단락에 맞춘 전략을 함께 준비하세요.');
  }
  if (signals.hasInfo && lines.length < 3) {
    lines.push('뉴스, 이미지 등 정보성 단락에서의 노출 방향도 검토하세요.');
  }
  if (lines.length === 0) {
    lines.push('상위에 노출된 단락별로 우선순위를 정해 영역별 점검을 진행하세요.');
    lines.push('키워드 정밀 분석과 연관 키워드로 검색 의도를 함께 확인하세요.');
  }
  return lines.slice(0, 3);
}

// ── 추천 도구 ──

function buildTools(keywordType: string, signals: SectionSignals): string[] {
  if (['쇼핑 중심형', '쇼핑+콘텐츠 복합형', '쇼핑+광고형', '쇼핑+브랜드 탐색형'].includes(keywordType)) {
    return ['쇼핑 순위 확인', '키워드별 조회수', '연관 키워드 조회', '키워드 정밀 분석'];
  }
  if (['장소/플레이스 중심형', '장소+콘텐츠 복합형', '장소+전문정보형'].includes(keywordType)) {
    return ['플레이스 순위 확인', '키워드 정밀 분석', '키워드별 조회수', '연관 키워드 조회'];
  }
  if (keywordType === '의료·전문정보형') {
    return ['키워드 정밀 분석', '플레이스 순위 확인', '키워드별 조회수', '연관 키워드 조회'];
  }
  const fourth = signals.hasShopping
    ? '쇼핑 순위 확인'
    : signals.hasPlace
    ? '플레이스 순위 확인'
    : '쇼핑 순위 확인';
  return ['키워드 정밀 분석', '키워드별 조회수', '연관 키워드 조회', fourth];
}

// ── 메인 분석 함수 ──

function analyzeKeywordStructure(sections: RenderedSection[], keyword: string): StructureAnalysis {
  const signals = extractSectionSignals(sections, keyword);

  // 1. 의료/전문정보 + 플레이스 → 장소+전문정보형
  // 키워드 자체에 병원·의료·시술 의도가 있을 때만 적용 (단락명만으로 분류하지 않음)
  if (signals.hasMedicalKeyword && signals.hasPlace) {
    const keywordType = '장소+전문정보형';
    const interp = makeMedicalPlaceInterpretation(signals);
    return {
      keywordType,
      interpretation: interp,
      priorityArea: { label: '플레이스 노출 + 전문정보 콘텐츠', reason: interp },
      strategy: buildPlaceStrategy(signals),
      tools: buildTools(keywordType, signals),
    };
  }

  // 2. 의료/전문정보만 강하면 → 의료·전문정보형 (키워드 의도 기준)
  if (signals.hasMedicalKeyword) {
    const keywordType = '의료·전문정보형';
    const interp = '건강·의학 관련 콘텐츠 단락이 주요 위치에 노출되어 신뢰성 있는 전문 정보 전략이 필요합니다.';
    return {
      keywordType,
      interpretation: interp,
      priorityArea: { label: '전문정보 콘텐츠 공략', reason: interp },
      strategy: buildContentStrategy(signals),
      tools: buildTools(keywordType, signals),
    };
  }

  // 3. 상위 5개 기준 주요 신호 3종 이상 → 복합형
  if (signals.topMainSignalCount >= 3) {
    const keywordType = '복합형';
    const interp = makeCompositeInterpretation(signals);
    return {
      keywordType,
      interpretation: interp,
      priorityArea: { label: buildCompositePriorityLabel(signals), reason: interp },
      strategy: buildCompositeStrategy(signals),
      tools: buildTools(keywordType, signals),
    };
  }

  // 4. 플레이스 + 콘텐츠 (상위) → 장소+콘텐츠 복합형
  if (signals.topHasPlace && signals.topHasContent) {
    const keywordType = '장소+콘텐츠 복합형';
    const interp = makePlaceContentInterpretation(signals);
    return {
      keywordType,
      interpretation: interp,
      priorityArea: { label: '플레이스 노출 + 콘텐츠 공략', reason: interp },
      strategy: buildPlaceStrategy(signals),
      tools: buildTools(keywordType, signals),
    };
  }

  // 5. 플레이스 강함 (쇼핑 없음) → 장소 계열
  if (signals.topHasPlace || (signals.hasPlace && !signals.hasShopping)) {
    if (signals.hasContent) {
      const keywordType = '장소+콘텐츠 복합형';
      const interp = makePlaceContentInterpretation(signals);
      return {
        keywordType,
        interpretation: interp,
        priorityArea: { label: '플레이스 노출 + 콘텐츠 공략', reason: interp },
        strategy: buildPlaceStrategy(signals),
        tools: buildTools(keywordType, signals),
      };
    }
    const keywordType = '장소/플레이스 중심형';
    const interp = makePlaceInterpretation(signals);
    return {
      keywordType,
      interpretation: interp,
      priorityArea: { label: '플레이스 노출 최적화', reason: interp },
      strategy: buildPlaceStrategy(signals),
      tools: buildTools(keywordType, signals),
    };
  }

  // 6. 쇼핑 + 콘텐츠 → 쇼핑+콘텐츠 복합형
  if (signals.hasShopping && signals.hasContent) {
    const keywordType = '쇼핑+콘텐츠 복합형';
    const interp = makeShoppingInterpretation(signals);
    return {
      keywordType,
      interpretation: interp,
      priorityArea: { label: '쇼핑 최적화 + 콘텐츠 공략', reason: interp },
      strategy: buildShoppingStrategy(signals),
      tools: buildTools(keywordType, signals),
    };
  }

  // 7. 쇼핑 + 광고 (콘텐츠 없음) → 쇼핑+광고형
  if (signals.hasShopping && signals.hasAd && !signals.hasContent) {
    const keywordType = '쇼핑+광고형';
    const interp = makeShoppingInterpretation(signals);
    return {
      keywordType,
      interpretation: interp,
      priorityArea: { label: '쇼핑 최적화 + 광고 대응', reason: interp },
      strategy: buildShoppingStrategy(signals),
      tools: buildTools(keywordType, signals),
    };
  }

  // 쇼핑 + 웹문서가 상위에 있고 콘텐츠·플레이스 없음 → 쇼핑+브랜드 탐색형
  if (signals.hasShopping && signals.topHasWeb && !signals.hasContent && !signals.hasPlace) {
    const keywordType = '쇼핑+브랜드 탐색형';
    const interp = '쇼핑 단락과 웹문서·사이트 단락이 함께 노출되어 상품 노출과 브랜드 검색 대응을 함께 점검해야 합니다.';
    return {
      keywordType,
      interpretation: interp,
      priorityArea: { label: '쇼핑 최적화 + 브랜드 점검', reason: interp },
      strategy: buildShoppingStrategy(signals),
      tools: buildTools(keywordType, signals),
    };
  }

  // 8. 쇼핑 단독 → 쇼핑 중심형
  if (signals.hasShopping) {
    const keywordType = '쇼핑 중심형';
    const interp = makeShoppingInterpretation(signals);
    return {
      keywordType,
      interpretation: interp,
      priorityArea: { label: '쇼핑 최적화', reason: interp },
      strategy: buildShoppingStrategy(signals),
      tools: buildTools(keywordType, signals),
    };
  }

  // 9. 콘텐츠 + 정보 → 복합형
  if (signals.hasContent && signals.hasInfo) {
    const keywordType = '복합형';
    const interp = makeCompositeInterpretation(signals);
    return {
      keywordType,
      interpretation: interp,
      priorityArea: { label: '콘텐츠 공략 + 정보 탐색 대응', reason: interp },
      strategy: buildContentStrategy(signals),
      tools: buildTools(keywordType, signals),
    };
  }

  // 10. 콘텐츠 공략형
  if (signals.hasContent) {
    const keywordType = '콘텐츠 공략형';
    const contentLabels = getContentLabels(signals.topSections);
    const contentText = contentLabels.length > 0
      ? `${formatQuotedList(contentLabels)} 등 콘텐츠 단락이`
      : '콘텐츠 단락이';
    const interp = `${contentText} 상위에 보여 검색 단락에 맞춘 콘텐츠 전략이 필요합니다.`;
    return {
      keywordType,
      interpretation: interp,
      priorityArea: { label: '콘텐츠 공략', reason: interp },
      strategy: buildContentStrategy(signals),
      tools: buildTools(keywordType, signals),
    };
  }

  // 11. 정보 탐색형
  if (signals.hasInfo) {
    const keywordType = '정보 탐색형';
    const infoLabels = getInfoLabels(signals.topSections);
    const infoText = infoLabels.length > 0
      ? `${formatQuotedList(infoLabels)} 등 정보 탐색 단락이`
      : '정보 탐색 단락이';
    const interp = `${infoText} 함께 보여 단순 판매보다 정보성 콘텐츠 대응이 중요합니다.`;
    return {
      keywordType,
      interpretation: interp,
      priorityArea: { label: '정보성 콘텐츠 대응', reason: interp },
      strategy: buildContentStrategy(signals),
      tools: buildTools(keywordType, signals),
    };
  }

  // 12. 기본 복합형
  const keywordType = '복합형';
  const fallbackLabels = uniqueLabels(signals.topSections.map(getSectionLabel)).slice(0, 2);
  const fallbackInterp = fallbackLabels.length >= 2
    ? `${formatQuotedList(fallbackLabels)} 등 여러 영역이 함께 노출되어 영역별 대응이 필요합니다.`
    : '다양한 유형의 결과가 함께 노출되어 영역별 대응이 필요합니다.';
  return {
    keywordType,
    interpretation: fallbackInterp,
    priorityArea: { label: '복합 영역 점검', reason: fallbackInterp },
    strategy: buildCompositeStrategy(signals),
    tools: buildTools(keywordType, signals),
  };
}

// ─────────────────────────────────────────────
// 메인 페이지 컴포넌트
// ─────────────────────────────────────────────

export default function SearchStructurePage() {
  const { user } = useAuth();
  const { deductPoints } = usePoint();

  const [keyword, setKeyword] = useState('');
  const [isLoadingRendered, setIsLoadingRendered] = useState(false);
  const [renderedResult, setRenderedResult] = useState<RenderedSearchResult | null>(null);
  const [renderedError, setRenderedError] = useState<string | null>(null);

  // SEARCH_STRUCTURE 포인트 정책 (관리자가 0P 초과로 설정하면 차감 적용)
  const [pointCost, setPointCost] = useState<number>(0);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('point_policies')
      .select('point_cost')
      .eq('page_type', 'SEARCH_STRUCTURE')
      .single()
      .then(({ data }) => { if (data) setPointCost(data.point_cost); });
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);

  const callSearchApi = async (kw: string): Promise<void> => {
    setIsLoadingRendered(true);
    setRenderedError(null);
    try {
      const res = await fetch('/api/search-structure-rendered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw }),
      });
      const data = await res.json();
      if (!res.ok) { setRenderedError(data?.error || '렌더링 분석 중 오류가 발생했습니다.'); return; }
      setRenderedResult(data as RenderedSearchResult);
    } catch {
      setRenderedError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsLoadingRendered(false);
    }
  };

  const handleRenderedSearch = async () => {
    const kw = keyword.trim();
    if (!kw) { inputRef.current?.focus(); return; }
    setRenderedResult(null);

    // point_cost > 0인 경우에만 포인트 차감 (0P이면 무료 베타 그대로)
    if (pointCost > 0) {
      const approved = await deductPoints(user?.id, pointCost, 1, kw);
      if (!approved) return;
    }

    await callSearchApi(kw);
  };

  const handleSupplementSearch = async () => {
    const kw = keyword.trim();
    if (!kw || isLoadingRendered) return;

    if (pointCost > 0) {
      const approved = await deductPoints(user?.id, pointCost, 1, kw);
      if (!approved) return;
    }

    await callSearchApi(kw);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleRenderedSearch();
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <div
        className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight"
        style={{ fontFamily: "'NanumSquare', sans-serif" }}
      >
        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">

            {/* NAVER TOOLS 공통 탭 */}
            <RankTabs />

            {/* 페이지 헤더 */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                검색결과 구성 분석
                <span className="inline-flex items-center gap-1">
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-600 leading-tight">FREE</span>
                  <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-500 leading-tight">beta</span>
                </span>
              </h1>
              <p className="!text-sm !text-slate-500 leading-relaxed">
                모바일 네이버 통합검색 1페이지의 주요 단락 구성을 자동 감지합니다. 네이버 검색결과 리뉴얼 기간에는 일부 단락이 중복되거나 추정될 수 있습니다.
              </p>
            </div>

            {/* 안내 배너 */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
              <p className={`${TYPO_CARD_DESC} text-slate-600`}>
                무료 베타 기능입니다. 실제 모바일 네이버 화면을 기준으로 주요 단락을 자동 감지하며, 네이버 화면 구조에 따라 일부 단락은 중복되거나 추정될 수 있습니다. 결과는 검색결과 구조를 빠르게 파악하기 위한 참고용으로 활용해 주세요.
              </p>
            </div>

            {/* ── 상단 2열: 키워드 입력 + 분석 요약 (높이 맞춤) ── */}
            <div className="grid grid-cols-[9fr_11fr] gap-6 items-stretch mb-5">
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-full flex flex-col">
                <label className={`block ${TYPO_CARD_TITLE} mb-2 shrink-0`}>키워드 입력</label>
                <div className="flex gap-3 flex-1 items-center min-h-0">
                  <input
                    ref={inputRef}
                    type="text"
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="예: 강남 헬스장, 다이어트 보충제"
                    className="flex-1 min-w-0 border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#5244e8]/30 focus:border-[#5244e8]"
                    disabled={isLoadingRendered}
                  />
                  <button
                    onClick={handleRenderedSearch}
                    disabled={isLoadingRendered || !keyword.trim()}
                    className="shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 !text-white rounded-lg text-sm font-bold transition-colors shadow-sm whitespace-nowrap flex items-center justify-center gap-1.5"
                    title="네이버 모바일 검색 화면 기준으로 현재 노출되는 단락 순서를 분석합니다."
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                    </svg>
                    {isLoadingRendered ? '분석 중...' : '모바일 화면 분석'}
                  </button>
                </div>
              </div>

              {renderedResult && !isLoadingRendered ? (
                <RenderedSummaryCard result={renderedResult} />
              ) : isLoadingRendered ? (
                <div className="bg-white border border-gray-100 rounded-xl p-8 text-center shadow-sm h-full flex flex-col items-center justify-center">
                  <div className="w-6 h-6 border-[3px] border-gray-100 border-t-emerald-300 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-300">분석 결과가 준비되면 여기에 표시됩니다.</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-100 rounded-xl p-10 text-center shadow-sm h-full flex flex-col items-center justify-center">
                  <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    키워드를 입력하고 분석을 시작하면<br />구조 요약과 공략 방향이 여기에 표시됩니다.
                  </p>
                </div>
              )}
            </div>

            {/* ── 하단 2열 메인 레이아웃 (45 : 55) ── */}
            <div className="grid grid-cols-[9fr_11fr] gap-6 items-start">

              {/* ───── 왼쪽 열 ───── */}
              <div className="space-y-5">

                {/* 로딩 상태 */}
                {isLoadingRendered && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 shadow-sm flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-[3px] border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-sm text-emerald-700 font-bold">모바일 화면을 분석하는 중입니다...</p>
                    <p className="text-xs text-emerald-600">실제 모바일 기준으로 노출되는 단락 순서를 분석합니다.</p>
                    <p className="text-xs text-gray-400">검색어: <span className="font-bold text-gray-600">{keyword}</span></p>
                  </div>
                )}

                {/* 에러 상태 */}
                {renderedError && !isLoadingRendered && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-bold text-red-700 mb-0.5">분석 실패</p>
                        <p className="text-sm text-red-600">{renderedError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 단락 순서 표 */}
                {renderedResult && !isLoadingRendered && (
                  <>
                    <RenderedSectionsTable sections={renderedResult.sections} keyword={renderedResult.keyword} />
                    {renderedResult.qualityStatus === 'low_confidence' ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                        <p className={`${TYPO_CARD_DESC} text-amber-700 font-semibold`}>
                          수집 결과 보완이 필요할 수 있습니다.
                        </p>
                        {renderedResult.qualityReasons && renderedResult.qualityReasons.length > 0 && (
                          <ul className="space-y-0.5">
                            {renderedResult.qualityReasons.map((reason, i) => (
                              <li key={i} className={`${TYPO_CARD_DESC} text-amber-600`}>• {reason}</li>
                            ))}
                          </ul>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            onClick={handleSupplementSearch}
                            disabled={isLoadingRendered}
                            className="mt-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 !text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                          >
                            {isLoadingRendered ? '보완 분석 중...' : '결과 보완 분석'}
                          </button>
                          <p className={`${TYPO_CARD_DESC} text-amber-500 mt-1`}>
                            무료 베타에서는 포인트가 차감되지 않습니다. 단, 일일 무료 이용 횟수 제한이 적용될 수 있습니다.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <p className={`${TYPO_CARD_DESC} text-emerald-700`}>
                          현재 모바일 검색 화면에서 감지된 주요 단락을 기준으로 분석합니다. 일부 단락은 네이버 화면 구조에 따라 추정값일 수 있습니다.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ───── 오른쪽 열 ───── */}
              <div className="space-y-5">
                {renderedResult && !isLoadingRendered && (
                  <>
                    <StructureAnalysisPanel sections={renderedResult.sections} keyword={renderedResult.keyword} />
                    <KeywordTypeGuideCard />
                  </>
                )}
              </div>
            </div>

          </div>{/* /max-w-7xl */}
        </main>
      </div>
    </>
  );
}

const RESULT_CARD_HEADER_CLASS =
  'px-5 py-3.5 min-h-[4.25rem] flex flex-col justify-center border-b shrink-0';

const TYPO_CARD_TITLE = 'text-sm font-bold text-slate-800 leading-snug';
const TYPO_CARD_DESC = 'text-xs text-slate-500 leading-relaxed';
const TYPO_BODY = 'text-sm text-slate-700 leading-relaxed';
const TYPO_BODY_LABEL = 'font-semibold text-slate-500';
const TYPO_SECTION_LABEL = 'text-xs font-bold text-slate-500 uppercase tracking-wide';

const KEYWORD_TYPE_COLOR: Record<string, string> = {
  '쇼핑 중심형': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  '광고 노출형': 'bg-orange-100 text-orange-700 border-orange-200',
  '장소/플레이스 중심형': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  '콘텐츠 공략형': 'bg-rose-100 text-rose-700 border-rose-200',
  '브랜드/탐색형': 'bg-violet-100 text-violet-700 border-violet-200',
  '정보 탐색형': 'bg-sky-100 text-sky-700 border-sky-200',
  '의료·전문정보형': 'bg-teal-100 text-teal-700 border-teal-200',
  '복합형': 'bg-purple-100 text-purple-700 border-purple-200',
};

const KEYWORD_TYPE_GUIDE: { type: string; description: string }[] = [
  { type: '쇼핑 중심형', description: '가격비교, 스토어, 상품 카드가 강하게 노출되는 키워드입니다.' },
  { type: '광고 노출형', description: '파워링크나 쇼핑 브랜드 광고가 주요 위치에 노출되는 키워드입니다.' },
  { type: '장소/플레이스 중심형', description: '지도, 플레이스, 업체 정보가 검색결과에서 중요한 키워드입니다.' },
  { type: '콘텐츠 공략형', description: '블로그, 클립, 인플루언서, 인기글 등 콘텐츠 노출이 중요한 키워드입니다.' },
  { type: '브랜드/탐색형', description: '브랜드 콘텐츠, 공식 사이트, 웹문서 탐색 결과가 함께 나타나는 키워드입니다.' },
  { type: '정보 탐색형', description: '뉴스, 이미지, 지식iN, 도서 등 정보 확인 목적이 강한 키워드입니다.' },
  { type: '의료·전문정보형', description: '건강, 의료, 상담, 전문 정보성 결과가 함께 노출되는 키워드입니다.' },
  { type: '복합형', description: '쇼핑, 광고, 콘텐츠, 웹문서 등 여러 영역이 함께 노출되는 키워드입니다.' },
];

function resolveKeywordTypeColorKey(keywordType: string): string {
  if (KEYWORD_TYPE_COLOR[keywordType]) return keywordType;
  if (keywordType.includes('복합')) return '복합형';
  if (keywordType.includes('쇼핑')) return '쇼핑 중심형';
  if (keywordType.includes('장소') || keywordType.includes('플레이스')) return '장소/플레이스 중심형';
  if (keywordType.includes('콘텐츠')) return '콘텐츠 공략형';
  if (keywordType.includes('정보')) return '정보 탐색형';
  return '복합형';
}

function getKeywordTypeBadgeClass(keywordType: string): string {
  const color = KEYWORD_TYPE_COLOR[resolveKeywordTypeColorKey(keywordType)];
  return `inline-block align-baseline mx-0.5 px-2.5 py-0.5 rounded-full text-xs font-bold border leading-snug ${color}`;
}

function KeywordResultCardTitle({ keyword, suffix }: { keyword: string; suffix: string }) {
  return (
    <h2 className={TYPO_CARD_TITLE}>
      {'\u201C'}
      <span className="italic">{keyword}</span>
      {'\u201D'} {suffix}
    </h2>
  );
}

function renderInterpretationWithTypeBadge(interpretation: string, keywordType: string) {
  if (interpretation.includes(keywordType)) {
    const idx = interpretation.indexOf(keywordType);
    return (
      <>
        {interpretation.slice(0, idx)}
        <span className={getKeywordTypeBadgeClass(keywordType)}>{keywordType}</span>
        {interpretation.slice(idx + keywordType.length)}
      </>
    );
  }
  return (
    <>
      <span className={getKeywordTypeBadgeClass(keywordType)}>{keywordType}</span>
      {' '}
      {interpretation}
    </>
  );
}

// ─────────────────────────────────────────────
// 단락 순서 표 (왼쪽 열 하단)
// ─────────────────────────────────────────────

function RenderedSectionsTable({ sections, keyword }: { sections: RenderedSection[]; keyword: string }) {
  return (
    <div className="bg-white border border-emerald-200 rounded-xl shadow-sm overflow-hidden">
      <div className={`${RESULT_CARD_HEADER_CLASS} border-emerald-100 bg-emerald-50/40`}>
        <KeywordResultCardTitle keyword={keyword} suffix="검색 단락 순서" />
        <p className={`${TYPO_CARD_DESC} mt-0.5`}>모바일 검색 화면에서 감지된 주요 단락 기준</p>
      </div>

      {sections.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-gray-400">감지된 단락이 없습니다. 키워드를 다시 확인해 주세요.</p>
        </div>
      ) : (
        <>
          {/* 컬럼 헤더: 순서 | 단락명 | 분류 | 감지 기준 */}
          <div
            className="grid items-center gap-x-3 px-4 py-2 bg-gray-50 border-b border-gray-200"
            style={{ gridTemplateColumns: '2rem 1fr 120px 74px' }}
          >
            <div className={`${TYPO_SECTION_LABEL} text-center`}>순서</div>
            <div className={TYPO_SECTION_LABEL}>단락명</div>
            <div className={TYPO_SECTION_LABEL}>분류</div>
            <div className={TYPO_SECTION_LABEL}>감지 기준</div>
          </div>

          <div className="divide-y divide-gray-100">
            {sections.map((section, idx) => {
              const meta = getTypeMeta(section.type);
              const hasRealTitle = section.title !== '제목 없는 단락';
              const displaySectionTitle =
                section.title === '제목 없는 단락' ? '제목 미감지' : section.title;
              return (
                <div key={section.order} className={meta.bg}>
                  <div
                    className="grid items-center gap-x-3 px-4 py-2.5"
                    style={{ gridTemplateColumns: '2rem 1fr 120px 74px' }}
                  >
                    {/* 순서 */}
                    <div className="flex justify-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${meta.border} ${meta.badge}`}>
                        {idx + 1}
                      </div>
                    </div>

                    {/* 단락명 */}
                    <div className={`text-sm font-bold ${meta.color} min-w-0 leading-snug`}>
                      {displaySectionTitle}
                    </div>

                    {/* 분류 */}
                    <div className="min-w-0">
                      <span className={`inline-block text-[11px] font-bold ${meta.badge} px-1.5 py-0.5 rounded leading-snug`}>
                        {section.classification}
                      </span>
                    </div>

                    {/* 감지 기준 */}
                    <div>
                      {section.isEstimated ? (
                        <span className="inline-block w-[3.75rem] min-w-[3.75rem] text-center text-[11px] px-1 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700 font-bold">
                          추정 감지
                        </span>
                      ) : hasRealTitle ? (
                        <span className="inline-block w-[3.75rem] min-w-[3.75rem] text-center text-[11px] px-1 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 font-bold">
                          화면 감지
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-300">-</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 분석 요약 카드 (오른쪽 상단)
// ─────────────────────────────────────────────

function RenderedSummaryCard({ result }: { result: RenderedSearchResult }) {
  const confirmedCount = result.sections.filter(s => !s.isEstimated && s.title !== '제목 없는 단락').length;

  const usageScopeLabel: Record<string, string> = {
    anonymous: '무료 베타 (비로그인)',
    free_user: '무료 베타',
    admin: '관리자',
  };

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-sm h-full min-h-full flex flex-col">
      <div className="grid grid-cols-[1.05fr_0.85fr] gap-x-3 mb-2 shrink-0 items-center">
        <h2 className={TYPO_CARD_TITLE}>분석 요약</h2>
        {result.elapsedMs != null && (
          <p className={`${TYPO_BODY} whitespace-nowrap`}>
            <span className={TYPO_BODY_LABEL}>소요 시간: </span>
            <span className="font-semibold text-emerald-600">{(result.elapsedMs / 1000).toFixed(1)}초</span>
          </p>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-0">
        <div className="grid grid-cols-[1.05fr_0.85fr] gap-x-3 items-start">
          <div className="min-w-0 space-y-1">
            <p className={TYPO_BODY}>
              <span className={TYPO_BODY_LABEL}>검색어: </span>
              <span>{result.keyword}</span>
            </p>
            <p className={`${TYPO_BODY} whitespace-nowrap`}>
              <span className={TYPO_BODY_LABEL}>조회 기준: </span>
              <span>{cleanBaseLabel(result.base)}</span>
            </p>
          </div>
          <div className="min-w-0 space-y-1">
            <p className={`${TYPO_BODY} whitespace-nowrap`}>
              <span className={TYPO_BODY_LABEL}>조회 시각: </span>
              <span>{formatDateTime(result.searchedAt)}</span>
            </p>
            <p className={`${TYPO_BODY} whitespace-nowrap`}>
              <span className={TYPO_BODY_LABEL}>감지된 단락 수: </span>
              <span className="font-semibold text-emerald-700">
                {result.sections.length}개
                {confirmedCount > 0 && (
                  <span className="font-normal text-emerald-600">
                    {' '}(화면 감지 {confirmedCount}개)
                  </span>
                )}
              </span>
            </p>
          </div>
        </div>

        {/* 사용량 표시 */}
        {result.usage && (
          <div className="mt-3 pt-3 border-t border-emerald-200">
            <p className={`${TYPO_CARD_DESC} text-emerald-600`}>
              {usageScopeLabel[result.usage.scope] ?? '무료 베타'} 이용: 오늘 {result.usage.used}/{result.usage.limit}회 사용
              {result.usage.remaining > 0 && (
                <span className="text-emerald-500"> (잔여 {result.usage.remaining}회)</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 구조 분석 요약 패널 (오른쪽 하단)
// ─────────────────────────────────────────────

function StructureAnalysisPanel({ sections, keyword }: { sections: RenderedSection[]; keyword: string }) {
  const analysis = analyzeKeywordStructure(sections, keyword);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className={`${RESULT_CARD_HEADER_CLASS} border-gray-100 bg-gray-50/50`}>
        <KeywordResultCardTitle keyword={keyword} suffix="구조 분석" />
        <p className={`${TYPO_CARD_DESC} mt-0.5`}>
          검색 단락 구성을 바탕으로 키워드 유형과 공략 방향을 요약합니다.
        </p>
      </div>

      <div className="p-5 space-y-5">
        {/* 주요 해석 */}
        <div>
          <p className={`${TYPO_SECTION_LABEL} mb-2`}>주요 해석</p>
          <p className={TYPO_BODY}>
            {renderInterpretationWithTypeBadge(analysis.interpretation, analysis.keywordType)}
          </p>
        </div>

        {/* 우선 공략 */}
        <div>
          <p className={`${TYPO_SECTION_LABEL} mb-2`}>우선 공략</p>
          <div className="space-y-1.5">
            <p className={TYPO_BODY}>
              <span className="font-semibold text-slate-800">{analysis.priorityArea.label}</span>
            </p>
            <p className={TYPO_BODY}>
              {analysis.priorityArea.reason}
            </p>
          </div>
        </div>

        {/* 추천 공략 */}
        <div>
          <p className={`${TYPO_SECTION_LABEL} mb-2`}>추천 공략</p>
          <ul className="space-y-2">
            {analysis.strategy.map((s, i) => (
              <li key={i} className={`flex items-start gap-2.5 ${TYPO_BODY}`}>
                <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-bold mt-0.5">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 추천 도구 */}
        <div>
          <p className={`${TYPO_SECTION_LABEL} mb-2`}>추천 도구</p>
          <div className="flex flex-wrap gap-2">
            {analysis.tools.map((tool, i) => (
              <span
                key={i}
                className="inline-block px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 검색결과 유형 안내 카드 (오른쪽 열 하단)
// ─────────────────────────────────────────────

function KeywordTypeGuideCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4.5">
      <p className={`${TYPO_CARD_TITLE} mb-2.5`}>검색결과 유형 안내</p>
      <div className="space-y-2">
        {KEYWORD_TYPE_GUIDE.map(({ type, description }) => (
          <p key={type} className={TYPO_BODY}>
            <span className="font-semibold text-slate-700">{type}</span>
            <span className="text-slate-500">: </span>
            {description}
          </p>
        ))}
      </div>
    </div>
  );
}
