'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import RankTabs from '@/components/RankTabs';
import { checkNaverBlogRank } from './actions';
// 🌟 URL 파라미터를 읽기 위해 추가
import { useSearchParams } from 'next/navigation';

import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from "@/app/contexts/AuthContext";
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";

import { usePoint } from '@/app/hooks/usePoint'; 
import HelpButton from '@/components/HelpButton';

interface SearchResultRow {
  keyword: string;
  rank: string | number;
  date: string;
  title: string;
  author: string;
  isSuccess: boolean;
  isLoading?: boolean;
  error?: string;
}

const AUTHOR_COLORS = [
  'text-[#5244e8]', 'text-green-600', 'text-amber-600', 'text-pink-600',
  'text-purple-600', 'text-orange-600', 'text-cyan-600', 'text-red-600',
];

// 🌟 메인 로직을 별도의 컴포넌트로 분리 (Suspense로 감싸기 위함)
function BlogRankContent() {
  const { user } = useAuth();
  const { deductPoints } = usePoint(); 
  
  // 🌟 URL 쿼리 파라미터 읽기
  const searchParams = useSearchParams();
  const urlKeyword = searchParams.get('keyword');
  const urlNickname = searchParams.get('nickname');
  
  // 중복 실행 방지를 위한 Ref
  const isSearchExecuted = useRef(false);

  const [targetNickname, setTargetNickname] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // 🌟 재조회 순차 대기열
  const retryQueue = useRef<{ keyword: string; nickname: string }[]>([]);
  const isRetrying = useRef<boolean>(false);

  const nicknames = targetNickname.split(',').map(s => s.trim()).filter(Boolean);

  const getMatchedNicknameIndex = (author: string) => {
    if (!author || author === '-') return -1;
    let best = -1;
    let len = 0;
    nicknames.forEach((nick, i) => {
      if (author.includes(nick) && nick.length > len) {
        best = i;
        len = nick.length;
      }
    });
    return best;
  };

  const handleCheck = async (overrideNickname?: string, overrideKeyword?: string) => {
    const nickToSearch = overrideNickname !== undefined ? overrideNickname : targetNickname;
    const kwToSearch = overrideKeyword !== undefined ? overrideKeyword : keywordInput;

    if (!nickToSearch || !kwToSearch) {
      alert('닉네임과 키워드를 모두 입력해주세요.');
      return;
    }

    const keywords = kwToSearch.split(',').map(k => k.trim()).filter(Boolean).slice(0, 10);
    const keywordString = keywords.join(', ');

    const isPaySuccess = await deductPoints(user?.id, 10 * keywords.length, keywords.length, keywordString);
    if (!isPaySuccess) return;

    setLoading(true);
    setResults([]);

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      setProgress(`${i + 1} / ${keywords.length} 진행 중... (${keyword})`);

      try {
        const res = await checkNaverBlogRank(keyword, nickToSearch);

        if (res.success && Array.isArray(res.data)) {
          const rows = res.data.map(item => ({
            keyword, rank: item.rank, date: item.date, title: item.title, author: item.author, isSuccess: true,
          }));
          setResults(prev => [...prev, ...rows]);
        } else {
          setResults(prev => [...prev, { keyword, rank: 'X', date: '-', title: '순위 내 없음', author: '-', isSuccess: false }]);
        }
      } catch {
        setResults(prev => [...prev, { keyword, rank: 'Err', date: '-', title: '오류 발생', author: '-', isSuccess: false }]);
      }
    }

    setLoading(false);
    setProgress('완료');
  };

  // 🌟 재조회 함수 (포인트 차감 없이 해당 키워드만 재시도)
  const processRetryQueue = async () => {
    if (isRetrying.current || retryQueue.current.length === 0) return;
    isRetrying.current = true;

    while (retryQueue.current.length > 0) {
      const { keyword: retryKeyword, nickname: retryNickname } = retryQueue.current.shift()!;

      try {
        const res = await checkNaverBlogRank(retryKeyword, retryNickname);

        setResults(prev => prev.map(item => {
          if (item.keyword !== retryKeyword) return item;
          if (res.success && Array.isArray(res.data)) {
            const matched = res.data.find((d: any) =>
              retryNickname.split(',').map((s: string) => s.trim()).some(nick => d.author?.includes(nick))
            ) || res.data[0];
            if (matched) {
              return { ...item, rank: matched.rank, date: matched.date, title: matched.title, author: matched.author, isSuccess: true, isLoading: false, error: undefined };
            }
          }
          return { ...item, rank: 'X', date: '-', title: '순위 내 없음', author: '-', isSuccess: false, isLoading: false, error: undefined };
        }));
      } catch (e: any) {
        setResults(prev => prev.map(item =>
          item.keyword === retryKeyword
            ? { ...item, isLoading: false, error: e.message || '조회 실패' }
            : item
        ));
      }

      if (retryQueue.current.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    isRetrying.current = false;
  };

  const handleRetry = (retryKeyword: string) => {
    const retryNickname = targetNickname;
    const alreadyQueued = retryQueue.current.some(q => q.keyword === retryKeyword);
    const currentItem = results.find(r => r.keyword === retryKeyword);
    if (alreadyQueued || currentItem?.isLoading) return;

    retryQueue.current.push({ keyword: retryKeyword, nickname: retryNickname });

    setResults(prev => prev.map(item =>
      item.keyword === retryKeyword
        ? { ...item, isLoading: true, error: undefined }
        : item
    ));

    processRetryQueue();
  };

  // 🌟 결과 복사 함수 (닉네임 헤더 + 닉네임별 키워드/순위 TSV)
  const handleCopyResults = () => {
    const sections: string[] = [];
    nicknames.forEach((nick) => {
      sections.push(`[블로그 닉네임]\t${nick}`);
      sections.push('키워드\t순위');
      uniqueKeywords.forEach(kw => {
        const kwRows = results.filter(r => r.keyword === kw);
        const matchedRow = kwRows.find(r => getMatchedNicknameIndex(r.author) === nicknames.indexOf(nick));
        const displayRow = matchedRow || kwRows.find(r => r.author === '-');
        const rank = displayRow ? String(displayRow.rank) : '-';
        sections.push(`${kw}\t${rank}`);
      });
      sections.push('');
    });
    const tsv = sections.join('\n').trimEnd();
    navigator.clipboard.writeText(tsv).then(() => {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    });
  };

  // 🌟 URL 파라미터로 입력값 채우기 (자동 검색 없음 — 수동 검색)
  useEffect(() => {
    if (urlKeyword && urlNickname && !isSearchExecuted.current) {
      isSearchExecuted.current = true;
      setTargetNickname(urlNickname);
      setKeywordInput(urlKeyword);
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
      page_type: 'BLOG',
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
    // 자동 검색 제거: 입력값만 채워주고 사용자가 직접 '순위 확인하기'를 누르도록 함
  };

  const uniqueKeywords = Array.from(new Set(results.map(r => r.keyword)));

  return (
    <>
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">N 모바일 블로그 탭 순위 확인</h1>
            <HelpButton href="https://blog.naver.com/lboll/224254481124" tooltip="도움말" />
          </div>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            블로그 닉네임과 키워드를 입력하여 N 모바일 블로그 탭의 노출 순위를 확인하세요.<br />
            여러 개의 키워드는 쉼표(,)로 구분하여 한 번에 여러 개를 조회할 수 있습니다. <span className="font-bold text-amber-500">(최대 10개)</span>
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
      </div>

      <div className="bg-white p-6 rounded-sm border border-gray-200 shadow-sm mb-8">
        <div className="flex gap-4 items-start">
          <div className="w-1/4 min-w-[200px]">
            <label className="block text-sm font-bold mb-2 text-gray-600">블로그 닉네임</label>
            <input
              value={targetNickname}
              onChange={e => setTargetNickname(e.target.value)}
              className="w-full p-3 h-[50px] border border-gray-300 rounded-sm focus:outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8] transition-all shadow-sm"
              placeholder="예: 연세베스트치과"
            />
            {nicknames.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {nicknames.map((nick, idx) => (
                  <span
                    key={idx}
                    className={`text-xs font-extrabold px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-full ${AUTHOR_COLORS[idx % AUTHOR_COLORS.length]}`}
                  >
                    {nick}
                  </span>
                ))}
              </div>
            )}
          </div>
// 구글 서버 렉 해결을 위한 재배포 주석
          <div className="flex-1">
            <label className="block text-sm font-bold mb-2 text-gray-600">키워드 (쉼표 구분)</label>
            <input
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`w-full p-3 h-[50px] border rounded-sm focus:outline-none focus:ring-1 transition-all shadow-sm ${
                keywordInput.split(',').filter(k => k.trim()).length > 10
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-400 bg-red-50'
                  : 'border-gray-300 focus:border-[#5244e8] focus:ring-[#5244e8]'
              }`}
              placeholder="부천교정, 부천치과"
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
              className={`h-[50px] px-6 rounded-sm font-bold text-white transition-all shadow-sm ${loading ? 'bg-gray-400' : 'bg-[#5244e8] hover:bg-[#4336c9]'}`}
            >
              {loading ? progress : '순위 확인하기'}
            </button>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-4 text-gray-700">검색 결과 ({uniqueKeywords.length}개 키워드)</h2>
          
          <div className="space-y-8 animate-in fade-in duration-500">
            {nicknames.map((nick, idx) => {
              const colorClass = AUTHOR_COLORS[idx % AUTHOR_COLORS.length];
              
              return (
                <div key={idx} className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
                  <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center gap-3">
                    <span className={`text-[13px] font-extrabold px-3 py-1.5 bg-white border border-gray-200 rounded-md shadow-sm ${colorClass}`}>
                      {nick}
                    </span>
                    <span className="text-sm font-bold text-gray-500">
                      블로그 노출 순위
                    </span>
                  </div>
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-white text-xs uppercase text-gray-500 font-bold tracking-wider border-b border-gray-200">
                      <tr>
                        <th className="p-3 w-40 text-center">키워드</th>
                        <th className="p-3 w-28 text-center">순위</th>
                        <th className="p-3 w-16 text-center">재조회</th>
                        <th className="p-3 w-32 text-center">작성일</th>
                        <th className="p-3">제목</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {uniqueKeywords.map((kw, i) => {
                        const kwRows = results.filter(r => r.keyword === kw);
                        const matchedRow = kwRows.find(r => getMatchedNicknameIndex(r.author) === idx);
                        const displayRow = matchedRow || kwRows.find(r => r.author === '-') || {
                          keyword: kw, rank: 'X', date: '-', title: '순위 내 없음', author: '-'
                        };
                        
                        const isRanked = displayRow.rank !== 'X' && displayRow.rank !== 'Err';
                        const isRowLoading = (displayRow as SearchResultRow).isLoading === true;
                        const isRowError = (displayRow as SearchResultRow).error != null || displayRow.rank === 'Err';

                        return (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="p-3 font-bold text-gray-900 text-center">{kw}</td>
                            <td className="p-3 text-center">
                              {isRowLoading ? (
                                <div className="flex justify-center"><div className="w-5 h-5 border-2 rounded-full animate-spin border-indigo-100 border-t-[#5244e8]" /></div>
                              ) : isRowError ? (
                                <span className="text-xs font-bold text-red-500">검색 실패</span>
                              ) : (
                                <span className={`font-extrabold text-lg ${isRanked ? 'text-[#5244e8]' : 'text-gray-300'}`}>
                                  {displayRow.rank}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {isRowLoading ? (
                                <div className="w-5 h-5 border-2 rounded-full animate-spin border-indigo-100 border-t-[#5244e8] mx-auto" />
                              ) : (!isRanked || isRowError) ? (
                                <button
                                  onClick={() => handleRetry(kw)}
                                  title="재조회"
                                  className="w-8 h-8 flex items-center justify-center mx-auto rounded-full hover:bg-indigo-50 text-slate-400 hover:text-[#5244e8] transition-all"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </button>
                              ) : null}
                            </td>
                            <td className="p-3 text-center text-[13px] font-medium text-gray-500 whitespace-nowrap">
                              {displayRow.date}
                            </td>
                            <td className="p-3 text-[14px] font-medium text-gray-700 pr-4">
                              {displayRow.title}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* 🌟 결과 복사 버튼 */}
          {!loading && (
            <div className="flex justify-center mt-8">
              <button
                onClick={handleCopyResults}
                className="flex items-center gap-2 px-8 py-3 bg-slate-800 text-white text-sm font-bold rounded-full shadow-md hover:bg-slate-700 transition-all hover:-translate-y-0.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                결과 복사
              </button>
            </div>
          )}
        </div>
      )}

      {/* 🌟 복사 완료 토스트 */}
      <div
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-slate-800 text-white text-sm font-bold rounded-full shadow-lg transition-all duration-300 z-50 flex items-center gap-2 ${showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
      >
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
        복사 되었습니다.
      </div>

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
        pageType="BLOG" 
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
      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        
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