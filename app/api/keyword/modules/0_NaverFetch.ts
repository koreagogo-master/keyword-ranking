/**
 * 0_NaverFetch.ts
 * 역할: 네이버의 모든 API 원본 데이터를 가져오기만 합니다.
 */

export async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok) {
    const msg = json?.errorMessage || json?.message || text || `HTTP ${res.status}`;
    throw new Error(`${res.status} ${res.statusText} - ${msg}`);
  }
  return json;
}

export function getNaverHeaders(id: string, secret: string) {
  return {
    'X-Naver-Client-Id': id,
    'X-Naver-Client-Secret': secret,
    'Content-Type': 'application/json',
  };
}

export async function fetchAllNaverData(keyword: string, config: any) {
  const { searchHeaders, adHeaders, start30Days, endDate, startDate } = config;

  // 네이버의 9개 API를 동시에 호출합니다. (뉴스 포함)
  return await Promise.all([
    fetchJson(`https://api.searchad.naver.com/keywordstool?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`, { headers: adHeaders }),
    fetchJson(`https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=100&start=1&sort=date`, { headers: searchHeaders }),
    fetchJson(`https://openapi.naver.com/v1/search/cafearticle.json?query=${encodeURIComponent(keyword)}&display=100&start=1&sort=date`, { headers: searchHeaders }),
    fetchJson(`https://openapi.naver.com/v1/search/kin.json?query=${encodeURIComponent(keyword)}&display=100&start=1&sort=date`, { headers: searchHeaders }),
    fetchJson(`https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=100&start=1&sort=date`, { headers: searchHeaders }), //
    fetchJson('https://openapi.naver.com/v1/datalab/search', { method: 'POST', headers: searchHeaders, body: JSON.stringify({ startDate: start30Days, endDate, timeUnit: 'date', keywordGroups: [{ groupName: keyword, keywords: [keyword] }] }) }),
    fetchJson('https://openapi.naver.com/v1/datalab/search', { method: 'POST', headers: searchHeaders, body: JSON.stringify({ startDate: start30Days, endDate, timeUnit: 'date', keywordGroups: [{ groupName: keyword, keywords: [keyword] }], gender: 'f' }) }),
    fetchJson('https://openapi.naver.com/v1/datalab/search', { method: 'POST', headers: searchHeaders, body: JSON.stringify({ startDate: start30Days, endDate, timeUnit: 'date', keywordGroups: [{ groupName: keyword, keywords: [keyword] }], gender: 'm' }) }),
    fetchJson('https://openapi.naver.com/v1/datalab/search', { method: 'POST', headers: searchHeaders, body: JSON.stringify({ startDate, endDate, timeUnit: 'month', keywordGroups: [{ groupName: keyword, keywords: [keyword] }] }) }),
  ]);
}