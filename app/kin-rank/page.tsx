'use client';

import { useState } from 'react';
import { checkNaverKinRank } from './actions';
import Sidebar from '@/components/Sidebar';
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
  // 초기 상태 5개
  const [inputs, setInputs] = useState<InputRow[]>([
    { keyword: '', targetTitle: '' },
    { keyword: '', targetTitle: '' },
    { keyword: '', targetTitle: '' },
    { keyword: '', targetTitle: '' },
    { keyword: '', targetTitle: '' },
  ]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleInputChange = (index: number, field: keyof InputRow, value: string) => {
    const newInputs = [...inputs];
    newInputs[index][field] = value;
    setInputs(newInputs);
  };

  // [추가] 행 추가 로직
  const handleAddRow = () => {
    if (inputs.length >= 10) {
      alert('최대 10개까지만 입력 가능합니다.');
      return;
    }
    setInputs([...inputs, { keyword: '', targetTitle: '' }]);
  };

  // [추가] 행 삭제 로직
  const handleRemoveRow = (index: number) => {
    // 최소 1개는 유지하고 싶다면 아래 조건 사용 (선택사항)
    if (inputs.length <= 1) return;
    
    const newInputs = inputs.filter((_, i) => i !== index);
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
    <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] font-sans">
      <Sidebar />

      <main className="flex-1 ml-64 p-10">
        <div className="max-w-7xl mx-auto">
          
          <RankTabs />
          
          <h1 className="text-2xl font-normal text-gray-900 mb-8">
            N 지식인 통검노출, 순위, 날짜 확인
          </h1>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-10">
            <div className="flex flex-col gap-3">
              {inputs.map((row, index) => {
                // 마지막 줄인지 확인 (마지막 줄에만 + 표시)
                const isLastItem = index === inputs.length - 1;
                // 10개 꽉 찼으면 + 버튼 숨기기 위해 체크
                const isFull = inputs.length >= 10;

                return (
                  <div key={index} className="flex gap-4 items-end">
                    
                    {/* [버튼 영역] 좌측 배치 */}
                    <div className="w-[45px] flex-shrink-0">
                      {/* 첫 번째 줄일 때 라벨과의 줄 맞춤을 위한 빈 공간 */}
                      {index === 0 && <div className="mb-2 h-5"></div>}
                      
                      {isLastItem ? (
                        /* 마지막 줄: 10개 미만일 때 + 버튼, 10개면 - 버튼(혹은 숨김) */
                        !isFull ? (
                          <button
                            onClick={handleAddRow}
                            className="w-full h-[45px] rounded bg-blue-500 hover:bg-blue-600 text-white font-bold text-xl flex items-center justify-center transition-colors"
                            title="입력창 추가"
                          >
                            +
                          </button>
                        ) : (
                          /* 10개 꽉 찼을 때는 마지막 줄도 삭제 가능하게 - 처리 */
                          <button
                            onClick={() => handleRemoveRow(index)}
                            className="w-full h-[45px] rounded bg-red-100 hover:bg-red-200 text-red-500 font-bold text-xl flex items-center justify-center transition-colors"
                            title="삭제"
                          >
                            -
                          </button>
                        )
                      ) : (
                        /* 마지막 줄이 아니면: 삭제(-) 버튼 */
                        <button
                          onClick={() => handleRemoveRow(index)}
                          className="w-full h-[45px] rounded bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-red-500 font-bold text-xl flex items-center justify-center transition-colors"
                          title="삭제"
                        >
                          -
                        </button>
                      )}
                    </div>

                    <div className="flex-1">
                      {index === 0 && <label className="block text-sm font-medium mb-2 text-gray-600">키워드</label>}
                      <input 
                        type="text"
                        value={row.keyword}
                        onChange={(e) => handleInputChange(index, 'keyword', e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`키워드 ${index + 1}`}
                        className="w-full p-3 h-[45px] rounded bg-white border border-gray-300 focus:outline-none focus:border-[#1a73e8] text-gray-900 text-sm transition-colors"
                      />
                    </div>
                    <div className="flex-[2]">
                      {index === 0 && <label className="block text-sm font-medium mb-2 text-gray-600">찾을 제목</label>}
                      <input 
                        type="text"
                        value={row.targetTitle}
                        onChange={(e) => handleInputChange(index, 'targetTitle', e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`제목 식별 문구 ${index + 1}`}
                        className="w-full p-3 h-[45px] rounded bg-white border border-gray-300 focus:outline-none focus:border-[#1a73e8] text-gray-900 text-sm transition-colors"
                      />
                    </div>
                  </div>
                );
              })}

              <div className="mt-4">
                <button 
                  onClick={handleCheck}
                  disabled={loading}
                  className={`w-full py-3 rounded font-bold text-white transition-all
                    ${loading ? 'bg-gray-400' : 'bg-[#1a73e8] hover:bg-[#1557b0]'}`}
                >
                  {loading ? progress : '순위 확인하기 (입력된 항목 일괄 조회)'}
                </button>
              </div>
            </div>
          </div>

          {/* 결과 테이블 */}
          {results.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4 text-gray-700">검색 결과 ({results.length}건)</h2>
              
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="p-4 border-b w-32 text-center">키워드</th>
                      <th className="p-4 border-b w-24 text-center">통검 노출</th>
                      <th className="p-4 border-b w-24 text-center">탭 순위</th>
                      <th className="p-4 border-b w-32 text-center">작성일</th>
                      <th className="p-4 border-b w-auto text-left">제목</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.map((res, index) => (
                      <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-4 text-center font-semibold text-gray-900 truncate">{res.keyword}</td>
                        
                        <td className="p-4 text-center">
                          {res.isMainExposed === true ? (
                              <span className="px-2 py-1 rounded bg-blue-50 text-blue-600 text-xs font-bold border border-blue-200">노출 O</span>
                          ) : res.isMainExposed === false ? (
                              <span className="text-gray-400 text-sm font-medium">X</span>
                          ) : (
                              <span className="text-gray-300">-</span>
                          )}
                        </td>

                        <td className="p-4 text-center">
                          {res.tabRank !== 'X' && res.tabRank !== 'Err' ? (
                            <span className="text-lg font-bold text-[#1a73e8]">{res.tabRank}</span>
                          ) : (
                            <span className="text-sm text-red-400 font-medium">{res.tabRank}</span>
                          )}
                        </td>

                        <td className="p-4 text-center text-sm text-gray-400">
                          {res.date}
                        </td>

                        <td className="p-4 text-sm text-gray-600 truncate max-w-[400px]" title={res.title}>
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
      </main>
    </div>
  );
}