// app/api/google-related/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { getProxyAgent } from '@/app/lib/proxyConfig';

export async function POST(request: Request) {
  try {
    const { keyword } = await request.json();
    if (!keyword) return NextResponse.json({ success: false, error: '키워드가 없습니다.' });

    const k = keyword.trim();

    // ==========================================
    // 1. [대안 A] 구글 자동완성 (프록시 불필요, 가볍게 호출)
    // ==========================================
    let suggested: string[] = [];
    try {
      const suggestRes = await fetch(`http://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(k)}&hl=ko&gl=kr&ie=utf8&oe=utf8`);
      if (suggestRes.ok) {
        const suggestData = await suggestRes.json();
        suggested = suggestData[1] || [];
      }
    } catch (e) {
      console.error('자동완성 에러:', e);
    }

    // ==========================================
    // 2. [대안 B] 프록시 + 아이폰 위장 모바일 스크래핑
    // ==========================================
    let related: string[] = [];
    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(k)}&hl=ko&gl=kr&ie=utf8&oe=utf8`;
      const response = await fetch(searchUrl, {
        headers: {
          // 🌟 완전한 아이폰(iOS) 사파리 브라우저로 위장
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
        // @ts-ignore
        agent: getProxyAgent(),
        cache: 'no-store',
      });

      const html = await response.text();
      const $ = cheerio.load(html);
      const tempRelated: string[] = [];
      
      // 모바일 구글의 관련검색어는 주로 href="/search?q=..." 형태의 링크에 담겨 있습니다.
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('/search?q=')) {
          const text = $(el).text().trim();
          
          // 이미지/뉴스 등 상단 탭 이동 버튼 제외, 너무 짧은 글자 제외
          if (text && text.length > 1 && !href.includes('&tbm=')) {
            if (text !== k) { // 검색한 원본 키워드는 제외
              tempRelated.push(text);
            }
          }
        }
      });

      const filterWords = ['다음', '이전', '검색결과', '로그인', '도움말', '개인정보처리방침', 'click here', 'here', 'Redirecting'];
      related = [...new Set(tempRelated)].filter(word => {
        return !filterWords.some(fw => word.includes(fw)) && word.length < 25;
      });

    } catch (e) {
      console.error('모바일 스크래핑 실패:', e);
    }

    // 대안 A와 대안 B의 데이터를 프론트엔드로 한 번에 던져줍니다.
    return NextResponse.json({ 
      success: true, 
      suggested, 
      related 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}