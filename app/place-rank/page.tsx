'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { usePoint } from '@/app/hooks/usePoint';
import RankTabs from '@/components/RankTabs';
import HelpButton from '@/components/HelpButton';
import SavedSearchesDrawer from '@/components/SavedSearchesDrawer';
import { createClient } from '@/app/utils/supabase/client';
import { useSearchParams } from 'next/navigation';

// ── 순위 배경색
function getRankBg(rank: number | null | undefined): string {
  if (rank === null || rank === undefined) return 'bg-gray-100 !text-gray-400';
  if (rank <= 10) return 'bg-emerald-50 !text-emerald-700 border border-emerald-200';
  if (rank <= 30) return 'bg-amber-50 !text-amber-700 border border-amber-200';
  return 'bg-red-50 !text-red-700 border border-red-200';
}

// ── 타입 정의
interface PlaceResult {
  inputName: string;
  matchedName: string | null;
  placeOrganicRank?: number | null;
  mapRank?: number | null;
  rank?: number | null;
}

interface SearchResult {
  keyword: string;
  totalCount: number;
  results: PlaceResult[];
  isLoading?: boolean;
  error?: string;
}

// ── 모드 A 테이블: 업체별 순위 비교 (하나의 키워드 × 여러 업체)
// 컬럼: [#] [검색 키워드] [입력 업체명] [매칭 업체명] [플레이스 순위(광고 제외)]
function MultiPlaceTable({ data }: { data: SearchResult }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-center py-1.5 pl-8 pr-4 text-[13px] font-bold !text-slate-600 w-16">#</th>
              <th className="text-left py-1.5 px-4 text-[13px] font-bold !text-slate-600 whitespace-nowrap">검색 키워드</th>
              <th className="text-left py-1.5 px-4 text-[13px] font-bold !text-slate-600 whitespace-nowrap">입력 업체명</th>

              <th className="text-center py-1.5 pr-8 pl-4 text-[13px] font-bold !text-indigo-500 whitespace-nowrap">
                플레이스 순위
              </th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((r, i) => {
              const finalRank = r.placeOrganicRank ?? r.mapRank ?? r.rank;
              return (
                <tr key={i} className="h-[50px] border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 pl-8 pr-4 text-center text-xs !text-slate-400 font-medium">{i + 1}</td>
                  <td className="py-2.5 px-4 !text-slate-600 font-medium">{data.keyword}</td>
                  <td className="py-2.5 px-4 font-bold !text-slate-800">{r.inputName}</td>

                  <td className="py-2.5 pr-8 pl-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getRankBg(finalRank)}`}>
                      {finalRank !== null && finalRank !== undefined ? `${finalRank}위` : '미노출'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 모드 B 테이블: 키워드별 순위 비교 (하나의 업체 × 여러 키워드) → 단일 통합 테이블
// 컬럼: [#] [입력 업체명] [매칭 업체명] [검색 키워드] [플레이스 순위(광고 제외)]
function MultiKeywordTable({ results, onRetry }: { results: SearchResult[], onRetry: (keyword: string) => void }) {
  // 모든 SearchResult를 평탄화(flatten)하여 단일 행 배열로 변환
  const rows = results.flatMap((res) =>
    res.results.map((r) => ({ ...r, keyword: res.keyword }))
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-center py-1.5 pl-8 pr-4 text-[13px] font-bold !text-slate-600 w-16">#</th>
              <th className="text-left py-1.5 px-4 text-[13px] font-bold !text-slate-600 whitespace-nowrap">입력 업체명</th>
              <th className="text-left py-1.5 px-4 text-[13px] font-bold !text-slate-600 whitespace-nowrap">검색 키워드</th>
              <th className="text-center py-1.5 px-4 text-[13px] font-bold !text-indigo-500 whitespace-nowrap">
                플레이스 순위
              </th>
              <th className="text-center py-1.5 pr-8 pl-8 text-[13px] font-bold !text-slate-600 w-28 whitespace-nowrap">재조회</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const finalRank = r.placeOrganicRank ?? r.mapRank ?? r.rank;
              const resObj = results.find(res => res.keyword === r.keyword);

              if (resObj?.isLoading) {
                return (
                  <tr key={i} className="h-[50px] border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 pl-8 pr-4 text-center text-xs !text-slate-400 font-medium">{i + 1}</td>
                    <td className="py-2.5 px-4 font-bold !text-slate-800">{r.inputName}</td>
                    <td className="py-2.5 px-4 !text-slate-600 font-medium">{r.keyword}</td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex justify-center"><div className="w-5 h-5 border-2 rounded-full animate-spin border-indigo-100 border-t-[#5244e8]" /></div>
                    </td>
                    <td className="py-2.5 pr-8 pl-8 text-center"></td>
                  </tr>
                );
              }
              if (resObj?.error) {
                return (
                  <tr key={i} className="h-[50px] border-b border-slate-50 hover:bg-slate-50/50 transition-colors bg-red-50/30">
                    <td className="py-2.5 pl-8 pr-4 text-center text-xs !text-slate-400 font-medium">{i + 1}</td>
                    <td className="py-2.5 px-4 font-bold !text-slate-800">{r.inputName}</td>
                    <td className="py-2.5 px-4 !text-slate-600 font-medium">{r.keyword}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="text-xs font-bold text-red-500">조회 실패</span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => onRetry(r.keyword)}
                        className="p-1.5 !text-slate-400 hover:!text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-sm inline-flex items-center justify-center"
                        title="포인트 차감 없이 재조회"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      </button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={i} className="h-[50px] border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 pl-8 pr-4 text-center text-xs !text-slate-400 font-medium">{i + 1}</td>
                  <td className="py-2.5 px-4 font-bold !text-slate-800">{r.inputName}</td>
                  <td className="py-2.5 px-4 !text-slate-600 font-medium">{r.keyword}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getRankBg(finalRank)}`}>
                      {finalRank !== null && finalRank !== undefined ? `${finalRank}위` : '미노출'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-8 pl-8 text-center"></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트
function PlaceRankContent() {
  const { user } = useAuth();
  const { deductPoints } = usePoint();

  const [mode, setMode] = useState<'multi-keyword' | 'multi-place'>('multi-keyword');

  // multi-place 상태
  const [keyword, setKeyword] = useState('');
  const [places, setPlaces] = useState<string[]>(['', '']);

  // multi-keyword 상태
  const [keywords, setKeywords] = useState<string[]>(['', '']);
  const [singlePlace, setSinglePlace] = useState('');

  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [multiResults, setMultiResults] = useState<SearchResult[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(true);

  const searchParams = useSearchParams();
  const urlKeyword = searchParams.get('keyword');
  const urlNickname = searchParams.get('nickname');
  const isAutoSearched = useRef(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // 입력값이 변경될 때마다 isDirty를 true로 설정하여 버튼 텍스트를 복구함
  useEffect(() => {
    setIsDirty(true);
  }, [keyword, places, singlePlace, keywords]);

  // ── [요청 1] 탭 전환 시 결과 즉시 초기화
  const handleModeChange = (newMode: 'multi-place' | 'multi-keyword') => {
    setMode(newMode);
    setSearchResult(null);
    setMultiResults([]);
    setHasSearched(false);
    setError(null);
  };

  // ── 업체/키워드 입력 행 추가/제거
  const addPlace = () => { if (places.length < 5) setPlaces([...places, '']); };
  const removePlace = (i: number) => { if (places.length > 1) setPlaces(places.filter((_, idx) => idx !== i)); };
  const updatePlace = (i: number, v: string) => setPlaces(places.map((p, idx) => idx === i ? v : p));

  const addKeyword = () => { if (keywords.length < 10) setKeywords([...keywords, '']); };
  const removeKeyword = (i: number) => { if (keywords.length > 1) setKeywords(keywords.filter((_, idx) => idx !== i)); };
  const updateKeyword = (i: number, v: string) => setKeywords(keywords.map((k, idx) => idx === i ? v : k));

  const retryQueue = useRef<string[]>([]);
  const isRetrying = useRef<boolean>(false);

  const processRetryQueue = async () => {
    if (isRetrying.current || retryQueue.current.length === 0) return;
    isRetrying.current = true;

    while (retryQueue.current.length > 0) {
      const retryKeyword = retryQueue.current.shift()!;

      try {
        const res = await fetch('/api/place-rank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: retryKeyword.trim(), places: [singlePlace.trim()] }),
        });
        const data = await res.json();

        setMultiResults(prev => prev.map(item => {
          if (item.keyword === retryKeyword) {
            if (!data.success) {
              return { ...item, isLoading: false, error: data.error || '조회 실패' };
            }
            return { ...data, isLoading: false };
          }
          return item;
        }));
      } catch (e: any) {
        setMultiResults(prev => prev.map(item =>
          item.keyword === retryKeyword
            ? { ...item, isLoading: false, error: e.message || '조회 실패' }
            : item
        ));
      }

      // 서버 보호를 위해 1초 대기 (큐에 항목이 더 남아있을 경우에만)
      if (retryQueue.current.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    isRetrying.current = false;
  };

  const handleRetry = (retryKeyword: string) => {
    // 이미 큐에 있거나, 이미 성공/로딩중이면 중복 추가 방지
    if (!retryQueue.current.includes(retryKeyword)) {
      retryQueue.current.push(retryKeyword);

      // 즉각적으로 UI를 로딩 상태로 변경
      setMultiResults(prev => prev.map(item =>
        item.keyword === retryKeyword
          ? { ...item, isLoading: true, error: undefined }
          : item
      ));

      processRetryQueue();
    }
  };

  const handleCopyResults = async () => {
    try {
      let tsv = '';
      if (mode === 'multi-keyword') {
        const header = `[업체명] ${singlePlace}`;
        const rows = multiResults.flatMap(res => res.results.map(r => {
          const finalRank = r.placeOrganicRank ?? r.mapRank ?? r.rank;
          const rankText = finalRank !== null && finalRank !== undefined ? `${finalRank}위` : '미노출';
          return `${res.keyword}\t${rankText}`;
        }));
        tsv = [header, ...rows].join('\n');
      } else if (mode === 'multi-place' && searchResult) {
        const header = `[검색키워드] ${keyword}`;
        const rows = searchResult.results.map(r => {
          const finalRank = r.placeOrganicRank ?? r.mapRank ?? r.rank;
          const rankText = finalRank !== null && finalRank !== undefined ? `${finalRank}위` : '미노출';
          return `${r.inputName}\t${rankText}`;
        });
        tsv = [header, ...rows].join('\n');
      }

      if (tsv) {
        await navigator.clipboard.writeText(tsv);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const handleSearch = async () => {
    setError(null);
    setSearchResult(null);
    setMultiResults([]);
    setHasSearched(false);

    if (mode === 'multi-place') {
      const validPlaces = places.filter(p => p.trim());
      if (!keyword.trim() || validPlaces.length === 0) {
        setError('키워드와 업체명을 1개 이상 입력해주세요.'); return;
      }
    } else {
      const validKws = keywords.filter(k => k.trim());
      if (validKws.length === 0 || !singlePlace.trim()) {
        setError('키워드와 업체명을 입력해주세요.'); return;
      }
    }

    const validPlaces = mode === 'multi-place' ? places.filter(p => p.trim()) : [];
    const validKws = mode === 'multi-keyword' ? keywords.filter(k => k.trim()) : [];

    const pointsToDeduct = mode === 'multi-place' ? 10 : 10 * validKws.length;
    const itemsCount = mode === 'multi-place' ? 1 : validKws.length;
    const targetQuery = mode === 'multi-place'
      ? `업체별 조회 / ${keyword.trim()} / 업체: ${validPlaces.join(', ')}`
      : `키워드별 조회 / ${singlePlace.trim()} / 키워드: ${validKws.join(', ')}`;

    const deducted = await deductPoints(user?.id, pointsToDeduct, itemsCount, targetQuery);
    if (!deducted) return;

    setIsSearching(true);
    setHasSearched(true); // 바로 테이블 표시하기 위해

    try {
      if (mode === 'multi-place') {
        const res = await fetch('/api/place-rank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: keyword.trim(), places }),
        });
        const data = await res.json();
        if (!data.success) { setError(data.error || '오류가 발생했습니다.'); return; }
        setSearchResult(data);
      } else {
        // 1. 초기 상태 (스피너 표시용)
        const initialStates: SearchResult[] = validKws.map(kw => ({
          keyword: kw,
          totalCount: 0,
          results: [{ inputName: singlePlace.trim(), matchedName: null, placeOrganicRank: null, mapRank: null, rank: null }],
          isLoading: true,
        }));
        setMultiResults(initialStates);

        // 2. 3개씩 청크 분할 및 순차 실행 (스트리밍)
        const CHUNK_SIZE = 3;
        for (let i = 0; i < validKws.length; i += CHUNK_SIZE) {
          const chunk = validKws.slice(i, i + CHUNK_SIZE);

          const chunkResponses = await Promise.allSettled(
            chunk.map(kw =>
              fetch('/api/place-rank', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword: kw.trim(), places: [singlePlace.trim()] }),
              }).then(async r => {
                const data = await r.json();
                if (!data.success) throw new Error(data.error || 'API Error');
                return data;
              })
            )
          );

          // 청크 완료될 때마다 상태 실시간 업데이트
          setMultiResults(prev => prev.map(item => {
            const chunkIndex = chunk.indexOf(item.keyword);
            if (chunkIndex !== -1) {
              const res = chunkResponses[chunkIndex];
              if (res.status === 'fulfilled') {
                return { ...res.value, isLoading: false };
              } else {
                return { ...item, isLoading: false, error: res.reason?.message || '조회 실패' };
              }
            }
            return item;
          }));
        }
      }
      setIsDirty(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async () => {
    if (isDirty) {
      alert('입력값이 변경되었습니다. 다시 조회 후 저장해주세요.');
      return;
    }
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const supabase = createClient();
    let savedKeyword = '';
    let savedNickname = '';

    if (mode === 'multi-keyword') {
      savedNickname = singlePlace;
      savedKeyword = keywords.filter(k => k.trim()).join(', ');
    } else {
      savedNickname = places.filter(p => p.trim()).join(', ');
      savedKeyword = keyword;
    }

    if (!savedKeyword && !savedNickname) {
      alert('저장할 내역이 없습니다.');
      return;
    }

    const { error: dbError } = await supabase.from('saved_searches').insert({
      user_id: user.id,
      page_type: 'PLACE_RANK',
      nickname: savedNickname,
      keyword: savedKeyword,
    });

    if (!dbError) {
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } else {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false);

    const kws = (item.keyword || '').split(',').map((k: string) => k.trim()).filter(Boolean);
    const nns = (item.nickname || '').split(',').map((n: string) => n.trim()).filter(Boolean);

    if (nns.length > 1) {
      setMode('multi-place');
      setKeyword(kws[0] || '');
      setPlaces(nns.length > 0 ? nns : ['', '']);
    } else {
      setMode('multi-keyword');
      setSinglePlace(nns[0] || '');
      setKeywords(kws.length > 0 ? kws : ['', '']);
    }
  };

  useEffect(() => {
    if ((!urlKeyword && !urlNickname) || isAutoSearched.current) return;
    isAutoSearched.current = true;

    const kws = (urlKeyword || '').split(',').map(k => k.trim()).filter(Boolean);
    const nns = (urlNickname || '').split(',').map(n => n.trim()).filter(Boolean);

    if (nns.length > 1) {
      setMode('multi-place');
      setKeyword(kws[0] || '');
      setPlaces(nns);
    } else {
      setMode('multi-keyword');
      setSinglePlace(nns[0] || '');
      setKeywords(kws);
    }

    setTimeout(() => {
      const btn = document.getElementById('place-search-btn');
      if (btn) btn.click();
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKeyword, urlNickname]);

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        {saveToast && (
          <div className="fixed top-24 right-12 z-[9999] flex items-center gap-3 bg-[#5244e8]/80 text-white text-[15px] font-bold px-7 py-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(82,68,232,0.6)] border border-indigo-400/30 animate-fade-in-down backdrop-blur-sm">
            <svg className="w-6 h-6 text-indigo-100 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            현재 설정이 성공적으로 저장되었습니다.
          </div>
        )}
        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">
            <RankTabs />

            {/* 헤더 */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold !text-gray-900">네이버 플레이스 순위 조회</h1>
                  <HelpButton href="https://blog.naver.com/lboll" tooltip="도움말" />
                </div>
                <p className="!text-slate-500 text-sm">
                  업체의 해당 키워드로 플레이스의 순위를 확인 합니다.(업체명 + 키워드 최대 10개)<br />
                  키워드 기준으로 경쟁 업체의 플레이스 순위와 노출 여부를 한 번에 비교합니다.(키워드 + 업체명 최대 5개)<br />
                  조회 실패 항목의 "재조회"는 포인트를 차감하지 않습니다.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1 shrink-0">
                <button
                  onClick={handleSave}
                  disabled={isDirty || !hasSearched || !user}
                  className={`px-4 py-2 text-sm font-bold text-white rounded-md shadow-sm flex items-center gap-1.5 transition-colors ${(isDirty || !hasSearched || !user) ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-800'
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  현재 설정 저장
                </button>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="px-4 py-2 text-sm font-bold text-white bg-slate-700 hover:bg-slate-800 rounded-md shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                  저장된 목록 보기
                </button>
              </div>
            </div>

            {/* 모드 탭 */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                onClick={() => handleModeChange('multi-keyword')}
                className={`px-5 py-3 text-[14px] transition-all duration-200 ease-in-out border-b-2 -mb-[1px] ${mode === 'multi-keyword'
                  ? 'border-[#5244e8] !text-[#5244e8] font-bold bg-white'
                  : 'border-transparent !text-gray-500 font-medium hover:!text-gray-800 hover:border-gray-300'
                  }`}
              >
                [키워드별 조회]
              </button>
              <button
                onClick={() => handleModeChange('multi-place')}
                className={`px-5 py-3 text-[14px] transition-all duration-200 ease-in-out border-b-2 -mb-[1px] ${mode === 'multi-place'
                  ? 'border-[#1f8c75] !text-[#1f8c75] font-bold bg-white'
                  : 'border-transparent !text-gray-500 font-medium hover:!text-gray-800 hover:border-gray-300'
                  }`}
              >
                [업체별 조회]
              </button>
            </div>

            {/* ── 좌우 2단 분할 레이아웃 ── */}
            <div className="flex flex-col lg:flex-row items-start gap-6">

              {/* 1열 (왼쪽): 입력 폼 */}
              <div className={`w-full lg:w-[340px] shrink-0 rounded-2xl shadow-sm p-6 ${mode === 'multi-place'
                ? 'bg-[#f0faf7] border-2 border-[#1f8c75]'
                : 'bg-[#f5f3ff] border-2 border-[#5244e8]'
                }`}>

                {mode === 'multi-place' ? (
                  <>
                    <div className="mb-5">
                      <label className="block text-sm font-bold !text-slate-700 mb-2">검색 키워드</label>
                      <input
                        type="text"
                        value={keyword}
                        onChange={e => setKeyword(e.target.value)}
                        placeholder="예: 부천치과"
                        className="w-full py-2.5 px-4 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#1f8c75] focus:ring-2 focus:ring-[#1f8c75]/20 shadow-inner bg-slate-50 focus:bg-white !text-slate-800 placeholder:!text-slate-400 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold !text-slate-700 mb-2">플레이스 등록 업체명</label>
                      <div className="flex flex-col gap-2">
                        {places.map((p, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <span className="text-xs !text-slate-400 w-4 text-right shrink-0">{i + 1}</span>
                            <input
                              type="text"
                              value={p}
                              onChange={e => updatePlace(i, e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleSearch()}
                              placeholder="예: 연세베스트치과의원"
                              className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#1f8c75] focus:ring-2 focus:ring-[#1f8c75]/20 shadow-inner bg-slate-50 focus:bg-white !text-slate-800 placeholder:!text-slate-400 transition-all"
                            />
                            {places.length > 1 && (
                              <button onClick={() => removePlace(i)} className="!text-slate-400 hover:!text-red-400 transition-colors text-lg leading-none">×</button>
                            )}
                          </div>
                        ))}
                        {places.length < 5 && (
                          <button onClick={addPlace} className="text-sm !text-[#1f8c75] hover:!text-[#166b59] font-medium mt-1 text-left">+ 업체 추가 (최대 5개)</button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-5">
                      <label className="block text-sm font-bold !text-slate-700 mb-2">플레이스 등록 업체명</label>
                      <input
                        type="text"
                        value={singlePlace}
                        onChange={e => setSinglePlace(e.target.value)}
                        placeholder="예: 연세베스트치과의원"
                        className="w-full py-2.5 px-4 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#5244e8] focus:ring-2 focus:ring-[#5244e8]/20 shadow-inner bg-slate-50 focus:bg-white !text-slate-800 placeholder:!text-slate-400 transition-all"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-bold !text-slate-700">키워드 입력</label>
                        <span className="text-[11px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">1개당 10P 차감</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {keywords.map((k, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <span className="text-xs !text-slate-400 w-4 text-right shrink-0">{i + 1}</span>
                            <input
                              type="text"
                              value={k}
                              onChange={e => updateKeyword(i, e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleSearch()}
                              placeholder="예: 부천치과"
                              className="flex-1 py-2.5 px-4 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#5244e8] focus:ring-2 focus:ring-[#5244e8]/20 shadow-inner bg-slate-50 focus:bg-white !text-slate-800 placeholder:!text-slate-400 transition-all"
                            />
                            {keywords.length > 1 && (
                              <button onClick={() => removeKeyword(i)} className="!text-slate-400 hover:!text-red-400 transition-colors text-lg leading-none">×</button>
                            )}
                          </div>
                        ))}
                        {keywords.length < 10 && (
                          <button onClick={addKeyword} className="text-sm !text-[#5244e8] hover:!text-indigo-700 font-medium mt-1 text-left">+ 키워드 추가 (최대 10개)</button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm !text-red-600">{error}</p>
                  </div>
                )}

                <button
                  id="place-search-btn"
                  onClick={handleSearch}
                  disabled={isSearching}
                  className={`w-full mt-8 py-3.5 text-white font-bold rounded-full shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-[15px] transition-all transform hover:-translate-y-0.5 ${mode === 'multi-place'
                    ? 'bg-[#1f8c75] hover:bg-[#166b59] hover:shadow-[0_6px_20px_rgba(31,140,117,0.3)]'
                    : 'bg-[#5244e8] hover:bg-indigo-700 hover:shadow-[0_6px_20px_rgba(82,68,232,0.3)]'
                    }`}
                >
                  {isSearching ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>조회 중...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <span>{!isDirty && hasSearched ? '조회 완료' : '순위 조회'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* 2열 (오른쪽): 결과 영역 */}
              <div className="w-full lg:w-[65%] flex flex-col gap-6">

                {/* 로딩 (전체 덮기 - multi-place 모드일 때만) */}
                {isSearching && mode === 'multi-place' && (
                  <div className="bg-white border border-slate-200 rounded-xl p-16 flex flex-col items-center justify-center shadow-sm min-h-[300px]">
                    <div className="w-10 h-10 border-4 rounded-full animate-spin mb-4 border-[#e0f2ec] border-t-[#1f8c75]" />
                    <p className="!text-slate-500 text-sm font-medium">검색 중입니다...</p>
                  </div>
                )}

                {/* 빈 상태 */}
                {!isSearching && !hasSearched && (
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-16 flex flex-col items-center justify-center !text-slate-400 min-h-[300px]">
                    <p className="font-bold !text-slate-500 mb-1">키워드와 업체명을 입력하고 조회하세요</p>
                    <p className="text-sm">네이버 상위 100위 이내 순위를 표시합니다</p>
                  </div>
                )}

                {/* 결과 렌더링 블록 (키워드 입력칸 높이와 맞추기 위해 마진 적용) */}
                {(isSearching || hasSearched) && (
                  <div className="flex flex-col lg:mt-[116px]">
                    {/* [요청 2-A] 업체별 순위 비교 결과 테이블 */}
                    {mode === 'multi-place' && searchResult && (
                      <MultiPlaceTable data={searchResult} />
                    )}

                    {/* [요청 2-B] 키워드별 순위 비교 결과 → 단일 통합 테이블 */}
                    {mode === 'multi-keyword' && multiResults.length > 0 && (
                      <MultiKeywordTable results={multiResults} onRetry={handleRetry} />
                    )}

                    {/* 순위 범례 및 하단 버튼 */}
                    <div className="mt-1">
                      <div className="flex items-center justify-start px-2">
                        <div className="flex items-center gap-4 text-xs !text-slate-400 shrink-0">
                          <span className="font-medium text-sm">※ 광고를 제외한 순위 입니다.</span>
                          <span className="flex items-center gap-1 ml-2"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />1~10위</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />11~30위</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />31~100위</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />100위 밖</span>
                        </div>
                      </div>

                      {hasSearched && !isSearching && (
                        <div className="flex justify-center mt-8">
                          <button
                            onClick={handleCopyResults}
                            className="w-[200px] py-3.5 bg-slate-800 hover:bg-slate-700 !text-white font-bold rounded-full shadow-[0_4px_14px_0_rgba(0,0,0,0.15)] transition-all flex items-center justify-center gap-2"
                          >
                            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            결과 복사
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 설정 저장 팝업과 유사한 토스트 팝업 */}
      <div
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-slate-800 text-white text-sm font-bold rounded-full shadow-lg transition-all duration-300 z-50 flex items-center gap-2 ${showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
      >
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
        복사 되었습니다.
      </div>
      <SavedSearchesDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        pageType="PLACE_RANK"
        onSelect={handleApplySavedSetting}
      />
    </>
  );
}

export default function PlaceRankPage() {
  return (
    <Suspense>
      <PlaceRankContent />
    </Suspense>
  );
}
