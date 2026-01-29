/**
 * 4_RelatedKeywords.tsx
 * 역할: 검색된 키워드의 연관 키워드 목록을 표 형식으로 보여줍니다.
 */

import React from 'react';

// 숫자가 없을 경우를 대비한 안전 장치
function safeNumber(v: any) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export default function RelatedKeywords({ data }: { data: any }) {
  if (!data || !data.relatedKeywords) return null;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">연관 키워드</h2>
      <div className="bg-white border border-gray-200 rounded-none overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
            <tr>
              <th className="px-8 py-5 font-bold">순위</th>
              <th className="px-8 py-5 font-bold">키워드</th>
              <th className="px-8 py-5 font-bold text-right">월간 검색량</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.relatedKeywords.map((item: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-8 py-4 text-gray-400 font-bold">{i + 1}</td>
                <td className="px-8 py-4 font-bold text-gray-800">{item.relKeyword}</td>
                <td className="px-8 py-4 text-right font-medium text-blue-600">
                  {(
                    safeNumber(Number(item.monthlyPcQcCnt)) + 
                    safeNumber(Number(item.monthlyMobileQcCnt))
                  ).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}