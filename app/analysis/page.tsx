'use client';

import { useMemo, useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation"; // ✅ useRouter 추가
import Sidebar from "@/components/Sidebar";
import RankTabs from "@/components/RankTabs";

// 컴포넌트 임포트
import SearchVolume from "./components/1_SearchVolume"; // 월간 검색량, PC / Mobile 비중 / 성별 검색 비중
import ContentStats from "./components/2_ContentStats"; // 콘텐츠 분석 / 최근 30일 신규 발행 콘텐츠 / 전체(누적) & 플랫폼별 구성
import TrendCharts from "./components/3_TrendCharts"; // 검색 관심도(트렌드) / 연간 검색 비율 (월별 %) / 요일별 분포 (단위: 요일)
import RelatedKeywords from "./components/4_RelatedKeywords"; // 연관 키워드 분석 (조회수 기준)
import SimilarityAnalysis from "./components/5_SimilarityAnalysis"; // 유사 키워드 분석 (유사도 기준)
import KeywordStrategy from "./components/6_KeywordStrategy"; // 키워드 성격 분석 (3각 표)
import SectionOrder from "./components/7_SectionOrder"; // pc 섹션 / MOBILE 섹션

function safeNumber(v: any) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function AnalysisContent() {
  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<any>(null);
  const [googleVolume, setGoogleVolume] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // ✅ [추가] 상단 연관검색어 버튼들을 저장할 상태
  const [relatedKeywords, setRelatedKeywords] = useState<string[]>([]);

  const searchParams = useSearchParams();
  const router = useRouter(); // ✅ 라우터 객체 생성
  const urlKeyword = searchParams.get("keyword");

  // ✅ URL 키워드 변경 감지 및 검색 실행
  useEffect(() => {
    if (urlKeyword && urlKeyword !== "") {
      executeSearch(urlKeyword);
    }
  }, [urlKeyword]);

  useEffect(() => {
    setIsCompleted(false);
  }, [keyword]);

  // ✅ 실제 검색 로직 수행 함수
  const executeSearch = async (k: string) => {
    setKeyword(k);
    setIsSearching(true);
    setIsCompleted(false);
    
    // ✅ 새로운 검색 시작 시 기존 데이터 및 연관검색어 초기화
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

  // ✅ 검색 버튼 클릭 또는 연관 키워드 클릭 시 실행
  const handleSearch = (targetKeyword?: string) => {
    const k = (typeof targetKeyword === 'string' ? targetKeyword : keyword).trim();
    if (!k) return;

    // ✅ URL 주소창을 변경하여 검색을 유도합니다.
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
    <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043]" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
      <Sidebar />
      <main className="flex-1 ml-64 p-10">
        <div className="max-w-7xl mx-auto">
          <RankTabs />
          
          <div className="mb-10">
            <h1 className="text-2xl font-normal text-gray-900">
              {keyword ? `"${keyword}" 키워드 정밀 분석` : "키워드 정밀 분석"}
            </h1>
          </div>

          <div className="bg-white border border-gray-300 flex items-center mb-6 shadow-sm focus-within:border-blue-500 transition-all rounded-none max-w-3xl mx-auto w-full">
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

          {/* ✅ [신규] 상단 연관검색어 버튼 나열 섹션 */}
          {relatedKeywords.length > 0 && (
            <div className="max-w-3xl mx-auto w-full mb-10 flex flex-wrap gap-2 justify-center">
              {relatedKeywords.map((kw, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(kw)}
                  className="text-[12px] px-3 py-1 bg-white border border-gray-200 rounded-full text-gray-800 hover:border-blue-500 hover:text-blue-500 transition-all shadow-sm"
                >
                  #{kw}
                </button>
              ))}
            </div>
          )}

          {stats && (
            <div className="space-y-10">
              <SearchVolume stats={stats} />
              <ContentStats stats={stats} />
              <TrendCharts stats={stats} />

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">키워드 성격 및 섹션</h2>
                <div className="flex gap-8 items-start">
                  <div className="w-[40%] flex-none">
                    <KeywordStrategy stats={stats} />
                  </div>
                  <div className="w-[60%] flex-none">
                    {/* ✅ onKeywordsFound를 통해 7번 파일로부터 연관검색어 목록을 받습니다. */}
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
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">로딩 중...</div>}>
      <AnalysisContent />
    </Suspense>
  );
}