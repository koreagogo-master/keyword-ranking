/**
 * 3_TrendCharts.tsx (디자인 통일 및 최대 잔여법 적용)
 * - '연관 키워드' 섹션과 폰트, 굵기, 색상, 여백을 완벽하게 맞췄습니다.
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
  
  // ✅ [수정] 오타 등으로 데이터가 부족할 때 에러가 나지 않도록 안전 장치를 추가했습니다.
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
    <div className="mt-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        검색 관심도(트렌드)
      </h2>
      
      <div className="grid grid-cols-2 gap-8">
        
        {/* 1. 월별 분포 (최대 잔여법 적용) */}
        <div className="bg-white border border-gray-200 p-8 pt-12 rounded-none">
          <h3 className="text-sm font-bold text-gray-900 mb-10">연간 검색 비율 (월별 %)</h3>
          {/* ✅ 데이터가 하나도 없을 경우 표시 */}
          {final12.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-sm text-gray-400">데이터가 부족합니다.</div>
          ) : (
            <div className="flex items-end justify-between h-32 gap-1">
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
                    <div className="relative w-full bg-blue-50 flex-1">
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

              {lastMonthRaw && (
                <div className="flex-1 flex flex-col items-center h-full">
                  <div className="flex flex-col items-center mb-1 h-8 justify-end">
                    <span className="text-[9px] text-orange-500 font-bold leading-none mb-1">[예상]</span>
                    <span className="text-[10px] font-medium leading-none text-gray-500">{lastMonthValue}%</span>
                  </div>
                  <div className="relative w-full bg-blue-50 flex-1">
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

        {/* 2. 요일별 분포 */}
        <div className="bg-white border border-gray-200 p-8 pt-12 rounded-none">
          <h3 className="text-sm font-bold text-gray-900 mb-10">요일별 분포 (단위: 요일)</h3>
          <div className="flex items-end justify-between h-32 gap-3">
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
                  <div className="relative w-full bg-blue-50 flex-1">
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
  );
}