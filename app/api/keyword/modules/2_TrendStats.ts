/**
 * 2_TrendStats.ts
 * 역할: 데이터랩에서 가져온 원본 데이터를 그래프용 통계로 변환합니다.
 */

/** ✅ 성별 비중 계산 */
export function calculateGenderRatio(dlFemale: any, dlMale: any) {
  const femaleSum = dlFemale?.results?.[0]?.data?.reduce((acc: number, cur: any) => acc + Number(cur.ratio || 0), 0) || 0;
  const maleSum = dlMale?.results?.[0]?.data?.reduce((acc: number, cur: any) => acc + Number(cur.ratio || 0), 0) || 0;
  
  const genderBase = femaleSum + maleSum;
  const femaleRatio = genderBase > 0 ? Math.round((femaleSum / genderBase) * 100) : 50;
  const maleRatio = 100 - femaleRatio;

  return { male: maleRatio, female: femaleRatio };
}

/** ✅ 요일별(주간) 트렌드 계산 */
export function calculateWeeklyTrend(dlTotal: any) {
  const daySums = [0, 0, 0, 0, 0, 0, 0]; // 일(0) ~ 토(6)
  
  dlTotal?.results?.[0]?.data?.forEach((item: any) => {
    const day = new Date(item.period).getDay();
    daySums[day] += Number(item.ratio || 0);
  });

  const weeklySum = daySums.reduce((a, b) => a + b, 0) || 1;
  return daySums.map((v) => Math.round((v / weeklySum) * 100));
}

/** ✅ 월별(연간) 트렌드 계산 */
export function calculateMonthlyTrend(dlMonthly: any) {
  const monthlyResults = dlMonthly?.results?.[0]?.data || [];
  const monthlySum = monthlyResults.reduce((acc: number, cur: any) => acc + Number(cur.ratio || 0), 0) || 1;

  return monthlyResults.map((item: any) => ({
    label: (item.period.split('-')[1] || '') + '월',
    value: Math.round((Number(item.ratio || 0) / monthlySum) * 100),
  }));
}