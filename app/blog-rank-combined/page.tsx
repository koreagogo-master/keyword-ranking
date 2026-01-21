'use client';

import { useState } from 'react';
import { checkNaverRank as checkRankA } from '../blog-rank/actions';
import { checkNaverBlogRank as checkRankB } from '../blog-rank-b/actions';

interface SearchResult {
  keyword: string;
  success: boolean;
  rank: string | number;
  date: string;
  title: string;
  author: string;
  url?: string;
}

export default function CombinedRankPage() {
  const [targetNickname, setTargetNickname] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  
  const [resultsA, setResultsA] = useState<SearchResult[]>([]);
  const [resultsB, setResultsB] = useState<SearchResult[]>([]);

  const handleCheck = async () => {
    if (!targetNickname || !keywordInput) {
      alert('닉네임과 키워드를 모두 입력해주세요.');
      return;
    }

    const keywords = keywordInput.split(',').map(k => k.trim()).filter(k => k.length > 0);
    if (keywords.length === 0) return;

    setLoading(true);
    setResultsA([]);
    setResultsB([]);
    
    for (let i = 0; i < keywords.length; i++) {
      const currentKeyword = keywords[i];
      setProgress(`${i + 1} / ${keywords.length} 진행 중... (${currentKeyword})`);

      try {
        // --- [Type A] 데이터 처리 ---
        const dataA = await checkRankA(currentKeyword, targetNickname);
        setResultsA(prev => [...prev, {
          keyword: currentKeyword,
          success: dataA.success,
          // Type A는 totalRank를 사용한다고 가정
          rank: dataA.success ? dataA.data?.totalRank || 0 : 'X',
          date: dataA.success ? dataA.data?.date || '-' : '-',
          title: dataA.success ? dataA.data?.title || '' : '순위 없음',
          author: dataA.success ? dataA.data?.author || '-' : '-',
          url: dataA.success ? dataA.data?.url : '',
        }]);

        // --- [Type B] 데이터 처리 (수정됨) ---
        const dataB = await checkRankB(currentKeyword, targetNickname);
        
        // [핵심 수정] Type B는 결과가 리스트(배열)로 오므로 첫 번째([0])를 꺼내야 함
        const firstItemB = (dataB.success && dataB.data && dataB.data.length > 0) 
          ? dataB.data[0] 
          : null;

        setResultsB(prev => [...prev, {
          keyword: currentKeyword,
          success: dataB.success,
          // totalRank 대신 rank 사용, dataB.data 대신 firstItemB 사용
          rank: firstItemB ? firstItemB.rank : 'X',
          date: firstItemB ? firstItemB.date : '-',
          title: firstItemB ? firstItemB.title : '순위 없음',
          author: firstItemB ? firstItemB.author : '-',
          url: firstItemB ? firstItemB.url : '',
        }]);

      } catch (error) {
        console.error(error);
      }
    }

    setLoading(false);
    setProgress('완료');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCheck();
  };

  const ResultTable = ({ title, data, color }: { title: string, data: SearchResult[], color: string }) => (
    <div className="flex-1">
      <h2 className={`text-xl font-bold mb-4 text-${color}-400 text-center`}>{title}</h2>
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-700 text-gray-300">
            <tr>
              <th className="p-3 w-32 text-center">닉네임</th>
              <th className="p-3 w-40">키워드</th>
              <th className="p-3 w-16 text-center">순위</th>
              <th className="p-3 w-24 text-center">작성일</th>
              <th className="p-3">제목 (클릭)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {data.map((res, idx) => (
              <tr key={idx} className="hover:bg-gray-700/50">
                <td className="p-3 text-center text-gray-300 truncate max-w-[150px]" title={res.author}>
                  {res.author}
                </td>
                <td className="p-3 font-medium text-white break-words">
                  {res.keyword}
                </td>
                <td className="p-3 text-center">
                  <span className={`font-bold text-lg ${res.success ? 'text-green-400' : 'text-red-400'}`}>
                    {res.rank}
                  </span>
                </td>
                <td className="p-3 text-center text-gray-400 text-xs whitespace-nowrap">
                  {res.date}
                </td>
                <td className="p-3 text-gray-300 truncate max-w-[300px]" title={res.title}>
                  {res.url ? (
                    <a 
                      href={res.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                    >
                      {res.title}
                    </a>
                  ) : (
                    <span>{res.title}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    // min-h-screen 수정 포함됨 (스크롤바 방지)
    <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white p-4">
      <div className="w-[95%] mx-auto mt-5">
        <h1 className="text-3xl font-bold mb-8 text-center text-purple-400">
          🚀 통합 순위 확인 (Type A + B)
        </h1>
        
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg mb-8 max-w-4xl mx-auto">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-sm text-gray-400 mb-1">블로그 닉네임</label>
                <input 
                  type="text" value={targetNickname} onChange={(e) => setTargetNickname(e.target.value)}
                  className="w-full p-3 rounded bg-gray-700 border border-gray-600 text-white focus:border-purple-500 outline-none"
                  placeholder="닉네임"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-gray-400 mb-1">키워드 (쉼표 구분)</label>
                <input 
                  type="text" value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} onKeyDown={handleKeyDown}
                  className="w-full p-3 rounded bg-gray-700 border border-gray-600 text-white focus:border-purple-500 outline-none"
                  placeholder="예: 강남맛집, 홍대카페"
                />
              </div>
            </div>
            <button 
              onClick={handleCheck} disabled={loading}
              className={`w-full py-3 rounded font-bold transition-all ${loading ? 'bg-gray-600' : 'bg-purple-600 hover:bg-purple-500'}`}
            >
              {loading ? `분석 중... ${progress}` : '두 가지 모드 동시 확인하기'}
            </button>
          </div>
        </div>

        {(resultsA.length > 0 || resultsB.length > 0) && (
          <div className="flex flex-col xl:flex-row gap-6 animate-fade-in-up">
            <ResultTable title="Type A (통합검색)" data={resultsA} color="blue" />
            <ResultTable title="Type B (블로그탭)" data={resultsB} color="green" />
          </div>
        )}
      </div>
    </div>
  );
}