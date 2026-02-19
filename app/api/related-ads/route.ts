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
    const body = await request.json();
    
    // ==========================================
    // 🌟 [추가됨] 콤보박스 변경 시: 단가(CPC) 데이터만 빠르게 다시 가져오기
    // ==========================================
    if (body.isCpcOnly) {
      const { keywords, device, position } = body;
      const estimateMap = new Map();
      const estimatePath = '/estimate/average-position-bid/keyword';
      const estimateMethod = 'POST';
      const chunkSize = 100;
      const chunks = [];
      
      for (let i = 0; i < keywords.length; i += chunkSize) {
        chunks.push(keywords.slice(i, i + chunkSize));
      }

      await Promise.all(chunks.map(async (chunk) => {
        const estTimestamp = Date.now().toString();
        const estSignature = generateSignature(estTimestamp, estimateMethod, estimatePath, SECRET_KEY);

        const estRes = await axios.post(
          `${NAVER_AD_COMMON_URL}${estimatePath}`,
          { device: device, items: chunk.map((k: string) => ({ key: k, position: position })) },
          { headers: { 'X-Timestamp': estTimestamp, 'X-API-KEY': ACCESS_LICENSE, 'X-Customer': CUSTOMER_ID, 'X-Signature': estSignature } }
        );

        const estimates = estRes.data.estimate || estRes.data.items || estRes.data;
        if (Array.isArray(estimates)) {
          estimates.forEach((est: any) => {
            const kw = est.keyword || est.key;
            if (kw) estimateMap.set(kw, est.bid || 0);
          });
        }
      }));
      
      // 새로 구한 단가표만 프론트엔드로 전달
      return NextResponse.json({ success: true, estimateMap: Object.fromEntries(estimateMap) });
    }

    // ==========================================
    // 기존 검색 로직 (초기 검색 시)
    // ==========================================
    // 🌟 프론트엔드에서 현재 선택된 콤보박스 옵션(기기, 순위)을 받아서 적용합니다.
    const { keyword, cpcDevice = 'MOBILE', cpcPosition = 3 } = body; 
    
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

    const adsKeywords = response.data.keywordList.slice(0, 200).map((item: any) => {
      let normalizedCompIdx = item.compIdx;
      if (item.compIdx === '높음') normalizedCompIdx = 'HIGH';
      else if (item.compIdx === '중간') normalizedCompIdx = 'MEDIUM';
      else if (item.compIdx === '낮음') normalizedCompIdx = 'LOW';

      return {
        keyword: item.relKeyword,
        pc: item.monthlyPcQcCnt,
        mobile: item.monthlyMobileQcCnt,
        monthlyAvePcClkCnt: item.monthlyAvePcClkCnt,
        monthlyAveMobileClkCnt: item.monthlyAveMobileClkCnt,
        monthlyAvePcCtr: item.monthlyAvePcCtr,
        monthlyAveMobileCtr: item.monthlyAveMobileCtr,
        compIdx: normalizedCompIdx
      };
    });

    const estimateMap = new Map();
    try {
      const estimatePath = '/estimate/average-position-bid/keyword'; 
      const estimateMethod = 'POST';
      const chunkSize = 100;
      const chunks = [];
      for (let i = 0; i < adsKeywords.length; i += chunkSize) {
        chunks.push(adsKeywords.slice(i, i + chunkSize));
      }

      await Promise.all(chunks.map(async (chunk) => {
        const estTimestamp = Date.now().toString();
        const estSignature = generateSignature(estTimestamp, estimateMethod, estimatePath, SECRET_KEY);

        const estRes = await axios.post(
          `${NAVER_AD_COMMON_URL}${estimatePath}`,
          {
            device: cpcDevice, // 🌟 고정값이 아닌 동적 할당
            items: chunk.map((k: any) => ({ key: k.keyword, position: cpcPosition })) // 🌟 고정값이 아닌 동적 할당
          },
          { headers: { 'X-Timestamp': estTimestamp, 'X-API-KEY': ACCESS_LICENSE, 'X-Customer': CUSTOMER_ID, 'X-Signature': estSignature } }
        );

        const estimates = estRes.data.estimate || estRes.data.items || estRes.data;
        if (Array.isArray(estimates)) {
          estimates.forEach((est: any) => {
            const kw = est.keyword || est.key;
            if (kw) estimateMap.set(kw, est.bid || 0);
          });
        }
      }));
    } catch (estError: any) {
      console.error('견적 API 에러:', estError.response?.data || estError.message);
    }

    const finalKeywords = adsKeywords.map((item: any) => ({
      ...item,
      cpc: estimateMap.get(item.keyword) || 0
    }));

    return NextResponse.json({ success: true, keywords: finalKeywords });

  } catch (error: any) {
    console.error('Naver Ads API Error:', error.response?.data || error.message);
    return NextResponse.json({ success: false, error: '광고 API 호출 실패' });
  }
}