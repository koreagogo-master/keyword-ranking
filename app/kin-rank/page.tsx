'use client';

import { useState } from 'react';
import { checkNaverKinRank } from './actions';
import Sidebar from '@/components/Sidebar';
import RankTabs from '@/components/RankTabs';

import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from "@/app/contexts/AuthContext";
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";

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
  const { user } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

  const handleAddRow = () => {
    if (inputs.length >= 10) {
      alert('최대 10개까지만 입력 가능합니다.');
      return;
    }
    setInputs([...inputs, { keyword: '', targetTitle: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    if (inputs.length <= 1) return;
    const newInputs = inputs.filter((_, i) => i !== index);
    setInputs(newInputs);
  };

  const waitRandom = (min: number, max: number) => {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  const handleCheck = async (overrideInputs?: InputRow[]) => {
    const inputsToUse = overrideInputs || inputs;
    const validInputs = inputsToUse.filter(input => input.keyword.trim() !== '' && input.targetTitle.trim() !== '');

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

        // 🌟 [수정됨] 순위 뒤에 붙던 "위" 텍스트를 제거했습니다.
        const newResult: SearchResult = {
          keyword: keyword,
          success: data.success,
          tabRank: data.success ? (data.data?.tabRank && data.data.tabRank > 0 ? data.data.tabRank : 'X') : 'Err',
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

  const handleSaveCurrentSetting = async () => {
    const validInputs = inputs.filter(input => input.keyword.trim() !== '' && input.targetTitle.trim() !== '');
    if (validInputs.length === 0) {
      alert("최소 하나의 키워드와 찾을 제목을 입력한 후 저장해주세요.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user?.id,
      page_type: 'JISIKIN',
      jisikin_data: validInputs
    });
    
    if (!error) alert("현재 설정이 안전하게 저장되었습니다.");
    else alert("저장 중 오류가 발생했습니다.");
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false);
    
    if (item.jisikin_data && Array.isArray(item.jisikin_data)) {
      const loadedInputs = item.jisikin_data.slice(0, 10);
      
      const paddedInputs = [...loadedInputs];
      while (paddedInputs.length < 5) {
        paddedInputs.push({ keyword: '', targetTitle: '' });
      }

      setInputs(paddedInputs);
      handleCheck(loadedInputs);
    }
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css');
      `}</style>

      <div 
        className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" 
        style={{ fontFamily: "'NanumSquare', sans-serif" }}
      >
        <Sidebar />

        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">
            
            <RankTabs />
            
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">
                N 지식인 통검노출, 순위, 날짜 확인
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
            
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-10">
              <div className="flex flex-col gap-3">
                {inputs.map((row, index) => {
                  const isLastItem = index === inputs.length - 1;
                  const isFull = inputs.length >= 10;

                  return (
                    <div key={index} className="flex gap-4 items-end">
                      <div className="w-[45px] flex-shrink-0">
                        {index === 0 && <div className="mb-2 h-5"></div>}
                        
                        {isLastItem ? (
                          !isFull ? (
                            <button
                              onClick={handleAddRow}
                              className="w-full h-[45px] rounded bg-blue-500 hover:bg-blue-600 text-white font-bold text-xl flex items-center justify-center transition-colors shadow-sm"
                              title="입력창 추가"
                            >
                              +
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRemoveRow(index)}
                              className="w-full h-[45px] rounded bg-red-100 hover:bg-red-200 text-red-500 font-bold text-xl flex items-center justify-center transition-colors shadow-sm"
                              title="삭제"
                            >
                              -
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleRemoveRow(index)}
                            className="w-full h-[45px] rounded bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-red-500 font-bold text-xl flex items-center justify-center transition-colors shadow-sm"
                            title="삭제"
                          >
                            -
                          </button>
                        )}
                      </div>

                      <div className="flex-1">
                        {index === 0 && <label className="block text-sm font-bold mb-2 text-gray-600">키워드</label>}
                        <input 
                          type="text"
                          value={row.keyword}
                          onChange={(e) => handleInputChange(index, 'keyword', e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={`키워드 ${index + 1}`}
                          className="w-full p-3 h-[45px] rounded bg-white border border-gray-300 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] text-gray-900 text-sm font-medium transition-all shadow-sm"
                        />
                      </div>
                      <div className="flex-[2]">
                        {index === 0 && <label className="block text-sm font-bold mb-2 text-gray-600">찾을 제목</label>}
                        <input 
                          type="text"
                          value={row.targetTitle}
                          onChange={(e) => handleInputChange(index, 'targetTitle', e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={`제목 식별 문구 ${index + 1}`}
                          className="w-full p-3 h-[45px] rounded bg-white border border-gray-300 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] text-gray-900 text-sm font-medium transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="mt-4">
                  <button 
                    onClick={() => handleCheck()}
                    disabled={loading}
                    className={`w-full py-3 rounded font-bold text-white transition-all shadow-md
                      ${loading ? 'bg-gray-400' : 'bg-[#1a73e8] hover:bg-[#1557b0] hover:shadow-lg'}`}
                  >
                    {loading ? progress : '순위 확인하기 (입력된 항목 일괄 조회)'}
                  </button>
                </div>
              </div>
            </div>

            {results.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-4 text-gray-700">검색 결과 ({results.length}건)</h2>
                
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold tracking-wider">
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
                          <td className="p-4 text-center font-bold text-gray-900 truncate">{res.keyword}</td>
                          
                          <td className="p-4 text-center">
                            {res.isMainExposed === true ? (
                                <span className="px-2 py-1 rounded bg-blue-50 text-blue-600 text-xs font-bold border border-blue-200">노출 O</span>
                            ) : res.isMainExposed === false ? (
                                <span className="text-gray-400 text-xs font-medium">X</span>
                            ) : (
                                <span className="text-gray-300">-</span>
                            )}
                          </td>

                          <td className="p-4 text-center">
                            {res.tabRank !== 'X' && res.tabRank !== 'Err' ? (
                              <span className="text-lg font-extrabold text-[#1a73e8]">{res.tabRank}</span>
                            ) : (
                              <span className="text-sm text-red-400 font-medium">{res.tabRank}</span>
                            )}
                          </td>

                          <td className="p-4 text-center text-sm text-gray-400 font-medium">
                            {res.date}
                          </td>

                          <td className="p-4 text-sm text-gray-700 font-medium truncate max-w-[400px]" title={res.title}>
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

      <SavedSearchesDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        pageType="JISIKIN" 
        onSelect={handleApplySavedSetting} 
      />
    </>
  );
}