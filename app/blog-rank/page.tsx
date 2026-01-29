'use client';

import { useState } from 'react';
import { checkNaverRank } from './actions';
import Sidebar from '@/components/Sidebar';
import RankTabs from '@/components/RankTabs';

interface SearchResult {
  keyword: string;
  success: boolean;
  rank: string | number;
  date: string;
  title: string;
  author: string;
}

export default function BlogRankPage() {
  const [targetNickname, setTargetNickname] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

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
        const data = await checkNaverRank(keyword, targetNickname);

        setResults(prev => [
          ...prev,
          {
            keyword,
            success: data.success,
            rank: data.success ? data.data?.totalRank || 0 : 'X',
            date: data.success ? data.data?.date || '-' : '-',
            title: data.success ? data.data?.title || '' : '순위 내 없음',
            author: data.success ? data.data?.author || '' : '-',
          },
        ]);
      } catch {
        setResults(prev => [
          ...prev,
          {
            keyword,
            success: false,
            rank: 'Err',
            date: '-',
            title: '오류 발생',
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

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] font-sans">
      {/* 사이드바 */}
      <Sidebar />

      {/* 메인 영역: p-10 으로 여백 통일 */}
      <main className="flex-1 ml-64 p-10">
        <div className="max-w-7xl mx-auto">
          {/* 탭 메뉴 */}
          <RankTabs />

          {/* 제목 영역: blog-rank-b와 동일한 스타일 적용 */}
          <h1 className="text-2xl font-normal text-gray-900 mb-8">
            N 모바일 통검 순위 확인
          </h1>

          {/* 입력 영역 */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-10">
            <div className="flex gap-4 items-start">
              <div className="w-1/4 min-w-[200px]">
                <label className="block text-sm font-medium mb-2 text-gray-600">
                  블로그 닉네임
                </label>
                <input
                  value={targetNickname}
                  onChange={e => setTargetNickname(e.target.value)}
                  placeholder="예: 연세베스트치과"
                  className="w-full h-[50px] p-3 rounded bg-white border border-gray-300
                             focus:outline-none focus:border-[#1a73e8] transition-colors"
                />
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium mb-2 text-gray-600">
                  키워드 (쉼표 구분)
                </label>
                <input
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="부천교정, 부천치과"
                  className="w-full h-[50px] p-3 rounded bg-white border border-gray-300
                             focus:outline-none focus:border-[#1a73e8] transition-colors"
                />
              </div>

              <div className="mt-[29px]">
                <button
                  onClick={handleCheck}
                  disabled={loading}
                  className={`h-[50px] px-6 rounded font-bold text-white whitespace-nowrap transition-all
                    ${
                      loading
                        ? 'bg-gray-400'
                        : 'bg-[#1a73e8] hover:bg-[#1557b0]'
                    }`}
                >
                  {loading ? `분석 중... ${progress}` : '순위 확인하기'}
                </button>
              </div>
            </div>
          </div>

          {/* 결과 테이블 */}
          {results.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 text-left">키워드</th>
                    <th className="px-6 py-4 text-center">순위</th>
                    <th className="px-6 py-4 text-center">작성일</th>
                    <th className="px-6 py-4 text-left">제목</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t hover:bg-blue-50/30">
                      <td className="px-6 py-4 font-semibold">{r.keyword}</td>
                      <td className="px-6 py-4 text-center font-bold text-[#1a73e8]">
                        {r.rank}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-400">
                        {r.date}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
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
  );
}