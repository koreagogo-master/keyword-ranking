/**
 * 3_TrendCharts.tsx (디자인 통일 완료)
 * - 회색 헤더 + 흰색 박스 + 그림자 스타일 적용
 * - 최대 잔여법 로직 유지
 */

import React from 'react';

export default function TrendCharts({ stats }: { stats: any }) {
  if (!stats || !stats.monthlyTrend || !stats.weeklyTrend) return null;

  // --- [A] 월별 데이터 정밀 재계산 (최대 잔여법) ---
  const monthlyRaw = stats.monthlyTrend;
  const base12Months = monthlyRaw.slice(0, 12);
  const sum12 = base12Months.reduce((acc: number, cur: any) => acc + (Number(cur.value) || 0), 0) || 1;

  let floorSum = 0;
  const processed12 = base12Months.map((item: any, index: number) => {
    const rawValue = (Number(item.value) || 0) * (100 / sum12);
    const floorValue = Math.floor(rawValue);
    floorSum += floorValue;
    return {
      index,
      label: item.label,
      rawValue,
      floorValue,
      remainder: rawValue - floorValue
    };
  });

  let difference = 100 - floorSum;
  const sortedByRemainder = [...processed12].sort((a, b) => b.remainder - a.remainder);
  
  for (let i = 0; i < difference; i++) {
    if (sortedByRemainder[i]) {
      sortedByRemainder[i].floorValue += 1;
    }
  }

  const final12 = [...processed12].sort((a, b) => a.index - b.index);
  
  const lastMonthRaw = monthlyRaw[12];
  const lastMonthValue = lastMonthRaw ? Math.round((Number(lastMonthRaw.value) || 0) * (100 / sum12)) : 0;

  const allFinalValues = [...final12.map(d => d.floorValue), lastMonthValue];
  const maxMonthly = Math.max(...allFinalValues, 0.1);
  const maxWeekly = Math.max(...stats.weeklyTrend.map((val: number) => val || 0), 0.1);

  return (
    <div className="space-y-8 mt-12">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        검색 관심도(트렌드)
      </h2>
      
      <div className="grid grid-cols-2 gap-8">
        
        {/* 1. 월별 분포 카드 */}
        <div className="bg-white border border-gray-200 rounded-none shadow-sm overflow-hidden">
          {/* 헤더 */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center h-[60px]">
            <h3 className="text-[15px] font-bold text-gray-800">연간 검색 비율 (월별 %)</h3>
          </div>
          
          {/* 차트 영역 */}
          <div className="p-8">
            {final12.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-gray-400">데이터가 부족합니다.</div>
            ) : (
              <div className="flex items-end justify-between h-40 gap-1">
                {final12.map((item, i) => {
                  const val = item.floorValue;
                  const relativeHeight = (val / maxMonthly) * 100;
                  const isMax = val === Math.round(maxMonthly) && val > 0;
                  
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center h-full">
                      <div className="flex flex-col items-center mb-1 h-8 justify-end">
                        <span className={`text-[10px] font-medium leading-none ${isMax ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                          {val}%
                        </span>
                      </div>
                      <div className="relative w-full bg-blue-50 flex-1 rounded-t-sm overflow-hidden">
                        <div 
                          className="absolute bottom-0 w-full transition-all duration-300" 
                          style={{ 
                            height: `${relativeHeight}%`,
                            backgroundColor: isMax ? '#1a73e8' : '#8ab4f8'
                          }} 
                        />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 mt-2">{item.label}</span>
                    </div>
                  );
                })}

                {/* 마지막 달 (예상) */}
                {lastMonthRaw && (
                  <div className="flex-1 flex flex-col items-center h-full">
                    <div className="flex flex-col items-center mb-1 h-8 justify-end">
                      <span className="text-[9px] text-orange-500 font-bold leading-none mb-1">[예상]</span>
                      <span className="text-[10px] font-medium leading-none text-gray-500">{lastMonthValue}%</span>
                    </div>
                    <div className="relative w-full bg-blue-50 flex-1 rounded-t-sm overflow-hidden">
                      <div 
                        className="absolute bottom-0 w-full transition-all duration-300" 
                        style={{ 
                          height: `${(lastMonthValue / maxMonthly) * 100}%`,
                          backgroundColor: '#d1d5db'
                        }} 
                      />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 mt-2">{lastMonthRaw.label}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. 요일별 분포 카드 */}
        <div className="bg-white border border-gray-200 rounded-none shadow-sm overflow-hidden">
          {/* 헤더 */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center h-[60px]">
            <h3 className="text-[15px] font-bold text-gray-800">요일별 분포 (단위: 요일)</h3>
          </div>

          {/* 차트 영역 */}
          <div className="p-8">
            <div className="flex items-end justify-between h-40 gap-3">
              {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => {
                const val = Math.round(Number(stats.weeklyTrend[i] || 0));
                const relativeHeight = (val / maxWeekly) * 100;
                const isMax = val === Math.round(maxWeekly) && val > 0;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full">
                    <div className="flex flex-col items-center mb-1 h-8 justify-end">
                      <span className={`text-[11px] font-medium leading-none ${isMax ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                        {val}%
                      </span>
                    </div>
                    <div className="relative w-full bg-blue-50 flex-1 rounded-t-sm overflow-hidden">
                      <div 
                        className="absolute bottom-0 w-full transition-all duration-300" 
                        style={{ 
                          height: `${relativeHeight}%`,
                          backgroundColor: isMax ? '#1a73e8' : '#8ab4f8' 
                        }} 
                      />
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 mt-2">{day}요일</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}