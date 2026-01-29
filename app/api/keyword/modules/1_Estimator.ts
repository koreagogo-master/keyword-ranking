/**
 * 1_Estimator.ts
 * 역할: 2만 건 기준으로 추정 여부를 계산합니다.
 */

export function parseYYYYMMDD(s?: string) {
  if (!s || typeof s !== 'string' || s.length !== 8) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function parsePubDate(s?: string) {
  if (!s || typeof s !== 'string') return null;
  const dt = new Date(s);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

export function estimateRecent30(total: number, items: any[], getDate: (it: any) => Date | null, start30: Date, isPrecise: boolean = false) {
  const sampleSize = Array.isArray(items) ? items.length : 0;
  if (total <= 0 || sampleSize <= 0) return { estimated: 0, isLimit: false };

  const newestDate = getDate(items[0]);
  const oldestDate = getDate(items[sampleSize - 1]);

  if (sampleSize < 100) {
    if (!newestDate) return { estimated: sampleSize, isLimit: false };
    let count = 0;
    for (const it of items) {
      const dt = getDate(it);
      if (dt && dt >= start30) count++;
    }
    return { estimated: count, isLimit: false };
  }

  if (!newestDate || !oldestDate) {
    const ratio = total > 1000000 ? 0.008 : 0.012;
    const est = Math.round(total * ratio);
    return { estimated: Math.min(total, est), isLimit: total > 50000 };
  }

  if (oldestDate < start30) {
    let recentCount = 0;
    for (const it of items) {
      const dt = getDate(it);
      if (dt && dt >= start30) recentCount++;
    }
    return { estimated: recentCount, isLimit: false };
  } 
  
  else {
    const diffTime = Math.abs(newestDate.getTime() - oldestDate.getTime());
    let diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffDays < 0.25) diffDays = (diffDays + 0.25) / 2;
    const dailyRate = sampleSize / diffDays;
    let estimated = Math.round(dailyRate * 30);
    const cap = Math.round(total * 0.03);
    if (estimated > cap && total > 10000) estimated = cap;
    return { estimated: Math.min(total, estimated), isLimit: total > 50000 || diffDays <= 0.3 };
  }
}