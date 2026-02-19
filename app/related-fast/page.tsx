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
  
  const [isFilterOn, setIsFilterOn] = useState(true);

  const [sortField, setSortField] = useState<'pc' | 'mobile' | 'total' | 'cpc' | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>(null);

  // 콤보박스 상태 관리
  const [cpcOption, setCpcOption] = useState('MOBILE_3');
  const [isCpcUpdating, setIsCpcUpdating] = useState(false);

  const totalSelectedVolume = useMemo(() => {
    return selectedKeywords.reduce((acc, cur) => acc + (cur.total || 0), 0);
  }, [selectedKeywords]);

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

  const toggleKeyword = (item: any) => {
    setSelectedKeywords(prev => {
      const isAlreadySelected = prev.find(it => it.keyword === item.keyword);
      if (isAlreadySelected) return prev.filter(it => it.keyword !== item.keyword);
      return [...prev, item];
    });
  };

  const tokenize = (str: string) => {
    const tokens = new Set<string>();
    const cleanStr = str.replace(/\s+/g, '');
    if (cleanStr.length >= 2) {
      for (let i = 0; i <= cleanStr.length - 2; i++) tokens.add(cleanStr.substring(i, i + 2));
    } else {
      tokens.add(cleanStr);
    }
    return Array.from(tokens);
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

    const [device, posStr] = cpcOption.split('_');
    const cpcPosition = parseInt(posStr, 10);

    try {
      const adsRes = await fetch('/api/related-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: k, cpcDevice: device, cpcPosition: cpcPosition })
      });
      const adsJson = await adsRes.json();
      
      if (adsJson.keywords?.length > 0) {
        const uniqueMap = new Map();
        const searchKey = k.replace(/\s+/g, '');
        const searchTokens = tokenize(searchKey); 

        const forceNum = (val: any) => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const clean = val.replace(/,/g, '');
            if (clean.includes('<')) return 5;
            return Number(clean) || 0;
          }
          return 0;
        };

        adsJson.keywords.forEach((item: any) => {
          const normalized = item.keyword.replace(/\s+/g, '');
          const isMainKeyword = normalized === searchKey;
          let passFilter = true;
          
          if (isFilterOn && !isMainKeyword) {
            passFilter = searchTokens.some(token => normalized.includes(token));
          }

          if (passFilter && !uniqueMap.has(normalized)) {
            uniqueMap.set(normalized, {
              ...item,
              pc: forceNum(item.pc),
              mobile: forceNum(item.mobile),
              total: forceNum(item.pc) + forceNum(item.mobile),
              cpc: forceNum(item.cpc),
              compText: item.compIdx === 'HIGH' ? '높음' : item.compIdx === 'MEDIUM' ? '중간' : '낮음',
              ctr: (forceNum(item.monthlyAvePcCtr) + forceNum(item.monthlyAveMobileCtr)) / 2
            });
          }
        });
        setAdsList(Array.from(uniqueMap.values()).slice(0, 100));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCpcChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOption = e.target.value;
    setCpcOption(newOption);
    
    if (adsList.length === 0) return;

    setIsCpcUpdating(true);
    const [device, posStr] = newOption.split('_');
    const position = parseInt(posStr, 10);
    
    const keywordList = adsList.map(item => item.keyword);
    
    try {
      const res = await fetch('/api/related-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCpcOnly: true, keywords: keywordList, device, position })
      });
      const data = await res.json();
      
      if (data.success && data.estimateMap) {
        setAdsList(prev => prev.map(item => ({
          ...item,
          cpc: data.estimateMap[item.keyword] !== undefined ? data.estimateMap[item.keyword] : item.cpc
        })));
      }
    } catch (error) {
      console.error("CPC 업데이트 실패:", error);
    } finally {
      setIsCpcUpdating(false);
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

  const handleSort = (field: 'pc' | 'mobile' | 'total' | 'cpc') => {
    if (sortField === field) {
      if (sortOrder === 'desc') setSortOrder('asc');
      else { setSortField(null); setSortOrder(null); }
    } else { setSortField(field); setSortOrder('desc'); }
  };

  const renderSortIcon = (field: 'pc' | 'mobile' | 'total' | 'cpc') => {
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
            <p className="text-sm text-slate-500 mt-1">* 포스팅 시 적용 가능한 연관 키워드를 네이버 API 기반으로 추천합니다. 조회 후 리스트에서 키워드를 선택 하면 좌측 [선택된 키워드]의 리스트가 생성 됩니다.</p>
            <p className="text-sm text-slate-500 mt-1">* 최종 선택 된 키워드를 복사하여 메모장에 붙여넣기가 가능 합니다. 선택된 키워드는 조회 키워드를 변경 하여도 남아 있습니다.</p>
            <p className="text-sm text-slate-500 mt-1">* CPC 단가 : 우측 상단의 순위를 조정 하면 조회 시점 기준으로 업데이트 됩니다.</p>
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

              <div className="flex justify-between items-center px-1">
                <span className="text-[11px] text-slate-400 font-medium">연관성 필터링 (핵심어 기준)</span>
                <button 
                  onClick={() => setIsFilterOn(!isFilterOn)}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${isFilterOn ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isFilterOn ? 'translate-x-5.5' : 'translate-x-1'}`} />
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

              {selectedKeywords.length > 0 && (
                <div className="bg-white border border-gray-200 shadow-md rounded-sm overflow-hidden flex flex-col">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-gray-200 flex justify-between items-center">
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
                        <button onClick={() => toggleKeyword(item)} className="p-1 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-full transition-all">
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
                <div className="flex flex-col gap-3">
                  {/* 🌟 콤보박스를 표 우측 상단으로 독립시켰습니다. */}
                  <div className="flex justify-end items-center gap-2">
                    <span className="text-[12px] font-bold text-slate-500">단가 조회 기준 :</span>
                    <select 
                      value={cpcOption} 
                      onChange={handleCpcChange}
                      disabled={isCpcUpdating || isSearching}
                      className="bg-white text-orange-600 border border-orange-200 text-[12px] font-extrabold py-1.5 px-2 rounded-sm outline-none cursor-pointer hover:bg-orange-50 focus:border-orange-400 disabled:opacity-50"
                    >
                      <option value="MOBILE_1">모바일 1위</option>
                      <option value="MOBILE_2">모바일 2위</option>
                      <option value="MOBILE_3">모바일 3위</option>
                      <option value="PC_1">PC 1위</option>
                      <option value="PC_2">PC 2위</option>
                      <option value="PC_3">PC 3위</option>
                    </select>
                  </div>

                  <div className="bg-white border border-gray-300 shadow-sm overflow-visible rounded-sm">
                    <table className="w-full text-left border-collapse table-fixed">
                      <thead className="sticky top-[64px] z-20 bg-slate-50 border-b border-gray-200">
                        <tr className="text-[13px]">
                          <th className="px-2 py-4 text-center w-12 font-bold text-slate-500">선택</th>
                          <th className="px-4 py-4 font-bold text-slate-500 text-center w-16">순위</th>
                          <th className="px-4 py-4 font-bold text-slate-500">연관 키워드</th>
                          
                          {/* 🌟 예상 CPC 헤더가 드디어 완벽한 수평 라인을 찾았습니다! */}
                          <th className="px-4 py-4 text-right cursor-pointer hover:bg-orange-50 group font-bold text-orange-600 w-28 align-middle" onClick={() => handleSort('cpc')}>
                            <div className="flex items-center justify-end" title="선택된 기준 예상 평균 클릭 비용">
                              *예상 CPC{renderSortIcon('cpc')}
                            </div>
                          </th>
                          
                          <th className="px-4 py-4 text-right cursor-pointer hover:bg-blue-50 group text-blue-600 font-bold w-40" onClick={() => handleSort('total')}>
                            <div className="flex items-center justify-end">총 검색량 (월){renderSortIcon('total')}</div>
                          </th>
                          <th className="px-4 py-4 text-right cursor-pointer hover:bg-slate-100 group font-semibold text-slate-500 w-32" onClick={() => handleSort('pc')}>
                            <div className="flex items-center justify-end">PC (%){renderSortIcon('pc')}</div>
                          </th>
                          <th className="px-4 py-4 text-right cursor-pointer hover:bg-slate-100 group font-semibold text-slate-500 w-32" onClick={() => handleSort('mobile')}>
                            <div className="flex items-center justify-end">모바일 (%){renderSortIcon('mobile')}</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
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
                              <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-sm whitespace-nowrap min-w-[40px] inline-block">검색어</span>
                            </td>
                            <td className="px-4 py-2.5 font-bold text-blue-700 text-sm truncate">{mainKeywordData.keyword}</td>
                            
                            <td className={`px-4 py-2.5 text-right font-extrabold text-[13px] ${isCpcUpdating ? 'text-orange-300 animate-pulse' : 'text-orange-600'}`}>
                              {mainKeywordData.cpc ? `${formatNum(mainKeywordData.cpc)}원` : '-'}
                            </td>
                            
                            <td className="px-4 py-2.5 text-right font-bold text-blue-700 text-sm">{formatNum(mainKeywordData.total)}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-sm text-slate-700">
                              {formatNum(mainKeywordData.pc)} <span className="text-slate-400 text-[10px] font-normal italic">({Math.round(mainKeywordData.pc/mainKeywordData.total*100)}%)</span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-sm text-slate-700">
                              {formatNum(mainKeywordData.mobile)} <span className="text-slate-400 text-[10px] font-normal italic">({Math.round(mainKeywordData.mobile/mainKeywordData.total*100)}%)</span>
                            </td>
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
                              <button onClick={() => handleSearch(item.keyword)} className="!text-black font-bold text-[13px] hover:text-blue-600 hover:underline text-left truncate w-full cursor-pointer">
                                {item.keyword}
                              </button>
                            </td>
                            
                            <td className={`px-4 py-2 text-right font-bold bg-orange-50/20 text-[13px] ${isCpcUpdating ? 'text-orange-300 animate-pulse' : 'text-orange-600'}`}>
                              {item.cpc ? `${formatNum(item.cpc)}원` : '-'}
                            </td>
                            
                            <td className={`px-4 py-2 text-right font-bold text-blue-600 bg-blue-50/20 text-[13px]`}>{formatNum(item.total)}</td>
                            <td className="px-4 py-2 text-right !text-black font-medium text-[13px]">
                              {formatNum(item.pc)} <span className="text-slate-400 text-[10px] font-normal italic">({Math.round(item.pc/item.total*100)}%)</span>
                            </td>
                            <td className="px-4 py-2 text-right !text-black font-medium text-[13px]">
                              {formatNum(item.mobile)} <span className="text-slate-400 text-[10px] font-normal italic">({Math.round(item.mobile/item.total*100)}%)</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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