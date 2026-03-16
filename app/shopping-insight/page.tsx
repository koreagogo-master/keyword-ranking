'use client';

import { useState } from 'react';
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/app/contexts/AuthContext";
import { createClient } from "@/app/utils/supabase/client";
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";

const formatNum = (num: number) => new Intl.NumberFormat().format(num || 0);

const stripHtml = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

const highlightKeyword = (text: string, keyword: string) => {
  if (!keyword) return text;
  const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
  return parts.map((part, index) =>
    part.toLowerCase() === keyword.toLowerCase() ?
      <span key={index} className="bg-yellow-200 text-black px-0.5 rounded-sm">{part}</span> : part
  );
};

export default function ShoppingInsightPage() {
  const { user } = useAuth();

  // 서랍 상태 추가
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [summaryData, setSummaryData] = useState<any>(null);
  const [advancedStats, setAdvancedStats] = useState<any>(null);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [autoCompleteWords, setAutoCompleteWords] = useState<string[]>([]);

  // 검색 함수 (서랍에서 클릭한 키워드도 받을 수 있게 수정됨)
  const handleSearch = async (overrideKeyword?: any) => {
    const kwToSearch = typeof overrideKeyword === 'string' ? overrideKeyword : keyword;
    if (!kwToSearch.trim()) return;

    setKeyword(kwToSearch);
    setIsSearching(true);
    setHasSearched(false);
    setIsDetailsLoading(false);
    setSummaryData(null);
    setAdvancedStats(null);
    setTopItems([]);
    setAutoCompleteWords([]);

    try {
      const [shoppingRes, adRes, autoCompleteRes] = await Promise.all([
        fetch(`/api/naver-shopping?keyword=${encodeURIComponent(kwToSearch)}`),
        fetch(`/api/naver-ad?keyword=${encodeURIComponent(kwToSearch)}`),
        fetch(`/api/naver-autocomplete?keyword=${encodeURIComponent(kwToSearch)}`) // 🌟 추가됨
      ]);

      const shoppingData = await shoppingRes.json();
      const adData = await adRes.json();
      const autoCompleteData = await autoCompleteRes.json(); // 🌟 추가됨

      if (autoCompleteData.success) {
        setAutoCompleteWords(autoCompleteData.keywords || []);
      }

      if (!shoppingData.success) {
        alert("쇼핑 데이터를 불러오지 못했습니다: " + shoppingData.error);
        setIsSearching(false);
        return;
      }

      const realSearchVolume = adData.success && adData.searchVolume > 0 ? adData.searchVolume : 0;
      const productCount = shoppingData.total;
      const competitionRatio = realSearchVolume > 0 ? (productCount / realSearchVolume).toFixed(2) : 0;

      const firstItem = shoppingData.items[0];
      const categoryStr = firstItem ? `${firstItem.category1} > ${firstItem.category2}${firstItem.category3 ? ` > ${firstItem.category3}` : ''}` : '카테고리 정보 없음';

      setSummaryData({
        category: categoryStr,
        searchVolume: realSearchVolume,
        productCount: productCount,
        competition: Number(competitionRatio)
      });

      const prices = shoppingData.items.map((i: any) => i.price).filter((p: number) => p > 0);
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const maxPrice = prices.length ? Math.max(...prices) : 0;
      const avgPrice = prices.length ? Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length) : 0;

      const catalogCount = shoppingData.items.filter((i: any) => i.mallName === '네이버').length;
      const catalogRatio = shoppingData.items.length > 0 ? Math.round((catalogCount / shoppingData.items.length) * 100) : 0;

      const wordMap: Record<string, number> = {};
      shoppingData.items.forEach((i: any) => {
        const cleanWords = stripHtml(i.title).replace(/[^가-힣a-zA-Z0-9\s]/g, '').split(/\s+/);
        cleanWords.forEach(w => {
          if (w.length > 1 && w !== keyword.replace(/\s+/g, '')) {
            wordMap[w] = (wordMap[w] || 0) + 1;
          }
        });
      });
      const topWords = Object.entries(wordMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);

      const categoryMap: Record<string, number> = {};
      shoppingData.items.forEach((i: any) => {
        const cats = [i.category1, i.category2, i.category3].filter(Boolean).join(' > ');
        if (cats) {
          categoryMap[cats] = (categoryMap[cats] || 0) + 1;
        }
      });
      const totalItems = shoppingData.items.length;
      const categoryDistribution = Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
          name,
          count,
          ratio: Math.round((count / totalItems) * 100)
        }))
        .slice(0, 3);

      setAdvancedStats({ minPrice, maxPrice, avgPrice, catalogRatio, topWords, categoryDistribution });

      setTopItems(shoppingData.items.map((item: any) => ({ ...item, isDetailLoaded: false })));
      setHasSearched(true);
      setIsSearching(false);

      fetchDetailedStats(kwToSearch, shoppingData.items);

    } catch (e) {
      console.error(e);
      alert("검색 중 오류가 발생했습니다.");
      setIsSearching(false);
    }
  };

  const fetchDetailedStats = async (searchKeyword: string, currentItems: any[]) => {
    setIsDetailsLoading(true);
    try {
      const res = await fetch(`/api/naver-shopping-details?keyword=${encodeURIComponent(searchKeyword)}`);
      const data = await res.json();

      if (data.success && data.details) {
        setTopItems(prevItems => prevItems.map(item => {
          const cleanTitle = stripHtml(item.title).replace(/[^가-힣a-zA-Z0-9]/g, '');
          const detail = data.details[cleanTitle];

          if (detail) {
            return {
              ...item,
              reviews: detail.reviews,
              purchases: detail.purchases,
              regDate: detail.regDate,
              rating: detail.rating,
              isDetailLoaded: true
            };
          }
          return { ...item, isDetailLoaded: true };
        }));
      }
    } catch (e) {
      console.error("상세 데이터 크롤링 실패", e);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  // 심플하게 변경된 저장 함수
  const handleSaveCurrentSetting = async () => {
    if (!keyword) {
      alert("키워드를 입력한 후 저장해주세요.");
      return;
    }
    if (!user) {
      alert("로그인이 필요한 기능입니다.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user?.id,
      page_type: 'SHOPPING',
      keyword: keyword
    });

    if (!error) alert("현재 설정이 안전하게 저장되었습니다.");
    else alert("저장 중 오류가 발생했습니다.");
  };

  // 서랍에서 클릭 시 실행될 함수
  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false);
    handleSearch(item.keyword);
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <div className="flex min-h-screen bg-[#f8f9fa] !text-black antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        <Sidebar />

        <main className="flex-1 ml-64 p-10 relative">
          <div className="max-w-7xl mx-auto">

            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold !text-black mb-2">쇼핑 인사이트</h1>
                <p className="text-sm text-slate-500 mt-1">* 네이버 쇼핑 데이터 기반으로 상품 키워드의 경쟁력과 트렌드를 분석합니다.</p>
              </div>
              <div className="flex items-center gap-2 mt-1 shrink-0">
                <button
                  onClick={handleSaveCurrentSetting}
                  disabled={!hasSearched || !user}
                  className={`px-4 py-2 text-sm font-bold text-white rounded-md shadow-sm flex items-center gap-1.5 transition-colors
                    ${(!hasSearched || !user) ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-800'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  현재 설정 저장
                </button>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="px-4 py-2 text-sm font-bold text-white bg-slate-700 rounded-md hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                  저장된 목록 보기
                </button>
              </div>
            </div>

            <div className="max-w-2xl mb-8">
              <div className="bg-white border border-gray-200 rounded-sm flex items-center shadow-md focus-within:border-[#5244e8]/50 overflow-hidden">
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 py-3 px-4 text-base outline-none !text-black bg-white"
                  placeholder="분석할 쇼핑 키워드 입력 (예: 캠핑의자)"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-10 py-3.5 font-bold bg-[#5244e8] hover:bg-[#4336c9] text-white transition-colors text-base whitespace-nowrap border-l border-gray-200 disabled:opacity-70"
                >
                  {isSearching ? "조회 중..." : "조회"}
                </button>
              </div>

              {hasSearched && autoCompleteWords.length > 0 && (
                <div className="flex items-center gap-2 mt-2.5 px-1 animate-in fade-in duration-300">
                  <span className="text-[13px] font-bold text-slate-500 shrink-0 whitespace-nowrap">자동 완성 키워드 :</span>
                  {/* w-full 제한과 스크롤 속성을 모두 제거하여 오른쪽으로 무한정 뻗어 나가게 합니다 */}
                  <div className="flex flex-nowrap gap-1.5">
                    {autoCompleteWords.map((word: string, idx: number) => (
                      <button 
                        key={idx} 
                        onClick={() => handleSearch(word)}
                        title="이 키워드로 바로 검색"
                        className="shrink-0 px-2.5 py-1 !bg-blue-50 hover:!bg-blue-100 !text-blue-600 text-[12px] font-bold rounded-sm border border-blue-200 transition-colors shadow-sm"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {hasSearched && advancedStats?.topWords?.length > 0 && (
                <div className="flex items-center gap-2 mt-2.5 px-1 animate-in fade-in duration-300">
                  <span className="text-[13px] font-bold text-slate-500">상위노출 핵심 태그 :</span>
                  <div className="flex flex-wrap gap-1.5">
                    {advancedStats.topWords.map((word: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-yellow-100 text-yellow-800 text-[12px] font-bold rounded-sm border border-yellow-200"
                      >
                        #{word}
                      </span>
                    ))}
                  </div>
                </div>
              )}


            </div>

            {hasSearched && summaryData && (
              <div className="space-y-6 animate-in fade-in duration-500">

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
                    <span className="text-sm font-bold text-slate-500 mb-2">대표 카테고리</span>
                    <span className="text-[13px] font-extrabold text-slate-800 break-keep leading-snug">{summaryData.category}</span>
                  </div>

                  <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#5244e8]"></div>
                    <span className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-1">한 달 검색량</span>
                    <div className="flex items-end gap-1">
                      <span className="text-2xl font-bold text-[#5244e8]">{formatNum(summaryData.searchVolume)}</span>
                      <span className="text-sm font-medium text-slate-400 mb-1">회</span>
                    </div>
                  </div>

                  <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-600"></div>
                    <span className="text-sm font-bold text-slate-500 mb-2">총 등록 상품수</span>
                    <div className="flex items-end gap-1">
                      <span className="text-2xl font-bold text-slate-700">{formatNum(summaryData.productCount)}</span>
                      <span className="text-sm font-medium text-slate-400 mb-1">개</span>
                    </div>
                  </div>

                  <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 rounded-l-sm"></div>
                    <span className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-1">
                      경쟁 강도
                      <div className="group relative flex items-center cursor-help">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-48 p-2 bg-slate-800 text-white text-[11px] rounded shadow-lg text-center z-50 whitespace-nowrap">
                          (등록 상품수 ÷ 한 달 검색량)<br />수치가 낮을수록 경쟁이 적습니다.
                        </div>
                      </div>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-black ${summaryData.competition > 2 ? 'text-orange-600' : 'text-green-600'}`}>
                        {summaryData.competition}
                      </span>
                    </div>
                  </div>
                </div>

                {advancedStats && (
                  <div className="bg-white border border-gray-200 shadow-sm rounded-sm p-6 mt-6">
                    <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#5244e8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      TOP 40 심층 분석 (1페이지 기준)
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-gray-100">

                      <div className="pt-4 md:pt-0 md:px-4 first:pl-0">
                        <span className="text-xs font-bold text-slate-500 mb-3 block">가격대 형성</span>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[13px] text-slate-500">평균가</span>
                            <span className="font-bold text-slate-800">{formatNum(advancedStats.avgPrice)}원</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[13px] text-slate-500">최저가</span>
                            <span className="font-bold text-blue-600">{formatNum(advancedStats.minPrice)}원</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[13px] text-slate-500">최고가</span>
                            <span className="font-bold text-red-500">{formatNum(advancedStats.maxPrice)}원</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 md:pt-0 md:px-4">
                        <span className="text-xs font-bold text-slate-500 mb-3 block">가격비교(카탈로그) 비중</span>
                        <div className="flex items-end gap-2 mb-2">
                          <span className="text-3xl font-black text-slate-700">{advancedStats.catalogRatio}</span>
                          <span className="text-sm font-bold text-slate-400 mb-1">%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div className="bg-[#5244e8] h-1.5 rounded-full" style={{ width: `${advancedStats.catalogRatio}%` }}></div>
                        </div>
                        <p className={`text-[11px] mt-2 leading-tight font-bold ${advancedStats.catalogRatio >= 50 ? 'text-red-500' : 'text-blue-500'}`}>
                          {advancedStats.catalogRatio >= 50
                            ? "카탈로그 비중이 높아 초보 셀러 진입이 까다롭습니다."
                            : "일반 스마트스토어 비중이 높아 진입해 볼 만합니다."}
                        </p>
                      </div>

                      <div className="pt-4 md:pt-0 md:px-4">
                        <span className="text-xs font-bold text-slate-500 mb-3 block">TOP 40 카테고리 점유율</span>
                        <div className="space-y-3">
                          {advancedStats.categoryDistribution.map((cat: any, idx: number) => (
                            <div key={idx}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] font-bold text-slate-700 truncate pr-2" title={cat.name}>{cat.name}</span>
                                <span className="text-[11px] font-black text-[#5244e8] shrink-0">{cat.ratio}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-sm h-1.5">
                                <div className="bg-[#5244e8]/70 h-1.5 rounded-sm" style={{ width: `${cat.ratio}%` }}></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden mt-8 relative">
                  <div className="px-5 py-4 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                      네이버 쇼핑 상위 노출 <span className="text-[#5244e8]">TOP 40</span> 분석
                      {isDetailsLoading && (
                        <span className="text-xs font-normal text-orange-600 bg-orange-50 px-2 py-0.5 rounded-sm animate-pulse border border-orange-100 flex items-center gap-1">
                          <svg className="animate-spin h-3 w-3 text-orange-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          실제 리뷰/찜 데이터 분석 중...
                        </span>
                      )}
                    </h3>
                  </div>

                  <table className="w-full text-left border-collapse table-fixed">
                    <thead className="bg-white border-b border-gray-200">
                      <tr className="text-[13px]">
                        <th className="px-4 py-4 font-bold text-slate-500 text-center w-14">순위</th>
                        <th className="px-4 py-4 font-bold text-slate-500 text-center w-24">썸네일</th>
                        <th className="px-4 py-4 font-bold text-slate-500 w-auto">상품 정보 (상품명 / 판매처)</th>
                        <th className="px-4 py-4 font-bold text-slate-500 text-right w-28">판매가</th>
                        <th className="px-4 py-4 font-bold text-[#5244e8] text-right w-24 bg-[#5244e8]/5">리뷰 수</th>
                        <th className="px-4 py-4 font-bold text-slate-500 text-center w-16">평점</th>
                        <th className="px-4 py-4 font-bold text-slate-600 text-right w-20 bg-slate-50">찜 수</th>
                        <th className="px-4 py-4 font-bold text-slate-500 text-center w-20">등록일</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {topItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-center text-slate-400 font-bold text-[14px]">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 flex justify-center">
                            <img src={item.image} alt="thumbnail" className="w-16 h-16 object-cover rounded-sm border border-gray-200 shadow-sm bg-white" loading="lazy" />
                          </td>
                          <td className="px-4 py-3 pr-6">
                            <a href={item.link} target="_blank" rel="noreferrer" className="font-bold !text-black hover:text-[#5244e8] text-[14px] line-clamp-2 mb-2 leading-snug cursor-pointer transition-colors">
                              {highlightKeyword(stripHtml(item.title), keyword)}
                            </a>
                            <div className={`text-[12px] font-bold inline-block px-2 py-0.5 rounded-sm ${item.mallName === '네이버' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                              {item.mallName === '네이버' ? '네이버 가격비교' : item.mallName}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-700 text-[14px]">
                            {item.price ? `${formatNum(item.price)}원` : '-'}
                          </td>

                          <td className="px-4 py-3 text-right font-extrabold text-[#5244e8] text-[14px] bg-[#5244e8]/5 border-b border-white">
                            {!item.isDetailLoaded ? <span className="text-slate-300 font-normal text-xs animate-pulse">수집 중</span> : (item.reviews ? formatNum(item.reviews) : '-')}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-orange-500 text-[13px]">
                            {!item.isDetailLoaded ? <span className="text-slate-300 font-normal text-xs animate-pulse">...</span> : (item.rating ? item.rating : '-')}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-600 text-[13px] bg-slate-50 border-b border-white">
                            {!item.isDetailLoaded ? <span className="text-slate-300 font-normal text-xs animate-pulse">수집 중</span> : (item.purchases ? formatNum(item.purchases) : '-')}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500 text-[13px] tracking-tighter">
                            {!item.isDetailLoaded ? <span className="text-slate-300 font-normal text-xs animate-pulse">...</span> : (item.regDate || '-')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

          </div>
        </main>
      </div>

      {/* 서랍 연동 완료 부분 */}
      <SavedSearchesDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        pageType="SHOPPING"
        onSelect={handleApplySavedSetting}
      />
    </>
  );
}