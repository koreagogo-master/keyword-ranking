'use client';

import { useState } from 'react';
import { checkNaverBlogRank } from './actions';
import RankTabs from '@/components/RankTabs';

// 결과 타입 정의
interface SearchResultRow {
  keyword: string;
  rank: string | number;
  date: string;
  title: string;
  author: string;
  isSuccess: boolean;
}

export default function BlogRankPage() {
  const [targetNickname, setTargetNickname] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<SearchResultRow[]>([]);

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
        const response = await checkNaverBlogRank(currentKeyword, targetNickname);

        if (response.success && response.data && Array.isArray(response.data)) {
          const newRows = response.data.map((item) => ({
            keyword: currentKeyword,
            rank: item.rank,
            date: item.date,
            title: item.title,
            author: item.author,
            isSuccess: true
          }));
          setResults(prev => [...prev, ...newRows]);

        } else {
          setResults(prev => [...prev, {
            keyword: currentKeyword,
            rank: 'X',
            date: '-',
            title: '순위 내 없음',
            author: '-',
            isSuccess: false
          }]);
        }

      } catch (error) {
        console.error(error);
        setResults(prev => [...prev, {
          keyword: currentKeyword,
          rank: 'Err',
          date: '-',
          title: '오류 발생',
          author: '-',
          isSuccess: false
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
        
        <RankTabs />
        
        <h1 className="text-3xl font-bold mb-8 text-left text-blue-400">
          N 블로그 탭 순위 확인 (멀티 닉네임)
        </h1>
        
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg mb-8">
          <div className="flex gap-4 items-start">
            
            <div className="w-1/4 min-w-[200px]">
              <label className="block text-sm font-medium mb-2 text-gray-300">
                블로그 닉네임 (쉼표로 구분 가능)
              </label>
              <input 
                type="text"
                value={targetNickname}
                onChange={(e) => setTargetNickname(e.target.value)}
                placeholder="예: 연세베스트치과, 연세베스트치과입니다"
                className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 text-white h-[50px]"
              />
              <p className="text-xs text-gray-400 mt-2 ml-1">
                * 닉네임을 여러 개 입력하면 모두 찾습니다.
              </p>
            </div>

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
                className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 text-white h-[50px]"
              />
            </div>

            <div className="mt-[29px]">
              <button 
                onClick={handleCheck}
                disabled={loading}
                className={`h-[50px] px-6 rounded font-bold transition-all whitespace-nowrap flex items-center justify-center
                  ${loading ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-500'}`}
              >
                {loading ? `분석 중... ${progress}` : '순위 확인하기'}
              </button>
            </div>
          </div>
        </div>

        {results.length > 0 && (
          <div className="animate-fade-in-up">
            <h2 className="text-xl font-bold mb-4 text-gray-200">
              검색 결과 ({results.length}건)
            </h2>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-700 text-gray-300 text-xs uppercase">
                  <tr>
                    <th className="p-3 border-b border-gray-600 w-32">키워드</th>
                    <th className="p-3 border-b border-gray-600 w-16 text-center">순위</th>
                    {/* [수정됨] 작성자 칸 넓힘 (w-32 -> w-[200px]) */}
                    <th className="p-3 border-b border-gray-600 w-[200px] text-center">작성자</th>
                    <th className="p-3 border-b border-gray-600 w-24 text-center">작성일</th>
                    <th className="p-3 border-b border-gray-600 w-auto">제목</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {results.map((res, index) => (
                    <tr key={index} className="hover:bg-gray-700/50 transition-colors">
                      <td className="p-3 font-light text-white truncate">
                        {res.keyword}
                      </td>
                      
                      <td className="p-3 text-center">
                        {res.isSuccess ? (
                          <span className="text-base font-bold text-green-400">{res.rank}</span>
                        ) : (
                          <span className="text-xs text-red-400">{res.rank}</span>
                        )}
                      </td>

                      {/* [수정됨] 작성자 칸 데이터 표시 너비 조정 */}
                      <td className="p-3 text-center text-gray-300 text-sm truncate max-w-[200px]">
                         {res.author}
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