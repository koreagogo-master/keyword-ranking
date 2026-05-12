"use client";

import { useState, Suspense } from "react";
import AiTabs from "@/components/AiTabs";
import { useAuth } from "@/app/contexts/AuthContext";
import { usePoint } from "@/app/hooks/usePoint";
import HelpButton from "@/components/HelpButton";
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";
import { createClient } from "@/app/utils/supabase/client";

function AiInsightContent() {
  const { user } = useAuth();
  const { deductPoints } = usePoint();

  const [keyword, setKeyword] = useState("");
  // 🔧 Fix #2: stable key를 위해 {id, value} 구조로 관리
  const [urls, setUrls] = useState<{id: number; value: string}[]>(
    () => [{ id: Date.now(), value: '' }, { id: Date.now() + 1, value: '' }]
  );
  const nextId = { current: Date.now() + 2 };
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [selectedStatIdx, setSelectedStatIdx] = useState<number | null>(null);
  const [isStatModalOpen, setIsStatModalOpen] = useState(false);
  const [isResetToastOpen, setIsResetToastOpen] = useState(false);

  const handleUrlChange = (index: number, value: string) => {
    setUrls(prev => prev.map((u, i) => i === index ? { ...u, value } : u));
    setIsAnalyzed(false);
  };

  const handleRemoveUrl = (index: number) => {
    setUrls(prev => prev.filter((_, i) => i !== index));
    setIsAnalyzed(false);
  };

  const handleReset = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setKeyword("");
    setUrls([{ id: Date.now(), value: '' }, { id: Date.now() + 1, value: '' }]);
    setIsAnalyzed(false);
    setResult(null);
    setErrorMsg("");
    setIsResetToastOpen(true);
    setTimeout(() => setIsResetToastOpen(false), 1500);
  };

  const handleSaveCurrentSetting = async () => {
    if (!user) { alert('로그인 정보가 확인되지 않습니다.'); return; }
    if (!keyword.trim()) { alert('저장할 키워드를 먼저 입력해 주세요.'); return; }
    const title = prompt('저장할 항목의 이름을 입력하세요:', `[${keyword}] 인사이트`);
    if (!title) return;
    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user.id,
      page_type: 'AI_INSIGHT',
      nickname: '',
      keyword: title,
      settings: { keyword, urls: urls.map(u => u.value) }
    });
    if (!error) { setSaveToast(true); setTimeout(() => setSaveToast(false), 3000); }
    else alert(`저장 실패: ${error.message}`);
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false);
    const settings = typeof item.settings === 'string' ? JSON.parse(item.settings) : (item.settings || {});
    if (settings.keyword) setKeyword(settings.keyword);
    if (settings.urls && Array.isArray(settings.urls)) {
      const loadedUrls = settings.urls.filter(Boolean);
      while (loadedUrls.length < 2) loadedUrls.push('');
      setUrls(loadedUrls.slice(0, 5));
    }
  };

  const handleAnalyze = async () => {
    setErrorMsg("");
    setResult(null);
    setIsAnalyzed(false);

    // 🔧 Fix #2: value만 추출
    const validUrls = urls.map(u => u.value).filter((u) => u.trim() !== "");

    if (!keyword.trim()) {
      setErrorMsg("타겟 검색 키워드를 입력해주세요.");
      return;
    }
    if (validUrls.length < 2) {
      setErrorMsg("비교 분석을 위해 최소 2개의 URL을 입력해주세요.");
      return;
    }

    if (!user) {
      setErrorMsg("로그인이 필요한 서비스입니다.");
      return;
    }

    // 🔧 Fix #1: 포인트 먼저 차감 후, API 실패 시 롤백
    let pointDeducted = false;
    if (deductPoints) {
      const isPaySuccess = await deductPoints(user.id, 100, 1, `[${keyword}] 검색 (1건)`);
      if (!isPaySuccess) return;
      pointDeducted = true;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, urls: validUrls }),
      });

      // 🔧 Fix #3: HTML 에러 페이지가 내려올 경우 JSON 파싱 오류 방어
      let data: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`서버 응답 오류 (${response.status}): 잠시 후 다시 시도해 주세요.`);
      }

      if (!response.ok) {
        // 🔧 Fix #1: API 실패 시 포인트 롤백 (환불)
        if (pointDeducted && deductPoints) {
          await deductPoints(user.id, -100, 0, `[${keyword}] 분석 실패 포인트 환불`);
        }
        throw new Error(data?.error || '분석 중 오류가 발생했습니다.');
      }

      setResult(data);
      setIsAnalyzed(true);
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />

      <title>AI 포스팅 인사이트 | 랭킹프로</title>

      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        <main className="flex-1 ml-64 p-10">
          <div className="max-w-[1400px] mx-auto">
            <AiTabs />

            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">AI 포스팅 인사이트</h1>
                  <HelpButton
                    href="https://blog.naver.com/lboll/224267680747"
                    tooltip="도움말"
                  />
                </div>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  타겟 키워드를 선점한 상위 문서 2~5개를 교차 분석하여, 차별화된 SEO 노출 로직과 단계별 포스팅 가이드라인을 역엔지니어링합니다.<br />
                  <span className="text-[#5244e8] font-bold mt-1 inline-block">※ 해당 키워드로 실제 네이버 검색 시 상위에 노출된 블로그 포스팅의 주소(URL)를 입력해 주세요.</span>
                </p>
              </div>
              {/* 우측 상단 저장/목록 버튼 */}
              <div className="flex items-center gap-2 mt-1 shrink-0">
                {saveToast && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md">✓ 저장되었습니다</span>
                )}
                <button
                  onClick={handleSaveCurrentSetting}
                  disabled={!keyword.trim()}
                  className={`px-4 py-2 text-sm font-bold text-white rounded-md shadow-sm transition-colors flex items-center gap-1.5 ${keyword.trim()
                    ? 'bg-slate-700 hover:bg-slate-800 cursor-pointer'
                    : 'bg-slate-400 cursor-not-allowed opacity-60'
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg> 현재 설정 저장
                </button>
                <button onClick={() => setIsDrawerOpen(true)} className="px-4 py-2 text-sm font-bold text-white bg-slate-700 rounded-md hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg> 저장된 목록 보기
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start relative w-full">
              {/* 좌측 1/3: 입력 섹션 (Sticky 고정) */}
              <div className="col-span-1 sticky top-[100px] self-start z-30 space-y-4">
                <div className="bg-white border border-gray-200 shadow-md rounded-lg p-5">
                  <div className="flex flex-col">
                    {/* 1열: 타겟 검색 키워드 */}
                    <div className="border-b border-gray-100 pb-5 mb-5">
                      <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        검색 키워드
                        <span className="text-xs text-red-500 font-normal ml-1">*필수</span>
                      </h3>
                      <div className="flex flex-col gap-3">
                        <div className="w-full">
                          <input
                            type="text"
                            value={keyword}
                            onChange={(e) => {
                              setKeyword(e.target.value);
                              setIsAnalyzed(false);
                            }}
                            className="w-full py-2.5 px-3 border border-indigo-200 rounded-md outline-none text-sm focus:border-[#5244e8] transition-colors bg-indigo-50/50 focus:bg-white"
                            placeholder="예: 강남역 맛집"
                          />
                        </div>
                        <p className="text-[12px] text-gray-500 font-medium">※ AI가 이 키워드를 중심으로 공통점을 분석합니다.</p>
                      </div>
                    </div>

                    {/* URL 입력 목록 (동적 배열) */}
                    <div className="flex flex-col gap-5 w-full">
                      {/* 🔧 Fix #2: stable key (id 기반) */}
                      {urls.map((urlItem, idx) => (
                        <div key={urlItem.id} className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-[#5244e8]/10 text-[#5244e8] flex items-center justify-center text-[10px] font-extrabold">{idx + 1}</span>
                              포스팅 URL {idx + 1}
                              {idx < 2 ? (
                                <span className="text-xs text-red-500 font-normal ml-1">*필수</span>
                              ) : (
                                <span className="text-xs text-slate-400 font-normal ml-1">(선택)</span>
                              )}
                            </div>
                          </h3>
                          {isAnalyzed && result?.individualStats?.[idx] && (
                            <p className="text-[13px] text-slate-800 font-bold mb-2 truncate" title={result.individualStats[idx].title}>
                              {result.individualStats[idx].title}
                            </p>
                          )}
                          <div className="relative">
                            <input
                              type="text"
                              value={urlItem.value}
                              onChange={(e) => handleUrlChange(idx, e.target.value)}
                              className="w-full py-2.5 pl-3 pr-10 border border-gray-300 rounded-md outline-none text-sm focus:border-[#5244e8] transition-colors bg-slate-50 focus:bg-white"
                              placeholder="https://blog.naver.com/..."
                            />
                            {idx >= 2 && (
                              <button
                                onClick={() => handleRemoveUrl(idx)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md bg-white border border-gray-200 !text-[#5244e8] hover:border-red-400 hover:!text-red-500 transition-colors"
                                title="URL 삭제"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          {/* 분석 완료 시 개별 결과 버튼 */}
                          {isAnalyzed && result?.individualStats?.[idx] && (
                            <div className="mt-2 flex items-center justify-end gap-2">
                              <button
                                onClick={() => { setSelectedStatIdx(idx); setIsStatModalOpen(true); }}
                                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-[#5244e8] text-white text-[12px] font-bold rounded-md hover:bg-indigo-700 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                분석결과
                              </button>
                              <a
                                href={result.individualStats[idx].url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-slate-600 text-[12px] font-bold rounded-md hover:border-slate-700 hover:text-slate-800 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                원본 글 보기
                              </a>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* 포스팅 추가 버튼 (최대 5개까지) */}
                      {urls.length < 5 && (
                        <button
                          onClick={() => {
                            // 🔧 Fix #2: 새 항목도 고유 id 부여
                            setUrls(prev => [...prev, { id: Date.now(), value: '' }]);
                            setIsAnalyzed(false);
                          }}
                          className="w-full py-2.5 px-3 bg-white border border-gray-300 !text-[#5244e8] text-[13px] font-extrabold rounded-md hover:border-[#5244e8] hover:bg-slate-50 transition-colors flex items-center justify-center shadow-sm"
                        >
                          + 포스팅 추가
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-center w-full gap-3">
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || isAnalyzed || !keyword.trim() || urls.filter(u => u.value.trim()).length < 2}
                    className={`px-12 py-4 rounded-lg font-bold text-[15px] shadow-sm flex items-center justify-center gap-2 transition-all ${isAnalyzing || !keyword.trim() || urls.filter(u => u.value.trim()).length < 2
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : isAnalyzed
                        ? 'bg-emerald-600 text-white cursor-default shadow-emerald-200'
                        : 'bg-[#5244e8] hover:bg-indigo-700 text-white'
                      }`}
                  >
                    {isAnalyzing ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        AI 정밀 분석 중... (약 20~30초 소요)
                      </>
                    ) : isAnalyzed ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        분석 완료
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        AI 포스팅 인사이트 분석
                      </>
                    )}
                  </button>
                  {isAnalyzed && (
                    <button
                      onClick={handleReset}
                      className="px-6 py-4 rounded-lg font-extrabold text-[15px] shadow-sm flex items-center justify-center gap-2 transition-all bg-slate-100 !text-[#5244e8] border border-slate-200 hover:bg-indigo-50 hover:border-[#5244e8]"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      초기화
                    </button>
                  )}
                </div>

                {errorMsg && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg font-bold flex items-center gap-2">
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {errorMsg}
                  </div>
                )}
              </div>

              {/* 우측 2/3: 결과 섹션 */}
              <div className="lg:col-span-2 w-full relative min-h-[500px]">
                {isAnalyzing ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm z-20 border-2 border-indigo-100 rounded-xl rounded-tl-none border-dashed">
                    <div className="w-16 h-16 border-4 border-indigo-100 border-t-[#5244e8] rounded-full animate-spin mb-6"></div>
                    <h3 className="text-lg font-extrabold text-gray-800 mb-2">벤치마킹 데이터를 수집하고 있습니다</h3>
                    <p className="text-sm text-slate-500 max-w-sm text-center">작성된 글의 길이와 AI 토큰 양에 따라 최대 20~30초가 소요될 수 있습니다. 잠시만 기다려주세요.</p>
                  </div>
                ) : !result ? (
                  <div className="h-[400px] border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-slate-400 bg-white/50 p-10 text-center">
                    <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    <p className="font-bold text-slate-500 mb-1 text-lg">상위 노출 전략을 벤치마킹합니다.</p>
                    <p className="text-sm">좌측에 키워드와 URL을 입력하고 분석 버튼을 눌러주세요.</p>
                  </div>
                ) : (
                  <div className="space-y-6 animate-fadeIn relative z-10">


                    {/* 1. AI 최종 벤치마킹 가이드 */}
                    <div className="bg-indigo-50/30 border border-indigo-200 shadow-sm rounded-xl overflow-hidden relative mb-6 h-full">
                      {/* 헤더 - AVG/KW/SEQ 카드와 동일한 구조 */}
                      <div className="p-4 bg-indigo-100/70 border-b border-indigo-200 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-200 text-indigo-700 font-extrabold text-[11px]">AI</span>
                        <h3 className="text-[15px] font-bold text-gray-900">작성 Guide</h3>
                      </div>
                      {/* 내용 */}
                      <div className="p-6 space-y-3">
                        {/* 🔧 Fix #4: 빈 배열도 안내 문구로 처리 */}
                        {Array.isArray(result?.finalInsights) && result.finalInsights.length > 0 ? (
                          result.finalInsights.map((insight: any, i: number) => (
                            <p key={i} className="text-[14px] text-slate-800 font-medium leading-relaxed break-keep">
                              <strong className="text-[#5244e8] font-extrabold mr-1">「{insight?.title}」</strong>
                              {insight?.content}
                            </p>
                          ))
                        ) : result?.finalInsight ? (
                          result.finalInsight
                            ?.split('\n')
                            .filter((line: string) => line.trim() !== '')
                            .map((line: string, i: number) => (
                              <p key={i} className="text-[14px] text-slate-800 font-medium leading-relaxed break-keep">
                                {line}
                              </p>
                            ))
                        ) : (
                          <p className="text-[13px] text-slate-400 py-2">AI 가이드를 불러오지 못했습니다. 다시 분석해 주세요.</p>
                        )}
                      </div>
                    </div>

                    {/* 2. 추천 공통 작성 흐름 */}
                    {result.commonTimeline && result.commonTimeline.length > 0 && (
                      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden mb-6">
                        <div className="p-4 bg-slate-50 border-b border-gray-200 flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-extrabold text-[11px]">SEQ</span>
                          <h3 className="text-[15px] font-bold text-gray-900">추천 Flow</h3>
                        </div>
                        <div className="p-6 space-y-4">
                          {result.commonTimeline.map((step: any, idx: number) => (
                            <div key={idx} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-[11px] shrink-0 border border-orange-200">
                                  {idx + 1}
                                </div>
                                {idx !== result.commonTimeline.length - 1 && <div className="w-px h-full bg-orange-100 mt-1"></div>}
                              </div>
                              <div className="pb-4">
                                <h5 className="font-extrabold text-slate-800 text-[15px] mb-1">{step.step}</h5>
                                <p className="text-[14px] text-slate-700 font-medium leading-relaxed">{step.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. 상위 노출 평균 목표치 */}
                    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden mb-6">
                      <div className="p-4 bg-slate-50 border-b border-gray-200 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-[11px]">AVG</span>
                        <h3 className="text-[15px] font-bold text-gray-900">평균 Data</h3>
                      </div>
                      <div className="p-6 flex flex-wrap gap-4 justify-center">
                        <div className="text-center px-6 py-3 bg-indigo-50/50 rounded-lg border border-indigo-100 w-full sm:w-auto">
                          <div className="text-[11px] font-bold text-indigo-500 mb-1">평균 글자수</div>
                          {/* 🔧 Fix #4: optional chaining으로 화이트스크린 방지 */}
                          <div className="text-[18px] font-extrabold text-indigo-700">{result?.averages?.textLength?.toLocaleString() ?? '-'}자</div>
                        </div>
                        <div className="text-center px-6 py-3 bg-indigo-50/50 rounded-lg border border-indigo-100 w-full sm:w-auto">
                          <div className="text-[11px] font-bold text-indigo-500 mb-1">평균 이미지 수</div>
                          <div className="text-[18px] font-extrabold text-indigo-700">{result?.averages?.imageCount ?? '-'}장</div>
                        </div>
                        <div className="text-center px-6 py-3 bg-indigo-50/50 rounded-lg border border-indigo-100 w-full sm:w-auto">
                          <div className="text-[11px] font-bold text-indigo-500 mb-1">평균 키워드 반복</div>
                          <div className="text-[18px] font-extrabold text-indigo-700">{result?.averages?.keywordCount ?? '-'}회</div>
                        </div>
                      </div>
                    </div>

                    {/* 4. 공통 핵심 서브 키워드 */}
                    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden mb-6">
                      <div className="p-4 bg-slate-50 border-b border-gray-200 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[11px]">KW</span>
                        <h3 className="text-[15px] font-bold text-gray-900">Sub Keyword</h3>
                      </div>
                      <div className="p-6">
                        <p className="text-[13px] text-gray-800 font-medium mb-3">* 상위 노출 포스팅에 공통적으로 등장하는 서브 키워드입니다. 본문에 자연스럽게 포함시키면 노출 가능성이 높아집니다.</p>
                        <div className="flex flex-wrap gap-2">
                          {result.commonKeywords.map((kw: string, idx: number) => (
                            <span key={idx} className="px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[13px] font-bold shadow-sm">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      <SavedSearchesDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        pageType={"AI_INSIGHT" as any}
        onSelect={handleApplySavedSetting}
      />

      {/* ── 개별 포스팅 분석 모달 ── */}
      {isStatModalOpen && selectedStatIdx !== null && result?.individualStats?.[selectedStatIdx] && (() => {
        const stat = result.individualStats[selectedStatIdx];
        const timeline = result.individualTimelines?.[selectedStatIdx] ?? [];
        return (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            onClick={() => setIsStatModalOpen(false)}
          >
            {/* 오버레이 */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            {/* 모달 창 */}
            <div
              className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-8 max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 헤더 */}
              <div className="flex items-start justify-between gap-4 px-8 py-6 bg-slate-50 border-b border-gray-200 shrink-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-[#5244e8] uppercase tracking-widest mb-1">블로그 {selectedStatIdx + 1} · 개별 분석 결과</p>
                  <h2 className="text-[17px] font-extrabold text-gray-900 leading-snug" title={stat.title}>{stat.title}</h2>
                </div>

              </div>

              {/* 모달 바디 (스크롤 가능) */}
              <div className="overflow-y-auto flex-1 px-8 py-7 space-y-8">

                {/* 기본 지표 */}
                <div>
                  <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest mb-4">기본 지표</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center px-4 py-5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                      <div className="text-[11px] font-bold text-indigo-500 mb-1">총 글자수</div>
                      <div className="text-[22px] font-extrabold text-indigo-700">{stat.textLength.toLocaleString()}<span className="text-[13px] font-bold ml-1">자</span></div>
                    </div>
                    <div className="text-center px-4 py-5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                      <div className="text-[11px] font-bold text-indigo-500 mb-1">이미지 수</div>
                      <div className="text-[22px] font-extrabold text-indigo-700">{stat.imageCount}<span className="text-[13px] font-bold ml-1">장</span></div>
                    </div>
                    <div className="text-center px-4 py-5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                      <div className="text-[11px] font-bold text-indigo-500 mb-1">키워드 반복</div>
                      <div className="text-[22px] font-extrabold text-indigo-700">{stat.keywordCount}<span className="text-[13px] font-bold ml-1">회</span></div>
                    </div>
                  </div>
                </div>

                {/* 작성 흐름 */}
                <div>
                  <h3 className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest mb-4">작성 흐름 (목차 구조)</h3>
                  {timeline.length > 0 ? (
                    <div className="space-y-0">
                      {timeline.map((step: any, stepIdx: number) => (
                        <div key={stepIdx} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-7 h-7 rounded-full bg-[#5244e8] text-white flex items-center justify-center font-extrabold text-[11px] shrink-0 shadow">
                              {stepIdx + 1}
                            </div>
                            {stepIdx !== timeline.length - 1 && (
                              <div className="w-px flex-1 bg-indigo-100 my-1" />
                            )}
                          </div>
                          <div className="pb-6 flex-1">
                            <h5 className="font-extrabold text-slate-800 text-[14px] mb-1">{step.step}</h5>
                            <p className="text-[13px] text-slate-600 leading-relaxed">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-slate-400 py-4">목차 흐름을 추출하지 못했습니다.</p>
                  )}
                </div>
              </div>

              {/* 모달 푸터 */}
              <div className="px-8 py-4 bg-slate-50 border-t border-gray-200 flex justify-end shrink-0">
                <button
                  onClick={() => setIsStatModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold rounded-lg transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 초기화 완료 안내 팝업 (자동 닫힘) ── */}
      {isResetToastOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
          <div className="bg-gray-900/90 backdrop-blur-sm text-white px-8 py-5 rounded-2xl shadow-2xl flex flex-col items-center gap-3 animate-[fadeIn_0.2s_ease-out,fadeOut_0.3s_ease-in_1.2s_forwards]">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-[15px] font-bold tracking-wide">입력 데이터가 초기화 되었습니다.</p>
          </div>
        </div>
      )}
    </>
  );
}

export default function AiInsightPage() {
  return (
    <Suspense fallback={<div className="p-10 flex justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <AiInsightContent />
    </Suspense>
  );
}
