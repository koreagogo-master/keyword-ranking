'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { createClient } from '@/app/utils/supabase/client';
import SavedSearchesDrawer from '@/components/SavedSearchesDrawer';
import RankTabs from '@/components/RankTabs';
import { usePoint } from '@/app/hooks/usePoint';

interface VolumeResult {
  keyword: string;
  pc: number;
  mobile: number;
  total: number;
  baseDate: string;
}

function KeywordVolumeContent() {
  const { user } = useAuth();
  const { deductPoints } = usePoint();

  const searchParams = useSearchParams();
  const urlKeyword = searchParams.get('keyword');
  const isAutoSearched = useRef(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState<VolumeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [baseDate, setBaseDate] = useState('');
  const [copyToast, setCopyToast] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  const handleSubmit = async () => {
    const keywords = inputText
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keywords.length === 0) {
      setError('키워드를 최소 1개 이상 입력해주세요.');
      return;
    }
    if (keywords.length > 100) {
      setError('키워드는 최대 100개까지만 입력 가능합니다.');
      return;
    }

    setError('');
    setIsLoading(true);
    setResults([]);
    setBaseDate('');

    // 포인트 차감 (키워드 수를 itemCount로 전달)
    const isPaySuccess = await deductPoints(user?.id, 0, keywords.length, keywords.join(', '));
    if (!isPaySuccess) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/keyword-volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '조회 중 오류가 발생했습니다.');
      }

      setResults(data.results);
      if (data.results.length > 0) {
        setBaseDate(data.results[0].baseDate);
      }
    } catch (e: any) {
      setError(e.message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const keywordCount = inputText
    .split('\n')
    .filter(k => k.trim().length > 0).length;

  const handleCopy = async () => {
    if (results.length === 0) return;
    const text = results
      .map(row => `${row.keyword}\t${row.total.toLocaleString()}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 3000);
  };

  const handleSave = async () => {
    if (results.length === 0) {
      alert('저장할 조회 결과가 없습니다.');
      return;
    }
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    const supabase = createClient();
    const keywordSummary = results.map(r => r.keyword).join(', ');
    const { error: dbError } = await supabase.from('saved_searches').insert({
      user_id: user.id,
      page_type: 'KEYWORD_VOLUME',
      nickname: '',
      keyword: keywordSummary,
    });
    if (!dbError) {
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } else {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  // 저장된 목록에서 키워드 불러와 즐시 조회
  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false);
    // 저장된 키워드(콤마 구분):엘 textarea에 한 줄씩 브러쓰로 채우고 조회
    const keywords = item.keyword.split(',').map((k: string) => k.trim()).filter(Boolean);
    setInputText(keywords.join('\n'));
    // 조회 실행 (textarea 상태 업데이트 후 타임아웃)
    setTimeout(() => {
      handleSubmitWithKeywords(keywords);
    }, 50);
  };

  const handleSubmitWithKeywords = async (keywords: string[]) => {
    if (keywords.length === 0) return;
    setError('');
    setIsLoading(true);
    setResults([]);
    setBaseDate('');
    try {
      const res = await fetch('/api/keyword-volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '조회 중 오류가 발생했습니다.');
      setResults(data.results);
      if (data.results.length > 0) setBaseDate(data.results[0].baseDate);
    } catch (e: any) {
      setError(e.message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // URL ?keyword=... 파라미터 감지 시 1회 자동 조회
  useEffect(() => {
    if (!urlKeyword || isAutoSearched.current) return;
    isAutoSearched.current = true;
    const keywords = urlKeyword.split(',').map(k => k.trim()).filter(Boolean);
    setInputText(keywords.join('\n'));
    setTimeout(() => {
      handleSubmitWithKeywords(keywords);
    }, 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKeyword]);

  return (
    <div
      className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight"
      style={{ fontFamily: "'NanumSquare', sans-serif" }}
    >
      {/* 복사 완료 Toast */}
      {copyToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-gray-900 text-white text-[13px] font-bold px-5 py-3.5 rounded-xl shadow-lg animate-fade-in">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
          결과가 클립보드에 복사되었습니다. 엑셀에 바로 붙여넣을 수 있습니다.
        </div>
      )}
      {/* 저장 완료 Toast */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-gray-900 text-white text-[13px] font-bold px-5 py-3.5 rounded-xl shadow-lg">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
          목록에 저장되었습니다.
        </div>
      )}
      <main className="flex-1 ml-64 p-10">
        <div className="max-w-7xl mx-auto">

          <RankTabs />

          {/* 헤더 */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">키워드별 조회수</h1>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                네이버 검색광고 데이터를 기반으로 다수 키워드의 PC/모바일 조회수를 일괄 분석합니다.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1 shrink-0">
              <button
                onClick={handleSave}
                disabled={results.length === 0 || !user}
                className={`px-4 py-2 text-sm font-bold text-white rounded-md shadow-sm flex items-center gap-1.5 transition-colors
                  ${(results.length === 0 || !user) ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-800'}`}
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

          {/* 2열 레이아웃: 좌=입력, 우=결과 */}
          <div className="flex flex-col lg:flex-row gap-8 items-start">

            {/* ── 좌측: 입력 영역 ── */}
            <div className="w-full lg:w-[340px] shrink-0">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <p className="text-sm text-gray-500 font-medium mb-3">
                  키워드를 한 줄에 하나씩 입력하세요.{' '}
                  <span className="text-[#5244e8] font-bold">(최대 100개)</span>
                </p>
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  rows={14}
                  placeholder={`예시:\n삼성 갤럭시\n아이폰 케이스\n무선 이어폰`}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-[14px] text-gray-800 font-medium outline-none focus:border-[#5244e8] transition-all resize-none leading-relaxed"
                />
                <p className="text-[12px] text-gray-400 mt-1.5 font-medium">
                  현재 입력된 키워드:{' '}
                  <span className={`font-bold ${keywordCount > 100 ? 'text-rose-500' : 'text-[#5244e8]'}`}>
                    {keywordCount}개
                  </span>
                  {' '}/ 최대 100개
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || keywordCount === 0 || keywordCount > 100}
                  className="mt-4 w-full py-3 bg-[#5244e8] hover:bg-[#4336c9] disabled:bg-gray-300 text-white text-[14px] font-bold rounded-lg transition-all shadow-sm disabled:cursor-not-allowed"
                >
                  {isLoading ? '조회 중...' : '조회수 확인'}
                </button>
              </div>
            </div>

            {/* ── 우측: 결과 영역 ── */}
            <div className="flex-1 min-w-0">

              {/* 에러 */}
              {error && (
                <div className="mb-6 px-5 py-4 bg-rose-50 border border-rose-200 rounded-xl text-[14px] text-rose-600 font-bold">
                  ⚠️ {error}
                </div>
              )}

              {/* 로딩 스피너 */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-[#5244e8]/30 rounded-full animate-bounce" />
                    <div className="w-3 h-3 bg-[#5244e8]/60 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-3 h-3 bg-[#5244e8] rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <p className="text-[13px] text-gray-400 font-bold">네이버 API에서 조회수를 불러오는 중...</p>
                </div>
              )}

              {/* 결과 없을 때 안내 */}
              {!isLoading && results.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
                  <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-[13px] font-bold">키워드를 입력하고 조회수 확인 버튼을 눌러주세요.</p>
                </div>
              )}

              {/* 결과 테이블 */}
              {!isLoading && results.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

                  {/* 결과 헤더: 제목+날짜 / 복사 버튼 */}
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-gray-200">
                    <h2 className="text-[15px] font-bold text-gray-800 flex items-center gap-2">
                      <div className="w-1 h-4 bg-[#5244e8] rounded-sm" />
                      조회수 결과
                      <span className="text-[12px] text-gray-400 font-medium ml-1">{baseDate}</span>
                    </h2>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-[#5244e8] hover:bg-[#4336c9] text-white text-[12px] font-bold rounded-lg transition-all shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      결과 복사
                    </button>
                  </div>

                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-600 text-[13px] font-bold border-b border-gray-200">
                      <tr>
                        <th className="px-5 py-3.5 w-10 text-center text-slate-400">#</th>
                        <th className="px-5 py-3.5">키워드</th>
                        <th className="px-5 py-3.5 text-right w-28">PC 조회수</th>
                        <th className="px-5 py-3.5 text-right w-28">모바일 조회수</th>
                        <th className="px-5 py-3.5 text-right w-24 bg-indigo-50/50 text-[#5244e8]">합계</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[14px]">
                      {results.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 text-center text-[12px] text-slate-400 font-bold">{idx + 1}</td>
                          <td className="px-5 py-3 font-bold text-slate-800">{row.keyword}</td>
                          <td className="px-5 py-3 text-right text-slate-600 font-medium">{row.pc.toLocaleString()}</td>
                          <td className="px-5 py-3 text-right text-slate-600 font-medium">{row.mobile.toLocaleString()}</td>
                          <td className="px-5 py-3 text-right font-bold text-[#5244e8] bg-indigo-50/30">{row.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="px-6 py-3 bg-slate-50 border-t border-gray-200 text-right">
                    <span className="text-[12px] text-slate-500 font-bold">총 {results.length}개 키워드 조회 완료</span>
                  </div>
                </div>
              )}

            </div>{/* ── 우측 끝 ── */}
          </div>{/* ── 2열 레이아웃 끝 ── */}

        </div>
      </main>

      <SavedSearchesDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        pageType="KEYWORD_VOLUME"
        onSelect={handleApplySavedSetting}
      />
    </div>
  );
}

// useSearchParams 사용 시 Suspense 래핑 필수 (Next.js App Router 빌드 에러 방지)
export default function KeywordVolumePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen bg-[#f8f9fa] items-center justify-center"><p className="text-gray-400 font-bold">로딩 중...</p></div>}>
      <KeywordVolumeContent />
    </Suspense>
  );
}
