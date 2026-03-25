// app/api/refine-title/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { keyword, productName, attribute, titles } = await req.json();

        if (!titles || titles.length === 0) {
            return NextResponse.json({ success: false, message: '다듬을 상품명이 없습니다.' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, message: '서버에 API 키가 설정되지 않았습니다.' }, { status: 500 });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                response_format: { type: "json_object" }, 
                messages: [
                    {
                        role: 'system',
                        content: `당신은 네이버 스마트스토어 검색 알고리즘(SEO) 최고 전문가입니다. 주어진 핵심 검색어와 상위 노출 상품명 데이터를 바탕으로 다음 임무를 수행하세요:

[임무 1: 네이버 SEO 규정에 맞는 'OpenAI 추천 태그' 10개 추출]
- [태그 규정 1] 복합명사 결합 (파편화 금지): 'LED', '랜턴'처럼 의미 없이 단일 단어로 쪼개지 마세요. 소비자가 실제 검색하는 형태인 'LED랜턴', '캠핑조명', '차박용품' 같은 '복합명사'로 단단하게 결합하여 10개를 만드세요.
- [태그 규정 2] 어뷰징(스팸) 절대 금지: 단, 모든 태그에 핵심 검색어(예: '손전등') 하나만 반복해서 붙이는 도배 행위는 무조건 금지합니다. 동의어, 용도, 타겟층을 다양하게 활용하세요.
- [태그 규정 3] 글자 수: 각 태그는 10자 이내의 명사 형태로만 작성하세요. (특수기호 제외)

[임무 2: 브랜드명을 제외한 '수식어+키워드 덩어리' 10개 제작]
- [상품명 규칙 1] 과잉 생산 강제: 시스템이 나중에 45자가 넘으면 알아서 자를 것입니다. 길이를 절대 눈치 보지 말고, 무조건 띄어쓰기 기준으로 최소 10개 이상의 명사 키워드를 욱여넣어 50자가 훌쩍 넘도록 무식하게 길고 풍성하게 토해내세요!
- [상품명 규칙 2] 자연스러운 어순 배치 (매우 중요): 가장 중요하고 검색량이 많은 핵심 명사(예: 캠핑랜턴, 조명)를 앞쪽에 배치하고, 서브 타겟층이나 용도(예: 야외, 감성)는 맨 뒤로 빼서 자연스러운 어순을 만드세요.
- [상품명 규칙 3] 오직 명사의 나열: "감성을 더하세요" 같은 서술어, 형용사, 감성어는 100% 배제하세요. 오직 '명사형 쇼핑 키워드'만 나열해야 합니다.
- [상품명 규칙 4] 브랜드/속성 제외: 절대 브랜드명이나 속성을 포함하지 마세요.
- [상품명 규칙 5] 재료 총동원: 방금 [임무 1]에서 뽑은 추천 태그와 제공된 '상위 노출 후보 데이터'에 있는 명사들을 아낌없이 쏟아부으세요.

반드시 아래의 JSON 형식으로만 답변하세요:
{
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5", "태그6", "태그7", "태그8", "태그9", "태그10"],
  "refinedTitles": ["키워드조합1", "키워드조합2", "키워드조합3", "키워드조합4", "키워드조합5", "키워드조합6", "키워드조합7", "키워드조합8", "키워드조합9", "키워드조합10"]
}`
                    },
                    {
                        role: 'user',
                        content: `핵심 검색어: ${keyword}\n\n상위 노출 후보 데이터:\n${titles.join('\n')}`
                    }
                ],
                temperature: 0.4 
            })
        });

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
            const aiResult = JSON.parse(data.choices[0].message.content);
            
            const safeBrand = productName ? productName.trim() : '';
            const safeAttribute = attribute ? attribute.trim() : ''; 
            
            // 🌟 map 함수에 index(순서)를 추가로 받습니다.
            const finalTitles = aiResult.refinedTitles.map((aiTitle: string, index: number) => {
                
                let aiWords = aiTitle.trim().split(' ');
                
                // 🌟 [핵심 로직] index가 짝수(0, 2, 4...)일 때만 속성을 포함!
                // 프로그래밍에서 인덱스는 0부터 시작하므로 0, 2, 4번째가 화면상의 1, 3, 5번째 홀수 항목입니다.
                const shouldIncludeAttribute = safeAttribute && (index % 2 === 0);
                
                const buildTitle = (words: string[]) => {
                    const parts = [];
                    if (safeBrand) parts.push(safeBrand);
                    parts.push(...words);
                    // 🌟 교차 로직에 따라 속성을 넣거나 뺍니다.
                    if (shouldIncludeAttribute) parts.push(safeAttribute); 
                    return parts.join(' ').trim();
                };

                let combinedTitle = buildTitle(aiWords);
                
                while (combinedTitle.length > 45 && aiWords.length > 1) {
                    aiWords.pop(); 
                    combinedTitle = buildTitle(aiWords); 
                }
                
                return combinedTitle;
            });

            aiResult.refinedTitles = finalTitles;

            return NextResponse.json({ success: true, aiResult });
        } else {
            console.error('OpenAI API 에러:', data);
            throw new Error('OpenAI API 응답 오류');
        }

    } catch (error) {
        console.error('AI 다듬기 서버 오류:', error);
        return NextResponse.json({ success: false, message: 'AI 통신에 실패했습니다.' }, { status: 500 });
    }
}