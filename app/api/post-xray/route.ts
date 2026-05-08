import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { url, searchKeyword } = await request.json();

    if (!url || (!url.includes('blog.naver.com') && !url.includes('m.blog.naver.com'))) {
      return NextResponse.json({ error: "네이버 블로그 URL을 입력해주세요." }, { status: 400 });
    }

    // 💡 네이버 모바일 URL로 강제 변환 (모바일뷰는 iframe이 없고 UTF-8이라 크롤링이 매우 쉽고 정확함)
    let blogId = '';
    let logNo = '';

    try {
        const cleanUrl = url.replace('https://', '').replace('http://', '').split('?')[0];
        const parts = cleanUrl.split('/');
        if (parts[0] === 'blog.naver.com' || parts[0] === 'm.blog.naver.com') {
            blogId = parts[1];
            logNo = parts[2];
        }
    } catch (e) {
        return NextResponse.json({ error: "지원하지 않는 URL 형식입니다." }, { status: 400 });
    }

    if (!blogId || !logNo) {
        return NextResponse.json({ error: "블로그 아이디나 게시글 번호를 찾을 수 없습니다." }, { status: 400 });
    }

    const targetUrl = `https://m.blog.naver.com/${blogId}/${logNo}`;

    // 모바일 뷰 강제 요청
    const response = await axios.get(targetUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        }
    });

    const $ = cheerio.load(response.data);
    
    // 제목 추출
    const title = $('.se-title-text').text().trim() || $('.se_title').text().trim() || $('title').text().trim();
    
    // 이미지 개수 카운트
    const imageCount = $('.se-image-resource').length || $('.se_mediaImage').length || $('img').length;

    // 실제 해시태그 추출 (작성자가 직접 입력한 SEO 키워드)
    const hashtagSet = new Set<string>();
    const extractTag = (text: string) => {
      const cleaned = text.trim().replace(/^#/, '').trim();
      if (cleaned && cleaned.length > 0 && cleaned.length < 40) hashtagSet.add(cleaned);
    };

    // 네이버 스마트에디터 SE3 (모바일/PC 공통)
    $('.se-hash-tag').each((_: any, el: any) => extractTag($(el).text()));
    // SE3 컨테이너 방식
    $('.se-module-hashtag a').each((_: any, el: any) => extractTag($(el).text()));
    // SE3 해시태그 span
    $('a.se-hash-tag').each((_: any, el: any) => extractTag($(el).text()));
    // 구버전 PC 에디터
    $('.post_tag a').each((_: any, el: any) => extractTag($(el).text()));
    // SE2 태그
    $('.se2_tag a').each((_: any, el: any) => extractTag($(el).text()));
    // 모바일 태그 영역
    $('.wrap_tag_info a').each((_: any, el: any) => extractTag($(el).text()));
    // tagList 방식
    $('.tagList a').each((_: any, el: any) => extractTag($(el).text()));
    // 범용: href에 /tag/ 가 포함된 링크
    $('a[href*="/tag/"]').each((_: any, el: any) => extractTag($(el).text()));
    // 범용: 텍스트가 #으로 시작하는 a 태그
    $('a').each((_: any, el: any) => {
      const text = $(el).text().trim();
      if (text.startsWith('#') && text.length < 40 && !text.includes(' ')) {
        extractTag(text);
      }
    });

    const hashtags = Array.from(hashtagSet);

    // 본문 추출
    let content = $('.se-main-container').text();
    if (!content || content.trim().length === 0) {
        // 구버전 모바일 에디터
        content = $('.post_ct').text();
    }
    if (!content || content.trim().length === 0) {
        content = $('body').text();
    }

    // 텍스트 정제
    content = content.replace(/\s+/g, ' ').trim();
    if (content.length > 5000) {
        content = content.substring(0, 5000); // 토큰 절약을 위해 자르기
    }

    if (content.length < 50) {
        return NextResponse.json({ error: "본문 내용을 충분히 추출하지 못했습니다. (비공개 글이거나 특수 구조일 수 있습니다)" }, { status: 400 });
    }

    // AI 분석 (Claude 4.6 Sonnet)
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
        throw new Error("서버에 AI API 키가 설정되지 않았습니다.");
    }

    const searchKeywordContext = searchKeyword
      ? `\n[검색 컨텍스트]\n이 포스팅은 네이버에서 "${searchKeyword}"(으)로 검색했을 때 상위에 노출된 글입니다. 메인 타겟 키워드 분석 시 이 사실을 최우선으로 반영하여, 본문에서 해당 키워드가 직접 등장하지 않더라도 작성자가 이 검색어를 노리고 작성했을 가능성을 고려해 주세요.\n`
      : '';

    const prompt = `아래는 특정 네이버 블로그 포스팅의 원문 텍스트입니다. 이 글의 작성자가 상위 노출(SEO)을 위해 '어떤 키워드'를 노리고 썼는지 역추적(X-Ray)해주세요.
${searchKeywordContext}
[블로그 제목]
${title}

[블로그 본문]
${content}

분석 결과를 반드시 아래의 순수한 JSON 객체 형식으로만 반환해주세요. 시작과 끝에 백틱이나 다른 설명을 붙이지 마세요.
{
  "targetKeyword": "가장 핵심이 되는 메인 타겟 키워드 1개${searchKeyword ? ` (검색 컨텍스트 '${searchKeyword}' 반영)` : ' (예: 강남역 맛집)'}",
  "subKeywords": ["서브 키워드 1", "서브 키워드 2", "서브 키워드 3", "서브 키워드 4", "서브 키워드 5"],
  "contentFocus": "이 글이 타겟 독자에게 주려고 하는 핵심 가치 및 내용 요약 (1~2문장)",
  "strategy": "작성자의 SEO 및 글쓰기 전략 (예: 정보성 내용을 서론에 길게 깔아 체류 시간을 높이고, 중간에 키워드를 5번 반복함 등 구체적인 작성 스킬 위주로 2~3문장)"
}`;

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'x-api-key': ANTHROPIC_API_KEY.trim(), 
            'anthropic-version': '2023-06-01' 
        },
        body: JSON.stringify({ 
            model: 'claude-sonnet-4-6',
            max_tokens: 1500, 
            messages: [{ role: 'user', content: prompt }], 
            temperature: 0.1 // 분석의 일관성을 위해 낮은 온도
        })
    });

    const aiData = await aiResponse.json();
    if (!aiResponse.ok) throw new Error(`Claude API Error: ${aiData.error?.message || '응답 오류'}`);
    
    const resultText = aiData.content[0].text;
    
    // JSON 파싱 (안전하게)
    let resultJson;
    try {
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            resultJson = JSON.parse(jsonMatch[0]);
        } else {
            resultJson = JSON.parse(resultText);
        }
    } catch (parseError) {
        console.error("JSON 파싱 에러:", resultText);
        throw new Error("AI가 유효한 분석 결과를 반환하지 못했습니다.");
    }

    // 키워드 반복 횟수 카운팅 (AI가 추출한 키워드를 실제 텍스트에서 검색)
    // 5000자로 자른 content 대신 원본 full text에서 카운팅
    let fullContent = $('.se-main-container').text() || $('.post_ct').text() || $('body').text();
    fullContent = fullContent.replace(/\s+/g, ' ').trim();

    const countKeyword = (text: string, keyword: string): number => {
      if (!keyword || keyword.length === 0) return 0;
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedKeyword, 'gi');
      return (text.match(regex) || []).length;
    };

    const mainKeywordCount = countKeyword(fullContent, resultJson.targetKeyword);
    const subKeywordCounts: Record<string, number> = {};
    if (Array.isArray(resultJson.subKeywords)) {
      resultJson.subKeywords.forEach((kw: string) => {
        subKeywordCounts[kw] = countKeyword(fullContent, kw);
      });
    }

    return NextResponse.json({ 
        success: true,
        data: {
            title,
            textLength: content.length,
            imageCount,
            hashtags,
            analysis: {
              ...resultJson,
              mainKeywordCount,
              subKeywordCounts,
            }
        }
    });

  } catch (error: any) {
    console.error("Post X-Ray Error:", error);
    return NextResponse.json({ error: error.message || "분석 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
