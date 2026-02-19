import React, { useState, useEffect } from 'react';

function safeNumber(v: any) {
  const num = Number(v);
  return isNaN(num) ? 0 : num;
}

export default function RelatedKeywords({ data, onKeywordClick }: any) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => { setCurrentPage(1); }, [data]);

  if (!data || !data.relatedKeywords) return null;

  const sortedData = [...data.relatedKeywords].sort((a: any, b: any) => {
    const totalA = safeNumber(a.monthlyPcQcCnt) + safeNumber(a.monthlyMobileQcCnt);
    const totalB = safeNumber(b.monthlyPcQcCnt) + safeNumber(b.monthlyMobileQcCnt);
    return totalB - totalA;
  });

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const currentItems = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="mt-12">
      <h2 className="text-xl font-bold text-gray-900 mb-4">연관 키워드 분석 (조회수 기준)</h2>

      <div className="bg-white border border-gray-200 rounded-none overflow-hidden shadow-sm">
        {/* table-fixed 추가: 칼럼 너비 절대 고정 */}
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-[12px]">
            <tr>
              {/* 너비 지정 (합계 100%) */}
              <th className="px-4 py-4 font-bold text-center w-[10%]">순위</th>
              <th className="px-4 py-4 font-bold w-[35%]">키워드</th>
              <th className="px-2 py-4 font-bold text-right w-[15%]">PC</th>
              <th className="px-2 py-4 font-bold text-right w-[15%]">모바일</th>
              <th className="px-4 py-4 font-bold text-right bg-blue-50/50 text-blue-700 w-[25%]">총 검색량</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-gray-100 text-[14px]">
            {currentItems.map((item: any, i: number) => {
              const rank = (currentPage - 1) * itemsPerPage + i + 1;
              const pc = safeNumber(item.monthlyPcQcCnt);
              const mo = safeNumber(item.monthlyMobileQcCnt);
              const total = pc + mo;

              return (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-center text-gray-400 font-medium truncate">
                    {rank}
                  </td>
                  <td 
                    onClick={() => onKeywordClick(item.relKeyword)} 
                    className="px-4 py-4 font-bold text-gray-800 cursor-pointer hover:text-blue-600 hover:underline truncate"
                    title={item.relKeyword}
                  >
                    {item.relKeyword}
                  </td>
                  <td className="px-2 py-4 text-right text-gray-400 truncate">
                    {pc.toLocaleString()}
                  </td>
                  <td className="px-2 py-4 text-right text-gray-400 truncate">
                    {mo.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-blue-600 bg-blue-50/30 truncate">
                    {total.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex items-center justify-center py-6 gap-6 bg-gray-50 border-t border-gray-200">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
            disabled={currentPage === 1} 
            className="w-10 h-10 rounded-md border border-gray-300 bg-white font-bold disabled:opacity-20 text-xl"
          >
            {"<"}
          </button>
          <div className="text-sm text-gray-700">
            <span className="text-blue-600 font-black">{currentPage}</span> / {totalPages || 1}
          </div>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
            disabled={currentPage === totalPages} 
            className="w-10 h-10 rounded-md border border-gray-300 bg-white font-bold disabled:opacity-20 text-xl"
          >
            {">"}
          </button>
        </div>
      </div>
    </div>
  );
}