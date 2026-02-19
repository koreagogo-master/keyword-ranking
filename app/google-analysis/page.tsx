'use client';

import { useState, useMemo } from "react";
import Sidebar from "@/components/Sidebar";

const formatNum = (num: number) => new Intl.NumberFormat().format(num || 0);

export default function GoogleAnalysisPage() {
  const [keyword, setKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [adsList, setAdsList] = useState<any[]>([]);
  
  const [sortField, setSortField] = useState<'searchVolume' | 'cpcLow' | 'cpcHigh' | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | null>(null);

  const handleSearch = async (targetKeyword?: string) => {
    const k = (typeof targetKeyword === 'string' ? targetKeyword : keyword).trim();
    if (!k) return;

    setKeyword(k);
    setIsSearching(true);
    setAdsList([]);
    setSortField(null);
    setSortOrder(null);

    try {
      // 🌟 [핵심 변경 포인트] 새로 만든 전용 API 주소로 요청합니다.
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
    } catch (e) {
      console.error(e);
      alert("검색 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const mainKeywordData = useMemo(() => {
    if (adsList.length === 0) return null;
    const searchKey = keyword.replace(/\s+/g, '').toLowerCase();
    return adsList.find(it => it.keyword.replace(/\s+/g, '').toLowerCase() === searchKey) || adsList[0];
  }, [adsList, keyword]);

  const sortedList = useMemo(() => {
    if (adsList.length === 0 || !mainKeywordData) return [];
    
    const otherItems = adsList.filter(it => it.keyword !== mainKeywordData.keyword);
    
    if (sortField && sortOrder) {
      otherItems.sort((a, b) => {
        const valA = a[sortField] || 0;
        const valB = b[sortField] || 0;
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
    }
    return otherItems;
  }, [adsList, sortField, sortOrder, mainKeywordData]);

  const handleSort = (field: 'searchVolume' | 'cpcLow' | 'cpcHigh') => {
    if (sortField === field) {
      if (sortOrder === 'desc') setSortOrder('asc');
      else { setSortField(null); setSortOrder(null); }
    } else { 
      setSortField(field); 
      setSortOrder('desc'); 
    }
  };

  const renderSortIcon = (field: 'searchVolume' | 'cpcLow' | 'cpcHigh') => {
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
            <p className="text-sm text-slate-500 mt-1">구글 Ads API를 활용하여 글로벌 및 국내 검색량, 경쟁도, 예상 CPC(클릭당 비용)를 분석합니다.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm flex items-center shadow-md focus-within:border-blue-400 overflow-hidden max-w-2xl mb-8">
            <input 
              type="text" 
              value={keyword} 
              onChange={(e) => setKeyword(e.target.value)} 
              onKeyDown={(e) => e.key === "Enter" && handleSearch()} 
              className="flex-1 py-3 px-4 text-base outline-none !text-black bg-white" 
              placeholder="분석할 구글 키워드 입력 (예: 마케팅)" 
            />
            <button 
              onClick={() => handleSearch()} 
              disabled={isSearching}
              className="px-10 py-3.5 font-bold bg-[#1a73e8] hover:bg-[#1557b0] text-white transition-colors text-base whitespace-nowrap border-l border-gray-200 disabled:opacity-70"
            >
              {isSearching ? "조회 중..." : "조회"}
            </button>
          </div>

          {adsList.length > 0 && mainKeywordData && (
            <div className="space-y-8 animate-in fade-in duration-500">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center">
                  <span className="text-sm font-bold text-slate-500 mb-2">구글 월간 검색량</span>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-extrabold text-blue-600">{formatNum(mainKeywordData.searchVolume)}</span>
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
                      
                      <th className="px-5 py-4 text-center font-bold text-slate-500 w-28">경쟁도</th>
                      
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
                    {sortedList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-center text-slate-400 font-medium text-[13px]">{idx + 1}</td>
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
            </div>
          )}

        </div>
      </main>
    </div>
  );
}