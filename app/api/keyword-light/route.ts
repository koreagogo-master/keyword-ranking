// /api/related-ads/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import axios from 'axios';

const NAVER_AD_COMMON_URL = 'https://api.naver.com';
const CUSTOMER_ID = process.env.NAVER_AD_CUSTOMER_ID || '사용자_ID';
const ACCESS_LICENSE = process.env.NAVER_AD_ACCESS_LICENSE || '액세스_라이선스';
const SECRET_KEY = process.env.NAVER_AD_SECRET_KEY || '비밀키';

function generateSignature(timestamp: string, method: string, path: string, secretKey: string) {
  const message = timestamp + "." + method + "." + path;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

export async function POST(request: Request) {
  try {
    const { keyword } = await request.json();
    const timestamp = Date.now().toString();
    const path = '/keywordstool';
    const method = 'GET';
    const signature = generateSignature(timestamp, method, path, SECRET_KEY);

    const response = await axios.get(`${NAVER_AD_COMMON_URL}${path}`, {
      params: { hintKeywords: keyword, showDetail: '1' },
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': ACCESS_LICENSE,
        'X-Customer': CUSTOMER_ID,
        'X-Signature': signature,
      }
    });

    const adsKeywords = response.data.keywordList
      .slice(0, 200)
      .map((item: any) => {
        // ✅ 경쟁도 데이터 영문 상수로 변환
        let normalizedCompIdx = 'LOW';
        if (item.compIdx === '높음') normalizedCompIdx = 'HIGH';
        else if (item.compIdx === '중간') normalizedCompIdx = 'MEDIUM';

        return {
          keyword: item.relKeyword,
          pc: item.monthlyPcQcCnt,
          mobile: item.monthlyMobileQcCnt,
          // ✅ API 필드명(ClkCnt)을 정확히 매핑
          monthlyAvePcClkCnt: item.monthlyAvePcClkCnt,
          monthlyAveMobileClkCnt: item.monthlyAveMobileClkCnt,
          monthlyAvePcCtr: item.monthlyAvePcCtr,
          monthlyAveMobileCtr: item.monthlyAveMobileCtr,
          compIdx: normalizedCompIdx
        };
      });

    return NextResponse.json({ success: true, keywords: adsKeywords });
  } catch (error: any) {
    console.error('Naver Ads API Error:', error.response?.data || error.message);
    return NextResponse.json({ success: false, error: '광고 API 호출 실패' });
  }
}