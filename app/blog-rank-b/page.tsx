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

  // 콤마로 구분된 닉네임 배열 생성
  const nicknames = targetNickname
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // 작성자 닉네임에 따라 색상 매칭
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

  // 중복 키워드 제거 (테이블 표시용)
  const uniqueKeywords = Array.from(new Set(results.map(r => r.keyword)));

  return (
    <>
      {/* 1. 에러 방지를 위해 표준 Link 태그 사용 */}
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />

      {/* 2. 폰트 적용 및 스타일 통일 */}
      <div 
        className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight"
        style={{ fontFamily: "'NanumSquare', sans-serif" }}
      >
        {/* 사이드바 */}
        <Sidebar />

        {/* 메인 영역 */}
        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">
            <RankTabs />

            {/* 타이틀 스타일 통일 */}
            <h1 className="text-2xl font-bold text-gray-900 mb-8">
              N 모바일 블로그 탭 순위 확인
            </h1>

            {/* 입력 영역 */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-8">
              <div className="flex gap-4 items-end">
                <div className="w-1/4 min-w-[200px]">
                  <label className="block text-sm font-bold mb-2 text-gray-600">
                    블로그 닉네임
                  </label>
                  <input
                    value={targetNickname}
                    onChange={e => setTargetNickname(e.target.value)}
                    className="w-full p-3 h-[50px] border border-gray-300 rounded 
                               focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-all shadow-sm"
                    placeholder="예: 연세베스트치과"
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
                    className="w-full p-3 h-[50px] border border-gray-300 rounded 
                               focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-all shadow-sm"
                    placeholder="부천교정, 부천치과"
                  />
                </div>

                <div>
                  <button
                    onClick={handleCheck}
                    disabled={loading}
                    className={`h-[50px] px-6 rounded font-bold text-white transition-all shadow-md ${
                      loading
                        ? 'bg-gray-400'
                        : 'bg-[#1a73e8] hover:bg-[#1557b0] hover:shadow-lg'
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
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold tracking-wider">
                      <tr>
                        <th className="p-4 border-b w-32">키워드</th>
                        <th className="p-4 border-b w-40 text-center">순위</th>
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
                                <span
                                  key={j}
                                  className={`font-extrabold text-lg ${getAuthorColorClass(
                                    r.author
                                  )}`}
                                >
                                  {r.rank}
                                  {j < rows.length - 1 && ' / '}
                                </span>
                              ))}
                            </td>
                            <td className="p-4 text-sm text-gray-700 font-medium">
                              {rows.map((r, j) => (
                                <div key={j} className="mb-1 last:mb-0">
                                  {r.title}
                                  {r.date !== '-' && (
                                    <span className="ml-2 text-xs text-gray-400 font-normal">
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
    </>
  );
}