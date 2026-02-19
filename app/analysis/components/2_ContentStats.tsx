/**
 * 2_ContentStats.tsx
 * 역할: 콘텐츠 통계 + 실시간 탭별 바로가기 (전문가 추천: 헤더 배경 디자인 적용)
 */

import React from 'react';

// 1. 숫자 통계용 셀
function StatCell({ title, value, percent, highlight = false, showPercent = true, isLimit = false }: any) {
  const v = typeof value === "number" ? value : 0;
  return (
    <div className="border border-gray-100 p-5 bg-white hover:border-blue-100 transition-colors">
      <div className="flex justify-between items-center mb-2">
        <div className="text-[15px] font-bold text-gray-800">{title}</div>
        {showPercent && <div className="text-[12px] font-bold text-gray-400 ml-2">{percent}%</div>}
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <div className={highlight ? "text-2xl font-bold !text-blue-700" : "text-2xl font-bold !text-gray-900"}>
          {v.toLocaleString()}
          {isLimit && <span className="text-gray-300 font-normal ml-1 text-xl">+</span>}
        </div>
      </div>
    </div>
  );
}

// 2. 심플형 바로가기 박스
function SearchLinkBox({ title, keyword, type }: any) {
  const openMobileWindow = () => {
    let targetUrl = "";
    const encodedKw = encodeURIComponent(keyword || "");

    switch (type) {
      case 'blog':
        targetUrl = `https://m.search.naver.com/search.naver?ssc=tab.m_blog.all&sm=mtb_jum&query=${encodedKw}`;
        break;
      case 'cafe':
        targetUrl = `https://m.search.naver.com/search.naver?ssc=tab.m_cafe.all&sm=mtb_jum&query=${encodedKw}`;
        break;
      case 'kin':
        targetUrl = `https://m.search.naver.com/search.naver?ssc=tab.m_kin.all&where=m_kin&sm=mtb_jum&query=${encodedKw}`;
        break;
      case 'news':
        targetUrl = `https://m.search.naver.com/search.naver?ssc=tab.m_news.all&where=m_news&sm=mtb_jum&query=${encodedKw}`;
        break;
      default:
        targetUrl = `https://m.search.naver.com/search.naver?query=${encodedKw}`;
    }

    const width = 450;
    const height = 900;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      targetUrl, 
      `mobile_popup_${type}`, 
      `width=${width},height=${height},left=${left},top=${top},menubar=no,status=no,toolbar=no,scrollbars=yes`
    );
  };

  return (
    <div 
      onClick={openMobileWindow}
      className="bg-white border border-gray-200 h-[80px] flex items-center justify-between px-6 hover:bg-blue-50 hover:border-blue-200 hover:shadow-sm transition-all group cursor-pointer"
    >
      <div className="flex flex-col">
        <h4 className="font-bold text-gray-800 text-[15px] group-hover:text-blue-700">{title}</h4>
        <span className="text-[11px] text-gray-400 mt-1 group-hover:text-blue-400">(실시간 결과)</span>
      </div>
      
      <div className="text-gray-300 group-hover:text-blue-500 bg-gray-50 p-2 rounded-full group-hover:bg-white transition-all">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </div>
    </div>
  );
}

export default function ContentStats({ stats }: { stats: any }) {
  if (!stats) return null;

  return (
    <div className="space-y-8"> {/* 간격 조금 넓힘 */}
      <h2 className="text-xl font-bold text-gray-900 mb-4">콘텐츠 분석</h2>

      {/* 1. 최근 30일 신규 발행 콘텐츠 */}
      <div className="bg-white border border-gray-200 rounded-none shadow-sm overflow-hidden">
        {/* ✅ [추가됨] 헤더 영역 (회색 배경으로 구분감 부여) */}
        <div className="bg-gray-50 px-8 py-4 border-b border-gray-200 flex items-center gap-3">
          <h3 className="text-[15px] font-bold text-gray-800">최근 30일 신규 발행 콘텐츠</h3>
          <p className="text-[11px] text-gray-500 font-medium">최근 30일 기준 신규 발행량 ( "+" 표시는 집계 한도 초과를 의미)</p>
        </div>
        
        {/* 콘텐츠 영역 */}
        <div className="p-8">
          <div className="grid grid-cols-4 gap-4">
            <StatCell title={stats.content30.blogLimit ? "블로그(추정)" : "블로그(리얼)"} value={stats.content30.blog} isLimit={stats.content30.blogLimit} showPercent={false} />
            <StatCell title={stats.content30.cafeLimit ? "카페(추정)" : "카페(리얼)"} value={stats.content30.cafe} isLimit={stats.content30.cafeLimit} showPercent={false} />
            <StatCell title="지식인(리얼)" value={stats.content30.kin} showPercent={false} />
            <StatCell title="뉴스(리얼)" value={stats.content30.news} showPercent={false} />
          </div>
        </div>
      </div>

      {/* 2. 전체(누적) & 플랫폼별 구성 */}
      <div className="bg-white border border-gray-200 rounded-none shadow-sm overflow-hidden">
        {/* ✅ [추가됨] 헤더 영역 */}
        <div className="bg-gray-50 px-8 py-4 border-b border-gray-200 flex items-center">
          <h3 className="text-[15px] font-bold text-gray-800">전체(누적) & 플랫폼별 구성</h3>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="p-8">
          <div className="grid grid-cols-5 gap-4">
            <StatCell title="전체(누적)" value={stats.content.total} highlight showPercent={false} />
            <StatCell title="블로그" value={stats.content.blog} percent={stats.content.shares.blog} />
            <StatCell title="카페" value={stats.content.cafe} percent={stats.content.shares.cafe} />
            <StatCell title="지식인" value={stats.content.kin} percent={stats.content.shares.kin} />
            <StatCell title="뉴스" value={stats.content.news} percent={stats.content.shares.news} />
          </div>
        </div>
      </div>

      {/* 3. 실시간 모바일 검색 바로가기 */}
      <div className="bg-white border border-gray-200 rounded-none shadow-sm overflow-hidden">
        {/* ✅ [추가됨] 헤더 영역 */}
        <div className="bg-gray-50 px-8 py-4 border-b border-gray-200 flex items-center">
          <h3 className="text-[15px] font-bold text-gray-800">실시간 모바일 검색 결과 확인</h3>
        </div>
        
        {/* 콘텐츠 영역 */}
        <div className="p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SearchLinkBox title="블로그 탭" keyword={stats.keyword} type="blog" />
            <SearchLinkBox title="카페 탭" keyword={stats.keyword} type="cafe" />
            <SearchLinkBox title="지식인 탭" keyword={stats.keyword} type="kin" />
            <SearchLinkBox title="뉴스 탭" keyword={stats.keyword} type="news" />
          </div>
        </div>
      </div>
    </div>
  );
}