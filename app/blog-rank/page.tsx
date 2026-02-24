'use client';

import { useState } from 'react';
import { checkNaverRank } from './actions';
import Sidebar from '@/components/Sidebar';
import RankTabs from '@/components/RankTabs';

// 🌟 DB 및 서랍 컴포넌트 불러오기
import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from '@/app/contexts/AuthContext';
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";

interface SearchResult {
  keyword: string;
  success: boolean;
  rank: string | number;
  date: string;
  title: string;
  author: string;
}

export default function BlogRankPage() {
  const { user } = useAuth();

  const [targetNickname, setTargetNickname] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false); // 서랍 열림 상태

  // 매개변수(override)를 받아서 서랍에서 클릭 시 자동 검색이 가능하도록 업그레이드
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCheck();
  };

  // 1. 현재 설정 저장 로직
  const handleSaveCurrentSetting = async () => {
    if (!targetNickname || !keywordInput) {
      alert("닉네임과 키워드를 모두 입력한 후 저장해주세요.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user?.id,
      page_type: 'TOTAL', // 통검 페이지 명시
      nickname: targetNickname,
      keyword: keywordInput
    });

    if (!error) alert("현재 설정이 안전하게 저장되었습니다.");
    else alert("저장 중 오류가 발생했습니다.");
  };

  // 2. 저장된 데이터 불러오기 + 자동 검색 로직
  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false); // 서랍 닫기
    
    // 최대 10개까지만 잘라내기
    const slicedKeywords = item.keyword.split(',').map((k: string) => k.trim()).filter(Boolean).slice(0, 10).join(', ');

    setTargetNickname(item.nickname);
    setKeywordInput(slicedKeywords);
    
    // 자동 검색 실행
    handleCheck(item.nickname, slicedKeywords);
  };

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
                <h1 className="text-2xl font-bold text-gray-900 mb-3">
                  N 모바일 통검 순위 확인
                </h1>
                <div className="text-gray-600 space-y-1 font-medium">
                  <p>* "사이트", "뉴스", "플레이스"는 순위에서 제외 됩니다.</p>
                  <p>* "지식인"이 순위에 노출 될 경우 제목에 내용이 길게 표시 됩니다.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button 
                  onClick={handleSaveCurrentSetting}
                  className="px-4 py-2 text-sm font-bold text-white bg-slate-700 rounded-md hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5"
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

            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-10">
              <div className="flex gap-4 items-end">
                <div className="w-1/4 min-w-[200px]">
                  <label className="block text-sm font-bold mb-2 text-gray-600">
                    블로그 닉네임
                  </label>
                  <input
                    value={targetNickname}
                    onChange={e => setTargetNickname(e.target.value)}
                    placeholder="예: 연세베스트치과"
                    className="w-full h-[50px] p-3 rounded bg-white border border-gray-300
                               focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-all shadow-sm"
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
                    className="w-full h-[50px] p-3 rounded bg-white border border-gray-300
                               focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-all shadow-sm"
                  />
                </div>

                <div>
                  <button
                    onClick={() => handleCheck()}
                    disabled={loading}
                    className={`h-[50px] px-6 rounded font-bold text-white whitespace-nowrap transition-all shadow-md
                      ${
                        loading
                          ? 'bg-gray-400'
                          : 'bg-[#1a73e8] hover:bg-[#1557b0] hover:shadow-lg'
                      }`}
                  >
                    {loading ? `분석 중... ${progress}` : '순위 확인하기'}
                  </button>
                </div>
              </div>
            </div>

            {results.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4 text-center w-40">키워드</th>
                      <th className="px-6 py-4 text-center w-24">순위</th>
                      <th className="px-6 py-4 text-center w-32">작성일</th>
                      <th className="px-6 py-4 text-left">제목</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.map((r, i) => (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 text-center">{r.keyword}</td>
                        <td className="px-6 py-4 text-center">
                          {r.rank === 'Auth Error' ? (
                              <span className="text-sm text-red-500 font-bold">인증 실패</span>
                          ) : r.rank !== 'X' && r.rank !== 'Err' && r.rank !== 0 ? (
                            <span className="text-lg font-extrabold text-[#1a73e8]">{r.rank}</span>
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
          </div>
        </main>
      </div>

      <SavedSearchesDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        pageType="TOTAL" 
        onSelect={handleApplySavedSetting} 
      />
    </>
  );
}