'use client';

import { useState } from 'react';
import { checkNaverBlogRank } from './actions';
// 1. 탭 컴포넌트 추가
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

    const keywords = keywordInput.split(',').map(k => k.trim()).filter(k => k.length > 0);
    if (keywords.length === 0) return;

    setLoading(true);
    setResults([]);
    
    for (let i = 0; i < keywords.length; i++) {
      const currentKeyword = keywords[i];
      setProgress(`${i + 1} / ${keywords.length} 진행 중... (${currentKeyword})`);

      try {
        const data = await checkNaverBlogRank(currentKeyword, targetNickname);

        const newResult: SearchResult = {
          keyword: currentKeyword,
          success: data.success,
          rank: data.success ? data.data?.totalRank || 0 : 'X',
          date: data.success ? data.data?.date || '-' : '-',
          title: data.success ? data.data?.title || '' : '순위 내 없음',
          author: data.success ? data.data?.author || '' : '-',
        };

        setResults(prev => [...prev, newResult]);
      } catch (error) {
        console.error(error);
        setResults(prev => [...prev, {
          keyword: currentKeyword,
          success: false,
          rank: 'Err',
          date: '-',
          title: '오류 발생',
          author: '-'
        }]);
      }
    }

    setLoading(false);
    setProgress('완료');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCheck();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto mt-10">
        
        {/* 2. 상단 탭 배치 */}
        <RankTabs />
        
        <h1 className="text-3xl font-bold mb-8 text-left text-blue-400">
          N 블로그 탭 순위 확인
        </h1>
        
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg mb-8">
          {/* 3. 입력창 및 버튼 가로 배치 (flex-row) */}
          <div className="flex gap-4 items-end">
            
            {/* 블로그 닉네임 */}
            <div className="w-1/4 min-w-[200px]">
              <label className="block text-sm font-medium mb-2 text-gray-300">
                블로그 닉네임
              </label>
              <input 
                type="text"
                value={targetNickname}
                onChange={(e) => setTargetNickname(e.target.value)}
                placeholder="예: 연세베스트치과"
                className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
              />
            </div>

            {/* 키워드 */}
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2 text-gray-300">
                키워드 (쉼표로 구분)
              </label>
              <input 
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="예: 부천교정, 부천치과"
                className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
              />
            </div>

            {/* 버튼 */}
            <button 
              onClick={handleCheck}
              disabled={loading}
              className={`w-auto px-6 py-3 rounded font-bold transition-all whitespace-nowrap
                ${loading ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-500'}`}
            >
              {loading ? `분석 중... ${progress}` : '순위 확인하기'}
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="animate-fade-in-up">
            {/* 4. 결과 제목 수정 (닉네임 표시) */}
            <h2 className="text-xl font-bold mb-4 text-gray-200">
              검색 결과 ({results.length}건)
              <span className="text-blue-400 ml-2 font-medium">
                 / 닉네임 ({targetNickname})
              </span>
            </h2>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-700 text-gray-300 text-xs uppercase">
                  <tr>
                    {/* 5. 닉네임 컬럼 제거 */}
                    <th className="p-3 border-b border-gray-600 w-48">키워드</th>
                    <th className="p-3 border-b border-gray-600 w-16 text-center">순위</th>
                    <th className="p-3 border-b border-gray-600 w-24 text-center">작성일</th>
                    <th className="p-3 border-b border-gray-600 w-auto max-w-[300px]">제목</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {results.map((res, index) => (
                    <tr key={index} className="hover:bg-gray-700/50 transition-colors">
                      {/* 닉네임 데이터 셀 제거 */}
                      <td className="p-3 font-light text-white truncate max-w-[12rem]">
                        {res.keyword}
                      </td>
                      
                      <td className="p-3 text-center">
                        {res.success ? (
                          <span className="text-base font-bold text-green-400">{res.rank}</span>
                        ) : (
                          <span className="text-xs text-red-400">{res.rank}</span>
                        )}
                      </td>
                      
                      <td className="p-3 text-center text-gray-400 text-sm">
                        {res.date}
                      </td>
                      
                      <td className="p-3 text-sm text-gray-300 truncate max-w-[300px]" title={res.title}>
                        {res.title}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}