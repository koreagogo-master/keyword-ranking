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
  const [selectedKeywords, setSelectedKeywords] = useState<any[]>([]);

  const [sortField, setSortField] = useState<'pc' | 'mobile' | 'total' | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>(null);

  /**
   * ✅ 선택된 키워드들의 총 검색량 합계 계산
   */
  const totalSelectedVolume = useMemo(() => {
    return selectedKeywords.reduce((acc, cur) => acc + (cur.total || 0), 0);
  }, [selectedKeywords]);

  /**
   * ✅ 키워드 일괄 복사 함수 (줄바꿈 형식)
   */
  const copyToClipboard = () => {
    if (selectedKeywords.length === 0) return;
    const textToCopy = selectedKeywords
      .map(it => `${it.keyword} (${formatNum(it.total)})`)
      .join('\n');
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      alert("선택된 키워드 목록이 복사되었습니다.");
    }).catch(err => {
      console.error('복사 실패:', err);
    });
  };

  /**
   * ✅ 키워드 선택/해제 로직
   */
  const toggleKeyword = (item: any) => {
    setSelectedKeywords(prev => {
      const isAlreadySelected = prev.find(it => it.keyword === item.keyword);
      if (isAlreadySelected) return prev.filter(it => it.keyword !== item.keyword);
      return [...prev, item];
    });
  };

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

  const mainKeywordData = useMemo(() => {
    if (adsList.length === 0) return null;
    const searchKey = keyword.replace(/\s+/g, '');
    return adsList.find(it => it.keyword.replace(/\s+/g, '') === searchKey);
  }, [adsList, keyword]);

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
            <h1 className="text-2xl font-bold !text-black">연관 키워드 조회</h1>
            <p className="text-sm text-slate-500 mt-1">포스팅 시 적용 가능한 연관 키워드를 네이버 API 기반으로 추천합니다. 조회 후 리스트에서 키워드를 선택 하면 좌측 [선택된 키워드]의 리스트가 생성 됩니다.</p>
            <p className="text-sm text-slate-500 mt-1">최종 선택 된 키워드를 복사하여 메모장에 붙여넣기가 가능 합니다. 선택된 키워드는 조회 키워드를 변경 하여도 남아 있습니다.</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-start relative">
            
            <div className="w-full lg:w-[420px] sticky top-[64px] z-30 space-y-3 bg-[#f8f9fa]">
              <div className="bg-white border border-gray-200 rounded-sm flex items-center shadow-md focus-within:border-blue-400 overflow-hidden">
                <input 
                  type="text" 
                  value={keyword} 
                  onChange={(e) => setKeyword(e.target.value)} 
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()} 
                  className="flex-1 py-3 px-4 text-base outline-none !text-black bg-white" 
                  placeholder="분석할 키워드 입력" 
                />
                <button onClick={() => handleSearch()} className="px-10 py-3.5 font-bold bg-[#1a73e8] hover:bg-[#1557b0] text-white transition-colors text-base whitespace-nowrap border-l border-gray-200">
                  {isSearching ? "..." : "조회"}
                </button>
              </div>

              {mainKeywordData && (
                <div className="grid grid-cols-2 gap-2 pb-2">
                  <div className="bg-white px-4 py-3 border border-gray-100 shadow-sm rounded-sm flex justify-between items-center">
                    <span className="text-[12px] font-medium text-slate-400">예상클릭율</span>
                    <span className="text-base font-extrabold text-blue-600 leading-none">{mainKeywordData.ctr.toFixed(2)}%</span>
                  </div>
                  <div className="bg-white px-4 py-4 border border-gray-100 shadow-sm rounded-sm flex justify-between items-center">
                    <span className="text-[12px] font-medium text-slate-400">광고 경쟁도</span>
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-full leading-none ${mainKeywordData.compText === '높음' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                      {mainKeywordData.compText}
                    </span>
                  </div>
                </div>
              )}

              {/* ✅ 선택된 키워드: 헤더 레이아웃 수정 */}
              {selectedKeywords.length > 0 && (
                <div className="bg-white border border-gray-200 shadow-md rounded-sm overflow-hidden flex flex-col">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-gray-200 flex justify-between items-center">
                    {/* ✅ 검색량 수치를 텍스트 우측으로 이동 및 폰트 크기 통일 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600">선택된 키워드 ({selectedKeywords.length})</span>
                      <span className="text-xs text-blue-600 font-extrabold">{formatNum(totalSelectedVolume)}</span>
                    </div>
                    <button onClick={() => setSelectedKeywords([])} className="text-[10px] text-red-500 hover:underline font-bold">전체삭제</button>
                  </div>
                  
                  <div className="max-h-[350px] overflow-y-auto p-2 space-y-1">
                    {selectedKeywords.map((item, i) => (
                      <div key={i} className="flex justify-between items-center px-3 py-2 bg-blue-50/30 border border-blue-100 rounded-sm group hover:border-blue-300 transition-all">
                        <div className="flex items-baseline gap-2 overflow-hidden">
                          <span className="text-[13px] font-bold text-blue-700 truncate">{item.keyword}</span>
                          <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">{formatNum(item.total)}</span>
                        </div>
                        <button 
                          onClick={() => toggleKeyword(item)} 
                          className="p-1 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="p-2 border-t border-gray-100 bg-gray-50/50">
                    <button onClick={copyToClipboard} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-sm transition-colors shadow-sm">
                      선택 키워드 일괄 복사
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 w-full">
              {adsList.length > 0 && (
                <div className="bg-white border border-gray-300 shadow-sm overflow-visible rounded-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-[64px] z-20">
                      <tr className="text-[13px] bg-slate-50">
                        <th className="px-2 py-4 text-center w-12 font-bold text-slate-500 border-b border-gray-200">선택</th>
                        <th className="px-4 py-4 font-bold text-slate-500 text-center w-32 border-b border-gray-200">순위</th>
                        <th className="px-4 py-4 font-bold text-slate-500 border-b border-gray-200">연관 키워드</th>
                        <th className="px-4 py-4 text-right cursor-pointer hover:bg-slate-100 group font-semibold text-slate-500 border-b border-gray-200" onClick={() => handleSort('pc')}>
                          <div className="flex items-center justify-end">PC (%){renderSortIcon('pc')}</div>
                        </th>
                        <th className="px-4 py-4 text-right cursor-pointer hover:bg-slate-100 group font-semibold text-slate-500 border-b border-gray-200" onClick={() => handleSort('mobile')}>
                          <div className="flex items-center justify-end">모바일 (%){renderSortIcon('mobile')}</div>
                        </th>
                        <th className="px-4 py-4 text-right cursor-pointer hover:bg-blue-50 group text-blue-600 font-bold border-b border-gray-200" onClick={() => handleSort('total')}>
                          <div className="flex items-center justify-end">총 검색량{renderSortIcon('total')}</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {mainKeywordData && (
                        <tr className="bg-blue-50/40 transition-colors border-b-2 border-blue-100">
                          <td className="px-2 py-2.5 text-center">
                            <input 
                              type="checkbox" 
                              checked={!!selectedKeywords.find(it => it.keyword === mainKeywordData.keyword)}
                              onChange={() => toggleKeyword(mainKeywordData)}
                              className="w-4 h-4 cursor-pointer accent-blue-600"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-sm whitespace-nowrap min-w-[50px] inline-block">검색어</span>
                          </td>
                          <td className="px-4 py-2.5 font-bold text-blue-700 text-sm">{mainKeywordData.keyword}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-sm text-slate-700">{formatNum(mainKeywordData.pc)} <span className="text-slate-400 text-[10px] font-normal italic">({Math.round(mainKeywordData.pc/mainKeywordData.total*100)}%)</span></td>
                          <td className="px-4 py-2.5 text-right font-medium text-sm text-slate-700">{formatNum(mainKeywordData.mobile)} <span className="text-slate-400 text-[10px] font-normal italic">({Math.round(mainKeywordData.mobile/mainKeywordData.total*100)}%)</span></td>
                          <td className="px-4 py-2.5 text-right font-bold text-blue-700 text-sm">{formatNum(mainKeywordData.total)}</td>
                        </tr>
                      )}
                      {sortedList.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-2 py-2 text-center">
                            <input 
                              type="checkbox" 
                              checked={!!selectedKeywords.find(it => it.keyword === item.keyword)}
                              onChange={() => toggleKeyword(item)}
                              className="w-4 h-4 cursor-pointer accent-blue-600"
                            />
                          </td>
                          <td className="px-4 py-2 text-center text-slate-400 font-medium text-[13px]">{idx + 1}</td>
                          <td className="px-4 py-2">
                            <button onClick={() => handleSearch(item.keyword)} className="!text-black font-bold text-[13px] hover:text-blue-600 hover:underline text-left">
                              {item.keyword}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-right !text-black font-medium text-[13px]">{formatNum(item.pc)} <span className="text-slate-400 text-[10px] font-normal italic">({Math.round(item.pc/item.total*100)}%)</span></td>
                          <td className="px-4 py-2 text-right !text-black font-medium text-[13px]">{formatNum(item.mobile)} <span className="text-slate-400 text-[10px] font-normal italic">({Math.round(item.mobile/item.total*100)}%)</span></td>
                          <td className={`px-4 py-2 text-right font-bold text-blue-600 bg-blue-50/20 border-b border-gray-100 text-[13px]`}>{formatNum(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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