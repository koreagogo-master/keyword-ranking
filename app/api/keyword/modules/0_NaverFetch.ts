/**
 * 0_NaverFetch.ts
 * 역할: 네이버 API 호출 및 429(Too Many Requests) 발생 시 지능적 재시도 로직 수행
 */

// 잠시 대기 기능을 위한 헬퍼 함수
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ✅ fetchJson: API를 호출하고 실패 시 최대 4번까지 재시도합니다.
 */
export async function fetchJson(url: string, init?: RequestInit, retries = 4) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, init);
    
    // 1. 성공 시: 즉시 결과를 반환합니다. (속도 저하 없음)
    if (res.ok) {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }

    // 2. 429(Too Many Requests) 에러 발생 시
    if (res.status === 429 && i < retries - 1) {
      // 지수 백오프(Exponential Backoff): 시도 횟수가 늘어날수록 대기 시간을 2배씩 늘립니다.
      // (예: 1초 -> 2초 -> 4초 ...) + 랜덤 시간(부하 분산)
      const waitTime = Math.pow(2, i) * 1000 + Math.floor(Math.random() * 1000);
      
      console.warn(`⚠️ [네이버 제한] ${url.split('?')[0]}에서 429 발생. ${waitTime}ms 후 재시도합니다. (${i + 1}/${retries})`);
      
      await sleep(waitTime);
      continue; // 루프의 처음으로 돌아가 다시 시도
    }

    // 3. 429 이외의 에러나 재시도 횟수 초과 시
    const text = await res.text();
    let json: any = null;
    try { 
      json = text ? JSON.parse(text) : null; 
    } catch {
      // JSON 파싱 실패 시 무시
    }
    
    const msg = json?.errorMessage || json?.message || text || `HTTP ${res.status}`;
    throw new Error(`${res.status} ${res.statusText} - ${msg}`);
  }
}

/**
 * ✅ 네이버 검색 API용 헤더 생성
 */
export function getNaverHeaders(id: string, secret: string) {
  return {
    'X-Naver-Client-Id': id,
    'X-Naver-Client-Secret': secret,
    'Content-Type': 'application/json',
  };
}

/**
 * ✅ 모든 네이버 데이터를 한 번에 호출 (기존 9개 API)
 */
export async function fetchAllNaverData(keyword: string, config: any) {
  const { searchHeaders, adHeaders, start30Days, endDate, startDate } = config;

  // Promise.all을 통해 9개의 API를 병렬로 호출합니다.
  // 각 fetchJson 함수가 개별적으로 상태를 판단하여 재시도 여부를 결정합니다.
  return await Promise.all([
    fetchJson(`https://api.searchad.naver.com/keywordstool?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`, { headers: adHeaders }),
    fetchJson(`https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=100&start=1&sort=date`, { headers: searchHeaders }),
    fetchJson(`https://openapi.naver.com/v1/search/cafearticle.json?query=${encodeURIComponent(keyword)}&display=100&start=1&sort=date`, { headers: searchHeaders }),
    fetchJson(`https://openapi.naver.com/v1/search/kin.json?query=${encodeURIComponent(keyword)}&display=100&start=1&sort=date`, { headers: searchHeaders }),
    fetchJson(`https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=100&start=1&sort=date`, { headers: searchHeaders }),
    fetchJson('https://openapi.naver.com/v1/datalab/search', { method: 'POST', headers: searchHeaders, body: JSON.stringify({ startDate: start30Days, endDate, timeUnit: 'date', keywordGroups: [{ groupName: keyword, keywords: [keyword] }] }) }),
    fetchJson('https://openapi.naver.com/v1/datalab/search', { method: 'POST', headers: searchHeaders, body: JSON.stringify({ startDate: start30Days, endDate, timeUnit: 'date', keywordGroups: [{ groupName: keyword, keywords: [keyword] }], gender: 'f' }) }),
    fetchJson('https://openapi.naver.com/v1/datalab/search', { method: 'POST', headers: searchHeaders, body: JSON.stringify({ startDate: start30Days, endDate, timeUnit: 'date', keywordGroups: [{ groupName: keyword, keywords: [keyword] }], gender: 'm' }) }),
    fetchJson('https://openapi.naver.com/v1/datalab/search', { method: 'POST', headers: searchHeaders, body: JSON.stringify({ startDate, endDate, timeUnit: 'month', keywordGroups: [{ groupName: keyword, keywords: [keyword] }] }) }),
  ]);
}