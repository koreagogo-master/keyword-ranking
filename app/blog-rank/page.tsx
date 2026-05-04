'use client';

// 🌟 Suspense 추가
import { useState, useEffect, useRef, Suspense } from 'react';
// 🌟 URL 파라미터를 읽기 위해 추가
import { useSearchParams } from 'next/navigation';
import { checkNaverRank } from './actions';

import RankTabs from '@/components/RankTabs';

import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from '@/app/contexts/AuthContext';
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";

import { usePoint } from '@/app/hooks/usePoint'; 
import HelpButton from '@/components/HelpButton';

interface SearchResult {
  keyword: string;
  success: boolean;
  rank: string | number;
  date: string;
  title: string;
  author: string;
  url?: string;
  reason?: 'NOT_FOUND' | 'ERROR' | null;
  deepSearched?: boolean;
}

// 🌟 메인 로직을 별도의 컴포넌트로 분리 (Suspense로 감싸기 위함)
function BlogRankContent() {
  const { user } = useAuth();
  const { deductPoints } = usePoint(); 

  // 🌟 URL 쿼리 파라미터 읽기
  const searchParams = useSearchParams();
  const urlKeyword = searchParams.get('keyword');
  const urlNickname = searchParams.get('nickname');
  
  // 🌟 중복 실행 방지를 위한 Ref
  const isSearchExecuted = useRef(false);

  const [targetNickname, setTargetNickname] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [deepSearchingKeyword, setDeepSearchingKeyword] = useState<string | null>(null);

  const handleCheck = async (overrideNickname?: string, overrideKeyword?: string) => {
    const nickToSearch = overrideNickname !== undefined ? overrideNickname : targetNickname;
    const kwToSearch = overrideKeyword !== undefined ? overrideKeyword : keywordInput;

    if (!nickToSearch || !kwToSearch) {
      alert('닉네임과 키워드를 모두 입력해주세요.');
      return;
    }

    if (!user) {
        alert('로그인 정보가 만료되었거나 확인할 수 없습니다. 다시 로그인해주세요.');
        return;
    }

    const keywords = kwToSearch
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    // 🌟 핵심 업그레이드: 배열로 된 키워드들을 쉼표 문자열로 묶어줍니다!
    const keywordString = keywords.join(', ');

    // 🌟 스위치 켜기: 키워드 문자열도 함께 DB로 전송하여 히스토리에 남깁니다!
    const isPaySuccess = await deductPoints(user?.id, 10 * keywords.length, keywords.length, keywordString);
    if (!isPaySuccess) return; 

    setLoading(true);
    setResults([]);

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      setProgress(`${i + 1} / ${keywords.length} 진행 중... (${keyword})`);

      try {
        const data = await checkNaverRank(keyword, nickToSearch);

        setResults(prev => [
          ...prev,
          {
            keyword,
            success: data.success,
            rank: data.success ? data.data?.totalRank || 0 : (data.message.includes('로그인') ? 'Auth Error' : 'X'),
            date: data.success ? data.data?.date || '-' : '-',
            title: data.success ? data.data?.title || '' : (data.message || '순위 내 없음'),
            author: data.success ? data.data?.author || '' : '-',
            url: data.success ? data.data?.url || '' : '',
            reason: data.success ? null : (data.reason || null),
          },
        ]);
      } catch (err) {
        setResults(prev => [
          ...prev,
          {
            keyword,
            success: false,
            rank: 'Err',
            date: '-',
            title: '시스템 오류 발생',
            author: '-',
            reason: 'ERROR',
          },
        ]);
      }
    }

    setLoading(false);
    setProgress('완료');
  };

  // 🌟 URL 파라미터로 진입 시 필드만 채우기 (자동 조회 없음)
  useEffect(() => {
    if (urlKeyword && urlNickname && !isSearchExecuted.current) {
      isSearchExecuted.current = true;
      setTargetNickname(urlNickname);
      setKeywordInput(urlKeyword);
      // 자동 조회 제거 — 사용자가 [순위 확인하기] 버튼을 직접 클릭해야 검색 시작
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKeyword, urlNickname]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCheck();
  };

  const handleSaveCurrentSetting = async () => {
    if (!targetNickname || !keywordInput) {
      alert("닉네임과 키워드를 모두 입력한 후 저장해주세요.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user?.id,
      page_type: 'TOTAL', 
      nickname: targetNickname,
      keyword: keywordInput
    });

    if (!error) {
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    }
    else alert("저장 중 오류가 발생했습니다.");
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false);

    const slicedKeywords = item.keyword.split(',').map((k: string) => k.trim()).filter(Boolean).slice(0, 10).join(', ');

    setTargetNickname(item.nickname);
    setKeywordInput(slicedKeywords);
    // 자동 조회 제거 — 사용자가 직접 버튼 클릭 시에만 검색
  };

  return (
    <> {/* 🌟 오류 수정: 전체를 감싸는 빈 태그 추가 */}
      
      {/* 1. 타이틀과 상단 버튼 영역 (여기에만 flex 적용) */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">N 모바일 통검 순위 확인</h1>
            <HelpButton href="https://blog.naver.com/lboll/224254481124" tooltip="도움말" />
          </div>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            "사이트", "뉴스", "플레이스"는 순위에서 제외됩니다.<br />
            "지식인"은 블로그가 아니므로 순위 집계에서 제외됩니다. 검색 결과에 포함된 경우 제목 자리에 답변 내용이 길게 표시될 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1 shrink-0">
          <button 
            onClick={handleSaveCurrentSetting}
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
      </div> {/* flex 영역 닫기 */}

      {/* 2. 메인 검색창 영역 (아래로 분리됨) */}
      <div className="bg-white p-6 rounded-sm border border-gray-200 shadow-sm mb-8">
        <div className="flex gap-4 items-start">
          <div className="w-1/4 min-w-[200px]">
            <label className="block text-sm font-bold mb-2 text-gray-600">
              블로그 닉네임
            </label>
            <input
              value={targetNickname}
              onChange={e => setTargetNickname(e.target.value)}
              placeholder="예: 연세베스트치과"
              className="w-full h-[50px] p-3 rounded-sm bg-white border border-gray-300 focus:outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8] transition-all shadow-sm"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-bold mb-2 text-gray-600">
              키워드 (쉼표 구분, 최대 10개)
            </label>
            <input
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="부천교정, 부천치과"
              className={`w-full h-[50px] p-3 rounded-sm bg-white border focus:outline-none focus:ring-1 transition-all shadow-sm ${
                keywordInput.split(',').filter(k => k.trim()).length > 10
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-400 bg-red-50'
                  : 'border-gray-300 focus:border-[#5244e8] focus:ring-[#5244e8]'
              }`}
            />
            {keywordInput.trim() && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  keywordInput.split(',').filter(k => k.trim()).length > 10
                    ? 'bg-red-100 text-red-600'
                    : keywordInput.split(',').filter(k => k.trim()).length === 10
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-indigo-50 text-[#5244e8]'
                }`}>
                  {keywordInput.split(',').filter(k => k.trim()).length} / 10
                </span>
                {keywordInput.split(',').filter(k => k.trim()).length > 10 && (
                  <span className="text-xs text-red-500 font-medium">처음 10개 키워드로 검색됩니다.</span>
                )}
              </div>
            )}
          </div>

          <div className="pt-[28px]">
            <button
              onClick={() => handleCheck()}
              disabled={loading}
              className={`h-[50px] px-6 rounded-sm font-bold text-white whitespace-nowrap transition-all shadow-sm ${loading ? 'bg-gray-400' : 'bg-[#5244e8] hover:bg-[#4336c9]'}`}
            >
              {loading ? `분석 중... ${progress}` : '순위 확인하기'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. 검색 결과 테이블 영역 */}
      {results.length > 0 && (
        <div className="bg-white rounded-sm border border-gray-200 shadow-sm overflow-hidden mt-8">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-center w-40 !text-gray-500">키워드</th>
                <th className="px-6 py-4 text-center w-32 !text-gray-500">순위</th>
                <th className="px-6 py-4 text-center w-28 !text-gray-500">재조회</th>
                <th className="px-6 py-4 text-center w-32 !text-gray-500">작성일</th>
                <th className="px-6 py-4 text-left !text-gray-500">제목</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r, i) => (
                <tr key={i} className="hover:bg-[#5244e8]/5 transition-colors">

                  {/* 키워드 */}
                  <td className="px-6 py-4 text-center font-bold !text-gray-900">{r.keyword}</td>

                  {/* 순위 */}
                  <td className="px-6 py-4 text-center">
                    {r.rank === 'Auth Error' ? (
                      <span className="text-xs font-bold px-2 py-1 bg-red-50 rounded-md border border-red-200 !text-red-500">인증 실패</span>
                    ) : r.reason === 'ERROR' ? (
                      <span className="text-xs font-bold px-2 py-1 bg-red-50 rounded-md border border-red-200 !text-red-500">오류</span>
                    ) : r.reason === 'NOT_FOUND' ? (
                      <span className="text-xs font-bold px-2 py-1 bg-slate-50 rounded-md border border-slate-200 !text-slate-400">순위 없음</span>
                    ) : r.rank !== 'X' && r.rank !== 'Err' && r.rank !== 0 ? (
                      <span className="text-lg font-extrabold !text-[#5244e8]">{r.rank}</span>
                    ) : (
                      <span className="text-sm font-medium !text-gray-400">-</span>
                    )}
                  </td>

                  {/* 재조회 */}
                  <td className="px-6 py-4 text-center">
                    {r.reason === 'NOT_FOUND' && !r.deepSearched ? (
                      <button
                        disabled={deepSearchingKeyword === r.keyword}
                        onClick={async () => {
                          setDeepSearchingKeyword(r.keyword);
                          try {
                            const { checkNaverRankDeep } = await import('./actions');
                            const data = await checkNaverRankDeep(r.keyword, targetNickname);
                            setResults(prev => prev.map(item =>
                              item.keyword === r.keyword
                                ? {
                                    ...item,
                                    success: data.success,
                                    rank: data.success ? data.data?.totalRank || 0 : 'X',
                                    date: data.success ? data.data?.date || '-' : '-',
                                    title: data.success ? data.data?.title || '' : '순위 없음 (50위 밖)',
                                    author: data.success ? data.data?.author || '' : '-',
                                    reason: data.success ? null : (data.reason || 'NOT_FOUND'),
                                    deepSearched: true,
                                  }
                                : item
                            ));
                          } catch {
                            setResults(prev => prev.map(item =>
                              item.keyword === r.keyword ? { ...item, reason: 'ERROR', rank: 'Err' } : item
                            ));
                          } finally {
                            setDeepSearchingKeyword(null);
                          }
                        }}
                        className="text-[11px] font-bold px-3 py-1 rounded-md bg-amber-50 !text-amber-600 border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-wait"
                      >
                        {deepSearchingKeyword === r.keyword ? '검색 중...' : '50위까지 추가 검색'}
                      </button>
                    ) : r.reason === 'ERROR' ? (
                      <button
                        disabled={loading}
                        onClick={async () => {
                          setDeepSearchingKeyword(r.keyword);
                          try {
                            const data = await (await import('./actions')).checkNaverRank(r.keyword, targetNickname);
                            setResults(prev => prev.map(item =>
                              item.keyword === r.keyword
                                ? {
                                    ...item,
                                    success: data.success,
                                    rank: data.success ? data.data?.totalRank || 0 : 'X',
                                    date: data.success ? data.data?.date || '-' : '-',
                                    title: data.success ? data.data?.title || '' : '-',
                                    author: data.success ? data.data?.author || '' : '-',
                                    reason: data.success ? null : (data.reason || 'ERROR'),
                                  }
                                : item
                            ));
                          } catch {
                            /* 유지 */
                          } finally {
                            setDeepSearchingKeyword(null);
                          }
                        }}
                        className="text-[11px] font-bold px-3 py-1 rounded-md bg-rose-50 !text-rose-500 border border-rose-200 hover:bg-rose-100 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-wait"
                      >
                        {deepSearchingKeyword === r.keyword ? '조회 중...' : '재조회'}
                      </button>
                    ) : (
                      <span className="!text-gray-300">—</span>
                    )}
                  </td>

                  {/* 작성일 */}
                  <td className="px-6 py-4 text-center font-medium !text-gray-400">{r.date}</td>

                  {/* 제목 */}
                  <td className="px-6 py-4 font-medium !text-gray-700">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="!text-[#5244e8] hover:underline cursor-pointer"
                      >
                        {r.title}
                      </a>
                    ) : (
                      <span>{r.title}</span>
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. 결과 복사 버튼 */}
      {results.length > 0 && !loading && (
        <div className="flex justify-end mt-3">
          <button
            onClick={() => {
              const header = '키워드\t순위\t작성일\t제목';
              const rows = results.map(r => {
                const rankText = r.reason === 'NOT_FOUND' ? '순위 없음' : r.reason === 'ERROR' ? '오류' : String(r.rank);
                return `${r.keyword}\t${rankText}\t${r.date}\t${r.title}`;
              });
              navigator.clipboard.writeText([header, ...rows].join('\n'))
                .then(() => { setSaveToast(true); setTimeout(() => setSaveToast(false), 2500); })
                .catch(() => alert('복사에 실패했습니다.'));
            }}
            className="flex items-center gap-2 px-5 py-2 bg-slate-700 hover:bg-slate-800 !text-white text-sm font-bold rounded-md shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            결과 복사
          </button>
        </div>
      )}

      {saveToast && (
        <div className="fixed top-24 right-12 z-[9999] flex items-center gap-3 bg-[#5244e8]/80 text-white text-[15px] font-bold px-7 py-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(82,68,232,0.6)] border border-indigo-400/30 animate-fade-in-down backdrop-blur-sm">
          <svg className="w-6 h-6 text-indigo-100 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          현재 설정이 성공적으로 저장되었습니다.
        </div>
      )}

      <SavedSearchesDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        pageType="TOTAL" 
        onSelect={handleApplySavedSetting} 
      />
    </>
  );
}

// 🌟 메인 페이지 컴포넌트: Suspense로 감싸서 배포 에러 방지
export default function BlogRankPage() {
  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />

      <div 
        className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight"
        style={{ fontFamily: "'NanumSquare', sans-serif" }}
      >
        

        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">
            <RankTabs />

            {/* 🌟 URL 파라미터를 읽는 컴포넌트를 Suspense로 감싸기 */}
            <Suspense fallback={<div className="p-10 text-center text-gray-500 font-bold">로딩 중...</div>}>
              <BlogRankContent />
            </Suspense>

          </div>
        </main>
      </div>
    </>
  );
}