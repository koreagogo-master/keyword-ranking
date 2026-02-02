import { NextResponse } from 'next/server';
import crypto from 'crypto';
import axios from 'axios';

// ✅ 네이버 검색광고 API 설정 (환경변수나 직접 입력)
const NAVER_AD_COMMON_URL = 'https://api.naver.com';
const CUSTOMER_ID = process.env.NAVER_AD_CUSTOMER_ID || '사용자_ID';
const ACCESS_LICENSE = process.env.NAVER_AD_ACCESS_LICENSE || '액세스_라이선스';
const SECRET_KEY = process.env.NAVER_AD_SECRET_KEY || '비밀키';

// 서명 생성 함수
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
      params: {
        hintKeywords: keyword,
        showDetail: '1' // 검색량 상세 데이터 포함
      },
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': ACCESS_LICENSE,
        'X-Customer': CUSTOMER_ID,
        'X-Signature': signature,
      }
    });

    // API 응답 데이터를 우리 서비스 형식에 맞게 가공 (최대 200개)
    const adsKeywords = response.data.keywordList
      .slice(0, 200)
      .map((item: any) => ({
        keyword: item.relKeyword,
        // 검색량이 문자열("< 10")로 올 수 있으므로 숫자로 변환 처리
        pc: typeof item.monthlyPcQcCnt === 'number' ? item.monthlyPcQcCnt : 0,
        mobile: typeof item.monthlyMobileQcCnt === 'number' ? item.monthlyMobileQcCnt : 0,
        total: (typeof item.monthlyPcQcCnt === 'number' ? item.monthlyPcQcCnt : 0) + 
               (typeof item.monthlyMobileQcCnt === 'number' ? item.monthlyMobileQcCnt : 0)
      }));

    return NextResponse.json({ success: true, keywords: adsKeywords });
  } catch (error: any) {
    console.error('Naver Ads API Error:', error.response?.data || error.message);
    return NextResponse.json({ success: false, error: '광고 API 호출 실패' });
  }
}