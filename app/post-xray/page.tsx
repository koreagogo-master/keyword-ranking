"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import AiTabs from "@/components/AiTabs";
import { useAuth } from "@/app/contexts/AuthContext";
import { usePoint } from "@/app/hooks/usePoint";
import { createClient } from "@/app/utils/supabase/client";
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";
import HelpButton from "@/components/HelpButton";

function PostXRayContent() {
  const { user } = useAuth();
  const { deductPoints } = usePoint();

  const [url, setUrl] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  const searchParams = useSearchParams();
  const historyId = searchParams.get('id');

  useEffect(() => {
    if (historyId) {
      const fetchHistoryData = async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from('saved_searches')
          .select('settings')
          .eq('id', historyId)
          .single();

        if (data && data.settings) {
          const settings = typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings;
          if (settings.url) {
            setUrl(settings.url);
          }
        }
      };
      fetchHistoryData();
    }
  }, [historyId]);

  const handleSaveCurrentSetting = async () => {
    if (!user) {
      alert('로그인 정보가 만료되었거나 확인할 수 없습니다. 다시 로그인해주세요.');
      return;
    }
    if (!url.trim()) {
      alert("저장할 대상 URL을 먼저 입력해 주세요.");
      return;
    }

    const title = prompt("저장할 항목의 이름을 입력하세요:", "경쟁사 벤치마킹 URL");
    if (!title) return;

    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user.id,
      page_type: 'POST_XRAY',
      nickname: '',
      keyword: title,
      settings: { url }
    });

    if (!error) {
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } else {
      alert(`저장 실패: ${error.message}`);
    }
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false);
    const settings = typeof item.settings === 'string' ? JSON.parse(item.settings) : (item.settings || {});
    if (settings.url) {
      setUrl(settings.url);
    }
  };

  const handleAnalyze = async () => {
    if (!url.trim()) {
      alert("네이버 블로그 URL을 입력해 주세요.");
      return;
    }
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }

    setErrorMsg("");
    setIsAnalyzing(true);
    setResult(null);

    // 포인트 차감 (20P 설정)
    const isPaySuccess = await deductPoints(user.id, 20, 1, "포스팅 X-Ray 분석");
    if (!isPaySuccess) {
      setIsAnalyzing(false);
      return;
    }

    try {
      const response = await fetch("/api/post-xray", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), searchKeyword: searchKeyword.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "분석 중 오류가 발생했습니다.");
      }

      setResult(data.data);
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAnalyze();
  };

  const handleCopyResult = () => {
    if (!result) return;
    const hashtags = result.hashtags && result.hashtags.length > 0
      ? `\n■ 작성자 직접 입력 해시태그\n${result.hashtags.map((t: string) => `#${t}`).join('  ')}`
      : '';
    const subKeywords = result.analysis.subKeywords?.join('  /  ') || '';
    const text = [
      `[ 포스팅 X-Ray 분석 결과 ]`,
      `분석 URL: ${url}`,
      `원본 제목: ${result.title}`,
      `글자수: 약 ${result.textLength.toLocaleString()}자  |  이미지: ${result.imageCount}장`,
      ``,
      `■ 메인 타겟 키워드`,
      `${result.analysis.targetKeyword}${result.analysis.mainKeywordCount !== undefined ? ` (본문 내 ${result.analysis.mainKeywordCount}회 사용)` : ''}`,
      ``,
      `■ AI 추론 연관 키워드`,
      subKeywords,
      hashtags,
      ``,
      `■ 포스팅 전달 가치`,
      result.analysis.contentFocus,
      ``,
      `■ 작성자 SEO 전략`,
      result.analysis.strategy,
      ``,
      `■ 따라쓰기 치트시트`,
      `제목 구성: "${result.analysis.targetKeyword}"을 제목 맨 앞이나 핵심 위치에 배치`,
      `목표 글자수: 약 ${Math.round(result.textLength / 100) * 100}자 내외`,
      `권장 이미지: ${result.imageCount}장 내외`,
      `메인 키워드: "${result.analysis.targetKeyword}" — 원본 ${result.analysis.mainKeywordCount ?? '?'}회 사용 / 유사 횟수 유지 권장`,
      `서브 키워드: ${subKeywords}`,
      `글쓰기 전략: 공감(문제 제기) → 정보 심화 → 해결책 제시`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 3000);
    });
  };

  return (
    <>
      {saveToast && (
        <div className="fixed top-24 right-12 z-[9999] flex items-center gap-3 bg-[#5244e8]/80 text-white text-[15px] font-bold px-7 py-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(82,68,232,0.6)] border border-indigo-400/30 animate-fade-in-down backdrop-blur-sm">
          <svg className="w-6 h-6 text-indigo-100 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          현재 설정이 성공적으로 저장되었습니다.
        </div>
      )}
      {copyToast && (
        <div className="fixed top-24 right-12 z-[9999] flex items-center gap-3 bg-slate-700/90 text-white text-[15px] font-bold px-7 py-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-slate-500/30 animate-fade-in-down backdrop-blur-sm">
          <svg className="w-6 h-6 text-slate-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          분석 결과가 클립보드에 복사되었습니다.
        </div>
      )}

      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />

      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">
            <AiTabs />

            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">포스팅 X-Ray (경쟁사 분석)</h1>
                  <HelpButton
                    href="https://blog.naver.com/lboll/224267680747"
                    tooltip="도움말"
                  />
                </div>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  네이버 블로그 포스팅 URL을 입력하면, 상위 노출을 위해 숨겨진 타겟 키워드와 작성 전략을 AI가 역엔지니어링하여 분석합니다.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1 shrink-0">
                <button
                  onClick={handleSaveCurrentSetting}
                  disabled={!url.trim()}
                  className={`px-4 py-2 text-sm font-bold text-white rounded-md shadow-sm transition-colors flex items-center gap-1.5 ${url.trim()
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

            <div className="flex flex-col lg:flex-row gap-8 items-start relative">
              {/* 왼쪽: 입력 섹션 */}
              <div className="w-full lg:w-[380px] sticky top-[64px] z-30 space-y-4">
                <div className="bg-white border border-gray-200 shadow-md rounded-lg p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-[#5244e8]/10 text-[#5244e8] flex items-center justify-center text-[10px] font-extrabold">URL</span>
                    블로그 포스팅 URL
                  </h3>
                  <input
                    type="text"
                    value={url}
                    onKeyDown={handleKeyDown}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full py-2.5 px-3 border border-gray-300 rounded-md outline-none text-sm focus:border-[#5244e8] transition-colors"
                    placeholder="예: https://blog.naver.com/id/12345"
                  />
                  <p className="text-[11px] text-gray-400 mt-2 font-medium">※ 네이버 블로그 URL만 지원합니다.</p>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-extrabold">KW</span>
                      검색 키워드
                      <span className="text-[10px] font-normal text-slate-400">(선택)</span>
                    </h3>
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full py-2.5 px-3 border border-gray-300 rounded-md outline-none text-sm focus:border-[#5244e8] transition-colors"
                      placeholder="예: 손전등, 천안 다이어트한약"
                    />
                    <p className="text-[11px] text-gray-400 mt-2 font-medium">※ 이 글을 발견한 검색어를 입력하면 분석 정확도가 높아집니다.</p>
                  </div>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full py-3.5 font-bold bg-[#5244e8] hover:bg-[#4336c9] text-white rounded-lg transition-colors shadow-md disabled:opacity-70 flex justify-center items-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      X-Ray 분석 중...
                    </>
                  ) : (
                    "타겟 키워드 역추적"
                  )}
                </button>

                {/* 네이버 상위노출 요인 안내 */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2.5">
                    네이버 블로그 상위노출 주요 영향 요인
                  </p>
                  <ul className="space-y-1.5">
                    {[
                      { text: "블로그 지수 (이웃수, 방문자수, 공감수, 댓글 수)" },
                      { text: "C-Rank (블로그 전체 신뢰도)" },
                      { text: "D.I.A+ (콘텐츠 품질 AI 평가)" },
                      { text: "체류 시간, 재방문율" },
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[12px] text-slate-600 font-medium">
                        <span className="shrink-0 mt-px text-slate-400">-</span>
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg font-medium">
                    오류: {errorMsg}
                  </div>
                )}
              </div>

              {/* 오른쪽: 분석 결과 섹션 */}
              <div className="flex-1 w-full min-h-[400px]">
                {!result ? (
                  <div className="h-[400px] border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-slate-400 bg-white/50 p-10 text-center">
                    <svg className="w-12 h-12 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <p className="font-medium text-slate-500 mb-1">분석할 포스팅의 URL을 입력해주세요.</p>
                    <p className="text-sm">약 5~10초의 AI 분석 시간이 소요됩니다.</p>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden animate-fadeIn">

                    {/* 상단 헤더 영역 (원문 정보) */}
                    <div className="p-6 bg-slate-50 border-b border-gray-200">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">원본 포스팅 정보</h3>
                          <h2 className="text-[16px] font-extrabold text-gray-900 leading-snug">{result.title}</h2>
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:border-[#5244e8] hover:text-[#5244e8] text-gray-600 text-[13px] font-bold rounded-lg shadow-sm transition-colors"
                        >
                          원본 글 보기
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>

                    {/* 핵심 키워드 영역 */}
                    <div className="p-8">
                      <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-700 font-extrabold text-[11px]">01</span>
                          <h3 className="text-base font-bold text-gray-900">메인 타겟 키워드</h3>
                        </div>
                        <div className="p-5 bg-red-50 border border-red-200 rounded-xl text-center">
                          <span className="text-xl font-extrabold text-slate-800 tracking-tight">{result.analysis.targetKeyword}</span>
                          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                            {result.analysis.mainKeywordCount !== undefined && (
                              <span className="inline-flex items-center gap-1 px-3.5 py-1 bg-white border border-slate-300 rounded-full text-[13px] font-bold text-slate-700">
                                본문 내 <span className="text-red-600">{result.analysis.mainKeywordCount}</span>회 사용
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 px-3.5 py-1 bg-white border border-slate-300 rounded-full text-[13px] font-bold text-slate-700">
                              글자수: 약 <span className="text-red-600">{result.textLength.toLocaleString()}</span>자
                            </span>
                            <span className="inline-flex items-center gap-1 px-3.5 py-1 bg-white border border-slate-300 rounded-full text-[13px] font-bold text-slate-700">
                              이미지: <span className="text-red-600">{result.imageCount}</span>장
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-extrabold text-[11px]">02</span>
                          <h3 className="text-base font-bold text-gray-900">AI 추론 연관 키워드</h3>
                        </div>
                        <p className="text-[12px] text-slate-500 mb-3 leading-relaxed">
                          AI가 글 내용을 분석하여 이 포스팅이 함께 노렸을 것으로 추론한 SEO 연관 키워드입니다. 실제 해시태그가 아니며, 벤치마킹 시 참고용으로 활용하세요.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {result.analysis.subKeywords.map((keyword: string, idx: number) => (
                            <span key={idx} className="px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold text-sm rounded-md">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 실제 해시태그 */}
                      {result.hashtags && result.hashtags.length > 0 && (
                        <div className="mb-8">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-700 text-white font-extrabold text-[11px]">#</span>
                            <h3 className="text-base font-bold text-gray-900">작성자 직접 입력 해시태그</h3>
                          </div>
                          <p className="text-[12px] text-slate-500 mb-3 leading-relaxed">
                            블로그 포스팅 하단에 작성자가 직접 입력한 태그입니다. 실제 SEO 타겟 키워드에 가장 가깝습니다.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {result.hashtags.map((tag: string, idx: number) => (
                              <span key={idx} className="px-4 py-2 bg-slate-100 border border-slate-300 text-slate-700 font-bold text-sm rounded-lg">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="w-full h-px bg-gray-100 my-8"></div>

                      <div className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[11px]">03</span>
                          <h3 className="text-base font-bold text-gray-900">포스팅 전달 가치 (Content Focus)</h3>
                        </div>
                        <div className="p-5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                          <p className="text-[14px] text-gray-800 font-medium leading-relaxed">
                            {result.analysis.contentFocus}
                          </p>
                        </div>
                      </div>

                      <div className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-extrabold text-[11px]">04</span>
                          <h3 className="text-base font-bold text-gray-900">AI 분석: 작성자 SEO 전략</h3>
                        </div>
                        <div className="p-5 bg-purple-50/50 border border-purple-100 rounded-xl">
                          <p className="text-[14px] text-gray-800 font-medium leading-relaxed whitespace-pre-wrap">
                            {result.analysis.strategy}
                          </p>
                        </div>
                      </div>

                      {/* 따라쓰기 치트시트 */}
                      <div className="pt-8 border-t-2 border-dashed border-gray-200">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-extrabold text-[10px]">CS</span>
                          <h3 className="text-base font-bold text-gray-900">따라쓰기 치트시트</h3>
                          <span className="text-[11px] text-slate-400 font-medium">— 이 글을 벤치마킹하여 작성 시 참고하세요</span>
                        </div>
                        <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm">
                          <table className="w-full text-left">
                            <tbody className="divide-y divide-slate-200">
                              {[
                                {
                                  label: "제목 구성",
                                  value: `"${result.analysis.targetKeyword}"을 제목 맨 앞이나 핵심 위치에 배치`,
                                },
                                {
                                  label: "목표 글자수",
                                  value: `약 ${Math.round(result.textLength / 100) * 100}자 내외`,
                                },
                                {
                                  label: "권장 이미지",
                                  value: `${result.imageCount}장 내외 (원본 기준)`,
                                },
                                {
                                  label: "메인 키워드",
                                  value: `"${result.analysis.targetKeyword}" — 원본 ${result.analysis.mainKeywordCount ?? '?'}회 사용 / 벤치마킹 시 유사 횟수 유지 권장`,
                                },
                                {
                                  label: "서브 키워드",
                                  value: result.analysis.subKeywords.join('  /  '),
                                },
                                {
                                  label: "글쓰기 전략",
                                  value: "공감(문제 제기) → 정보 심화 → 해결책 제시 순서로 구성",
                                },
                              ].map((row, idx) => (
                                <tr key={idx}>
                                  <td className="px-5 py-3.5 w-36 shrink-0 text-[12px] font-extrabold text-white bg-slate-700 whitespace-nowrap border-r border-slate-600">
                                    {row.label}
                                  </td>
                                  <td className="px-5 py-3.5 text-[13px] font-medium text-slate-800 leading-relaxed bg-white">
                                    {row.value}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 복사 버튼 */}
                      <div className="pt-6 flex justify-end">
                        <button
                          onClick={handleCopyResult}
                          className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          결과 복사하기
                        </button>
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
        pageType={"POST_XRAY" as any}
        onSelect={handleApplySavedSetting}
      />
    </>
  );
}

export default function PostXRayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-slate-500">데이터를 불러오는 중입니다...</div>}>
      <PostXRayContent />
    </Suspense>
  );
}
