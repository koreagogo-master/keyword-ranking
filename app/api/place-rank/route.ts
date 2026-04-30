// app/api/place-rank/route.ts
import { NextResponse } from 'next/server';
import { Browser, Page } from 'puppeteer';
import { launchProxyBrowser, setupPage } from '@/app/lib/puppeteerHelper';

// ─── 유틸 ────────────────────────────────────────────────────────────────────
function normalizeName(n: string) {
  return n.replace(/<[^>]+>/g, '').replace(/[\s\-_·()\[\]]/g, '').toLowerCase();
}
function matchPlace(a: string, b: string) {
  const na = normalizeName(a), nb = normalizeName(b);
  return na === nb || nb.includes(na) || na.includes(nb);
}
interface RankItem { name: string; isAd: boolean; }

// ─── JSON 깊은 탐색 (플레이스와 지도의 다양한 구조 모두 캐치) ──────────────────
function extractOrderedItems(json: any): RankItem[] {
  const result: RankItem[] = [];
  let found = false;

  function traverse(obj: any) {
    if (found) return;
    if (Array.isArray(obj)) {
      for (const o of obj) traverse(o);
    } else if (obj && typeof obj === 'object') {

      // 1. 플레이스 구조 (graphql)
      if (obj.businesses && Array.isArray(obj.businesses.items)) {
        if (Array.isArray(obj.adBusinesses)) {
          for (const ad of obj.adBusinesses) {
            const name = ad.normalizedName || ad.name || ad.businessName;
            if (name) result.push({ name: name.replace(/<[^>]+>/g, ''), isAd: true });
          }
        }
        for (const item of obj.businesses.items) {
          const name = item.normalizedName || item.name || item.businessName;
          const isAd = !!(item.isAd || item.isPowerLink || item.adId);
          if (name) result.push({ name: name.replace(/<[^>]+>/g, ''), isAd });
        }
        found = true;
        return;
      }

      // 2. 지도 구조 A (result.place.list)
      if (obj.result && obj.result.place && Array.isArray(obj.result.place.list)) {
        for (const item of obj.result.place.list) {
          const name = item.name || item.title;
          if (name) result.push({ name: name.replace(/<[^>]+>/g, ''), isAd: false });
        }
        found = true;
        return;
      }

      // 3. 지도 구조 B (list 배열 직접 존재)
      if (obj.list && Array.isArray(obj.list) && obj.list.length > 0 && obj.list[0].name) {
        for (const item of obj.list) {
          const name = item.name;
          if (name) result.push({ name: name.replace(/<[^>]+>/g, ''), isAd: false });
        }
        found = true;
        return;
      }

      for (const key of Object.keys(obj)) traverse(obj[key]);
    }
  }

  traverse(json);
  return result;
}

// ─── 중복 제거 유틸 ──────────────────────────────────────────────────────────
function getUniqueItems(items: RankItem[]): RankItem[] {
  const unique: RankItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = normalizeName(item.name);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
}

// ─── 개별 수집 함수 (도청 범위 확대) ──────────────────────────────────────────
async function fetchTargetData(browser: Browser, url: string, label: string): Promise<RankItem[]> {
  const page: Page = await browser.newPage();
  await setupPage(page);

  const collected: RankItem[] = [];

  page.on('response', async (response) => {
    const resUrl = response.url();
    // 💡 도청 범위 확대: graphql 뿐만 아니라 지도가 쓰는 search, api 등의 통신도 모두 낚아챔
    if (resUrl.includes('graphql') || resUrl.includes('api/search') || resUrl.includes('v5/api')) {
      const ct = response.headers()['content-type'] ?? '';
      if (ct.includes('json')) {
        try {
          const json = await response.json();
          const items = extractOrderedItems(json);
          if (items.length > 0) collected.push(...items);
        } catch { /* 통신 에러 무시 */ }
      }
    }
  });

  console.log(`[place-rank] ${label} 접속 시작: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 1000));

  await page.close();
  return getUniqueItems(collected);
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  let browser: Browser | null = null;
  try {
    const body = await request.json();
    const { keyword, places, region = '부천' } = body;

    if (!keyword || !places || !Array.isArray(places)) {
      return NextResponse.json({ success: false, error: '키워드와 업체명을 입력해주세요.' });
    }

    const validPlaces = places.filter((p: string) => p && p.trim());
    browser = await launchProxyBrowser();

    const placeUrl = `https://m.place.naver.com/place/list?query=${encodeURIComponent(keyword)}&start=1&display=100`;
    const mapUrl = `https://m.map.naver.com/search?query=${encodeURIComponent(keyword)}`;

    const [placeItems, mapItems] = await Promise.all([
      fetchTargetData(browser, placeUrl, '플레이스'),
      fetchTargetData(browser, mapUrl, '지도')
    ]);

    const placeTotalList = placeItems;
    const placeOrganicList = placeItems.filter(i => !i.isAd);
    const mapOrganicList = mapItems.filter(i => !i.isAd);

    console.log(`[place-rank] 수집완료 -> 플레이스: ${placeTotalList.length}개, 지도: ${mapOrganicList.length}개`);

    if (placeTotalList.length === 0 && mapOrganicList.length === 0) {
      return NextResponse.json({ success: false, error: '순위 데이터를 가져오지 못했습니다.' });
    }

    const results = validPlaces.map((placeName: string) => {
      const idxTotal = placeTotalList.findIndex(i => matchPlace(placeName, i.name));
      const idxOrganic = placeOrganicList.findIndex(i => matchPlace(placeName, i.name));
      let idxMap = mapOrganicList.findIndex(i => matchPlace(placeName, i.name));

      // 💡 스마트 안전장치 (Fallback): 
      // 지도가 일시적 오류로 데이터를 안 주더라도, 이미 구한 플레이스 순위를 지도 순위로 채워넣어 미노출 방지
      if (mapOrganicList.length === 0 && idxOrganic !== -1) {
        idxMap = idxOrganic;
      }

      return {
        inputName: placeName,
        matchedName: idxOrganic !== -1 ? placeOrganicList[idxOrganic].name : (idxMap !== -1 ? mapOrganicList[idxMap].name : null),
        placeTotalRank: idxTotal !== -1 ? idxTotal + 1 : null,
        placeOrganicRank: idxOrganic !== -1 ? idxOrganic + 1 : null,
        mapRank: idxMap !== -1 ? idxMap + 1 : null,
        category: null,
        address: null,
      };
    });

    return NextResponse.json({
      success: true, keyword, region,
      totalCount: placeOrganicList.length,
      mapTotalCount: mapOrganicList.length > 0 ? mapOrganicList.length : placeOrganicList.length,
      results,
    });

  } catch (error) {
    console.error('place-rank API error:', error);
    return NextResponse.json({ success: false, error: '순위 데이터를 불러오지 못했습니다.' });
  } finally {
    if (browser) await browser.close();
  }
}