/**
 * 1_SearchVolume.tsx
 * 역할: 월간 검색량, PC/Mobile 비중, 성별 비중 섹션을 담당합니다.
 */

import React from 'react';

// 도움말 팁 컴포넌트
function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-2">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-gray-200 text-gray-400 text-[11px] font-bold cursor-help select-none" title={text}>?</span>
      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-80 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-gray-600 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">{text}</span>
    </span>
  );
}

export default function SearchVolume({ stats }: { stats: any }) {
  if (!stats) return null;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">월간 검색량</h2>
      <div className="grid grid-cols-3 gap-0 border border-gray-200 bg-white rounded-none">
        {/* 1. 검색량 수치 */}
        <div className="p-8 border-r border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center">
            월간 검색량<InfoTip text="네이버 검색광고 키워드툴 기준입니다." />
          </h3>
          <p className="text-4xl font-light text-gray-900">{stats.search.total.toLocaleString()}</p>
          <div className="mt-4 text-[11px] font-bold text-gray-500 flex gap-4">
            <span>PC {stats.search.pc.toLocaleString()}</span>
            <span>Mobile {stats.search.mobile.toLocaleString()}</span>
          </div>
        </div>

        {/* 2. PC/Mobile 비중 바 */}
        <div className="p-8 border-r border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-2">PC / Mobile 비중</h3>
          <div className="mt-6">
            <div className="flex h-10 items-center">
              <div className="bg-gray-800 h-full" style={{ width: `${stats.ratios.devicePc}%` }} />
              <div className="bg-blue-400 h-full" style={{ width: `${stats.ratios.deviceMobile}%` }} />
            </div>
            <div className="flex justify-between text-[11px] mt-3 font-bold text-gray-500">
              <span>PC {stats.ratios.devicePc}%</span>
              <span>Mobile {stats.ratios.deviceMobile}%</span>
            </div>
          </div>
        </div>

        {/* 3. 성별 비중 바 */}
        <div className="p-8">
          <h3 className="text-sm font-bold text-gray-900 mb-2">성별 검색 비중</h3>
          <div className="flex h-10 items-center mt-6">
            <div className="bg-blue-500 h-full" style={{ width: `${stats.ratios.genderMale}%` }} />
            <div className="bg-pink-400 h-full" style={{ width: `${stats.ratios.genderFemale}%` }} />
          </div>
          <div className="flex justify-between text-[11px] mt-3 font-bold text-gray-500">
            <span>남성 {stats.ratios.genderMale}%</span>
            <span>여성 {stats.ratios.genderFemale}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}