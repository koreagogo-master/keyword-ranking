/**
 * page.tsx (버튼 상태 동적 변경 버전)
 */
'use client';

import { useMemo, useState, useEffect } from "react"; // useEffect 추가
import Sidebar from "@/components/Sidebar";
import RankTabs from "@/components/RankTabs";

import SearchVolume from "./components/1_SearchVolume";
import ContentStats from "./components/2_ContentStats";
import TrendCharts from "./components/3_TrendCharts";
import RelatedKeywords from "./components/4_RelatedKeywords";

function safeNumber(v: any) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export default function AnalysisPage() {
  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false); // 분석 완료 상태 추가

  // ✅ 키워드가 바뀌면 '완료' 상태를 해제하여 다시 '실행' 버튼으로 되돌립니다.
  useEffect(() => {
    setIsCompleted(false);
  }, [keyword]);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setIsSearching(true);
    setIsCompleted(false); // 검색 시작 시 완료 상태 초기화
    try {
      const res = await fetch(`/api/keyword?keyword=${encodeURIComponent(keyword)}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "데이터 로드 실패");
      setData(result);
      setIsCompleted(true); // ✅ 데이터 로드 성공 시 완료 상태로 변경
    } catch (e: any) {
      alert(e?.message || "데이터를 가져오는 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const stats = useMemo(() => {
    if (!data) return null;
    const calcShares = (total: number, blog: number, cafe: number, kin: number, news: number) => {
      const t = total > 0 ? total : 1;
      return {
        blog: Math.round((blog / t) * 100),
        cafe: Math.round((cafe / t) * 100),
        kin: Math.round((kin / t) * 100),
        news: Math.round((news / t) * 100),
      };
    };
    const cTotal = safeNumber(data.contentCount?.total);
    return {
      search: { total: safeNumber(data.searchCount?.total), pc: safeNumber(data.searchCount?.pc), mobile: safeNumber(data.searchCount?.mobile) },
      content: { total: cTotal, blog: safeNumber(data.contentCount?.blog), cafe: safeNumber(data.contentCount?.cafe), kin: safeNumber(data.contentCount?.kin), news: safeNumber(data.contentCount?.news), shares: calcShares(cTotal, safeNumber(data.contentCount?.blog), safeNumber(data.contentCount?.cafe), safeNumber(data.contentCount?.kin), safeNumber(data.contentCount?.news)) },
      content30: data.content30,
      ratios: { devicePc: safeNumber(data.ratios?.device?.pc), deviceMobile: safeNumber(data.ratios?.device?.mobile), genderMale: safeNumber(data.ratios?.gender?.male), genderFemale: safeNumber(data.ratios?.gender?.female) },
      weeklyTrend: data.weeklyTrend,
      monthlyTrend: data.monthlyTrend,
    };
  }, [data]);

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043]" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-10">
        <div className="max-w-7xl mx-auto">
          <RankTabs />
          <div className="mb-10"><h1 className="text-2xl font-normal text-gray-900">키워드 정밀 분석</h1></div>

          <div className="bg-white border border-gray-300 flex items-center mb-12 shadow-sm focus-within:border-blue-500 transition-all rounded-none max-w-3xl mx-auto w-full">
            <input 
              type="text" 
              value={keyword} 
              onChange={(e) => setKeyword(e.target.value)} 
              onKeyDown={(e) => e.key === "Enter" && handleSearch()} 
              className="flex-1 py-4 px-6 text-lg outline-none" 
              placeholder="분석할 키워드를 입력하세요" 
            />
            <button 
              onClick={handleSearch} 
              disabled={isSearching} 
              className={`px-12 py-5 font-bold transition-all disabled:opacity-60 ${isCompleted ? 'bg-green-600 hover:bg-green-700' : 'bg-[#1a73e8] hover:bg-blue-700'} text-white`}
            >
              {/* ✅ 버튼 문구 로직 수정 */}
              {isSearching ? "분석 중..." : isCompleted ? "키워드 분석 완료" : "키워드 분석 실행"}
            </button>
          </div>

          {stats && (
            <div className="space-y-10">
              <SearchVolume stats={stats} />
              <ContentStats stats={stats} />
              <TrendCharts stats={stats} />
              <RelatedKeywords data={data} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}