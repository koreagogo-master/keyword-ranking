'use client';

// 🌟 useEffect와 useRef 추가
import { useState, useMemo, useEffect, useRef } from "react";
// 🌟 URL 파라미터를 읽기 위해 추가
import { useSearchParams } from 'next/navigation';

import Sidebar from "@/components/Sidebar";
import GoogleTabs from "@/components/GoogleTabs";

import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from '@/app/contexts/AuthContext';
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";

import { usePoint } from '@/app/hooks/usePoint'; 

const formatNum = (num: number) => new Intl.NumberFormat().format(num || 0);

export default function GoogleAnalysisPage() {
  const { user } = useAuth();
  const { deductPoints } = usePoint(); 

  // 🌟 URL 쿼리 파라미터 읽기
  const searchParams = useSearchParams();
  const urlKeyword = searchParams.get('keyword');
  
  // 🌟 중복 실행 방지를 위한 Ref
  const isSearchExecuted = useRef(false);

  const [keyword, setKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [adsList, setAdsList] = useState<any[]>([]);
  const [suggestedList, setSuggestedList] = useState<string[]>([]);
  const [relatedList, setRelatedList] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [sortField, setSortField] = useState<'searchVolume' | 'cpcLow' | 'cpcHigh' | 'competitionIndex' | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false); 

  const handleSearch = async (targetKeyword?: string) => {
    const k = (typeof targetKeyword === 'string' ? targetKeyword : keyword).trim();
    if (!k) return;

    // 🌟 핵심 업그레이드: k(검색어) 변수를 던져서 구글 분석도 히스토리에 남깁니다!
    const isPaySuccess = await deductPoints(user?.id, 10, 1, k);
    if (!isPaySuccess) return; 

    setKeyword(k);
    setIsSearching(true);
    setHasSearched(false);
    setAdsList([]);
    setSuggestedList([]);
    setRelatedList([]);
    setSortField(null);
    setSortOrder(null);
    setCurrentPage(1);

    try {
      const res = await fetch('/api/google-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: k })
      });
      const data = await res.json();

      if (data.success && data.keywords) {
        setAdsList(data.keywords);
      } else {
        alert("데이터를 불러오지 못했습니다. 다시 시도해 주세요.");
      }

      const relatedRes = await fetch('/api/google-related', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: k })
      });
      const relatedData = await relatedRes.json();

      if (relatedData.success) {
        setSuggestedList(relatedData.suggested || []);
        setRelatedList(relatedData.related || []);
      }

    } catch (e) {
      console.error(e);
      alert("검색 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  // 🌟 자동 검색 센서 로직 시작
  useEffect(() => {
    // URL 파라미터가 존재하고, 아직 검색이 실행되지 않았을 때만 작동
    if (urlKeyword && !isSearchExecuted.current) {
      isSearchExecuted.current = true; // 중복 실행 방지 락 걸기
      
      setKeyword(urlKeyword);

      // 약간의 딜레이를 주어 상태 업데이트가 화면에 반영될 시간을 확보
      setTimeout(() => {
        handleSearch(urlKeyword);
      }, 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKeyword]);

  const handleSaveCurrentSetting = async () => {
    if (!keyword) {
      alert("키워드를 입력한 후 저장해주세요.");
      return;
    }
    if (!user) {
      alert('로그인 정보가 만료되었거나 확인할 수 없습니다. 다시 로그인해주세요.');
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user?.id,
      page_type: 'GOOGLE',
      nickname: '', 
      keyword: keyword
    });

    if (!error) alert("현재 설정이 안전하게 저장되었습니다.");
    else alert("저장 중 오류가 발생했습니다.");
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false);
    setKeyword(item.keyword);
    handleSearch(item.keyword); 
  };

  const mainKeywordData = useMemo(() => {
    if (adsList.length === 0) return null;
    const searchKey = keyword.replace(/\s+/g, '').toLowerCase();
    return adsList.find(it => it.keyword.replace(/\s+/g, '').toLowerCase() === searchKey) || adsList[0];
  }, [adsList, keyword]);

  const sortedList = useMemo(() => {
    if (adsList.length === 0 || !mainKeywordData) return [];

    let otherItems = adsList.filter(it => it.keyword !== mainKeywordData.keyword);

    otherItems.sort((a, b) => {
      const volA = a.searchVolume || 0;
      const volB = b.searchVolume || 0;

      if (volA !== volB) return volB - volA;

      const weightA = a.competition === '높음' ? 2 : (a.competition === '중간' ? 1 : 0);
      const weightB = b.competition === '높음' ? 2 : (b.competition === '중간' ? 1 : 0);
      return weightB - weightA;
    });

    const top100Items = otherItems.slice(0, 100);

    if (sortField && sortOrder) {
      top100Items.sort((a, b) => {
        const valA = a[sortField] || 0;
        const valB = b[sortField] || 0;
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
    }
    return top100Items;
  }, [adsList, sortField, sortOrder, mainKeywordData]);

  const paginatedList = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedList, currentPage]);

  const totalPages = Math.ceil(sortedList.length / ITEMS_PER_PAGE);

  const handleSort = (field: 'searchVolume' | 'cpcLow' | 'cpcHigh' | 'competitionIndex') => {
    if (sortField === field) {
      if (sortOrder === 'desc') setSortOrder('asc');
      else { setSortField(null); setSortOrder(null); }
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: 'searchVolume' | 'cpcLow' | 'cpcHigh' | 'competitionIndex') => {
    if (sortField !== field) return (
      <span className="flex flex-col ml-1.5 opacity-20 text-[10px] leading-tight group-hover:opacity-40 transition-opacity">
        <span className="-mb-0.5">▲</span><span className="-mt-0.5">▼</span>
      </span>
    );
    return sortOrder === 'desc'
      ? <span className="text-[#5244e8] ml-1.5 text-xs font-extrabold">▼</span>
      : <span className="text-[#5244e8] ml-1.5 text-xs font-extrabold">▲</span>;
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        <Sidebar />

        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">

            <GoogleTabs />

            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold !text-black mb-2">구글 키워드 분석</h1>
                <p className="text-sm text-slate-500 mt-1">* 구글 Ads API를 활용하여 글로벌 및 국내 검색량, 경쟁도, 예상 CPC(클릭당 비용)를 분석합니다.</p>
                <p className="text-sm text-slate-500 mt-1">* 구글 기준 조회수가 적은 키워드는 구글 Ads에서 검색되지 않을 수 있습니다.</p>
              </div>

              <div className="flex items-center gap-2 mt-1 shrink-0">
                <button 
                  onClick={handleSaveCurrentSetting}
                  disabled={!keyword || !user}
                  className={`px-4 py-2 text-sm font-bold text-white rounded-md shadow-sm flex items-center gap-1.5 transition-colors
                    ${(!keyword || !user) ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-800'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  현재 설정 저장
                </button>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="px-4 py-2 text-sm font-bold text-white bg-slate-700 rounded-sm hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                  저장된 목록 보기
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm flex items-center shadow-md focus-within:border-[#5244e8]/50 overflow-hidden max-w-2xl mb-8">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 py-3 px-4 text-base outline-none !text-black bg-white"
                placeholder="분석할 구글 키워드 입력 (예: 다이어트)"
              />
              <button
                onClick={() => handleSearch()}
                disabled={isSearching}
                className="px-10 py-3.5 font-bold bg-[#5244e8] hover:bg-[#4336c9] text-white transition-colors text-base whitespace-nowrap border-l border-gray-200 disabled:opacity-70"
              >
                {isSearching ? "조회 중..." : "조회"}
              </button>
            </div>

            {hasSearched && (
              <div className="space-y-8 animate-in fade-in duration-500">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">

                  <div className="md:col-span-2 bg-white p-5 border border-gray-200 shadow-sm rounded-sm">
                    <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                      "{keyword}" 자동완성 키워드
                    </h3>

                    <div className="flex flex-wrap gap-2 max-h-[76px] overflow-hidden">
                      {suggestedList.length > 0 ? (
                        suggestedList.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSearch(item)}
                            className="!text-black px-3 py-1.5 border border-gray-300 bg-gray-50 font-medium text-[13px] rounded-sm hover:bg-[#5244e8]/10 hover:border-[#5244e8] hover:text-[#5244e8] transition-colors cursor-pointer"
                          >
                            {item}
                          </button>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">데이터가 없습니다.</span>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-1 bg-white p-5 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center">
                    <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                      관련 검색어 실시간 확인
                    </h3>
                    <p className="text-[13px] text-slate-500 mb-4 leading-relaxed">
                      구글 검색 결과 하단에서 <strong className="text-[#5244e8]">"{keyword}"</strong> 관련 검색어를 직접 확인하세요. <br />(PC검색 결과 입니다. 모바일은 다를 수 있습니다.)
                    </p>

                    <button
                      onClick={() => {
                        const popupWidth = 400;
                        const popupHeight = 800;
                        const left = (window.screen.width / 2) - (popupWidth / 2);
                        const top = (window.screen.height / 2) - (popupHeight / 2);

                        window.open(
                          `https://www.google.com/search?q=${keyword}`,
                          '_blank',
                          `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`
                        );
                      }}
                      className="w-full text-center px-4 py-2.5 bg-[#5244e8]/5 border border-[#5244e8]/20 !text-[#5244e8] font-bold text-[13px] rounded-sm hover:bg-[#5244e8]/10 transition-colors cursor-pointer"
                    >
                      구글 검색창 열기 ↗
                    </button>
                  </div>

                </div>

                {adsList.length > 0 && mainKeywordData ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center">
                        <span className="text-sm font-bold text-slate-500 mb-2">구글 월간 검색량</span>
                        <div className="flex items-end gap-1">
                          <span className="text-3xl font-bold text-[#5244e8]">{formatNum(mainKeywordData.searchVolume)}</span>
                          <span className="text-sm font-medium text-slate-400 mb-1">회</span>
                        </div>
                      </div>

                      <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center">
                        <span className="text-sm font-bold text-slate-500 mb-2">광고 경쟁도</span>
                        <div className="flex items-center">
                          <span className={`text-[13px] font-bold px-3 py-1.5 rounded-sm ${mainKeywordData.competition === '높음' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                            mainKeywordData.competition === '중간' ? 'bg-green-50 text-green-600 border border-green-100' :
                              'bg-slate-50 text-slate-600 border border-slate-200'
                            }`}>
                            {mainKeywordData.competition}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center">
                        <span className="text-sm font-bold text-slate-500 mb-2">상단 노출 예상 입찰가 (최저 ~ 최고)</span>
                        <div className="flex items-end gap-2">
                          <span className="text-xl font-extrabold text-orange-600">{formatNum(mainKeywordData.cpcLow)}원</span>
                          <span className="text-sm font-medium text-slate-400 mb-1">~</span>
                          <span className="text-xl font-extrabold text-orange-600">{formatNum(mainKeywordData.cpcHigh)}원</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-200 bg-slate-50">
                        <h3 className="font-bold text-slate-700 text-sm">구글 연관 키워드 리스트 ({formatNum(sortedList.length)}개)</h3>
                      </div>

                      <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-white border-b border-gray-200">
                          <tr className="text-[13px]">
                            <th className="px-5 py-4 font-bold text-slate-500 text-center w-16">순위</th>
                            <th className="px-5 py-4 font-bold text-slate-500 w-auto">연관 키워드</th>

                            <th className="px-5 py-4 text-center font-bold text-slate-500 w-24">경쟁도</th>
                            <th className="px-5 py-4 text-center cursor-pointer hover:bg-gray-50 group font-bold text-slate-500 w-32 align-middle" onClick={() => handleSort('competitionIndex')}>
                              <div className="flex items-center justify-center" title="0~100점 (높을수록 광고 입찰 치열)">
                                경쟁도 지수{renderSortIcon('competitionIndex')}
                              </div>
                            </th>

                            <th className="px-5 py-4 text-right cursor-pointer hover:bg-orange-50 group font-bold text-orange-600 w-36 align-middle" onClick={() => handleSort('cpcLow')}>
                              <div className="flex items-center justify-end" title="페이지 상단 노출 최소 입찰가">
                                최저 입찰가{renderSortIcon('cpcLow')}
                              </div>
                            </th>

                            <th className="px-5 py-4 text-right cursor-pointer hover:bg-orange-50 group font-bold text-orange-600 w-36 align-middle" onClick={() => handleSort('cpcHigh')}>
                              <div className="flex items-center justify-end" title="페이지 상단 노출 최고 입찰가">
                                최고 입찰가{renderSortIcon('cpcHigh')}
                              </div>
                            </th>

                            <th className="px-5 py-4 text-right cursor-pointer hover:bg-[#5244e8]/10 group text-[#5244e8] font-bold w-40 align-middle" onClick={() => handleSort('searchVolume')}>
                              <div className="flex items-center justify-end">월간 검색량{renderSortIcon('searchVolume')}</div>
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100 bg-white">
                          {paginatedList.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="px-5 py-3 text-center text-slate-400 font-medium text-[13px]">
                                {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                              </td>
                              <td className="px-5 py-3">
                                <button onClick={() => handleSearch(item.keyword)} className="!text-black font-bold text-[14px] hover:text-[#5244e8] hover:underline text-left truncate w-full cursor-pointer">
                                  {item.keyword}
                                </button>
                              </td>
                              <td className="px-5 py-3 text-center">
                                <span className={`text-[11px] font-bold px-2 py-1.5 rounded-sm ${item.competition === '높음' ? 'bg-orange-50 text-orange-600' :
                                  item.competition === '중간' ? 'bg-green-50 text-green-600' :
                                    'text-slate-500'
                                  }`}>
                                  {item.competition}
                                </span>
                              </td>

                              <td className="px-5 py-3 text-center font-bold text-slate-600 text-[13px]">
                                {item.competitionIndex !== undefined ? item.competitionIndex : '-'}
                              </td>

                              <td className="px-5 py-3 text-right font-medium text-slate-600 text-[13px]">
                                {item.cpcLow > 0 ? `${formatNum(item.cpcLow)}원` : '-'}
                              </td>
                              <td className="px-5 py-3 text-right font-bold text-orange-600 text-[13px]">
                                {item.cpcHigh > 0 ? `${formatNum(item.cpcHigh)}원` : '-'}
                              </td>
                              <td className="px-5 py-3 text-right font-extrabold text-[#5244e8] text-[14px] bg-[#5244e8]/5 border-b border-white">
                                {formatNum(item.searchVolume)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex justify-center items-center gap-2 mt-8 pb-10">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="px-4 py-2 bg-white border border-gray-300 rounded-sm text-sm font-bold !text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                          &lt; 이전
                        </button>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-9 h-9 flex items-center justify-center rounded-sm text-sm font-bold transition-all shadow-sm ${currentPage === pageNum
                                ? 'bg-[#5244e8] !text-white border border-[#5244e8]'
                                : 'bg-white !text-slate-700 border border-gray-300 hover:bg-slate-50'
                                }`}
                            >
                              {pageNum}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="px-4 py-2 bg-white border border-gray-300 rounded-sm text-sm font-bold !text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                          다음 &gt;
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-white p-12 border border-gray-200 shadow-sm rounded-sm text-center">
                    <span className="text-4xl mb-4 block">🚫</span>
                    <h3 className="font-bold text-slate-700 text-lg mb-2">광고 입찰 데이터가 제공되지 않는 키워드입니다.</h3>
                    <p className="text-[14px] text-slate-500 max-w-lg mx-auto leading-relaxed">
                      구글의 정책(의료, 금융 등 민감성 키워드)에 의해 조회가 제한되었거나, 월간 검색량이 너무 적어 구글 Ads에서 수치 데이터를 제공하지 않습니다.<br />
                      <strong>상단의 '자동완성' 단어를 통해 실제 검색 흐름을 파악해 보세요.</strong>
                    </p>
                  </div>
                )}

              </div>
            )}

          </div>
        </main>
      </div>

      <SavedSearchesDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        pageType="GOOGLE"
        onSelect={handleApplySavedSetting}
      />
    </>
  );
}