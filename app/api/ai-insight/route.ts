import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { jsonrepair } from 'jsonrepair';
import { proxyAgent } from '@/app/lib/proxyConfig';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────
interface IndividualStat {
  url: string;
  title: string;
  textLength: number;
  imageCount: number;
  keywordCount: number;
}

interface TimelineStep {
  step: string;
  description: string;
}

interface XrayAnalysis {
  targetKeyword: string;
  subKeywords: string[];
  contentFocus: string;
  strategy: string;
  mainKeywordCount: number;
  subKeywordCounts: Record<string, number>;
}

interface PostData {
  url: string;
  title: string;
  textLength: number;
  imageCount: number;
  keywordCount: number;
  hashtags: string[];
  content: string;         // 5000자 제한 본문 (AI 토큰용)
  analysis: XrayAnalysis; // post-xray와 동일한 개별 분석 결과
  timeline: TimelineStep[]; // 목차 흐름
  error: string | null;
}

// ────────────────────────────────────────────────────────────
// STAGE 1 : post-xray와 동일한 개별 포스팅 분석 함수
// ────────────────────────────────────────────────────────────
async function analyzeOnePost(url: string, keyword: string): Promise<PostData> {
  // --- (1-A) URL 파싱 & 모바일 변환 ---
  let blogId = '';
  let logNo = '';

  try {
    const cleanUrl = url.replace('https://', '').replace('http://', '').split('?')[0];
    const parts = cleanUrl.split('/');
    if (parts[0] === 'blog.naver.com' || parts[0] === 'm.blog.naver.com') {
      blogId = parts[1];
      logNo = parts[2];
    }
    // logNo가 쿼리스트링으로 들어온 경우 (PostView.naver?blogId=...&logNo=...)
    if (!logNo) {
      const urlObj = new URL(url);
      const qLogNo = urlObj.searchParams.get('logNo');
      const qBlogId = urlObj.searchParams.get('blogId');
      if (qLogNo && qBlogId) { blogId = qBlogId; logNo = qLogNo; }
    }
  } catch {
    return makeErrorPost(url, '지원하지 않는 URL 형식입니다.');
  }

  if (!blogId || !logNo) {
    return makeErrorPost(url, '블로그 아이디나 게시글 번호를 찾을 수 없습니다.');
  }

  const targetUrl = `https://m.blog.naver.com/${blogId}/${logNo}`;

  // --- (1-B) 모바일 뷰 HTML 가져오기 (프록시 적용) ---
  let $: cheerio.CheerioAPI;
  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      // @ts-ignore
      httpsAgent: proxyAgent,
      timeout: 15000,
    });
    $ = cheerio.load(response.data);
  } catch (err: any) {
    return makeErrorPost(url, `블로그 접속 실패: ${err.message}`);
  }

  // --- (1-C) 제목 추출 ---
  const title = $('.se-title-text').text().trim() || $('.se_title').text().trim() || $('title').text().trim() || '제목 없음';

  // --- (1-D) 이미지 개수 ---
  const imageCount = $('.se-image-resource').length || $('.se_mediaImage').length || $('img').length;

  // --- (1-E) 해시태그 추출 (post-xray 100% 동일) ---
  const hashtagSet = new Set<string>();
  const extractTag = (text: string) => {
    const cleaned = text.trim().replace(/^#/, '').trim();
    if (cleaned && cleaned.length > 0 && cleaned.length < 40) hashtagSet.add(cleaned);
  };
  $('.se-hash-tag').each((_: any, el: any) => extractTag($(el).text()));
  $('.se-module-hashtag a').each((_: any, el: any) => extractTag($(el).text()));
  $('a.se-hash-tag').each((_: any, el: any) => extractTag($(el).text()));
  $('.post_tag a').each((_: any, el: any) => extractTag($(el).text()));
  $('.se2_tag a').each((_: any, el: any) => extractTag($(el).text()));
  $('.wrap_tag_info a').each((_: any, el: any) => extractTag($(el).text()));
  $('.tagList a').each((_: any, el: any) => extractTag($(el).text()));
  $('a[href*="/tag/"]').each((_: any, el: any) => extractTag($(el).text()));
  $('a').each((_: any, el: any) => {
    const text = $(el).text().trim();
    if (text.startsWith('#') && text.length < 40 && !text.includes(' ')) extractTag(text);
  });
  const hashtags = Array.from(hashtagSet);

  // --- (1-F) 본문 추출 ---
  let fullContent = $('.se-main-container').text() || $('.post_ct').text() || $('body').text();
  fullContent = fullContent.replace(/\s+/g, ' ').trim();

  if (fullContent.length < 50) {
    return makeErrorPost(url, '본문 내용을 충분히 추출하지 못했습니다. (비공개 글이거나 특수 구조)');
  }

  const textLength = fullContent.length;
  const content5000 = fullContent.substring(0, 5000); // AI 토큰 절약

  // --- (1-G) 키워드 반복 횟수 (정규화: 공백 제거 후 매칭) ---
  // "LED손전등" 검색 시 본문의 "LED 손전등"도 정확히 카운트되도록
  // 양쪽 문자열에서 공백을 완전히 제거한 뒤 비교
  const countKeyword = (text: string, kw: string): number => {
    if (!kw || kw.length === 0) return 0;
    const normalizedText = text.replace(/\s+/g, '');
    const normalizedKw = kw.replace(/\s+/g, '');
    if (!normalizedKw) return 0;
    const escaped = normalizedKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (normalizedText.match(new RegExp(escaped, 'gi')) || []).length;
  };
  const keywordCount = countKeyword(fullContent, keyword);

  if (!ANTHROPIC_API_KEY) throw new Error('서버에 AI API 키가 설정되지 않았습니다.');

  // --- (1-H) post-xray와 동일한 개별 분석 프롬프트 ---
  const xrayPrompt = `아래는 특정 네이버 블로그 포스팅의 원문 텍스트입니다. 이 글의 작성자가 상위 노출(SEO)을 위해 '어떤 키워드'를 노리고 썼는지 역추적(X-Ray)해주세요.

[검색 컨텍스트]
이 포스팅은 네이버에서 "${keyword}"(으)로 검색했을 때 상위에 노출된 글입니다. 메인 타겟 키워드 분석 시 이 사실을 최우선으로 반영하여, 본문에서 해당 키워드가 직접 등장하지 않더라도 작성자가 이 검색어를 노리고 작성했을 가능성을 고려해 주세요.

[블로그 제목]
${title}

[블로그 본문]
${content5000}

분석 결과를 반드시 아래의 순수한 JSON 객체 형식으로만 반환해주세요. 시작과 끝에 백틱이나 다른 설명을 붙이지 마세요.
{
  "targetKeyword": "가장 핵심이 되는 메인 타겟 키워드 1개 (검색 컨텍스트 '${keyword}' 반영)",
  "subKeywords": ["서브 키워드 1", "서브 키워드 2", "서브 키워드 3", "서브 키워드 4", "서브 키워드 5"],
  "contentFocus": "이 글이 타겟 독자에게 주려고 하는 핵심 가치 및 내용 요약 (1~2문장)",
  "strategy": "작성자의 SEO 및 글쓰기 전략 (예: 정보성 내용을 서론에 길게 깔아 체류 시간을 높이고, 중간에 키워드를 5번 반복함 등 구체적인 작성 스킬 위주로 2~3문장)",
  "timeline": [
    { "step": "단계명 (예: 도입부)", "description": "해당 단계에서 어떤 내용을 어떻게 작성했는지 구체적으로 요약" }
  ]
}`;

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY.trim(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: xrayPrompt }],
      temperature: 0.1,
    }),
  });

  const aiData = await aiRes.json();
  if (!aiRes.ok || aiData.error) throw new Error(`Claude API Error (개별분석): ${aiData.error?.message || '응답 오류'}`);

  let xrayJson: any;
  try {
    const raw = aiData.content[0].text;
    const match = raw.match(/\{[\s\S]*\}/);
    xrayJson = JSON.parse(match ? match[0] : raw);
  } catch {
    throw new Error('AI가 유효한 JSON 분석 결과를 반환하지 않았습니다.');
  }

  // 키워드 카운팅
  const mainKeywordCount = countKeyword(fullContent, xrayJson.targetKeyword || '');
  const subKeywordCounts: Record<string, number> = {};
  if (Array.isArray(xrayJson.subKeywords)) {
    xrayJson.subKeywords.forEach((kw: string) => { subKeywordCounts[kw] = countKeyword(fullContent, kw); });
  }

  const timeline: TimelineStep[] = Array.isArray(xrayJson.timeline) ? xrayJson.timeline : [];

  return {
    url,
    title,
    textLength,
    imageCount,
    keywordCount,
    hashtags,
    content: content5000,
    analysis: {
      targetKeyword: xrayJson.targetKeyword || '',
      subKeywords: xrayJson.subKeywords || [],
      contentFocus: xrayJson.contentFocus || '',
      strategy: xrayJson.strategy || '',
      mainKeywordCount,
      subKeywordCounts,
    },
    timeline,
    error: null,
  };
}

function makeErrorPost(url: string, msg: string): PostData {
  return {
    url, title: '수집 실패', textLength: 0, imageCount: 0, keywordCount: 0,
    hashtags: [], content: '', timeline: [],
    analysis: { targetKeyword: '', subKeywords: [], contentFocus: '', strategy: '', mainKeywordCount: 0, subKeywordCounts: {} },
    error: msg,
  };
}

// ────────────────────────────────────────────────────────────
// JSON 복구 헬퍼: 문자열 내부의 raw \n/\r을 \\n/\\r로 수정
// AI가 JSON 문자열 값 내에 실제 엔터를 넣을 경우 자동 복구
// ────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
// JSON 복구 헬퍼 (3단계):
// Step1: 문자열 내부 raw \n/\r → 이스케이프
// Step2: 배열 객체 사이 쉼표 누락 } { → }, {
// Step3: 배열 문자열 사이 쉼표 누락 "a" "b" → "a", "b"
// ────────────────────────────────────────────────────────────
function repairRawNewlines(str: string): string {
  // Step 1: 상태 머신으로 문자열 내부 raw 줄바꿈 수정
  let result = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escape) {
      result += ch;
      escape = false;
    } else if (ch === '\\') {
      result += ch;
      escape = true;
    } else if (ch === '"') {
      result += ch;
      inString = !inString;
    } else if (inString && ch === '\n') {
      result += '\\n';
    } else if (inString && ch === '\r') {
      result += '\\r';
    } else {
      result += ch;
    }
  }
  // Step 2: 배열 내 객체 사이 쉼표 누락 수정: } { → }, {
  result = result.replace(/\}\s*\{/g, '}, {');
  // Step 3: 배열 내 문자열 사이 줄바꿈+쉼표 누락 수정
  result = result.replace(/"\s*\n\s*"/g, '", "');
  return result;
}

// ────────────────────────────────────────────────────────────
// STAGE 2 : 고품질 개별 분석 결과를 바탕으로 종합 벤치마킹 분석
// ────────────────────────────────────────────────────────────
async function synthesize(keyword: string, posts: PostData[]): Promise<{
  commonKeywords: string[];
  commonTimeline: TimelineStep[];
  finalInsights: any[];
}> {
  if (!ANTHROPIC_API_KEY) throw new Error('서버에 AI API 키가 설정되지 않았습니다.');

  // 개별 분석 결과를 종합 프롬프트에 구조화하여 주입
  const postSummaries = posts.map((p, i) => `
[포스팅 ${i + 1}]
- URL: ${p.url}
- 제목: ${p.title}
- 분량: ${p.textLength.toLocaleString()}자 / 이미지 ${p.imageCount}장 / 키워드 반복 ${p.keywordCount}회
- 메인 타겟 키워드: ${p.analysis.targetKeyword}
- 서브 키워드: ${p.analysis.subKeywords.join(', ')}
- 핵심 콘텐츠 가치: ${p.analysis.contentFocus}
- SEO 전략: ${p.analysis.strategy}
- 목차 흐름:
${p.timeline.map((t, j) => `  ${j + 1}. [${t.step}] ${t.description}`).join('\n')}
`).join('\n---\n');

  const synthesisPrompt = `당신은 네이버 블로그 SEO 분야의 현장 경험이 풍부한 전문가입니다. 아래는 검색어 "${keyword}"로 상위 노출된 블로그 포스팅 ${posts.length}개에 대한 고품질 개별 분석 결과입니다.

이 데이터를 바탕으로 '종합 벤치마킹 분석'만을 수행하세요. 각 포스팅의 공통점과 차이점을 깊이 있게 비교하여 마케터가 바로 글쓰기에 착수할 수 있는 수준의 전략적 인사이트를 도출하세요.

${postSummaries}

[CRITICAL JSON RULES - YOU MUST FOLLOW THESE EXACTLY]
1. You MUST output ONLY valid JSON. No markdown, no backticks, no explanations before or after.
2. Do NOT use unescaped double quotes inside any string value. Use single quotes (') instead of double quotes (") for internal quotations.
3. Ensure ALL array elements are properly separated by commas (,). Do not omit commas between array items.
4. Do NOT add a trailing comma after the last element in any array or object.
5. ALL string values must be written on a single line. Do NOT insert any newline characters (neither literal \\n nor escaped \\n).
6. "finalInsights" array MUST contain EXACTLY 3-4 objects covering key strategies (length, image composition, keyword placement, index strategy).

아래 JSON 형식으로만 답변을 반환하세요. 백틱이나 추가 설명 없이 순수 JSON만 반환하세요.
{
  "commonKeywords": ["각 글에서 실제로 공통적으로 등장하며 상위 노출에 기여한 핵심 서브 키워드만 엄선. 단순 나열이 아닌 실제 교집합 5~8개. 메인 키워드('${keyword}')는 제외"],
  "commonTimeline": [
    {
      "step": "공통 작성 단계명 (예: 도입 - 공감 유도)",
      "description": "이 단계에서 상위 노출 글들이 공통적으로 취하는 구체적인 전략. 불필요한 미사여구를 빼고 핵심만 2~3문장(150자 이내)으로 아주 간결하게 요약할 것."
    }
  ],
  "finalInsights": [
    {
      "title": "단락 제목 (예: 글자 수 및 이미지 구성 전략)",
      "content": "해당 단락의 구체적인 내용. 따뜻하고 친근한 말투를 유지하되, 장황한 설명을 피하고 단락당 3문장 이내로 짧고 명확하게 작성할 것. 절대 줄바꿈 문자를 넣지 마세요."
    }
  ]
}`;

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY.trim(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: synthesisPrompt }],
      temperature: 0.5,
    }),
  });

  const aiData = await aiRes.json();
  if (!aiRes.ok || aiData.error) throw new Error(`Claude API Error (종합분석): ${aiData.error?.message || '응답 오류'}`);

  let synthJson: any;
  try {
    const rawText: string = aiData.content[0].text;
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new Error('JSON 객체를 찾을 수 없습니다.');
    }
    const jsonCandidate = rawText.slice(firstBrace, lastBrace + 1);

    // jsonrepair로 깨진 JSON 자동 복구 후 파싱 (raw \n, 쉬표 누락, trailing comma, 이스케이프 안 된 따옴표 등 모두 처리)
    try {
      synthJson = JSON.parse(jsonrepair(jsonCandidate));
    } catch {
      // jsonrepair도 실패한 경우 원본 파싱 시도
      console.warn('[종합분석] jsonrepair 실패 → 원본 파싱 시도');
      synthJson = JSON.parse(jsonCandidate);
    }
  } catch (parseErr: any) {
    // 디버깅: 파싱 에러 발생 위치 주변 텍스트를 콘솔에 출력
    if (parseErr instanceof SyntaxError) {
      const raw = aiData?.content?.[0]?.text ?? '';
      const firstBrace = raw.indexOf('{');
      const jsonStr = firstBrace !== -1 ? raw.slice(firstBrace) : raw;
      const posMatch = parseErr.message.match(/(position|\bpos\b)\s*(\d+)/i);
      const pos = posMatch ? parseInt(posMatch[2], 10) : -1;
      if (pos !== -1 && jsonStr.length > 0) {
        const start = Math.max(0, pos - 80);
        const end = Math.min(jsonStr.length, pos + 80);
        const snippet = jsonStr.slice(start, end);
        const marker = ' '.repeat(Math.min(80, pos - start)) + '^^^';
        console.error('[종합분석파싱에러] 위치 %d 주변 텍스트:\n%s\n%s', pos, snippet, marker);
      } else {
        console.error('[종합분석파싱에러] 시작 200자:', jsonStr.slice(0, 200));
      }
    }
    console.error('종합 분석 JSON 파싱 실패:', parseErr.message);
    throw new Error('AI가 유효한 종합 분석 JSON을 반환하지 않았습니다.');
  }

  return {
    commonKeywords: Array.isArray(synthJson.commonKeywords) ? synthJson.commonKeywords : [],
    commonTimeline: Array.isArray(synthJson.commonTimeline) ? synthJson.commonTimeline : [],
    finalInsights: Array.isArray(synthJson.finalInsights) ? synthJson.finalInsights : [],
  };
}

// ────────────────────────────────────────────────────────────
// Main Handler
// ────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { keyword, urls } = await req.json();

    if (!keyword || !urls || !Array.isArray(urls) || urls.length < 2 || urls.length > 5) {
      return NextResponse.json({ error: '키워드와 2~5개의 URL이 필요합니다.' }, { status: 400 });
    }

    if (!ANTHROPIC_API_KEY) {
      throw new Error('서버에 AI API 키가 설정되지 않았습니다.');
    }

    // ── STAGE 1: 각 URL을 post-xray와 동일한 방식으로 병렬 개별 분석 ──
    const postResults = await Promise.all(urls.map(u => analyzeOnePost(u, keyword)));
    const validPosts = postResults.filter(p => !p.error && p.textLength > 50);

    if (validPosts.length < 2) {
      return NextResponse.json(
        { error: '유효한 본문을 추출할 수 있는 URL이 2개 미만입니다. 비공개 글이거나 주소가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // ── STAGE 2: 고품질 개별 분석 결과 기반 독립 종합 분석 ──
    const synthesis = await synthesize(keyword, validPosts);

    // ── 프론트엔드 호환 응답 구조 구성 (기존 UI와 완전 동일) ──
    const individualStats: IndividualStat[] = validPosts.map(p => ({
      url: p.url,
      title: p.title,
      textLength: p.textLength,
      imageCount: p.imageCount,
      keywordCount: p.keywordCount,
    }));

    const individualTimelines: TimelineStep[][] = validPosts.map(p => p.timeline);

    const avgTextLength = Math.round(validPosts.reduce((a, c) => a + c.textLength, 0) / validPosts.length);
    const avgImageCount = Math.round(validPosts.reduce((a, c) => a + c.imageCount, 0) / validPosts.length);
    const avgKeywordCount = Math.round(validPosts.reduce((a, c) => a + c.keywordCount, 0) / validPosts.length);

    return NextResponse.json({
      individualStats,
      individualTimelines,
      averages: {
        textLength: avgTextLength,
        imageCount: avgImageCount,
        keywordCount: avgKeywordCount,
      },
      commonKeywords: synthesis.commonKeywords,
      commonTimeline: synthesis.commonTimeline,
      finalInsights: synthesis.finalInsights,
    });

  } catch (error: any) {
    console.error('AI Insight Error:', error);
    return NextResponse.json({ error: error.message || '분석 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
