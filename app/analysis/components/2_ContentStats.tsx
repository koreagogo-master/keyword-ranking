/**
 * 2_ContentStats.tsx
 * 역할: 데이터가 정확하면 (리얼), 추정치가 포함되면 (추정)으로 글자가 자동 변경됩니다.
 */

import React from 'react';

function StatCell({ title, value, percent, highlight = false, showPercent = true, isLimit = false }: any) {
  const v = typeof value === "number" ? value : 0;
  return (
    <div className="border border-gray-100 p-5 bg-white">
      <div className="flex justify-between items-center mb-2">
        <div className="text-[11px] font-bold text-gray-500">{title}</div>
        {showPercent && <div className="text-[12px] font-bold text-gray-400 ml-2">{percent}%</div>}
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <div className={highlight ? "text-2xl font-bold text-blue-700" : "text-2xl font-light text-gray-900"}>
          {v.toLocaleString()}
          {/* 데이터 한계를 넘었을 때만 + 표시가 나타납니다. */}
          {isLimit && <span className="text-gray-300 font-normal ml-1 text-xl">+</span>}
        </div>
      </div>
    </div>
  );
}

export default function ContentStats({ stats }: { stats: any }) {
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">콘텐츠 분석</h2>

      <div className="bg-white border border-gray-200 p-8 rounded-none">
        <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center">전체(누적) & 플랫폼별 구성</h3>
        <div className="grid grid-cols-5 gap-4">
          <StatCell title="전체(누적)" value={stats.content.total} highlight showPercent={false} />
          <StatCell title="블로그" value={stats.content.blog} percent={stats.content.shares.blog} />
          <StatCell title="카페" value={stats.content.cafe} percent={stats.content.shares.cafe} />
          <StatCell title="지식인" value={stats.content.kin} percent={stats.content.shares.kin} />
          <StatCell title="뉴스" value={stats.content.news} percent={stats.content.shares.news} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-8 rounded-none">
        <h3 className="text-sm font-bold text-gray-900 mb-2">최근 30일 신규 발행 콘텐츠</h3>
        <p className="text-[11px] text-gray-400 font-bold mb-6">최근 30일 기준 신규 발행량 ( "+" 추가 되면 최소 그 이상의 데이터임)</p>
        <div className="grid grid-cols-4 gap-4">
          {/* ✅ 핵심 수정: isLimit 값에 따라 제목이 (추정) 또는 (리얼)로 바뀝니다. */}
          <StatCell 
            title={stats.content30.blogLimit ? "블로그(추정)" : "블로그(리얼)"} 
            value={stats.content30.blog} 
            isLimit={stats.content30.blogLimit} 
            showPercent={false} 
          />
          <StatCell 
            title={stats.content30.cafeLimit ? "카페(추정)" : "카페(리얼)"} 
            value={stats.content30.cafe} 
            isLimit={stats.content30.cafeLimit} 
            showPercent={false} 
          />
          <StatCell title="지식인(리얼)" value={stats.content30.kin} showPercent={false} />
          <StatCell title="뉴스(리얼)" value={stats.content30.news} showPercent={false} />
        </div>
      </div>
    </div>
  );
}