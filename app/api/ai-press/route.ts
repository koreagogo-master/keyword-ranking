import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { docType, companyName, ceoName, newsTopic, details } = body;

    // 필수값 검증
    if (!companyName || !newsTopic || !details) {
      return NextResponse.json({ error: "필수 입력값이 누락되었습니다." }, { status: 400 });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!OPENAI_API_KEY || !ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "서버에 API 키가 설정되지 않았습니다." }, { status: 500 });
    }

    // 💡 1단계: GPT-4o 기획 단계 (수석 PR 기획자)
    const plannerPrompt = `너는 20년 차 수석 언론홍보(PR) 기획자야.
    다음 정보를 바탕으로 [${docType}]의 구조와 핵심 메시지를 기획해줘.

    [기본 정보]
    - 작성 형태: ${docType}
    - 기업/브랜드명: ${companyName}
    - 대표/기고자: ${ceoName || '없음'}
    - 핵심 주제: ${newsTopic}
    - 상세 내용: ${details}

    [출력 규칙]
    결과물은 서론, 본론, 결론의 뼈대와 반드시 포함되어야 할 핵심 키워드, 그리고 매력적인 헤드라인(제목) 후보 3개만 간결하게 텍스트로 출력해.`;

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: plannerPrompt }],
        temperature: 0.7,
      })
    });
    const gptData = await gptResponse.json();
    if (gptData.error) throw new Error(`GPT Error: ${gptData.error.message}`);
    const outline = gptData.choices[0].message.content;

    // 💡 2단계: Claude 작성 단계 (형태에 따라 문체 다르게 설정)
    let formatRules = '';
    if (docType === '보도자료 (언론 배포용)') {
        formatRules = `- 공식적이고 신뢰감 있는 건조한 언론사 톤앤매너 사용\n- [기업명=배포일시] 형식의 데이터라인 포함\n- 기사 하단에 담당자 연락처나 회사소개 등의 '문단(Boilerplate)' 공간 마련\n- 필요시 대표/관계자('${ceoName || '관계자'}')의 따옴표 인터뷰 인용구 필수 삽입`;
    } else if (docType === '뉴스 기사 (객관적 보도)') {
        formatRules = `- 제3자(기자)의 시각에서 객관적으로 작성된 스트레이트 기사 형식\n- 독자의 흥미를 끄는 리드(Lead) 문장으로 시작\n- 신문 기사용 표준어와 격식 있는 문체 사용`;
    } else if (docType === '전문 칼럼 (오피니언)') {
        formatRules = `- '${ceoName || '전문가'}'의 시점에서 1인칭 또는 오피니언 리더의 톤으로 작성\n- 단순 사실 전달을 넘어, 업계에 대한 통찰력(인사이트)과 깊이 있는 분석, 주관적인 견해 포함\n- 독자를 설득하거나 생각할 거리를 던져주는 세련된 문체`;
    }

    const writerPrompt = `앞서 PR 기획자가 작성한 [기획안]과 [기본 정보]를 바탕으로, 실제 언론에 배포할 완벽한 [${docType}] 최종본을 작성해줘.

    [기획안]:
    ${outline}

    [기본 정보]
    - 기업/브랜드명: ${companyName}
    - 대표/기고자: ${ceoName}
    - 핵심 주제: ${newsTopic}
    - 상세 내용: ${details}

    [작성 규칙]
    1. 맨 위에는 가장 매력적인 최종 제목 1개만 배치 (기획안의 후보 중 선택하거나 발전시킴)
    2. ${formatRules}
    3. 글자수: 공백 포함 1,200자 ~ 1,800자 사이로 작성 (분량을 너무 짧지 않게 채울 것)
    4. 문단 구분을 명확히 하여 가독성을 극대화할 것
    5. 쓸데없는 인사말이나 서론("네, 작성해 드리겠습니다" 등) 없이 바로 제목과 본문만 출력할 것`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY.trim(), 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ 
        model: 'claude-sonnet-4-6', // 기존 ai-blog에서 사용하신 모델명과 통일
        max_tokens: 4000, 
        messages: [{ role: 'user', content: writerPrompt }], 
        temperature: 0.8 
      })
    });
    const claudeData = await claudeResponse.json();
    if (!claudeResponse.ok || claudeData.error) throw new Error(`Claude Error: ${claudeData.error?.message || '응답 오류'}`);
    const finalContent = claudeData.content[0].text;

    return NextResponse.json({ content: finalContent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "오류가 발생했습니다." }, { status: 500 });
  }
}