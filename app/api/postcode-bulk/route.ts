import { NextResponse } from 'next/server';

const MAX_ADDRESSES = 20;
const MIN_LENGTH = 3;
const MAX_LENGTH = 200;

interface JusoItem {
  zipNo: string;
  roadAddr: string;
  jibunAddr: string;
}

interface JusoResponse {
  results: {
    common: {
      totalCount: string;
      errorCode: string;
      errorMessage: string;
    };
    juso: JusoItem[] | null;
  };
}

/**
 * 입력 주소에서 최대 3개의 검색 후보를 생성합니다.
 *
 * 순서:
 *  1) 원본 주소 (그대로)
 *  2) 괄호 및 괄호 이후 텍스트를 제거한 주소
 *  3) 도로명 + 건물번호 OR 지번 + 번지까지만 추출한 핵심 주소
 *
 * 중복 후보는 자동으로 제거됩니다.
 */
function generateSearchCandidates(address: string): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  const add = (s: string) => {
    const t = s.trim();
    if (t.length >= MIN_LENGTH && !seen.has(t)) {
      seen.add(t);
      candidates.push(t);
    }
  };

  // 1) 원본
  add(address);

  // 2) 괄호(한글/영문) 및 괄호 이후 배송 메모 전체 제거
  //    예: "A (평창동) 단독주택 계단밑" → "A"
  const noParens = address
    .replace(/\s*[(\（][^)\）]*[)\）][\s\S]*$/, '')
    .trim();
  add(noParens);

  // 3) 핵심 주소 추출 — 건물번호(도로명) 또는 번지(지번)까지만
  //    도로명 패턴: "로/길/대로 숫자(-숫자)?"
  //    예: "동탄지성로 295", "평창21길 71", "세교산단로101번길 114-2"
  const roadMatch = address.match(/^(.+?(?:로|길|대로)\s+\d+(?:-\d+)?)/);
  if (roadMatch) {
    add(roadMatch[1]);
  } else {
    // 지번 패턴: "동/읍/면/가/리 숫자(-숫자)?"
    // 예: "운니동 114-2", "충무로5가 36-2", "평창동 123"
    const jibunMatch = address.match(/^(.+?(?:동|읍|면|가|리)\s+\d+(?:-\d+)?)/);
    if (jibunMatch) {
      add(jibunMatch[1]);
    }
  }

  return candidates;
}

/**
 * 주소가 우편번호를 특정할 수 있을 만큼 구체적인지 검사합니다.
 *
 * 허용 기준:
 *  - 도로명주소: "로/길/대로 + 건물번호" 패턴 포함
 *    예) 신갈로96번길 15-20, 평창21길 71, 세교산단로101번길 114-2
 *  - 지번주소:  "동/읍/면/리/가 + 번지" 패턴 포함
 *    예) 운니동 114-2, 충무로5가 36-2
 *  - 시/도·시/군/구 수준만 있는 주소는 허용하지 않음
 */
function isAddressConcrete(address: string): boolean {
  // 도로명: 로/길/대로 뒤에 공백 + 숫자
  if (/(?:로|길|대로)\s+\d+/.test(address)) return true;
  // 지번: 동/읍/면/리/가 뒤에 공백 + 숫자
  if (/(?:동|읍|면|리|가)\s+\d+/.test(address)) return true;
  return false;
}

/**
 * 단일 키워드로 행정안전부 주소 API를 호출합니다.
 * 결과가 있으면 zipNo(우편번호)를 반환하고, 없으면 null을 반환합니다.
 */
async function fetchZipNo(keyword: string, apiKey: string): Promise<string | null> {
  const url =
    `https://business.juso.go.kr/addrlink/addrLinkApi.do` +
    `?confmKey=${encodeURIComponent(apiKey)}` +
    `&currentPage=1&countPerPage=1` +
    `&keyword=${encodeURIComponent(keyword)}` +
    `&resultType=json`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;

  const data: JusoResponse = await res.json();
  const common = data?.results?.common;
  if (!common || common.errorCode !== '0') return null;

  const jusoList = data?.results?.juso;
  if (!jusoList || jusoList.length === 0) return null;

  return jusoList[0].zipNo || null;
}

/**
 * 보정 후보를 순서대로 시도하여 우편번호를 반환합니다.
 * 모든 후보가 실패하면 "검색실패"를 반환합니다.
 * 주소 1개당 최대 3회까지만 API를 호출합니다.
 *
 * 주소가 구체적이지 않으면 (시/도·시/군/구 수준) API 호출 없이 즉시 "검색실패"를 반환합니다.
 */
async function lookupPostcode(address: string, apiKey: string): Promise<string> {
  if (!isAddressConcrete(address)) {
    return '검색실패';
  }

  const candidates = generateSearchCandidates(address);

  for (const candidate of candidates) {
    const zipNo = await fetchZipNo(candidate, apiKey);
    if (zipNo) return zipNo;
  }

  return '검색실패';
}

export async function POST(request: Request) {
  const apiKey = process.env.JUSO_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error:
          'JUSO_API_KEY 환경변수가 설정되지 않았습니다. .env.local에 JUSO_API_KEY를 추가해 주세요.',
      },
      { status: 500 }
    );
  }

  let body: { addresses?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: '요청 형식이 올바르지 않습니다.' },
      { status: 400 }
    );
  }

  const rawAddresses = body?.addresses;

  if (!Array.isArray(rawAddresses)) {
    return NextResponse.json(
      { success: false, error: 'addresses 배열이 필요합니다.' },
      { status: 400 }
    );
  }

  const addresses: string[] = rawAddresses
    .map((a) => (typeof a === 'string' ? a.trim() : ''))
    .filter((a) => a.length > 0);

  if (addresses.length === 0) {
    return NextResponse.json(
      { success: false, error: '주소가 하나도 없습니다.' },
      { status: 400 }
    );
  }

  if (addresses.length > MAX_ADDRESSES) {
    return NextResponse.json(
      { success: false, error: `최대 ${MAX_ADDRESSES}개까지만 처리할 수 있습니다.` },
      { status: 400 }
    );
  }

  const invalidIdx = addresses.findIndex(
    (a) => a.length < MIN_LENGTH || a.length > MAX_LENGTH
  );
  if (invalidIdx !== -1) {
    return NextResponse.json(
      {
        success: false,
        error: `${invalidIdx + 1}번째 주소의 길이가 올바르지 않습니다. (${MIN_LENGTH}~${MAX_LENGTH}자)`,
      },
      { status: 400 }
    );
  }

  const results = await Promise.all(
    addresses.map(async (addr) => {
      try {
        const zipNo = await lookupPostcode(addr, apiKey);
        return { address: addr, zipNo, success: zipNo !== '검색실패' };
      } catch {
        return { address: addr, zipNo: '검색실패', success: false };
      }
    })
  );

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  return NextResponse.json({
    success: true,
    results,
    summary: { total: results.length, successCount, failCount },
  });
}
