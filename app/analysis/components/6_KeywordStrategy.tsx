import React, { useMemo } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer
} from 'recharts';

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-2">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-gray-200 text-gray-400 text-[11px] font-bold cursor-help select-none" title={text}>?</span>
      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-80 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-gray-600 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">{text}</span>
    </span>
  );
}

export default function KeywordStrategy({ stats }: { stats: any }) {
  if (!stats) return null;

  const { displayScores, chartData } = useMemo(() => {
    const shares = stats.content.shares;
    const gVolume = stats.googleVolume || 0;

    const infoVal = Math.floor(((shares.blog || 0) + (shares.cafe || 0)) * 0.3);
    let googleCommBonus = 0;
    if (gVolume > 3000) googleCommBonus = 10;
    const commVal = (shares.shop || 0) * 5 + 15 + googleCommBonus;
    
    let googleIssueBonus = Math.floor(gVolume / 1500);
    if (googleIssueBonus > 15) googleIssueBonus = 15;

    let trendBonus = 0;
    if (stats.weeklyTrend && stats.weeklyTrend.length > 1) {
      const last = stats.weeklyTrend[stats.weeklyTrend.length - 1].value;
      const prev = stats.weeklyTrend[stats.weeklyTrend.length - 2].value;
      if (last > prev * 1.2) trendBonus = 10;
    }
    const issueVal = (shares.news || 0) * 4 + 10 + trendBonus + googleIssueBonus;

    const maxVal = Math.max(infoVal, commVal, issueVal, 1);
    const chartData = [
      { subject: '정보성', A: (infoVal / maxVal) * 100 },
      { subject: '상업성', A: (commVal / maxVal) * 100 },
      { subject: '이슈성', A: (issueVal / maxVal) * 100 },
    ];

    return { 
      displayScores: { 
        infoVal: Math.min(infoVal, 100), 
        commVal: Math.min(commVal, 100), 
        issueVal: Math.min(issueVal, 100),
        googleVolume: gVolume
      }, 
      chartData 
    };
  }, [stats]);

  return (
    <div className="mt-10 font-['NanumSquare']">
      {/* ✅ 메인 타이틀 변경 */}
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
        키워드 성격 및 섹션 노출
        <InfoTip text="네이버 통합검색의 섹션 배치 순서를 통해 실제 노출 가능성을 직접 판단하세요." />
      </h2>
      
      <div className="grid grid-cols-3 gap-0 border border-gray-200 bg-white rounded-none shadow-sm min-h-[420px]">
        
        {/* 좌측: 지표 (1/3) */}
        <div className="col-span-1 px-4 py-6 border-r border-gray-100 flex flex-col items-center justify-start">
          <div className="w-full h-64 mt-10">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 'bold' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="A" stroke="#1a73e8" strokeWidth={1} fill="#1a73e8" fillOpacity={0.3} dot={false} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-col items-center gap-1.5">
            <div className="flex flex-col items-center text-[11px] font-bold text-gray-500">
              <span>정보성:{displayScores.infoVal} | 상업성:{displayScores.commVal} | 이슈성:{displayScores.issueVal}</span>
            </div>
            {displayScores.googleVolume > 0 && (
              <div className="text-[10px] text-blue-500 font-medium bg-blue-50 px-2 py-0.5 rounded">
                * 구글 검색량 반영됨
              </div>
            )}
          </div>
        </div>

        {/* 우측: 섹션 비교 (2/3) */}
        <div className="col-span-2 p-10 flex flex-col bg-gray-50/30">
          <div className="flex justify-between items-end mb-8 border-b pb-4 border-gray-200">
            {/* ✅ 섹션 헤더 변경: 검색 키워드 포함 */}
            <h3 className="text-lg font-bold text-gray-800">"{stats.keyword || '해당 키워드'}" 검색 네이버 섹션 순서</h3>
          </div>

          <div className="grid grid-cols-2 gap-10">
            {/* PC 섹션 영역 */}
            <div>
              <div className="mb-4">
                {/* ✅ PC 헤더 변경: 박스 제거 및 텍스트만 유지 */}
                <h4 className="text-sm font-bold text-gray-700">PC 섹션</h4>
              </div>
              <ul className="space-y-2.5">
                {[
                  { name: "파워링크 (광고)" },
                  { name: "플레이스 (지도)" },
                  { name: "쇼핑 / 브랜드 검색" },
                  { name: "VIEW (블로그/카페)" },
                  { name: "지식iN / Q&A" },
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-[13px] text-gray-600 bg-white p-2.5 border border-gray-100 shadow-sm rounded">
                    <span className="font-bold text-gray-300 w-4">{idx + 1}</span>
                    <span className="font-medium">{item.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 모바일 섹션 영역 */}
            <div>
              <div className="mb-4">
                {/* ✅ MOBILE 헤더 변경: 박스 제거 및 텍스트만 유지 */}
                <h4 className="text-sm font-bold text-gray-700">MOBILE 섹션</h4>
              </div>
              <ul className="space-y-2.5">
                {[
                  { name: "파워링크 (광고)" },
                  { name: "브랜드 검색 / 플레이스" },
                  { name: "스마트블록 (인기글)" },
                  { name: "쇼핑 추천" },
                  { name: "지식iN / 동영상" },
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-[13px] text-gray-600 bg-white p-2.5 border border-gray-100 shadow-sm rounded">
                    <span className="font-bold text-gray-300 w-4">{idx + 1}</span>
                    <span className="font-medium">{item.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}