'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import RankTabs from '@/components/RankTabs';
import { checkNaverBlogRank } from './actions';

import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from "@/app/contexts/AuthContext";
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";

interface SearchResultRow {
  keyword: string;
  rank: string | number;
  date: string;
  title: string;
  author: string;
  isSuccess: boolean;
}

const AUTHOR_COLORS = [
  'text-blue-600',
  'text-green-600',
  'text-amber-600',
  'text-pink-600',
  'text-purple-600',
  'text-orange-600',
  'text-cyan-600',
  'text-red-600',
];

export default function BlogRankPage() {
  const { user } = useAuth();
  const [targetNickname, setTargetNickname] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<SearchResultRow[]>([]);
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const nicknames = targetNickname
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const getAuthorColorClass = (author: string) => {
    if (!author || author === '-') return 'text-gray-400';
    let best = -1;
    let len = 0;
    nicknames.forEach((nick, i) => {
      if (author.includes(nick) && nick.length > len) {
        best = i;
        len = nick.length;
      }
    });
    return best >= 0 ? AUTHOR_COLORS[best % AUTHOR_COLORS.length] : 'text-gray-500';
  };

  const handleCheck = async (overrideNickname?: string, overrideKeyword?: string) => {
    const nickToSearch = overrideNickname !== undefined ? overrideNickname : targetNickname;
    const kwToSearch = overrideKeyword !== undefined ? overrideKeyword : keywordInput;

    if (!nickToSearch || !kwToSearch) {
      alert('닉네임과 키워드를 모두 입력해주세요.');
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
    
    if (!error) alert("현재 설정이 안전하게 저장되었습니다.");
    else alert("저장 중 오류가 발생했습니다.");
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false);
    
    const slicedKeywords = item.keyword.split(',').map((k: string) => k.trim()).filter(Boolean).slice(0, 10).join(', ');

    setTargetNickname(item.nickname);
    setKeywordInput(slicedKeywords);
    
    handleCheck(item.nickname, slicedKeywords);
  };

  const uniqueKeywords = Array.from(new Set(results.map(r => r.keyword)));

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        <Sidebar />
        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">
            <RankTabs />

            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">
                N 모바일 블로그 탭 순위 확인
              </h1>
              <div className="flex items-center gap-2">
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

            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-8">
              <div className="flex gap-4 items-end">
                <div className="w-1/4 min-w-[200px]">
                  <label className="block text-sm font-bold mb-2 text-gray-600">블로그 닉네임</label>
                  <input
                    value={targetNickname}
                    onChange={e => setTargetNickname(e.target.value)}
                    className="w-full p-3 h-[50px] border border-gray-300 rounded focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-all shadow-sm"
                    placeholder="예: 연세베스트치과"
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-bold mb-2 text-gray-600">키워드 (쉼표 구분)</label>
                  <input
                    value={keywordInput}
                    onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full p-3 h-[50px] border border-gray-300 rounded focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-all shadow-sm"
                    placeholder="부천교정, 부천치과"
                  />
                </div>

                <div>
                  <button
                    onClick={() => handleCheck()}
                    disabled={loading}
                    className={`h-[50px] px-6 rounded font-bold text-white transition-all shadow-md ${loading ? 'bg-gray-400' : 'bg-[#1a73e8] hover:bg-[#1557b0] hover:shadow-lg'}`}
                  >
                    {loading ? progress : '순위 확인하기'}
                  </button>
                </div>
              </div>
            </div>

            {results.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-4 text-gray-700">검색 결과 ({results.length}건)</h2>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider">
                      <tr>
                        <th className="p-4 border-b w-32">키워드</th>
                        <th className="p-4 border-b w-24 text-center">순위</th>
                        {/* 🌟 [수정됨] 작성일 칼럼 추가 */}
                        <th className="p-4 border-b w-32 text-center">작성일</th>
                        <th className="p-4 border-b">제목</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {uniqueKeywords.map((kw, i) => {
                        const rows = results.filter(r => r.keyword === kw);
                        return (
                          <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                            <td className="p-4 font-bold text-gray-900">{kw}</td>
                            <td className="p-4 text-center">
                              {rows.map((r, j) => (
                                <div key={j} className={`mb-1 last:mb-0 font-extrabold text-lg ${getAuthorColorClass(r.author)}`}>
                                  {r.rank}
                                </div>
                              ))}
                            </td>
                            {/* 🌟 [수정됨] 작성일 데이터 분리 */}
                            <td className="p-4 text-center text-sm text-gray-400 font-medium">
                              {rows.map((r, j) => (
                                <div key={j} className="mb-1 last:mb-0">
                                  {r.date}
                                </div>
                              ))}
                            </td>
                            {/* 🌟 [수정됨] 제목에서 괄호 안의 작성일 제거 */}
                            <td className="p-4 text-sm text-gray-700 font-medium">
                              {rows.map((r, j) => (
                                <div key={j} className="mb-1 last:mb-0">
                                  {r.title}
                                </div>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      
      <SavedSearchesDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        pageType="BLOG" 
        onSelect={handleApplySavedSetting} 
      />
    </>
  );
}