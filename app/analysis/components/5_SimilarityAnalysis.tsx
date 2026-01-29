/**
 * 5_SimilarityAnalysis.tsx
 * - 개선 사항: 지역명(앞 2글자) 가중치 로직 도입
 * - 컬럼 구성: [키워드] [유사도] [PC] [모바일] [합계]
 */

import React, { useState, useEffect } from 'react';

function safeNumber(v: any) {
  const num = Number(v);
  return isNaN(num) ? 0 : num;
}

// ✅ 업그레이드된 유사도 판별 로직
function getSimilarity(main: string, target: string) {
  const m = main.replace(/\s+/g, "").toLowerCase();
  const t = target.replace(/\s+/g, "").toLowerCase();
  
  // 1. 완전 포함은 무조건 '높음'
  if (t.includes(m) || m.includes(t)) return "높음";
  
  // 2. 지역명 가중치 (검색어의 첫 2글자가 포함되었는지 확인)
  const locationPrefix = m.substring(0, 2);
  const hasLocation = t.includes(locationPrefix);

  // 3. 글자 겹침 횟수 계산 (Bigram)
  let matchCount = 0;
  for (let i = 0; i < m.length - 1; i++) {
    if (t.includes(m.substring(i, i + 2))) matchCount++;
  }

  // ✅ 결과 판정
  // 지역명이 일치하고 다른 글자도 겹치면 '높음'
  if (hasLocation && matchCount >= 1) return "높음";
  // 지역명만 일치하거나 글자가 많이 겹치면 '보통'
  if (hasLocation || matchCount >= 2) return "보통";
  
  return "낮음";
}

export default function SimilarityAnalysis({ data, mainKeyword, onKeywordClick }: any) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => { setCurrentPage(1); }, [data]);

  if (!data || !data.relatedKeywords) return null;

  // 유사도 판별 및 '낮음' 필터링
  const filtered = data.relatedKeywords
    .map((item: any) => ({ 
      ...item, 
      similarity: getSimilarity(mainKeyword, item.relKeyword) 
    }))
    .filter((item: any) => item.similarity !== "낮음")
    .sort((a: any, b: any) => (safeNumber(b.monthlyPcQcCnt) + safeNumber(b.monthlyMobileQcCnt)) - (safeNumber(a.monthlyPcQcCnt) + safeNumber(a.monthlyMobileQcCnt)));

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="mt-12">
      <h2 className="text-xl font-bold text-gray-900 mb-4">유사 키워드 분석</h2>
      
      <div className="bg-white border border-gray-200 rounded-none overflow-hidden shadow-sm">
        <table className="w-full text-left text-[12px] border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
            <tr>
              <th className="px-4 py-4 font-bold">키워드</th>
              <th className="px-2 py-4 font-bold text-center">유사도</th>
              <th className="px-2 py-4 font-bold text-right">PC</th>
              <th className="px-2 py-4 font-bold text-right">모바일</th>
              <th className="px-4 py-4 font-bold text-right bg-blue-50/50 text-blue-700">합계</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentItems.map((item: any, i: number) => {
              const pc = safeNumber(item.monthlyPcQcCnt);
              const mo = safeNumber(item.monthlyMobileQcCnt);
              const total = pc + mo;

              return (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td onClick={() => onKeywordClick(item.relKeyword)} className="px-4 py-[18px] font-bold text-gray-800 cursor-pointer hover:text-blue-600 hover:underline">
                    {item.relKeyword}
                  </td>
                  <td className="px-2 py-[18px] text-center">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${item.similarity === '높음' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                      {item.similarity}
                    </span>
                  </td>
                  <td className="px-2 py-[18px] text-right text-gray-400">{pc.toLocaleString()}</td>
                  <td className="px-2 py-[18px] text-right text-gray-400">{mo.toLocaleString()}</td>
                  <td className="px-4 py-[18px] text-right font-bold text-blue-600 bg-blue-50/30">
                    {total.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 페이지네이션 (높이 조정을 위해 py-6 적용) */}
        <div className="flex items-center justify-center py-6 gap-6 bg-gray-50 border-t border-gray-200">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="w-10 h-10 rounded-md border border-gray-300 bg-white font-bold disabled:opacity-20 text-xl">{"<"}</button>
          <div className="text-sm text-gray-700">
            <span className="text-blue-600 font-black">{currentPage}</span> / {totalPages || 1}
          </div>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="w-10 h-10 rounded-md border border-gray-300 bg-white font-bold disabled:opacity-20 text-xl">{">"}</button>
        </div>
      </div>
    </div>
  );
}