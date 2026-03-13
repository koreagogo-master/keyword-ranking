'use client';

import { useState, Suspense, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import RankTabs from "@/components/RankTabs";

import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from '@/app/contexts/AuthContext';
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";

const formatNum = (num: number) => new Intl.NumberFormat().format(num || 0);

function RelatedFastContent() {
  const { user } = useAuth();

  const [keyword, setKeyword] = useState("");
  const [adsList, setAdsList] = useState<any[]>([]); 
  const [isSearching, setIsSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState<any[]>([]);
  
  const [isFilterOn, setIsFilterOn] = useState(true);

  const [sortField, setSortField] = useState<'pc' | 'mobile' | 'total' | 'cpc' | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>(null);

  const [cpcOption, setCpcOption] = useState('MOBILE_3');
  const [isCpcUpdating, setIsCpcUpdating] = useState(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
      page_type: 'RELATED', 
      nickname: '', 
      keyword: keyword
    });

    if (!error) alert("현재 설정이 안전하게 저장되었습니다.");
    else alert("저장 중 오류가 발생했습니다.");
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false); 
    handleSearch(item.keyword); 
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
      ? <span className="text-[#5244e8] ml-1.5 text-xs font-extrabold">▼</span> 
      : <span className="text-[#5244e8] ml-1.5 text-xs font-extrabold">▲</span>;
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />

      <div 
        className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" 
        style={{ fontFamily: "'NanumSquare', sans-serif" }}
      >
        <Sidebar />

        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">
            <RankTabs />
          
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">연관 키워드 조회</h1>
              <p className="text-sm text-slate-500 mt-1">* 포스팅 시 적용 가능한 연관 키워드를 네이버 API 기반으로 추천합니다. 조회 후 리스트에서 키워드를 선택 하면 좌측 [선택된 키워드]의 리스트가 생성 됩니다.</p>
              <p className="text-sm text-slate-500 mt-1">* 최종 선택 된 키워드를 복사하여 메모장에 붙여넣기가 가능 합니다. 선택된 키워드는 조회 키워드를 변경 하여도 남아 있습니다.</p>
              <p className="text-sm text-slate-500 mt-1">* CPC 단가 : 우측 상단의 순위를 조정 하면 조회 시점 기준으로 업데이트 됩니다.</p>
            </div>
            <div className="flex items-center gap-2 mt-1 shrink-0">
              <button 
                onClick={handleSaveCurrentSetting}
                className="px-4 py-2 text-sm font-bold text-white bg-slate-700 rounded-md hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5"
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

          <div className="flex flex-col lg:flex-row gap-8 items-start relative">
            <div className="w-full lg:w-[420px] sticky top-[64px] z-30 space-y-3 bg-[#f8f9fa]">
              <div className="bg-white border border-gray-200 rounded-sm flex items-center shadow-md focus-within:border-[#5244e8]/50 overflow-hidden transition-colors">
                <input 
                  type="text" 
                  value={keyword} 
                  onChange={(e) => setKeyword(e.target.value)} 
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()} 
                  className="flex-1 py-3 px-4 text-base outline-none !text-black bg-white" 
                  placeholder="분석할 키워드 입력" 
                />
                <button onClick={() => handleSearch()} className="px-10 py-3.5 font-bold bg-[#5244e8] hover:bg-[#4336c9] text-white transition-colors text-base whitespace-nowrap border-l border-gray-200">
                  {isSearching ? "..." : "조회"}
                </button>
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-[11px] text-slate-400 font-medium">연관성 필터링 (핵심어 기준)</span>
                <button 
                  onClick={() => setIsFilterOn(!isFilterOn)}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${isFilterOn ? 'bg-[#5244e8]' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isFilterOn ? 'translate-x-5.5' : 'translate-x-1'}`} />
                </button>
              </div>

              {mainKeywordData && (
                <div className="grid grid-cols-2 gap-2 pb-2">
                  <div className="bg-white px-4 py-3 border border-gray-100 shadow-sm rounded-sm flex justify-between items-center">
                    <span className="text-[12px] font-medium text-slate-400">예상클릭율</span>
                    <span className="text-base font-extrabold text-[#5244e8] leading-none">{mainKeywordData.ctr.toFixed(2)}%</span>
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
                      <span className="text-xs text-[#5244e8] font-extrabold">{formatNum(totalSelectedVolume)}</span>
                    </div>
                    <button onClick={() => setSelectedKeywords([])} className="text-[10px] text-red-500 hover:underline font-bold">전체삭제</button>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto p-2 space-y-1">
                    {selectedKeywords.map((item, i) => (
                      <div key={i} className="flex justify-between items-center px-3 py-2 bg-[#5244e8]/[0.03] border border-[#5244e8]/20 rounded-sm group hover:border-[#5244e8]/40 transition-all">
                        <div className="flex items-baseline gap-2 overflow-hidden">
                          <span className="text-[13px] font-bold text-[#5244e8] truncate">{item.keyword}</span>
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
                    <button onClick={copyToClipboard} className="w-full py-2 bg-[#5244e8] hover:bg-[#4336c9] text-white text-[12px] font-bold rounded-sm transition-colors shadow-sm">
                      선택 키워드 일괄 복사
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 w-full">
              {adsList.length > 0 && (
                <div className="flex flex-col gap-3">
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
                          
                          <th className="px-4 py-4 text-right cursor-pointer hover:bg-orange-50 group font-bold text-orange-600 w-28 align-middle" onClick={() => handleSort('cpc')}>
                            <div className="flex items-center justify-end" title="선택된 기준 예상 평균 클릭 비용">
                              *예상 CPC{renderSortIcon('cpc')}
                            </div>
                          </th>
                          
                          <th className="px-4 py-4 text-right cursor-pointer hover:bg-[#5244e8]/10 group text-[#5244e8] font-bold w-40 transition-colors" onClick={() => handleSort('total')}>
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
                          <tr className="bg-[#5244e8]/5 transition-colors border-b-2 border-[#5244e8]/20">
                            <td className="px-2 py-2.5 text-center">
                              <input 
                                type="checkbox" 
                                checked={!!selectedKeywords.find(it => it.keyword === mainKeywordData.keyword)}
                                onChange={() => toggleKeyword(mainKeywordData)}
                                className="w-4 h-4 cursor-pointer accent-[#5244e8]"
                              />
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="bg-[#5244e8] text-white text-[10px] font-bold px-2 py-1 rounded-sm whitespace-nowrap min-w-[40px] inline-block">검색어</span>
                            </td>
                            <td className="px-4 py-2.5 font-bold text-[#5244e8] text-sm truncate">{mainKeywordData.keyword}</td>
                            
                            <td className={`px-4 py-2.5 text-right font-extrabold text-[13px] ${isCpcUpdating ? 'text-orange-300 animate-pulse' : 'text-orange-600'}`}>
                              {mainKeywordData.cpc ? `${formatNum(mainKeywordData.cpc)}원` : '-'}
                            </td>
                            
                            <td className="px-4 py-2.5 text-right font-bold text-[#5244e8] text-sm">{formatNum(mainKeywordData.total)}</td>
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
                                className="w-4 h-4 cursor-pointer accent-[#5244e8]"
                              />
                            </td>
                            <td className="px-4 py-2 text-center text-slate-400 font-medium text-[13px]">{idx + 1}</td>
                            <td className="px-4 py-2">
                              <button onClick={() => handleSearch(item.keyword)} className="!text-black font-bold text-[13px] hover:text-[#5244e8] hover:underline text-left truncate w-full cursor-pointer">
                                {item.keyword}
                              </button>
                            </td>
                            
                            <td className={`px-4 py-2 text-right font-bold bg-orange-50/20 text-[13px] ${isCpcUpdating ? 'text-orange-300 animate-pulse' : 'text-orange-600'}`}>
                              {item.cpc ? `${formatNum(item.cpc)}원` : '-'}
                            </td>
                            
                            <td className={`px-4 py-2 text-right font-bold text-[#5244e8] bg-[#5244e8]/[0.05] text-[13px]`}>{formatNum(item.total)}</td>
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

      <SavedSearchesDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        pageType="RELATED" 
        onSelect={handleApplySavedSetting} 
      />
    </div>
    </>
  );
}

export default function RelatedFastPage() { return ( <Suspense><RelatedFastContent /></Suspense> ); }