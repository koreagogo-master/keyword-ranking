'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import RankTabs from '@/components/RankTabs';
import { checkNaverBlogRank } from './actions';

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
  const [targetNickname, setTargetNickname] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<SearchResultRow[]>([]);

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

    return best >= 0
      ? AUTHOR_COLORS[best % AUTHOR_COLORS.length]
      : 'text-gray-500';
  };

  const handleCheck = async () => {
    if (!targetNickname || !keywordInput) {
      alert('닉네임과 키워드를 모두 입력해주세요.');
      return;
    }

    const keywords = keywordInput
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    setLoading(true);
    setResults([]);

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      setProgress(`${i + 1} / ${keywords.length} 진행 중... (${keyword})`);

      try {
        const res = await checkNaverBlogRank(keyword, targetNickname);

        if (res.success && Array.isArray(res.data)) {
          const rows = res.data.map(item => ({
            keyword,
            rank: item.rank,
            date: item.date,
            title: item.title,
            author: item.author,
            isSuccess: true,
          }));
          setResults(prev => [...prev, ...rows]);
        } else {
          setResults(prev => [
            ...prev,
            {
              keyword,
              rank: 'X',
              date: '-',
              title: '순위 내 없음',
              author: '-',
              isSuccess: false,
            },
          ]);
        }
      } catch {
        setResults(prev => [
          ...prev,
          {
            keyword,
            rank: 'Err',
            date: '-',
            title: '오류 발생',
            author: '-',
            isSuccess: false,
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

  const uniqueKeywords = Array.from(new Set(results.map(r => r.keyword)));

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] font-sans">
      {/* 사이드바 */}
      <Sidebar />

      {/* 메인 영역 */}
      <main className="flex-1 ml-64 p-10">
        <div className="max-w-7xl mx-auto">
          <RankTabs />

          <h1 className="text-2xl font-normal text-gray-900 mb-8">
            N 모바일 블로그 탭 순위 확인
          </h1>

          {/* 입력 영역 */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-8">
            <div className="flex gap-4 items-start">
              <div className="w-1/4 min-w-[200px]">
                <label className="block text-sm font-medium mb-2 text-gray-600">
                  블로그 닉네임
                </label>
                {/* 🎨 테두리를 border-gray-300(진한 회색)으로 수정했습니다 */}
                <input
                  value={targetNickname}
                  onChange={e => setTargetNickname(e.target.value)}
                  className="w-full p-3 h-[50px] border border-gray-300 rounded 
                             focus:outline-none focus:border-[#1a73e8] transition-colors"
                  placeholder="예: 연세베스트치과"
                />
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium mb-2 text-gray-600">
                  키워드 (쉼표 구분)
                </label>
                {/* 🎨 테두리를 border-gray-300(진한 회색)으로 수정했습니다 */}
                <input
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full p-3 h-[50px] border border-gray-300 rounded 
                             focus:outline-none focus:border-[#1a73e8] transition-colors"
                  placeholder="부천교정, 부천치과"
                />
              </div>

              <div className="mt-[29px]">
                <button
                  onClick={handleCheck}
                  disabled={loading}
                  className={`h-[50px] px-6 rounded font-bold text-white transition-all ${
                    loading
                      ? 'bg-gray-400'
                      : 'bg-[#1a73e8] hover:bg-[#1557b0]'
                  }`}
                >
                  {loading ? progress : '순위 확인하기'}
                </button>
              </div>
            </div>
          </div>

          {/* 결과 테이블 */}
          {results.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4 text-gray-700">
                검색 결과 ({results.length}건)
              </h2>

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                    <tr>
                      <th className="p-4 border-b w-32">키워드</th>
                      <th className="p-4 border-b w-40 text-center">순위</th>
                      <th className="p-4 border-b">제목</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueKeywords.map((kw, i) => {
                      const rows = results.filter(r => r.keyword === kw);

                      return (
                        <tr key={i} className="hover:bg-blue-50/30">
                          <td className="p-4 font-semibold">{kw}</td>
                          <td className="p-4 text-center">
                            {rows.map((r, j) => (
                              <span
                                key={j}
                                className={`font-bold ${getAuthorColorClass(
                                  r.author
                                )}`}
                              >
                                {r.rank}
                                {j < rows.length - 1 && ' / '}
                              </span>
                            ))}
                          </td>
                          <td className="p-4 text-sm text-gray-600">
                            {rows.map((r, j) => (
                              <div key={j}>
                                {r.title}
                                {r.date !== '-' && (
                                  <span className="ml-2 text-xs text-gray-400">
                                    ({r.date})
                                  </span>
                                )}
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
  );
}