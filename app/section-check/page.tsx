'use client';

import { useState } from 'react';
import { checkSectionOrder } from './actions';
import Header from '@/components/Header'; // 헤더 경로 확인 필요 (없으면 지워주세요)

interface SectionItem {
  order: number;
  name: string;
}

interface SectionResult {
  mobile: SectionItem[];
  pc: SectionItem[];
}

export default function SectionCheckPage() {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SectionResult | null>(null);

  const handleCheck = async () => {
    if (!keyword) {
      alert('키워드를 입력해주세요.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await checkSectionOrder(keyword);
      if (response.success && response.data) {
        setResult(response.data);
      } else {
        alert(response.message);
      }
    } catch (e) {
      console.error(e);
      alert('분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCheck();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto mt-10">
        <h1 className="text-3xl font-bold mb-2 text-left text-green-400">
          PC/MO 섹션 배치 분석
        </h1>
        <p className="text-gray-400 mb-8">
          특정 키워드 검색 시 네이버 상단에 어떤 섹션(블로그, 카페, 뉴스 등)이 먼저 나오는지 확인합니다.
        </p>

        {/* 검색 입력창 */}
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg mb-8">
          <div className="flex gap-4">
            <input 
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="분석할 키워드 입력 (예: 강남 맛집)"
              className="flex-1 p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-green-500 text-white h-[50px]"
            />
            <button 
              onClick={handleCheck}
              disabled={loading}
              className={`h-[50px] px-8 rounded font-bold transition-all whitespace-nowrap
                ${loading ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-500'}`}
            >
              {loading ? '분석 중...' : '확인하기'}
            </button>
          </div>
        </div>

        {/* 결과 화면 (2단 분리) */}
        {result && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up">
            
            {/* 1. 모바일 결과 */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                📱 모바일 통합검색 순서
              </h2>
              <div className="space-y-3">
                {result.mobile.length === 0 ? (
                  <p className="text-gray-500">데이터를 찾지 못했습니다.</p>
                ) : (
                  result.mobile.map((item) => (
                    <div key={item.order} className="flex items-center bg-gray-700 p-3 rounded border border-gray-600">
                      <span className="w-8 h-8 flex items-center justify-center bg-gray-900 rounded-full font-bold text-green-400 mr-3">
                        {item.order}
                      </span>
                      <span className="text-lg font-medium">{item.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. PC 결과 */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                💻 PC 통합검색 순서
              </h2>
              <div className="space-y-3">
                {result.pc.length === 0 ? (
                  <p className="text-gray-500">데이터를 찾지 못했습니다.</p>
                ) : (
                  result.pc.map((item) => (
                    <div key={item.order} className="flex items-center bg-gray-700 p-3 rounded border border-gray-600">
                      <span className="w-8 h-8 flex items-center justify-center bg-gray-900 rounded-full font-bold text-blue-400 mr-3">
                        {item.order}
                      </span>
                      <span className="text-lg font-medium">{item.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}