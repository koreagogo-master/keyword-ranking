// page.tsx
'use client';

import { useState, useRef } from 'react';

interface SectionItem {
  name: string;
  count: number;
  isSide?: boolean;
  subItems?: string[];
  subName?: string; 
  isAd?: boolean;   
}

export default function DebugMobileTestPage() {
  const [keyword, setKeyword] = useState('');
  const [mobileList, setMobileList] = useState<SectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const testApi = async () => {
    if (!keyword.trim()) return alert('키워드를 입력하세요.');
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setMobileList([]);

    try {
      const res = await fetch(`/api/debug-mobile?keyword=${encodeURIComponent(keyword)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('API 응답 오류');
      const data = await res.json();
      
      setMobileList(data.mobile || []);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error(error);
        alert('데이터 분석 중 오류가 발생했습니다.');
      }
    } finally {
      if (abortControllerRef.current === controller) setLoading(false);
    }
  };

  return (
    <div className="p-10 bg-gray-50 min-h-screen text-gray-900">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-extrabold mb-2 text-blue-600">🛠️ 모바일 로직 전용 테스트</h1>
        <p className="mb-6 text-gray-500 text-sm">/api/debug-mobile의 로직을 시각적으로 테스트합니다.</p>

        {/* 검색창 영역 */}
        <div className="flex gap-2 mb-8">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="테스트 키워드 입력"
            className="border border-gray-300 p-3 flex-1 rounded shadow-sm outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 bg-white"
            onKeyDown={(e) => e.key === 'Enter' && testApi()}
          />
          <button
            onClick={testApi}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? '분석 중...' : '데이터 확인'}
          </button>
        </div>

        {/* 결과 영역 */}
        {(loading || mobileList.length > 0) && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-sm">
            <div className="flex items-center px-6 h-[64px] border-b border-gray-200 bg-white">
              <h2 className="text-base font-extrabold text-gray-900">[MOBILE 섹션 테스트 결과]</h2>
            </div>
            
            <div className="px-6 py-4">
              {loading && <div className="mb-3 text-xs text-gray-500 animate-pulse">데이터를 불러오는 중…</div>}
              {!loading && mobileList.length === 0 && (
                <div className="text-sm text-gray-500 py-10 text-center">검색된 섹션 데이터가 없습니다.</div>
              )}
              <div className="divide-y divide-gray-100">
                {mobileList.map((item, idx) => (
                  <div key={idx} className="flex flex-col py-3 px-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center">
                      <div className="w-8 text-sm font-extrabold text-gray-400">{idx + 1}</div>
                      <div className="flex-1">
                        {/* 텍스트 크기와 색상을 부모 div에서 통일 시켰습니다. */}
                        <div className="text-sm font-bold text-gray-900 flex items-center gap-1">
                          <span>{item.name}</span>
                          
                          {/* subName을 name과 동일한 스타일로 출력합니다. */}
                          {item.subName && (
                            <span className="ml-0.5">
                              {item.subName}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* N개 노출 배지 로직은 그대로 두되, 값이 있을 때만 출력되도록 유지했습니다. */}
                      {item.count > 0 && (
                        <div className="text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {item.count}개 노출
                        </div>
                      )}
                    </div>
                    {item.subItems && item.subItems.length > 0 && (
                      <div className="mt-2 ml-8 flex flex-wrap gap-1">
                        {item.subItems.map((sub, sIdx) => (
                          <span key={sIdx} className="text-[11px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200">
                            "{sub}"
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}