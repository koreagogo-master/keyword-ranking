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

    // 정보성: 기존 로직 유지
    const infoVal = Math.floor(((shares.blog || 0) + (shares.cafe || 0)) * 0.3);
    
    // 상업성: 기존 로직 유지
    let googleCommBonus = 0;
    if (gVolume > 3000) googleCommBonus = 10;
    const commVal = (shares.shop || 0) * 5 + 15 + googleCommBonus;
    
    // 이슈성: 기존 로직 유지
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

  const guide = useMemo(() => {
    const { infoVal, commVal, issueVal } = displayScores;
    const max = Math.max(infoVal, commVal, issueVal);
    if (max === commVal) return { title: "광고주들의 전쟁터입니다.", desc: "구매 의도가 매우 높은 키워드입니다. 단순한 포스팅보다는 '네이버 플레이스' 광고나 '파워링크' 광고를 통해 직접 노출을 노리는 것이 효율적입니다.", tag: "상업 집중형", color: "bg-red-500" };
    if (max === issueVal) return { title: "지금 물 들어올 때 노 저으세요!", desc: "최근 화제성이 폭발하고 있는 키워드입니다. 깊이 있는 분석보다는 현재 상황을 빠르게 전달하는 속보형 포스팅으로 트래픽을 선점하세요.", tag: "트렌드 민감형", color: "bg-orange-500" };
    return { title: "신뢰를 쌓기 가장 좋은 키워드입니다.", desc: "사람들이 정보를 찾기 위해 검색하는 단계입니다. 전문적이고 상세한 정보를 제공하여 블로그의 지수를 높이는 용도로 활용하기 최적입니다.", tag: "정보 제공형", color: "bg-blue-600" };
  }, [displayScores]);

  return (
    <div className="mt-10 font-['NanumSquare']">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
        TMG 핵심 전략 분석 (Google Data 통합)
        <InfoTip text="네이버와 구글의 데이터를 종합 분석하여 최적의 마케팅 전략을 제안합니다." />
      </h2>
      
      <div className="grid grid-cols-2 gap-0 border border-gray-200 bg-white rounded-none shadow-sm">
        {/* 왼쪽 패널: 정렬 방식을 justify-start로 변경하여 상단 여백 조절을 용이하게 함 */}
        <div className="p-8 border-r border-gray-100 flex flex-col items-center justify-start">
          
          {/* ✅ 1번 공백 수정: mt-12를 추가하여 상단 여백을 대폭 넓힘 */}
          <div className="w-full h-72 mt-12">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 13, fontWeight: 'bold' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="A" stroke="#1a73e8" strokeWidth={1} fill="#1a73e8" fillOpacity={0.3} dot={false} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* ✅ 2번 공백 수정: mt-6에서 mt-2로 줄여 차트와 지수 사이를 좁힘 */}
          <div className="mt-2 flex flex-col items-center gap-2">
            <div className="flex gap-5 text-[12px] font-bold text-gray-500">
              <div>정보성 지수 : {displayScores.infoVal}</div>
              <div>상업성 지수 : {displayScores.commVal}</div>
              <div>이슈성 지수 : {displayScores.issueVal}</div>
            </div>
            
            {displayScores.googleVolume > 0 && (
              <div className="text-[11px] text-blue-500 font-medium bg-blue-50 px-2 py-0.5 rounded">
                * 구글 월간 검색량: {displayScores.googleVolume.toLocaleString()}건 반영됨
              </div>
            )}
          </div>
        </div>
        
        <div className="p-10 flex flex-col justify-center bg-gray-50/30">
          <div className="mb-6">
            <span className={`px-3 py-1 text-white text-[11px] font-bold rounded-full ${guide.color}`}>{guide.tag}</span>
          </div>
          <h3 className="text-2xl font-light text-gray-900 mb-5 leading-tight break-keep">{guide.title}</h3>
          <p className="text-sm text-gray-600 leading-relaxed font-normal break-keep">{guide.desc}</p>
        </div>
      </div>
    </div>
  );
}