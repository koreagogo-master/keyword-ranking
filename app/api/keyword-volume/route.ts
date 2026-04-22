// app/api/keyword-volume/route.ts
// 역할: 네이버 검색광고 API(keywordstool)로 다수 키워드의 월간 조회수 조회
// 수정: 1회 최대 5개 제한 → 청킹 후 순차 호출 + 병합

import { NextResponse } from 'next/server';
import crypto from 'crypto';

// ─── 유틸: 배열을 n개씩 청크로 분할 ──────────────────────────────────────────
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── 유틸: 딜레이 (Rate Limit 방지) ─────────────────────────────────────────
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── 유틸: 네이버 API 서명 생성 ──────────────────────────────────────────────
function makeSignature(secretKey: string): { timestamp: string; signature: string } {
  const timestamp = Date.now().toString();
  const message = `${timestamp}.GET./keywordstool`;
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('base64');
  return { timestamp, signature };
}

// ─── 유틸: 조회수 값 파싱 ("< 10" 문자열 → 5 처리) ──────────────────────────
function parseQcCnt(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return 5; // "< 10" 처리
  return 0;
}

// ─── 네이버 API 1회 호출 (청크 단위) ─────────────────────────────────────────
async function fetchKeywordChunk(
  chunk: string[],
  customerId: string,
  apiKey: string,
  secretKey: string
): Promise<any[]> {
  const { timestamp, signature } = makeSignature(secretKey);

  const url = new URL('https://api.naver.com/keywordstool');
  url.searchParams.set('hintKeywords', chunk.join(','));
  url.searchParams.set('showDetail', '1');

  console.log(`[keyword-volume] 청크 호출: [${chunk.join(', ')}]`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Timestamp': timestamp,
      'X-API-KEY': apiKey,
      'X-Customer': customerId,
      'X-Signature': signature,
    },
  });

  if (!response.ok) {
    const rawText = await response.text();
    console.error(`[keyword-volume] 청크 호출 실패 (${response.status}):`, rawText);
    throw new Error(`네이버 API 오류 (${response.status}): ${rawText}`);
  }

  const data = await response.json();
  const list: any[] = data.keywordList || [];
  console.log(`[keyword-volume] 청크 응답 keywordList 수: ${list.length}`);
  return list;
}

// ─── 메인 핸들러 ──────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const body = await request.json();
  const keywords: string[] = body.keywords;

  if (!Array.isArray(keywords) || keywords.length === 0) {
    return NextResponse.json({ error: '키워드 목록이 필요합니다.' }, { status: 400 });
  }

  if (keywords.length > 100) {
    return NextResponse.json({ error: '키워드는 최대 100개까지 입력 가능합니다.' }, { status: 400 });
  }

  const customerId = process.env.NAVER_AD_CUSTOMER_ID;
  const apiKey = process.env.NAVER_AD_ACCESS_LICENSE;
  const secretKey = process.env.NAVER_AD_SECRET_KEY;

  if (!customerId || !apiKey || !secretKey) {
    console.error('[keyword-volume] 환경변수 누락:', {
      customerId: !!customerId,
      apiKey: !!apiKey,
      secretKey: !!secretKey,
    });
    return NextResponse.json({ error: '검색광고 API 키가 설정되지 않았습니다.' }, { status: 500 });
  }

  // 5개씩 청킹
  const CHUNK_SIZE = 5;
  const chunks = chunkArray(keywords, CHUNK_SIZE);
  console.log(`[keyword-volume] 총 ${keywords.length}개 → ${chunks.length}개 청크로 분할`);

  try {
    // ✅ 순차 호출 + 청크 간 200ms 딜레이 (Rate Limit 방지)
    const allKeywordList: any[] = [];

    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) await delay(200);
      const chunkResult = await fetchKeywordChunk(chunks[i], customerId, apiKey, secretKey);
      allKeywordList.push(...chunkResult);
    }

    console.log(`[keyword-volume] 전체 병합 keywordList 수: ${allKeywordList.length}`);

    // 조회기준일 (당월 기준)
    const now = new Date();
    const baseDate = `${now.getFullYear()}년 ${now.getMonth() + 1}월 기준`;

    // 입력 키워드 순서대로 결과 매핑
    const results = keywords.map(kw => {
      const normalized = kw.toLowerCase().replace(/\s+/g, '');
      const match = allKeywordList.find(
        (item: any) => (item.relKeyword ?? '').toLowerCase().replace(/\s+/g, '') === normalized
      );

      if (!match) {
        console.log(`[keyword-volume] 매칭 없음: "${kw}"`);
      }

      const pc = match ? parseQcCnt(match.monthlyPcQcCnt) : 0;
      const mobile = match ? parseQcCnt(match.monthlyMobileQcCnt) : 0;

      return {
        keyword: kw,
        pc,
        mobile,
        total: pc + mobile,
        baseDate,
      };
    });

    return NextResponse.json({ success: true, results });

  } catch (error: any) {
    console.error('[keyword-volume] 예외 발생:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
