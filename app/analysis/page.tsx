'use client';

import { useMemo, useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import RankTabs from "@/components/RankTabs";

import SearchVolume from "./components/1_SearchVolume";
import ContentStats from "./components/2_ContentStats";
import TrendCharts from "./components/3_TrendCharts";
import RelatedKeywords from "./components/4_RelatedKeywords";
import SimilarityAnalysis from "./components/5_SimilarityAnalysis";
import KeywordStrategy from "./components/6_KeywordStrategy";

function safeNumber(v: any) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export default function AnalysisPage() {
  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<any>(null);
  const [googleVolume, setGoogleVolume] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    setIsCompleted(false);
  }, [keyword]);

  const handleSearch = async (targetKeyword?: string) => {
    const k = (typeof targetKeyword === 'string' ? targetKeyword : keyword).trim();
    if (!k) return;

    setKeyword(k);
    setIsSearching(true);
    setIsCompleted(false);
    setGoogleVolume(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      // ✅ 네이버와 구글 데이터를 동시에(병렬) 요청하여 속도 최적화
      const [naverRes, googleRes] = await Promise.all([
        fetch(`/api/keyword?keyword=${encodeURIComponent(k)}`),
        fetch('/api/google-ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: k }),
        })
      ]);

      // 네이버 데이터 처리
      const naverData = await naverRes.json();
      if (!naverRes.ok) throw new Error(naverData?.error || "네이버 데이터 로드 실패");

      // 구글 데이터 처리
      let gVolume = 0;
      if (googleRes.ok) {
        const gData = await googleRes.json();
        gVolume = gData.monthlySearchVolume || 0;
      }
      
      setGoogleVolume(gVolume);
      setData(naverData);
      setIsCompleted(true);
    } catch (e: any) {
      alert(e?.message || "데이터를 가져오는 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const stats = useMemo(() => {
    if (!data) return null;
    const calcShares = (total: number, blog: number, cafe: number, news: number) => {
      const t = total > 0 ? total : 1;
      return { blog: Math.round((blog/t)*100), cafe: Math.round((cafe/t)*100), news: Math.round((news/t)*100) };
    };
    const cTotal = safeNumber(data.contentCount?.total);
    return {
      search: { total: safeNumber(data.searchCount?.total), pc: safeNumber(data.searchCount?.pc), mobile: safeNumber(data.searchCount?.mobile) },
      content: { total: cTotal, blog: safeNumber(data.contentCount?.blog), cafe: safeNumber(data.contentCount?.cafe), kin: safeNumber(data.contentCount?.kin), news: safeNumber(data.contentCount?.news), shares: calcShares(cTotal, safeNumber(data.contentCount?.blog), safeNumber(data.contentCount?.cafe), safeNumber(data.contentCount?.news)) },
      content30: data.content30,
      ratios: { devicePc: safeNumber(data.ratios?.device?.pc), deviceMobile: safeNumber(data.ratios?.device?.mobile), genderMale: safeNumber(data.ratios?.gender?.male), genderFemale: safeNumber(data.ratios?.gender?.female) },
      weeklyTrend: data.weeklyTrend, 
      monthlyTrend: data.monthlyTrend,
      googleVolume: googleVolume 
    };
  }, [data, googleVolume]);

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043]" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-10">
        <div className="max-w-7xl mx-auto">
          <RankTabs />
          <div className="mb-10"><h1 className="text-2xl font-normal text-gray-900">키워드 정밀 분석</h1></div>

          <div className="bg-white border border-gray-300 flex items-center mb-12 shadow-sm focus-within:border-blue-500 transition-all rounded-none max-w-3xl mx-auto w-full">
            <input 
              type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} 
              onKeyDown={(e) => e.key === "Enter" && handleSearch()} 
              className="flex-1 py-4 px-6 text-lg outline-none" placeholder="분석할 키워드를 입력하세요" 
            />
            <button onClick={() => handleSearch()} disabled={isSearching} 
              className={`px-12 py-5 font-bold transition-all disabled:opacity-60 ${isCompleted ? 'bg-green-600 hover:bg-green-700' : 'bg-[#1a73e8] hover:bg-blue-700'} text-white`}
            >
              {isSearching ? "분석 중..." : isCompleted ? "키워드 분석 완료" : "키워드 분석 실행"}
            </button>
          </div>

          {stats && (
            <div className="space-y-10">
              <SearchVolume stats={stats} />
              <ContentStats stats={stats} />
              <TrendCharts stats={stats} />
              <KeywordStrategy stats={stats} />
              <div className="grid grid-cols-2 gap-10 items-start">
                <RelatedKeywords data={data} onKeywordClick={handleSearch} />
                <SimilarityAnalysis data={data} mainKeyword={keyword} onKeywordClick={handleSearch} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}