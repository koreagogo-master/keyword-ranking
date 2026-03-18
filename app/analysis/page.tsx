'use client';

import { useMemo, useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import RankTabs from "@/components/RankTabs";

import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from '@/app/contexts/AuthContext';
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";

// 🌟 1. 마법의 포인트 스위치 가져오기
import { usePoint } from '@/app/hooks/usePoint'; 

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
  const { user } = useAuth();
  const { deductPoints } = usePoint(); 

  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<any>(null);
  const [googleVolume, setGoogleVolume] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const [relatedKeywords, setRelatedKeywords] = useState<string[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const urlKeyword = searchParams.get("keyword");

  useEffect(() => {
    if (urlKeyword && urlKeyword !== "") {
      executeSearch(urlKeyword, false); 
    }
  }, [urlKeyword]);

  useEffect(() => {
    setIsCompleted(false);
  }, [keyword]);

  const executeSearch = async (k: string, isPaid: boolean = true) => {
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

  const handleSearch = async (targetKeyword?: string) => {
    const k = (typeof targetKeyword === 'string' ? targetKeyword : keyword).trim();
    if (!k) return;

    // 🌟 핵심 업그레이드: 키워드(k) 변수를 끝에 추가로 던져서 DB에 기록을 남깁니다!
    const isPaySuccess = await deductPoints(user?.id, 10, 1, k);
    if (!isPaySuccess) return; 

    router.push(`/analysis?keyword=${encodeURIComponent(k)}`);
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
      page_type: 'ANALYSIS',
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

        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">
            <RankTabs />

            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {keyword ? `"${keyword}" 키워드 정밀 분석` : "키워드 정밀 분석"}
                </h1>
                <p className="text-sm text-slate-500">* 분석할 키워드를 입력하여 네이버 검색량 및 상세 지표를 확인하세요.</p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button 
                  onClick={handleSaveCurrentSetting}
                  disabled={!keyword || !user}
                  className={`px-4 py-2 text-sm font-bold text-white rounded-md shadow-sm flex items-center gap-1.5 transition-colors
                    ${(!keyword || !user) ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-800'}`}
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

            <div className="bg-white border border-gray-300 flex items-center mb-6 shadow-sm focus-within:border-indigo-500 transition-all rounded-sm max-w-4xl w-full">
              <input
                type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 py-4 px-6 text-lg outline-none font-medium text-gray-900"
                placeholder="분석할 키워드를 입력하세요"
              />
              <button onClick={() => handleSearch()} disabled={isSearching}
                className="px-12 py-5 font-bold transition-all disabled:opacity-60 bg-[#5244e8] hover:bg-[#4336c9] text-white"
              >
                {isSearching ? "분석 중..." : isCompleted ? "키워드 분석 완료" : "키워드 분석 실행"}
              </button>
            </div>

            <div className="max-w-4xl w-full mb-10 min-h-[40px] flex items-center justify-start">
              {isSearching ? (
                <div className="flex gap-2 ml-2">
                  <div className="w-2.5 h-2.5 bg-[#5244e8]/30 rounded-full animate-bounce"></div>
                  <div className="w-2.5 h-2.5 bg-[#5244e8]/60 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2.5 h-2.5 bg-[#5244e8] rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              ) : relatedKeywords.length > 0 ? (
                <div className="flex flex-wrap gap-2 justify-start">
                  {relatedKeywords.map((kw, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSearch(kw)}
                      className="text-[13px] px-4 py-1.5 bg-white border border-gray-200 rounded-full !text-slate-600 !font-bold hover:!border-violet-500 hover:!text-violet-600 transition-all shadow-sm"
                    >
                      #{kw}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-gray-400 text-sm font-bold ml-2">검색 결과에 연관 키워드가 있으면 이곳에 노출됩니다.</div>
              )}
            </div>

            {stats && (
              <div className="space-y-10">
                <SearchVolume stats={stats} />
                <ContentStats stats={stats} />
                <TrendCharts stats={stats} />

                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">키워드 성격 및 섹션</h2>

                  <div className="grid grid-cols-3 gap-8 items-start">
                    <div className="col-span-1">
                      <KeywordStrategy stats={stats} />
                    </div>
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

      <SavedSearchesDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        pageType="ANALYSIS"
        onSelect={handleApplySavedSetting}
      />
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