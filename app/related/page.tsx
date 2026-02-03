'use client';

import { useState, Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import RankTabs from "@/components/RankTabs";

// 숫자 포맷팅 (1,000 단위 콤마)
const formatNum = (num: number) => new Intl.NumberFormat().format(num || 0);

function RelatedAnalysisContent() {
  const [keyword, setKeyword] = useState("");
  const [mainData, setMainData] = useState<any>(null);
  const [visualList, setVisualList] = useState<any[]>([]); // 실시간 시각 분석 리스트
  const [adsList, setAdsList] = useState<any[]>([]);       // 네이버 광고 API 리스트
  const [isSearching, setIsSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [isAdsExpanded, setIsAdsExpanded] = useState(false); // ✅ '더 보기' 상태 관리

  /**
   * ✅ 수정된 부분: Puppeteer 추출 단어들의 검색량을 '가벼운 API'를 통해 가져옵니다.
   * 기존 /api/keyword (호출 9번) 대신 /api/keyword-light (호출 1번)를 사용합니다.
   */
  const fetchVolumes = async (words: string[]) => {
    const detailPromises = words.slice(0, 20).map(async (word: string) => {
      // 🚀 가벼운 전용 API 호출로 429 에러를 방지합니다.
      const res = await fetch(`/api/keyword-light?keyword=${encodeURIComponent(word)}`);
      const d = await res.json();
      return {
        keyword: word,
        pc: d.pc || 0,        // 가벼운 API 응답 구조에 맞춰 수정
        mobile: d.mobile || 0,
        total: d.total || 0
      };
    });
    return await Promise.all(detailPromises);
  };

  const handleSearch = async (targetKeyword?: string) => {
    const k = (typeof targetKeyword === 'string' ? targetKeyword : keyword).trim();
    if (!k) return;

    setKeyword(k);
    setIsSearching(true);
    setSearchAttempted(true);
    setIsAdsExpanded(false); 
    
    setMainData(null);
    setVisualList([]);
    setAdsList([]);

    try {
      // [1단계] 메인 키워드 기본 정보 (이건 1번만 호출하므로 기존 무거운 API 유지 가능)
      const mainRes = await fetch(`/api/keyword?keyword=${encodeURIComponent(k)}`);
      const mainJson = await mainRes.json();
      setMainData(mainJson.searchCount);

      // [2단계] 실시간 시각 분석 (Puppeteer)
      const visualRes = await fetch('/api/related', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: k })
      });
      const visualJson = await visualRes.json();
      
      if (visualJson.keywords?.length > 0) {
        const visualDetails = await fetchVolumes(visualJson.keywords);
        setVisualList(visualDetails);
      }

      // [3단계] 네이버 광고 API 기반 연관 키워드
      const adsRes = await fetch('/api/related-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: k })
      });
      const adsJson = await adsRes.json();
      
      if (adsJson.keywords?.length > 0) {
        setAdsList(adsJson.keywords.sort((a: any, b: any) => b.total - a.total));
      }

    } catch (e) {
      console.error("분석 중 에러:", e);
      alert("데이터 분석 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  // 공통 테이블 컴포넌트
  const KeywordTable = ({ title, list, colorClass, isExpandable = false }: { title: string, list: any[], colorClass: string, isExpandable?: boolean }) => {
    const displayList = (isExpandable && !isAdsExpanded) ? list.slice(0, 10) : list;

    return (
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-1.5 h-6 ${colorClass}`}></div>
          <h3 className="text-xl font-bold !text-black">{title}</h3>
          <span className="text-sm text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded">
            {list.length}개 발견
          </span>
        </div>
        <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200">
                <th className="px-6 py-5 font-bold text-slate-500 text-[11px] uppercase tracking-widest text-center w-24">순위</th>
                <th className="px-6 py-5 font-bold text-slate-500 text-[11px] uppercase tracking-widest">키워드</th>
                <th className="px-6 py-5 font-bold text-slate-500 text-[11px] uppercase tracking-widest text-right">PC</th>
                <th className="px-6 py-5 font-bold text-slate-500 text-[11px] uppercase tracking-widest text-right">모바일</th>
                <th className={`px-6 py-5 font-bold text-[11px] uppercase tracking-widest text-right ${colorClass.replace('bg-', 'text-')}`}>총 검색량</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayList.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-center text-gray-500 font-medium text-sm">{idx + 1}</td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleSearch(item.keyword)} 
                      className="!text-black font-bold text-[15px] hover:text-blue-600 hover:underline cursor-pointer block text-left transition-all"
                    >
                      {item.keyword}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right !text-black font-semibold text-sm">{formatNum(item.pc)}</td>
                  <td className="px-6 py-4 text-right !text-black font-semibold text-sm">{formatNum(item.mobile)}</td>
                  <td className={`px-6 py-4 text-right font-bold text-[15px] ${colorClass.replace('bg-', 'text-')} bg-opacity-5`}>
                    {formatNum(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {isExpandable && list.length > 10 && !isAdsExpanded && (
            <div className="p-8 bg-slate-50 border-t border-gray-200 text-center">
              <button 
                onClick={() => setIsAdsExpanded(true)}
                className="px-10 py-3.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg shadow-sm hover:bg-slate-100 hover:border-slate-400 cursor-pointer transition-all flex items-center gap-2 mx-auto"
              >
                연관키워드 200개 모두 보기 (무료 이벤트 중)
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              <p className="text-xs text-slate-400 mt-3">* 추후 유료 서비스로 전환될 예정입니다.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] !text-black">
      <Sidebar />
      <main className="flex-1 ml-64 p-10">
        <div className="max-w-7xl mx-auto">
          <RankTabs />
          
          <div className="mb-10">
            <h1 className="text-2xl font-bold !text-black">연관검색어 분석</h1>
          </div>

          <div className="bg-white border border-gray-300 flex items-center mb-8 shadow-sm focus-within:border-blue-500 rounded-none max-w-3xl overflow-hidden">
            <input 
              type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} 
              onKeyDown={(e) => e.key === "Enter" && handleSearch()} 
              className="flex-1 py-4 px-6 text-lg outline-none !text-black bg-white" 
              placeholder="분석할 키워드를 입력하세요" 
            />
            <button 
              onClick={() => handleSearch()} disabled={isSearching} 
              className="px-12 py-5 font-bold bg-[#1a73e8] hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer"
            >
              {isSearching ? "데이터 분석 중..." : "분석 실행"}
            </button>
          </div>

          {mainData && (
            <div className="bg-white border border-gray-200 p-8 mb-12 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-tight">분석 키워드</span>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{keyword}</h2>
              </div>
              <div className="flex gap-16 text-center">
                <div>
                  <p className="text-[11px] text-slate-400 mb-1 uppercase font-bold">PC</p>
                  <p className="text-xl font-bold !text-black tracking-tight">{formatNum(mainData.pc)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-1 uppercase font-bold">모바일</p>
                  <p className="text-xl font-bold !text-black tracking-tight">{formatNum(mainData.mobile)}</p>
                </div>
                <div className="border-l border-gray-200 pl-16">
                  <p className="text-[11px] text-blue-500 mb-1 uppercase font-bold">총 검색량</p>
                  <p className="text-3xl font-bold text-blue-600 tracking-tighter">{formatNum(mainData.total)}</p>
                </div>
              </div>
            </div>
          )}

          {visualList.length > 0 && (
            <KeywordTable title="실시간 연관검색어" list={visualList} colorClass="bg-blue-600" />
          )}

          {adsList.length > 0 && (
            <KeywordTable 
              title="네이버 연관검색어 (최대 200개)" 
              list={adsList} 
              colorClass="bg-green-600" 
              isExpandable={true} 
            />
          )}

          {searchAttempted && !isSearching && visualList.length === 0 && adsList.length === 0 && (
            <div className="bg-white border border-gray-300 p-16 text-center shadow-sm">
              <p className="text-slate-400 font-bold text-lg italic">연관 검색어 결과를 찾을 수 없습니다.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function RelatedPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-400 font-bold">페이지 로딩 중...</div>}>
      <RelatedAnalysisContent />
    </Suspense>
  );
}