'use client';

import { useState, Suspense, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import RankTabs from "@/components/RankTabs";

const formatNum = (num: number) => new Intl.NumberFormat().format(num || 0);

function RelatedFastContent() {
  const [keyword, setKeyword] = useState("");
  const [adsList, setAdsList] = useState<any[]>([]); 
  const [isSearching, setIsSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  
  const [sortField, setSortField] = useState<'pc' | 'mobile' | 'total' | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>(null);

  const mainKeywordData = useMemo(() => {
    if (adsList.length === 0) return null;
    const searchKey = keyword.replace(/\s+/g, '');
    return adsList.find(it => it.keyword.replace(/\s+/g, '') === searchKey);
  }, [adsList, keyword]);

  const handleSearch = async (targetKeyword?: string) => {
    const k = (typeof targetKeyword === 'string' ? targetKeyword : keyword).trim();
    if (!k) return;

    setKeyword(k);
    setIsSearching(true);
    setSearchAttempted(true);
    setAdsList([]);
    setSortField(null);
    setSortOrder(null);

    try {
      const adsRes = await fetch('/api/related-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: k })
      });
      const adsJson = await adsRes.json();
      
      if (adsJson.keywords?.length > 0) {
        const uniqueMap = new Map();
        const forceNum = (val: any) => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const clean = val.replace(/,/g, '');
            if (clean.includes('<')) return 5;
            return Number(clean) || 0;
          }
          return 0;
        };

        const searchKey = k.replace(/\s+/g, '');
        adsJson.keywords.forEach((item: any) => {
          const normalized = item.keyword.replace(/\s+/g, '');
          let isRelevant = normalized.includes(searchKey) || searchKey.includes(normalized);
          if (!isRelevant && searchKey.length >= 2) {
            for (let i = 0; i <= searchKey.length - 2; i++) {
              const sub = searchKey.substring(i, i + 2);
              if (normalized.includes(sub)) {
                isRelevant = true;
                break;
              }
            }
          }

          if (isRelevant && !uniqueMap.has(normalized)) {
            uniqueMap.set(normalized, {
              ...item,
              pc: forceNum(item.pc),
              mobile: forceNum(item.mobile),
              total: forceNum(item.pc) + forceNum(item.mobile),
              compText: item.compIdx === 'HIGH' ? '높음' : item.compIdx === 'MEDIUM' ? '중간' : '낮음',
              clicks: forceNum(item.monthlyAvePcClkCnt) + forceNum(item.monthlyAveMobileClkCnt),
              ctr: (forceNum(item.monthlyAvePcCtr) + forceNum(item.monthlyAveMobileCtr)) / 2
            });
          }
        });
        setAdsList(Array.from(uniqueMap.values()).slice(0, 50));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const sortedList = useMemo(() => {
    if (adsList.length === 0) return [];
    const searchKey = keyword.replace(/\s+/g, '');
    const otherItems = adsList.filter(it => it.keyword.replace(/\s+/g, '') !== searchKey);
    if (sortField && sortOrder) {
      otherItems.sort((a, b) => {
        const valA = a[sortField] || 0;
        const valB = b[sortField] || 0;
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
    }
    return otherItems;
  }, [adsList, sortField, sortOrder, keyword]);

  const handleSort = (field: 'pc' | 'mobile' | 'total') => {
    if (sortField === field) {
      if (sortOrder === 'desc') setSortOrder('asc');
      else { setSortField(null); setSortOrder(null); }
    } else { setSortField(field); setSortOrder('desc'); }
  };

  const renderSortIcon = (field: 'pc' | 'mobile' | 'total') => {
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
          <RankTabs />
          
          <div className="mb-8">
            <h1 className="text-2xl font-bold !text-black">추천 연관 키워드 조회</h1>
            <p className="text-sm text-slate-500 mt-1">포스팅 시 적용 가능한 연관 키워드를 네이버 API 기반으로 추천합니다.</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-start relative">
            
            {/* ⬅️ 왼쪽 영역: 검색창부터 최상단 고정 */}
            {/* sticky top-0을 사용하여 스크롤 시 검색창이 화면 맨 위에서 멈춥니다. */}
            <div className="w-full lg:w-[420px] sticky top-0 z-30 space-y-3 pt-1 bg-[#f8f9fa]">
              {/* 검색 박스 */}
              <div className="bg-white border border-gray-200 rounded-sm flex items-center shadow-md focus-within:border-blue-400 transition-all overflow-hidden">
                <input 
                  type="text" 
                  value={keyword} 
                  onChange={(e) => setKeyword(e.target.value)} 
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()} 
                  className="flex-1 py-3 px-4 text-base outline-none !text-black bg-white" 
                  placeholder="분석할 키워드 입력" 
                />
                <button 
                  onClick={() => handleSearch()} 
                  className="px-10 py-3.5 font-bold bg-[#1a73e8] hover:bg-[#1557b0] text-white transition-colors text-base whitespace-nowrap border-l border-gray-200"
                >
                  {isSearching ? "..." : "조회"}
                </button>
              </div>

              {mainKeywordData && (
                <div className="grid grid-cols-2 gap-2 pb-2">
                  <div className="bg-white px-4 py-4 border border-gray-100 shadow-sm rounded-sm flex justify-between items-center">
                    <span className="text-[12px] font-medium text-slate-400">예상클릭율</span>
                    <span className="text-lg font-bold text-blue-600 leading-none">{mainKeywordData.ctr.toFixed(2)}%</span>
                  </div>
                  <div className="bg-white px-4 py-4 border border-gray-100 shadow-sm rounded-sm flex justify-between items-center">
                    <span className="text-[12px] font-medium text-slate-400">광고 경쟁도</span>
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-full leading-none ${mainKeywordData.compText === '높음' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                      {mainKeywordData.compText}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ➡️ 오른쪽 영역: 테이블 헤더 고정 */}
            <div className="flex-1 w-full">
              {adsList.length > 0 && (
                <div className="bg-white border border-gray-300 shadow-sm overflow-hidden rounded-sm">
                  <table className="w-full text-left border-collapse">
                    {/* 왼쪽 검색창과 높이를 맞추기 위해 동일한 sticky top-0을 설정합니다. */}
                    <thead className="sticky top-0 z-20 bg-slate-50 border-b border-gray-200 shadow-sm">
                      <tr className="text-[13px]">
                        <th className="px-4 py-4 font-bold text-slate-500 text-center w-20">순위</th>
                        <th className="px-4 py-4 font-bold text-slate-500">연관 키워드</th>
                        <th className="px-4 py-4 text-right cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('pc')}>
                          <div className="flex items-center justify-end"><strong>PC (%)</strong>{renderSortIcon('pc')}</div>
                        </th>
                        <th className="px-4 py-4 text-right cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('mobile')}>
                          <div className="flex items-center justify-end"><strong>모바일 (%)</strong>{renderSortIcon('mobile')}</div>
                        </th>
                        <th className="px-4 py-3 text-right cursor-pointer hover:bg-blue-50 group" onClick={() => handleSort('total')}>
                          <div className="flex items-center justify-end"><span className="font-bold text-blue-600">총 검색량</span>{renderSortIcon('total')}</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {mainKeywordData && (
                        <tr className="bg-blue-50/40 transition-colors border-b-2 border-blue-100">
                          <td className="px-4 py-2.5 text-center">
                            <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">검색어</span>
                          </td>
                          <td className="px-4 py-2.5 font-bold text-blue-700 text-sm">{mainKeywordData.keyword}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-sm">{formatNum(mainKeywordData.pc)} <span className="text-slate-400 text-[10px] font-normal italic">({Math.round(mainKeywordData.pc/mainKeywordData.total*100)}%)</span></td>
                          <td className="px-4 py-2.5 text-right font-semibold text-sm">{formatNum(mainKeywordData.mobile)} <span className="text-slate-400 text-[10px] font-normal italic">({Math.round(mainKeywordData.mobile/mainKeywordData.total*100)}%)</span></td>
                          <td className="px-4 py-2.5 text-right font-bold text-blue-700 text-sm">{formatNum(mainKeywordData.total)}</td>
                        </tr>
                      )}

                      {sortedList.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2 text-center text-slate-400 font-medium text-[13px]">{idx + 1}</td>
                          <td className="px-4 py-2">
                            <button onClick={() => handleSearch(item.keyword)} className="!text-black font-bold text-[13px] hover:text-blue-600 hover:underline text-left">
                              {item.keyword}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-right !text-black font-semibold text-[13px]">{formatNum(item.pc)} <span className="text-slate-400 text-[10px] font-normal italic">({Math.round(item.pc/item.total*100)}%)</span></td>
                          <td className="px-4 py-2 text-right !text-black font-semibold text-[13px]">{formatNum(item.mobile)} <span className="text-slate-400 text-[10px] font-normal italic">({Math.round(item.mobile/item.total*100)}%)</span></td>
                          <td className={`px-4 py-2 text-right font-bold text-blue-600 bg-blue-50/20 border-b border-gray-100 text-[13px]`}>{formatNum(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {searchAttempted && !isSearching && adsList.length === 0 && (
                <div className="bg-white border border-gray-300 p-12 text-center shadow-sm rounded-sm">
                  <p className="text-slate-400 font-bold text-base italic">분석 결과가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RelatedFastPage() { return ( <Suspense><RelatedFastContent /></Suspense> ); }