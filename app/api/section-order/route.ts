// keyword-ranking\app\api\section-order\route.ts

import { NextResponse } from 'next/server';

async function fetchSectionOrder(keyword: string, platform: 'pc' | 'mobile') {
  const url = platform === 'pc' 
    ? `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(keyword)}`
    : `https://m.search.naver.com/search.naver?where=m&query=${encodeURIComponent(keyword)}`;

  const userAgent = platform === 'pc'
    ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    : 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

  try {
    const response = await fetch(url, { headers: { 'User-Agent': userAgent } });
    const html = await response.text();
    
    // ✅ [수정] main_pack 분리를 제거하고 전체 HTML에서 찾습니다.
    // 연관검색어가 최상단에 있을 경우를 대비하여 범위를 제한하지 않습니다.
    const searchArea = html; 

    const sectionDefinitions = [
      // ✅ [시각적 인지] <b>연관</b> 또는 <strong>연관</strong> 패턴
      // 태그 안에 클래스가 있거나 공백이 있어도 찾을 수 있도록 정규식을 유연하게 설정했습니다.
      { 
        name: '[연관검색어]', 
        pattern: /<(b|strong)[^>]*>\s*연관\s*<\/(b|strong)>/, 
        mobileOnly: true 
      },
      { name: '파워링크', pattern: /id="nx_powerlink"|파워링크/ },
      { name: '네이버 가격비교', pattern: /네이버 가격비교/ },
      { name: '네이버플러스 스토어', pattern: /네이버플러스 스토어/ },
      { name: '브랜드 콘텐츠 (광고)', pattern: new RegExp(`'?${keyword}'? 관련 브랜드 콘텐츠`) },
      { name: '사이트', pattern: /">사이트<\/a>|">사이트<\/h|lh8\.googleusercontent/ },
      { name: '이미지', pattern: /">이미지<\/a>|">이미지<\/h/ },
      { name: '지식iN', pattern: /">지식iN<\/a>|">지식iN<\/h/ },
      { name: '블로그', pattern: /">블로그<\/a>|">블로그<\/h/ },
      { name: 'VIEW', pattern: /">VIEW<\/a>|">VIEW<\/h/ },
      { name: '위키백과', pattern: /위키백과/ },
      { name: '함께 많이 찾는', pattern: /함께 많이 찾는/ },
      { name: '어학사전', pattern: /어학사전/ },
      { name: '함께 보면 좋은', pattern: /함께 보면 좋은/ }
    ];

    const detected = sectionDefinitions
      .filter(def => !(platform === 'pc' && def.mobileOnly))
      .map(def => {
        const match = searchArea.match(def.pattern);
        return { name: def.name, index: match ? match.index : -1 };
      })
      .filter(item => item.index !== -1)
      .sort((a, b) => (a.index || 0) - (b.index || 0));

    const uniqueOrder: string[] = [];
    detected.forEach(item => {
      if (!uniqueOrder.includes(item.name)) uniqueOrder.push(item.name);
    });

    return uniqueOrder;
  } catch (e) {
    return ["분석 실패"];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = (searchParams.get('keyword') || '').replace(/\s+/g, '').trim();
  if (!keyword) return NextResponse.json({ error: '키워드 누락' }, { status: 400 });

  const [pc, mobile] = await Promise.all([
    fetchSectionOrder(keyword, 'pc'),
    fetchSectionOrder(keyword, 'mobile')
  ]);

  return NextResponse.json({ keyword, pc, mobile });
}