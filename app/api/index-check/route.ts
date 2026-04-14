// app/api/index-check/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { blogId, start = 0, limit = 10 } = await request.json();

    if (!blogId) {
      return NextResponse.json({ error: "블로그 아이디가 필요합니다." }, { status: 400 });
    }

    const rssUrl = `https://rss.blog.naver.com/${blogId}`;
    const rssResponse = await fetch(rssUrl, { cache: "no-store" });
    
    if (!rssResponse.ok) {
      return NextResponse.json({ error: "RSS 데이터를 불러올 수 없습니다." }, { status: 404 });
    }
    
    const rssText = await rssResponse.text();

    // 🌟 1. 블로그 공식 명칭 및 소개글 추출 (Channel 정보)
    const blogTitleMatch = rssText.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
    const blogDescMatch = rssText.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/);
    const blogTitle = blogTitleMatch ? blogTitleMatch[1] : "네이버 블로그";
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
      // 🌟 정확한 발행 시간(시/분/초) 포함을 위해 원본 날짜 그대로 가져옴
      const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);

      if (titleMatch && linkMatch) {
        allItems.push({
          title: titleMatch[1].replace(/<[^>]*>?/gm, "").trim(),
          link: linkMatch[1],
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
    return NextResponse.json({ error: "서버 내부 오류" }, { status: 500 });
  }
}