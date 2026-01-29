'use client';

import { useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import RankTabs from "@/components/RankTabs";

// 우리가 만든 조각(컴포넌트)들을 불러옵니다.
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

  const nanumSquare = { fontFamily: "'NanumSquare', sans-serif" };

  // 검색 실행 함수
  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/keyword?keyword=${encodeURIComponent(keyword)}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "데이터 로드 실패");
      setData(result);
    } catch (e: any) {
      alert(e?.message || "데이터를 가져오는 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  // 백엔드 데이터를 각 컴포넌트가 사용하기 좋게 가공합니다.
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
      search: {
        total: safeNumber(data.searchCount?.total),
        pc: safeNumber(data.searchCount?.pc),
        mobile: safeNumber(data.searchCount?.mobile),
      },
      content: {
        total: cTotal,
        blog: safeNumber(data.contentCount?.blog),
        cafe: safeNumber(data.contentCount?.cafe),
        kin: safeNumber(data.contentCount?.kin),
        news: safeNumber(data.contentCount?.news),
        shares: calcShares(cTotal, safeNumber(data.contentCount?.blog), safeNumber(data.contentCount?.cafe), safeNumber(data.contentCount?.kin), safeNumber(data.contentCount?.news))
      },
      content30: data.content30, // 백엔드에서 온 30일 추정치/리얼 수치
      ratios: {
        devicePc: safeNumber(data.ratios?.device?.pc),
        deviceMobile: safeNumber(data.ratios?.device?.mobile),
        genderMale: safeNumber(data.ratios?.gender?.male),
        genderFemale: safeNumber(data.ratios?.gender?.female),
      },
      weeklyTrend: data.weeklyTrend,
      monthlyTrend: data.monthlyTrend,
    };
  }, [data]);

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043]" style={nanumSquare}>
      <Sidebar />
      <main className="flex-1 ml-64 p-10">
        <div className="max-w-7xl mx-auto">
          <RankTabs />
          <div className="mb-10"><h1 className="text-2xl font-normal text-gray-900">키워드 정밀 분석</h1></div>

          {/* 검색창 섹션 */}
          <div className="bg-white border border-gray-300 flex items-center mb-12 shadow-sm focus-within:border-blue-500 transition-all rounded-none">
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
              className="bg-[#1a73e8] text-white px-12 py-5 font-bold hover:bg-blue-700 disabled:opacity-60"
            >
              {isSearching ? "분석 중..." : "데이터 분석 실행"}
            </button>
          </div>

          {/* 데이터가 있을 때만 조각들을 조립해서 보여줍니다. */}
          {stats && (
            <div className="space-y-10">
              {/* 1. 검색량 & 성별 비중 조각 */}
              <SearchVolume stats={stats} />

              {/* 2. 콘텐츠 분석 조각 (뉴스/지식인 리얼 수치 포함) */}
              <ContentStats stats={stats} />

              {/* 3. 트렌드 차트 조각 (월별/요일별 그래프) */}
              <TrendCharts stats={stats} />

              {/* 4. 연관 키워드 표 조각 */}
              <RelatedKeywords data={data} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}