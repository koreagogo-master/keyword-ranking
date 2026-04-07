// app/api/ai-blog/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, keyword, productName, features, imageCount, postPurpose, wordCount, targetAudience, subKeywords, extraPrompt, originalContent } = body;

    // 모드별 필수값 검증
    if (mode === 'auto') {
        if (!keyword || !productName || !features) {
          return NextResponse.json({ error: "필수 입력값이 누락되었습니다." }, { status: 400 });
        }
    } else if (mode === 'renewal') {
        if (!originalContent) {
          return NextResponse.json({ error: "리뉴얼할 원본 텍스트가 필요합니다." }, { status: 400 });
        }
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!OPENAI_API_KEY || !ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: "서버에 API 키가 설정되지 않았습니다." }, { status: 500 });
    }

    // 공통 프롬프트 세팅
    const audiencePrompt = targetAudience ? `- 메인 타겟 독자: ${targetAudience} (이 타겟층이 깊이 공감할 만한 서론을 적어줘)` : '- 메인 타겟 독자: 불특정 다수';
    const purposePrompt = postPurpose.includes('설득형') 
        ? '리뷰어가 직접 사용해보고 진심으로 추천하는 듯한 친근하고 자연스러운 설득형 문체 (블로그 이웃과 소통하는 느낌)'
        : '전문가가 객관적인 스펙과 장단점을 논리적으로 분석해주는 깔끔하고 딱딱한 정보성 문체';
    const subKeywordPrompt = subKeywords ? `\n- 연관 검색어: [${subKeywords}]를 본문에 자연스럽게 1~2회씩 넣어줘.` : '';
    const extraInstructionPrompt = extraPrompt ? `\n\n[추가 요구사항]\n"${extraPrompt}"` : '';

    // 💡 AI가 오버페이스 하지 않도록 '상한선'을 명확히 제시합니다.
    let lengthPrompt = '- 글자수: 공백 포함 1,500자 ~ 1,800자 사이로 작성해. 분량을 채우되 너무 길어지지 않도록 주의해.';
    if (wordCount === '2000') lengthPrompt = '- 글자수: 공백 포함 2,000자 ~ 2,300자 사이로 상세하게 작성해.';
    else if (wordCount === '3000') lengthPrompt = '- 글자수: 공백 포함 3,000자 ~ 3,500자 사이로 압도적인 분량으로 깊이 있게 작성해.';

    let finalContent = "";

    const isInfoMode = postPurpose.includes('정보성');

    // ====================================================================
    // 모드 A: [원고 자동 생성]
    // ====================================================================
    if (mode === 'auto') {
        if (isInfoMode) {
            const gptSinglePrompt = `너는 15년 차 네이버 블로그 상위노출 SEO 전문가야.
            다음 정보를 바탕으로 실제 블로그에 올라갈 [정보성 전문 원고]를 완벽하게 작성해.
            - 타겟 키워드: ${keyword}
            - 홍보할 상품명: ${productName}
            - 상품 핵심 장점: ${features}
            ${audiencePrompt}
            
            [본문 작성 필수 규칙]
            1. 맨 위에 클릭을 유도하는 매력적인 [제목]을 1개만 제안해.
            2. 메인 키워드(${keyword})를 본문에 5~7회 자연스럽게 반복해.
            3. 장점(${features})을 과장 없이 진정성 있게 풀어내.
            4. 문체: ${purposePrompt}
            ${lengthPrompt}
            6. 가독성을 위해 문단을 자주 나누어.
            ${subKeywordPrompt}
            ${extraInstructionPrompt}`;

            const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
              body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: gptSinglePrompt }],
                temperature: 0.7,
              })
            });
            const gptData = await gptResponse.json();
            if (gptData.error) throw new Error(`GPT Error: ${gptData.error.message}`);
            finalContent = gptData.choices[0].message.content;

        } else {
            const gptPrompt = `너는 네이버 블로그 기획자야. 다음 정보로 기획안을 도출해.\n- 키워드: ${keyword}\n- 상품명: ${productName}\n- 장점: ${features}\n결과만 텍스트로 출력해.`;

            const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
              body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: gptPrompt }], temperature: 0.7 })
            });
            const gptData = await gptResponse.json();
            if (gptData.error) throw new Error(`GPT Error 1단계: ${gptData.error.message}`);
            const outline = gptData.choices[0].message.content;

            const writerPrompt = `앞서 기획자가 작성한 [기획안]으로 블로그 원고를 작성해줘.\n[기획안]:\n${outline}\n\n[규칙]\n1. 맨 위에 제목 1개\n2. 키워드(${keyword}) 5~7회 반복\n3. 문체: ${purposePrompt}\n${lengthPrompt}\n${subKeywordPrompt}\n${extraInstructionPrompt}`;

            const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY.trim(), 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({ 
                model: 'claude-sonnet-4-6', // 💡 2026년 최신 정식 모델명으로 교체
                max_tokens: 4000, 
                messages: [{ role: 'user', content: writerPrompt }], 
                temperature: 0.8 
              })
            });
            const claudeData = await claudeResponse.json();
            if (!claudeResponse.ok || claudeData.error) throw new Error(`Claude Error: ${claudeData.error?.message || '응답 오류'}`);
            finalContent = claudeData.content[0].text;
        }
    } 
    // ====================================================================
    // 모드 B: [기존 원고 리뉴얼]
    // ====================================================================
    else {
        const renewalPrompt = `아래 [원본 텍스트]의 팩트만 살리고 문장 구조와 어휘를 완전히 새롭게 재창조해.\n[원본 텍스트]:\n${originalContent}\n\n[규칙]\n1. 유사문서 회피를 위해 완전히 다르게 쓰기\n2. 문체: ${purposePrompt}\n${audiencePrompt}\n${lengthPrompt}\n${subKeywordPrompt}\n${extraInstructionPrompt}`;

        if (isInfoMode) {
             const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
              body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: renewalPrompt }], temperature: 0.7 })
            });
            const gptData = await gptResponse.json();
            if (gptData.error) throw new Error(`GPT Error: ${gptData.error.message}`);
            finalContent = gptData.choices[0].message.content;
        } else {
            const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY.trim(), 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({ 
                model: 'claude-sonnet-4-6', // 💡 2026년 최신 정식 모델명으로 교체
                max_tokens: 4000, 
                messages: [{ role: 'user', content: renewalPrompt }], 
                temperature: 0.85 
              })
            });
            const claudeData = await claudeResponse.json();
            if (!claudeResponse.ok || claudeData.error) throw new Error(`Claude Error: ${claudeData.error?.message || '응답 오류'}`);
            finalContent = claudeData.content[0].text;
        }
    }

    return NextResponse.json({ content: finalContent, images: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "오류가 발생했습니다." }, { status: 500 });
  }
}