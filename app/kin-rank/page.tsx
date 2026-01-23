'use client';

import { useState } from 'react';
import { checkNaverKinRank } from './actions';
import RankTabs from '@/components/RankTabs';

interface SearchResult {
  keyword: string;
  success: boolean;
  tabRank: string | number;
  isMainExposed: boolean | null;
  title: string;
  date: string; 
}

interface InputRow {
  keyword: string;
  targetTitle: string;
}

export default function KinRankPage() {
  // [수정] 입력창을 10개로 늘렸습니다.
  const [inputs, setInputs] = useState<InputRow[]>([
    { keyword: '', targetTitle: '' },
    { keyword: '', targetTitle: '' },
    { keyword: '', targetTitle: '' },
    { keyword: '', targetTitle: '' },
    { keyword: '', targetTitle: '' },
    { keyword: '', targetTitle: '' }, // 6
    { keyword: '', targetTitle: '' }, // 7
    { keyword: '', targetTitle: '' }, // 8
    { keyword: '', targetTitle: '' }, // 9
    { keyword: '', targetTitle: '' }, // 10
  ]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleInputChange = (index: number, field: keyof InputRow, value: string) => {
    const newInputs = [...inputs];
    newInputs[index][field] = value;
    setInputs(newInputs);
  };

  const waitRandom = (min: number, max: number) => {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  const handleCheck = async () => {
    const validInputs = inputs.filter(input => input.keyword.trim() !== '' && input.targetTitle.trim() !== '');

    if (validInputs.length === 0) {
      alert('최소 하나의 키워드와 찾을 제목을 입력해주세요.');
      return;
    }

    setLoading(true);
    setResults([]); 
    
    for (let i = 0; i < validInputs.length; i++) {
      const { keyword, targetTitle } = validInputs[i];
      
      if (i > 0) {
          setProgress(`안전 대기 중... (${i + 1}/${validInputs.length})`);
          await waitRandom(2000, 4000);
      }

      setProgress(`${i + 1} / ${validInputs.length} 분석 중... (${keyword})`);

      try {
        const data = await checkNaverKinRank(keyword, targetTitle);

        const newResult: SearchResult = {
          keyword: keyword,
          success: data.success,
          tabRank: data.success ? (data.data?.tabRank && data.data.tabRank > 0 ? `${data.data.tabRank}위` : 'X') : 'Err',
          isMainExposed: data.success ? data.data?.isMainExposed || false : null,
          title: data.success ? data.data?.title || '' : '오류 발생',
          date: data.success ? data.data?.date || '-' : '-', 
        };

        setResults(prev => [...prev, newResult]);
      } catch (error) {
        console.error(error);
        setResults(prev => [...prev, {
          keyword: keyword,
          success: false,
          tabRank: 'Err',
          isMainExposed: null,
          title: '시스템 오류',
          date: '-'
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
    <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white p-10">
      <div className="max-w-7xl mx-auto mt-10">
        
        <RankTabs />
        
        <h1 className="text-3xl font-bold mb-8 text-left text-green-500">
          N 지식인 통검노출, 순위, 날짜 확인
        </h1>
        
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg mb-8">
          <div className="flex flex-col gap-4">
            {/* 10개로 늘어난 입력창 렌더링 */}
            {inputs.map((row, index) => (
              <div key={index} className="flex gap-4 items-start">
                <div className="w-1/3">
                  {index === 0 && <label className="block text-sm font-medium mb-2 text-gray-300">키워드</label>}
                  <input 
                    type="text"
                    value={row.keyword}
                    onChange={(e) => handleInputChange(index, 'keyword', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`키워드 ${index + 1}`}
                    className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-green-500 text-white"
                  />
                </div>
                <div className="w-2/3">
                  {index === 0 && <label className="block text-sm font-medium mb-2 text-gray-300">찾을 제목</label>}
                  <input 
                    type="text"
                    value={row.targetTitle}
                    onChange={(e) => handleInputChange(index, 'targetTitle', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`제목 식별 문구 ${index + 1}`}
                    className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-green-500 text-white"
                  />
                </div>
              </div>
            ))}

            <div className="mt-4">
              <button 
                onClick={handleCheck}
                disabled={loading}
                className={`w-full py-3 rounded font-bold transition-all
                  ${loading ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-500'}`}
              >
                {loading ? `🔄 ${progress}` : '순위 확인하기 (입력된 항목 일괄 조회)'}
              </button>
            </div>
          </div>
        </div>

        {results.length > 0 && (
          <div className="animate-fade-in-up">
            <h2 className="text-xl font-bold mb-4 text-gray-200">검색 결과 ({results.length}건)</h2>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-700 text-gray-300 text-xs uppercase">
                  <tr>
                    <th className="p-3 border-b border-gray-600 w-32 text-center">키워드</th>
                    <th className="p-3 border-b border-gray-600 w-24 text-center">통검 노출</th>
                    <th className="p-3 border-b border-gray-600 w-24 text-center">탭 순위</th>
                    <th className="p-3 border-b border-gray-600 w-32 text-center">작성일</th>
                    <th className="p-3 border-b border-gray-600 w-auto text-left">제목</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {results.map((res, index) => (
                    <tr key={index} className="hover:bg-gray-700/50 transition-colors">
                      <td className="p-3 text-center font-light text-white truncate">{res.keyword}</td>
                      
                      <td className="p-3 text-center">
                        {res.isMainExposed === true ? (
                            <span className="px-2 py-1 rounded bg-blue-900 text-blue-200 text-xs font-bold border border-blue-700">노출 O</span>
                        ) : res.isMainExposed === false ? (
                            <span className="text-gray-500 text-sm">X</span>
                        ) : (
                            <span className="text-gray-600">-</span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        {res.tabRank !== 'X' && res.tabRank !== 'Err' ? (
                          <span className="text-xl font-bold text-green-400">{res.tabRank}</span>
                        ) : (
                          <span className="text-sm text-red-400">{res.tabRank}</span>
                        )}
                      </td>

                      <td className="p-3 text-center text-sm text-gray-400">
                        {res.date}
                      </td>

                      <td className="p-3 text-sm text-gray-300 truncate max-w-[400px]" title={res.title}>
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