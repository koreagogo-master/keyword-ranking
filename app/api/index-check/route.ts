// app/api/index-check/route.ts
import { NextResponse } from "next/server";
// 🌟 프록시 모듈 불러오기 (경로는 기존 related API에서 쓰시는 경로와 동일하게 맞춰주세요)
import { launchProxyBrowser, setupPage } from "@/app/lib/puppeteerHelper"; 

export async function POST(request: Request) {
  let browser = null; // 🌟 봇 브라우저를 담을 변수 준비

  try {
    const { blogId, start = 0, limit = 10 } = await request.json();

    if (!blogId) {
      return NextResponse.json({ error: "블로그 아이디가 필요합니다." }, { status: 400 });
    }

    const rssUrl = `https://rss.blog.naver.com/${blogId}`;
    
    // =====================================================================
    // 🌟 프록시 서버 적용 부분 (기존 fetch 대신 Puppeteer 우회 접속 사용)
    // =====================================================================
    browser = await launchProxyBrowser();
    const page = await browser.newPage();
    await setupPage(page);

    // 네이버 RSS 페이지로 프록시 우회 접속
    const rssResponse = await page.goto(rssUrl, { waitUntil: "domcontentloaded" });
    
    if (!rssResponse || !rssResponse.ok()) {
      if (browser) await browser.close();
      return NextResponse.json({ error: "RSS 데이터를 불러올 수 없습니다." }, { status: 404 });
    }
    
    // 순수 XML(텍스트) 데이터를 추출합니다.
    const rssText = await rssResponse.text();
    
    // 작업이 끝나면 메모리 확보를 위해 브라우저를 안전하게 닫아줍니다.
    if (browser) await browser.close();
    // =====================================================================

    // 🌟 1. 블로그 공식 명칭 및 소개글 추출 (Channel 정보)
    // 줄바꿈이 있는 소개글도 매칭되도록 .*? 대신 [\s\S]*? 사용
    const blogTitleMatch = rssText.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const blogDescMatch = rssText.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
    const blogTitle = blogTitleMatch ? blogTitleMatch[1].trim() : "네이버 블로그";
    const blogDescription = blogDescMatch ? blogDescMatch[1] : "";

    // 2. 전체 글 리스트업
    const allItems = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(rssText)) !== null) {
      if (allItems.length >= 50) break; 
      
      const itemContent = match[1];
      const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
      const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
      const categoryMatch = itemContent.match(/<category>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/category>/);
      // 🌟 정확한 발행 시간(시/분/초) 포함을 위해 원본 날짜 그대로 가져옴
      const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);

      if (titleMatch && linkMatch) {
        allItems.push({
          title: titleMatch[1].replace(/<[^>]*>?/gm, "").trim(),
          link: linkMatch[1],
          category: categoryMatch ? categoryMatch[1].trim() : '일반',
          pubDate: pubDateMatch ? pubDateMatch[1] : new Date().toISOString(),
          status: "pending",
        });
      }
    }

    const itemsToCheck = allItems.slice(start, start + limit);

    if (itemsToCheck.length === 0) {
      return NextResponse.json({ results: [], total: allItems.length, hasMore: false });
    }

    const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
    const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

    const checkResults = [];

    // 🌟 이 부분은 네이버 '공식 API'를 사용하므로 IP 차단(캡차) 대상이 아닙니다. (기존 로직 그대로 유지)
    for (const item of itemsToCheck) {
      const exactQuery = `"${item.title}"`;
      const searchUrl = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(exactQuery)}&display=1`;

      try {
        const searchRes = await fetch(searchUrl, {
          headers: {
            "X-Naver-Client-Id": clientId!,
            "X-Naver-Client-Secret": clientSecret!,
          },
        });

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const isIndexed = searchData.total > 0;
          checkResults.push({ ...item, status: isIndexed ? "indexed" : "missing" });
        } else {
          checkResults.push({ ...item, status: "error" });
        }
      } catch (err) {
        checkResults.push({ ...item, status: "error" });
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return NextResponse.json({ 
      results: checkResults,
      total: allItems.length,
      hasMore: start + limit < allItems.length,
      // 🌟 블로그 메타 정보 추가 반환
      blogInfo: { title: blogTitle, description: blogDescription }
    });

  } catch (error) {
    if (browser) await browser.close(); // 에러 발생 시에도 브라우저가 계속 켜져있지 않도록 방어
    return NextResponse.json({ error: "서버 내부 오류" }, { status: 500 });
  }
}