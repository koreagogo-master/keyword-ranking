/**
 * 1_SearchVolume.tsx
 * 역할: 월간 검색량, PC/Mobile 비중, 성별 비중 (디자인 통일 완료)
 */

import React from 'react';

// 도움말 팁 컴포넌트
function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-2">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-gray-200 text-gray-400 text-[11px] font-bold cursor-help select-none bg-white" title={text}>?</span>
      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-80 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-gray-600 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">{text}</span>
    </span>
  );
}

export default function SearchVolume({ stats }: { stats: any }) {
  if (!stats) return null;

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">월간 검색량</h2>
      
      <div className="grid grid-cols-3 gap-8">
        {/* 1. 검색량 수치 */}
        <div className="bg-white border border-gray-200 rounded-none shadow-sm overflow-hidden">
          {/* 헤더 */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center">
            <h3 className="text-[15px] font-bold text-gray-800 flex items-center">
              월간 검색량 합계
              <InfoTip text="네이버 검색광고 키워드툴 기준 (최근 30일)" />
            </h3>
          </div>
          {/* 내용 */}
          <div className="p-6 flex flex-col justify-center h-[140px]">
            <p className="text-4xl font-extrabold !text-gray-900">{stats.search.total.toLocaleString()}</p>
            <div className="mt-4 text-[12px] font-bold text-gray-500 flex gap-4">
              <span>PC: {stats.search.pc.toLocaleString()}</span>
              <span>Mobile: {stats.search.mobile.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 2. PC / Mobile 비중 */}
        <div className="bg-white border border-gray-200 rounded-none shadow-sm overflow-hidden">
          {/* 헤더 */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center">
            <h3 className="text-[15px] font-bold text-gray-800">PC / Mobile 비중</h3>
          </div>
          {/* 내용 */}
          <div className="p-6 flex flex-col justify-center h-[140px]">
            <div className="flex h-10 items-center w-full rounded-sm overflow-hidden">
              <div className="bg-gray-800 h-full flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${stats.ratios.devicePc}%` }}>
                {stats.ratios.devicePc > 15 && `PC ${stats.ratios.devicePc}%`}
              </div>
              <div className="bg-blue-500 h-full flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${stats.ratios.deviceMobile}%` }}>
                {stats.ratios.deviceMobile > 15 && `Mobile ${stats.ratios.deviceMobile}%`}
              </div>
            </div>
            <div className="flex justify-between text-[11px] mt-3 font-bold text-gray-500">
              <span>PC {stats.ratios.devicePc}%</span>
              <span>Mobile {stats.ratios.deviceMobile}%</span>
            </div>
          </div>
        </div>

        {/* 3. 성별 검색 비중 */}
        <div className="bg-white border border-gray-200 rounded-none shadow-sm overflow-hidden">
          {/* 헤더 */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center">
            <h3 className="text-[15px] font-bold text-gray-800">성별 검색 비중</h3>
          </div>
          {/* 내용 */}
          <div className="p-6 flex flex-col justify-center h-[140px]">
            <div className="flex h-10 items-center w-full rounded-sm overflow-hidden">
              <div className="bg-blue-500 h-full flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${stats.ratios.genderMale}%` }}>
                {stats.ratios.genderMale > 15 && `남성 ${stats.ratios.genderMale}%`}
              </div>
              <div className="bg-pink-400 h-full flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${stats.ratios.genderFemale}%` }}>
                {stats.ratios.genderFemale > 15 && `여성 ${stats.ratios.genderFemale}%`}
              </div>
            </div>
            <div className="flex justify-between text-[11px] mt-3 font-bold text-gray-500">
              <span>남성 {stats.ratios.genderMale}%</span>
              <span>여성 {stats.ratios.genderFemale}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}