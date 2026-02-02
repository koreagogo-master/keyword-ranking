import { NextResponse } from 'next/server';
// [중요] 기존 actions.ts에서 사용하던 공통 프록시 도구를 가져옵니다.
import { launchProxyBrowser, setupPage } from '@/app/lib/puppeteerHelper';

export async function POST(request: Request) {
  const { keyword } = await request.json();
  const url = `https://m.search.naver.com/search.naver?where=m&query=${encodeURIComponent(keyword)}`;
  
  console.log(`\n🚀 [프록시 시각 분석 실행] 키워드: ${keyword}`);
  
  let browser;
  try {
    // 1. 기존 프로젝트의 공통 설정이 적용된 프록시 브라우저를 실행합니다.
    browser = await launchProxyBrowser();

    // 2. 새 페이지를 생성하고 프록시 인증 및 모바일 설정을 적용합니다.
    const page = await browser.newPage();
    await setupPage(page);
    
    // 브라우저 내부 로그를 터미널에 출력 (디버깅용)
    page.on('console', msg => console.log('🌐 [Browser Log]:', msg.text()));

    // 3. 네이버 접속 (프록시 상황을 고려하여 대기 시간을 충분히 줍니다.)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const result = await page.evaluate(() => {
      console.log("--- 프록시 브라우저 내부 스캔 시작 ---");
      const elements = document.querySelectorAll('*');
      let detectedInfo = null;
      const keywords: string[] = [];

      for (const el of Array.from(elements)) {
        const text = el.textContent?.trim() || "";
        
        // "연관" 텍스트를 포함하는 요소 탐색
        if (text === "연관" || text.startsWith("연관")) {
          const style = window.getComputedStyle(el);
          const weight = parseInt(style.fontWeight);
          const isVisible = el.getBoundingClientRect().height > 0;

          // 실험실에서 확인된 물리적 수치(600 이상)를 기준으로 인지합니다.
          if (isVisible && weight >= 600) {
            const rect = el.getBoundingClientRect();
            detectedInfo = {
              text: text,
              fontWeight: weight,
              fontSize: style.fontSize,
              y: rect.top + window.pageYOffset,
              tagName: el.tagName
            };

            // 주변 연관검색어 단어 추출
            const parent = el.closest('div, section');
            if (parent) {
              const links = parent.querySelectorAll('a');
              links.forEach(l => {
                const word = l.textContent?.trim();
                // "연관" 포함어 및 "# 도움말"을 제외한 실제 단어만 수집합니다.
                if (word && !word.includes("연관") && word !== "도움말" && word !== "") {
                  keywords.push(word);
                }
              });
            }
            break; 
          }
        }
      }
      return { detectedInfo, keywords };
    });

    await browser.close();
    console.log(`✅ [탐지 완료] 결과: ${result.detectedInfo ? '성공' : '실패'}`);
    return NextResponse.json({ success: true, ...result });

  } catch (error: any) {
    if (browser) await browser.close();
    console.error(`❌ [프록시 브라우저 에러]: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message });
  }
}