'use client';

import { useState, useMemo } from "react";
import Sidebar from "@/components/Sidebar";

const formatNum = (num: number) => new Intl.NumberFormat().format(num || 0);

export default function GoogleAnalysisPage() {
  const [keyword, setKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  // 🌟 [추가] 검색을 한 번이라도 실행했는지 여부를 추적합니다 (안내 메시지를 띄우기 위함)
  const [hasSearched, setHasSearched] = useState(false); 
  
  const [adsList, setAdsList] = useState<any[]>([]);
  const [suggestedList, setSuggestedList] = useState<string[]>([]); 
  const [relatedList, setRelatedList] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10; 

  const [sortField, setSortField] = useState<'searchVolume' | 'cpcLow' | 'cpcHigh' | 'competitionIndex' | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>(null);

  const handleSearch = async (targetKeyword?: string) => {
    const k = (typeof targetKeyword === 'string' ? targetKeyword : keyword).trim();
    if (!k) return;

    setKeyword(k);
    setIsSearching(true);
    setHasSearched(false); // 검색 시작 시 초기화
    setAdsList([]);
    setSuggestedList([]); 
    setRelatedList([]);   
    setSortField(null);
    setSortOrder(null);
    setCurrentPage(1); 

    try {
      // 1. 구글 Ads API 요청
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

      // 2. 구글 연관검색어(대안A, 대안B) API 요청
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
      setHasSearched(true); // 검색 완료 상태로 변경
    }
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
      ? <span className="text-blue-600 ml-1.5 text-xs font-extrabold">▼</span> 
      : <span className="text-blue-600 ml-1.5 text-xs font-extrabold">▲</span>;
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] !text-black">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-10">
        <div className="max-w-7xl mx-auto">
          
          <div className="mb-8">
            <h1 className="text-2xl font-bold !text-black">구글 키워드 분석</h1>
            <p className="text-sm text-slate-500 mt-1">* 구글 Ads API를 활용하여 글로벌 및 국내 검색량, 경쟁도, 예상 CPC(클릭당 비용)를 분석합니다.</p>
            <p className="text-sm text-slate-500 mt-1">* 구글 기준 조회수가 적은 키워드는 구글 Ads에서 검색되지 않을 수 있습니다.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm flex items-center shadow-md focus-within:border-blue-400 overflow-hidden max-w-2xl mb-8">
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
              className="px-10 py-3.5 font-bold bg-[#1a73e8] hover:bg-[#1557b0] text-white transition-colors text-base whitespace-nowrap border-l border-gray-200 disabled:opacity-70"
            >
              {isSearching ? "조회 중..." : "조회"}
            </button>
          </div>

          {/* 🌟 수정됨: 검색을 완료했다면 결과 영역을 보여줍니다 (Ads 데이터가 0건이어도 보여줌) */}
          {hasSearched && (
            <div className="space-y-8 animate-in fade-in duration-500">
              
              {/* 🌟 [교체할 영역] 대안 A & 대안 B 영역 시작 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                
                {/* 대안 A: 구글 자동완성 */}
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
                          style={{ backgroundColor: '#ebebeb', borderColor: '#858585' }}
                          // 🌟 className 맨 앞에 !text-black을 넣어 글자색을 강제로 검은색으로 고정합니다.
                          className="!text-black px-3 py-1.5 border font-medium text-[13px] rounded-md hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          {item}
                        </button>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">데이터가 없습니다.</span>
                    )}
                  </div>
                </div>

                {/* 대안 B: PC 구글 팝업 (검색어 연동) */}
                <div className="md:col-span-1 bg-white p-5 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center">
                  <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                    관련 검색어 실시간 확인
                  </h3>
                  <p className="text-[13px] text-slate-500 mb-4 leading-relaxed">
                    구글 검색 결과 하단에서 <strong className="text-blue-700">"{keyword}"</strong> 관련 검색어를 직접 확인하세요. <br />(PC검색 결과 입니다. 모바일은 다를 수 있습니다.)
                  </p>
                  
                  <button 
                    onClick={() => {
                      const popupWidth = 400;
                      const popupHeight = 800;
                      const left = (window.screen.width / 2) - (popupWidth / 2);
                      const top = (window.screen.height / 2) - (popupHeight / 2);
                      
                      // 🌟 keyword 변수를 주소에 넣어, 현재 검색한 단어로 구글이 열리게 합니다.
                      window.open(
                        `https://www.google.com/search?q=${keyword}`, 
                        '_blank', 
                        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes`
                      );
                    }}
                    className="w-full text-center px-4 py-2.5 bg-orange-50 border border-orange-200 !text-orange-600 font-bold text-[13px] rounded-md hover:bg-orange-100 transition-colors cursor-pointer"
                  >
                    구글 검색창 열기 ↗
                  </button>
                </div>

              </div>
              {/* 🌟 [교체할 영역] 대안 A & 대안 B 영역 끝 */}

              {/* 🌟 Ads 데이터가 있을 때만 보여주는 3개 박스와 표 */}
              {adsList.length > 0 && mainKeywordData ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center">
                      <span className="text-sm font-bold text-slate-500 mb-2">구글 월간 검색량</span>
                      <div className="flex items-end gap-1">
                        <span className="text-3xl font-bold text-blue-600">{formatNum(mainKeywordData.searchVolume)}</span>
                        <span className="text-sm font-medium text-slate-400 mb-1">회</span>
                      </div>
                    </div>
                    
                    <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center">
                      <span className="text-sm font-bold text-slate-500 mb-2">광고 경쟁도</span>
                      <div className="flex items-center">
                        <span className={`text-lg font-bold px-4 py-1.5 rounded-full ${
                          mainKeywordData.competition === '높음' ? 'bg-orange-50 text-orange-600' : 
                          mainKeywordData.competition === '중간' ? 'bg-green-50 text-green-600' : 
                          'bg-slate-100 text-slate-600'
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
                          
                          <th className="px-5 py-4 text-right cursor-pointer hover:bg-blue-50 group text-blue-600 font-bold w-40 align-middle" onClick={() => handleSort('searchVolume')}>
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
                              <button onClick={() => handleSearch(item.keyword)} className="!text-black font-bold text-[14px] hover:text-blue-600 hover:underline text-left truncate w-full cursor-pointer">
                                {item.keyword}
                              </button>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className={`text-[11px] font-bold px-2 py-1 rounded-sm ${
                                item.competition === '높음' ? 'bg-orange-50 text-orange-600' : 
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
                            <td className="px-5 py-3 text-right font-extrabold text-blue-600 text-[14px] bg-blue-50/10">
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
                        className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-bold !text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        &lt; 이전
                      </button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-9 h-9 flex items-center justify-center rounded-md text-sm font-bold transition-all shadow-sm ${
                              currentPage === pageNum 
                                ? 'bg-[#1a73e8] !text-white border border-[#1a73e8]' 
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
                        className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-bold !text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        다음 &gt;
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* 🌟 Ads 데이터가 0건일 때 보여주는 친절한 안내 메시지 */
                <div className="bg-white p-12 border border-gray-200 shadow-sm rounded-sm text-center">
                  <span className="text-4xl mb-4 block">🚫</span>
                  <h3 className="font-bold text-slate-700 text-lg mb-2">광고 입찰 데이터가 제공되지 않는 키워드입니다.</h3>
                  <p className="text-[14px] text-slate-500 max-w-lg mx-auto leading-relaxed">
                    구글의 정책(의료, 금융 등 민감성 키워드)에 의해 조회가 제한되었거나, 월간 검색량이 너무 적어 구글 Ads에서 수치 데이터를 제공하지 않습니다.<br/>
                    <strong>상단의 '자동완성' 단어를 통해 실제 검색 흐름을 파악해 보세요.</strong>
                  </p>
                </div>
              )}
              
            </div>
          )}

        </div>
      </main>
    </div>
  );
}