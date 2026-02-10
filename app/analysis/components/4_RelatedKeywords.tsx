/**
 * 4_RelatedKeywords.tsx
 * - 순위 아이콘을 제거하고 텍스트로 변경하여 디자인을 간소화했습니다.
 */
import React, { useState, useEffect } from 'react';

function safeNumber(v: any) {
  const num = Number(v);
  return isNaN(num) ? 0 : num;
}

export default function RelatedKeywords({ data, onKeywordClick }: { data: any, onKeywordClick: (k: string) => void }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => { setCurrentPage(1); }, [data]);

  if (!data || !data.relatedKeywords) return null;

  const sortedKeywords = [...data.relatedKeywords].sort((a, b) => {
    const sumA = safeNumber(a.monthlyPcQcCnt) + safeNumber(a.monthlyMobileQcCnt);
    const sumB = safeNumber(b.monthlyPcQcCnt) + safeNumber(b.monthlyMobileQcCnt);
    return sumB - sumA;
  });

  const totalPages = Math.ceil(sortedKeywords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = sortedKeywords.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="mt-12">
      <h2 className="text-xl font-bold text-gray-900 mb-4">연관 키워드 분석 (조회수 기준)</h2>
      
      <div className="bg-white border border-gray-200 rounded-none overflow-hidden shadow-sm">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
            <tr>
              <th className="px-6 py-4 font-bold w-20 text-center">순위</th>
              <th className="px-6 py-4 font-bold">키워드</th>
              <th className="px-6 py-4 font-bold text-right">PC</th>
              <th className="px-6 py-4 font-bold text-right">모바일</th>
              <th className="px-6 py-4 font-bold text-right bg-blue-50/50 text-blue-700">총 검색량</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentItems.map((item: any, i: number) => {
              const pc = safeNumber(item.monthlyPcQcCnt);
              const mo = safeNumber(item.monthlyMobileQcCnt);
              const total = pc + mo;
              const rank = startIndex + i + 1;

              return (
                <tr key={rank} className="hover:bg-gray-50 transition-colors">
                  {/* ✅ 순위 아이콘 제거: 깔끔한 텍스트와 표준 패딩(py-4) 적용 */}
                  <td className="px-6 py-4 text-center text-gray-400 font-bold">
                    {rank}
                  </td>
                  <td 
                    onClick={() => onKeywordClick(item.relKeyword)}
                    className="px-6 py-4 font-bold text-gray-800 cursor-pointer hover:text-blue-600 hover:underline transition-all"
                  >
                    {item.relKeyword}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500">{pc.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-gray-500">{mo.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-bold text-blue-600 bg-blue-50/30">{total.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 페이지네이션 구역 */}
        <div className="flex items-center justify-center py-6 gap-6 bg-gray-50 border-t border-gray-200">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="flex items-center justify-center w-10 h-10 rounded-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-20 transition-all font-bold text-xl"
          >
            {"<"}
          </button>
          <div className="text-sm text-gray-700">
            <span className="text-blue-600 font-black text-base">{currentPage}</span>
            <span className="text-gray-400 mx-2 font-normal">/</span>
            <span className="font-medium text-gray-500">{totalPages}</span>
          </div>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="flex items-center justify-center w-10 h-10 rounded-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-20 transition-all font-bold text-xl"
          >
            {">"}
          </button>
        </div>
      </div>
    </div>
  );
}