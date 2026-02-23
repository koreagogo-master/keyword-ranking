'use client';

import { useMemo, useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation"; 
import Sidebar from "@/components/Sidebar";
import RankTabs from "@/components/RankTabs";
import SaveSnapshotButton from "@/components/SaveSnapshotButton";

// 컴포넌트 임포트
import SearchVolume from "./components/1_SearchVolume"; // 월간 검색량
import ContentStats from "./components/2_ContentStats"; // 콘텐츠 분석
import TrendCharts from "./components/3_TrendCharts"; // 검색 트렌드
import RelatedKeywords from "./components/4_RelatedKeywords"; // 연관 키워드
import SimilarityAnalysis from "./components/5_SimilarityAnalysis"; // 유사 키워드
import KeywordStrategy from "./components/6_KeywordStrategy"; // 키워드 성격
import SectionOrder from "./components/7_SectionOrder"; // 섹션 순서

function safeNumber(v: any) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function AnalysisContent() {
  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<any>(null);
  const [googleVolume, setGoogleVolume] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // 상단 연관검색어 저장 상태
  const [relatedKeywords, setRelatedKeywords] = useState<string[]>([]);

  const searchParams = useSearchParams();
  const router = useRouter(); 
  const urlKeyword = searchParams.get("keyword");

  useEffect(() => {
    if (urlKeyword && urlKeyword !== "") {
      executeSearch(urlKeyword);
    }
  }, [urlKeyword]);

  useEffect(() => {
    setIsCompleted(false);
  }, [keyword]);

  const executeSearch = async (k: string) => {
    setKeyword(k);
    setIsSearching(true);
    setIsCompleted(false);
    setData(null); 
    setRelatedKeywords([]); 
    setGoogleVolume(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const [naverRes, googleRes] = await Promise.all([
        fetch(`/api/keyword?keyword=${encodeURIComponent(k)}`),
        fetch('/api/google-ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: k }),
        })
      ]);

      const naverData = await naverRes.json();
      if (!naverRes.ok) throw new Error(naverData?.error || "네이버 데이터 로드 실패");

      let gVolume = 0;
      if (googleRes.ok) {
        const gData = await googleRes.json();
        gVolume = gData.monthlySearchVolume || 0;
      }
      
      setGoogleVolume(gVolume);
      setData({ ...naverData }); 
      setIsCompleted(true);
    } catch (e: any) {
      alert(e?.message || "데이터를 가져오는 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (targetKeyword?: string) => {
    const k = (typeof targetKeyword === 'string' ? targetKeyword : keyword).trim();
    if (!k) return;
    router.push(`/analysis?keyword=${encodeURIComponent(k)}`);
  };

  const stats = useMemo(() => {
    if (!data) return null;

    const calcShares = (total: number, blog: number, cafe: number, kin: number, news: number) => {
      const t = total > 0 ? total : 1;
      return { 
        blog: Math.round((blog / t) * 100), 
        cafe: Math.round((cafe / t) * 100), 
        kin: Math.round((kin / t) * 100), 
        news: Math.round((news / t) * 100) 
      };
    };

    const cTotal = safeNumber(data.contentCount?.total);
    
    return {
      keyword: keyword,
      search: { 
        total: safeNumber(data.searchCount?.total), 
        pc: safeNumber(data.searchCount?.pc), 
        mobile: safeNumber(data.searchCount?.mobile) 
      },
      content: { 
        total: cTotal, 
        blog: safeNumber(data.contentCount?.blog), 
        cafe: safeNumber(data.contentCount?.cafe), 
        kin: safeNumber(data.contentCount?.kin), 
        news: safeNumber(data.contentCount?.news), 
        shares: calcShares(
          cTotal, 
          safeNumber(data.contentCount?.blog), 
          safeNumber(data.contentCount?.cafe), 
          safeNumber(data.contentCount?.kin), 
          safeNumber(data.contentCount?.news)
        ) 
      },
      content30: data.content30,
      ratios: { 
        devicePc: safeNumber(data.ratios?.device?.pc), 
        deviceMobile: safeNumber(data.ratios?.device?.mobile), 
        genderMale: safeNumber(data.ratios?.gender?.male), 
        genderFemale: safeNumber(data.ratios?.gender?.female) 
      },
      weeklyTrend: data.weeklyTrend, 
      monthlyTrend: data.monthlyTrend,
      googleVolume: googleVolume
    };
  }, [data, googleVolume, keyword]);

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />

      <div 
        className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" 
        style={{ fontFamily: "'NanumSquare', sans-serif" }}
      >
        <Sidebar />
        
        {/* 🌟 2. 화면 우측 상단에 고정될 저장 버튼 부품을 끼워 넣습니다. */}
        <SaveSnapshotButton keyword={keyword} resultData={stats} pageName="키워드 분석" />

        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">
            <RankTabs />
            
            <div className="mb-10">
              <h1 className="text-2xl font-bold text-gray-900">
                {keyword ? `"${keyword}" 키워드 정밀 분석` : "키워드 정밀 분석"}
              </h1>
            </div>

            <div className="bg-white border border-gray-300 flex items-center mb-6 shadow-sm focus-within:border-blue-500 transition-all rounded-none max-w-3xl mx-auto w-full">
              <input 
                type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} 
                onKeyDown={(e) => e.key === "Enter" && handleSearch()} 
                className="flex-1 py-4 px-6 text-lg outline-none font-medium" 
                placeholder="분석할 키워드를 입력하세요" 
              />
              <button onClick={() => handleSearch()} disabled={isSearching} 
                className={`px-12 py-5 font-bold transition-all disabled:opacity-60 ${isCompleted ? 'bg-green-600 hover:bg-green-700' : 'bg-[#1a73e8] hover:bg-blue-700'} text-white`}
              >
                {isSearching ? "분석 중..." : isCompleted ? "키워드 분석 완료" : "키워드 분석 실행"}
              </button>
            </div>

            <div className="max-w-3xl mx-auto w-full mb-10 min-h-[100px] flex items-center justify-center">
              {isSearching ? (
                <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 bg-blue-200 rounded-full animate-bounce"></div>
                  <div className="w-2.5 h-2.5 bg-blue-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              ) : relatedKeywords.length > 0 ? (
                <div className="flex flex-wrap gap-2 justify-center">
                  {relatedKeywords.map((kw, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSearch(kw)}
                      className="text-[13px] px-4 py-1.5 bg-white border border-gray-200 rounded-full !text-slate-600 !font-bold hover:!border-blue-500 hover:!text-blue-600 transition-all shadow-sm"
                    >
                      #{kw}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-gray-400 text-sm font-bold">검색 결과에 연관 키워드가 있으면 이곳에 노출됩니다.</div>
              )}
            </div>

            {stats && (
              <div className="space-y-10">
                <SearchVolume stats={stats} />
                <ContentStats stats={stats} />
                <TrendCharts stats={stats} />

                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">키워드 성격 및 섹션</h2>
                  
                  {/* ✅ [레이아웃 수정] 
                    기존: flex + width 40%/60% -> 여백 포함 시 100% 초과 문제 발생
                    변경: grid grid-cols-3 (3등분) -> 1:1:1 비율로 완벽하게 정렬
                  */}
                  <div className="grid grid-cols-3 gap-8 items-start">
                    
                    {/* 1. 키워드 성격 분석 (1칸 차지) -> 33.3% */}
                    <div className="col-span-1">
                      <KeywordStrategy stats={stats} />
                    </div>
                    
                    {/* 2. 섹션 순서 (2칸 차지) -> 66.6% 
                      * SectionOrder 내부에서 다시 2등분 되므로, 결과적으로 PC/Mobile 각각 33.3%가 됨
                    */}
                    <div className="col-span-2">
                      <SectionOrder 
                        keyword={keyword} 
                        onKeywordsFound={setRelatedKeywords}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-10 items-start">
                  <RelatedKeywords data={data} onKeywordClick={handleSearch} />
                  <div className="space-y-10">
                    <SimilarityAnalysis data={data} mainKeyword={keyword} onKeywordClick={handleSearch} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold">로딩 중...</div>}>
      <AnalysisContent />
    </Suspense>
  );
}