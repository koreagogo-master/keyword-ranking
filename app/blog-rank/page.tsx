'use client';

// 🌟 Suspense 추가
import { useState, useEffect, useRef, Suspense } from 'react';
// 🌟 URL 파라미터를 읽기 위해 추가
import { useSearchParams } from 'next/navigation';
import { checkNaverRank } from './actions';
import Sidebar from '@/components/Sidebar';
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
          },
        ]);
      }
    }

    setLoading(false);
    setProgress('완료');
  };

  // 🌟 자동 검색 센서 로직 시작
  useEffect(() => {
    // URL 파라미터가 모두 존재하고, 아직 검색이 실행되지 않았을 때만 작동
    if (urlKeyword && urlNickname && !isSearchExecuted.current) {
      isSearchExecuted.current = true; // 중복 실행 방지 락 걸기
      
      setTargetNickname(urlNickname);
      setKeywordInput(urlKeyword);

      // 약간의 딜레이를 주어 상태 업데이트가 화면에 반영될 시간을 확보
      setTimeout(() => {
        handleCheck(urlNickname, urlKeyword);
      }, 300);
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
    
    handleCheck(item.nickname, slicedKeywords);
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
            "지식인"이 순위에 노출될 경우 제목에 내용이 길게 표시됩니다.
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
        <div className="flex gap-4 items-end">
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
              키워드 (쉼표 구분)
            </label>
            <input
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="부천교정, 부천치과"
              className="w-full h-[50px] p-3 rounded-sm bg-white border border-gray-300 focus:outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8] transition-all shadow-sm"
            />
          </div>

          <div>
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
                <th className="px-6 py-4 text-center w-40">키워드</th>
                <th className="px-6 py-4 text-center w-24">순위</th>
                <th className="px-6 py-4 text-center w-32">작성일</th>
                <th className="px-6 py-4 text-left">제목</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r, i) => (
                <tr key={i} className="hover:bg-[#5244e8]/5 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900 text-center">{r.keyword}</td>
                  <td className="px-6 py-4 text-center">
                    {r.rank === 'Auth Error' ? (
                        <span className="text-sm text-red-500 font-bold">인증 실패</span>
                    ) : r.rank !== 'X' && r.rank !== 'Err' && r.rank !== 0 ? (
                      <span className="text-lg font-extrabold text-[#5244e8]">{r.rank}</span>
                    ) : (
                      <span className="text-sm text-gray-400 font-medium">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-400 font-medium">
                    {r.date}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {r.title}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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