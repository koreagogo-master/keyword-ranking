// keyword-ranking\app\analysis\components\6_KeywordStrategy.tsx
import React, { useMemo } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer
} from 'recharts';

// 도움말 툴팁 컴포넌트
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

  // 데이터 계산 로직 (원본 유지)
  const { displayScores, chartData } = useMemo(() => {
    const shares = stats.content.shares;
    const gVolume = stats.googleVolume || 0;

    const infoVal = Math.floor(((shares.blog || 0) + (shares.cafe || 0)) * 0.3);
    
    // 구글 검색량에 따른 상업성 보너스
    let googleCommBonus = 0;
    if (gVolume > 3000) googleCommBonus = 10;
    const commVal = (shares.shop || 0) * 5 + 15 + googleCommBonus;
    
    // 구글 검색량에 따른 이슈성 보너스
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
    <div className="bg-white border border-gray-200 p-8 shadow-sm flex flex-col items-center justify-center min-h-[420px]">
      {/* 제목 및 툴팁 */}
      <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-left justify-left w-full">
        키워드 성격 분석
        <InfoTip text="콘텐츠 점유율과 트렌드, 구글 검색량 등을 종합하여 키워드의 성격을 분석합니다." />
      </h3>

      {/* 방사형 차트 영역 */}
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 'bold' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="A" stroke="#1a73e8" strokeWidth={1} fill="#1a73e8" fillOpacity={0.3} dot={false} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 수치 요약 박스 */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="text-[11px] font-bold text-gray-500 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
          정보성:{displayScores.infoVal} | 상업성:{displayScores.commVal} | 이슈성:{displayScores.issueVal}
        </div>

        {/* ✅ [복구 완료] 구글 검색량 반영 알림 표시 */}
        {displayScores.googleVolume > 0 && (
          <div className="text-[10px] text-blue-500 font-bold bg-blue-50 px-3 py-1 rounded-md border border-blue-100 animate-pulse">
            * 구글 검색량 데이터가 분석에 반영되었습니다
          </div>
        )}
      </div>
    </div>
  );
}