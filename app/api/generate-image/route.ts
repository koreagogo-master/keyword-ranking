import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { style, ratio, count, keyword } = body;

    // 프롬프트 조합 (화면에서 선택한 설정 적용)
    const prompt = `주제: ${keyword}, 스타일: ${style}, 고품질로 그려주세요.`;

    // OpenAI API에 보낼 이미지 비율 설정 (DALL-E 3 지원 사이즈 기준)
    let size = "1024x1024"; // 1:1 정사각형 기본
    if (ratio.includes("16:9")) size = "1792x1024"; // 가로형
    if (ratio.includes("3:4")) size = "1024x1792"; // 세로형

    // 여러 장을 생성하기 위해 count 횟수만큼 API를 호출합니다.
    // (DALL-E 3는 정책상 한 번 호출에 1장씩만 생성 가능하므로 반복 호출 처리)
    const imagePromises = [];
    for (let i = 0; i < count; i++) {
      const promise = fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "dall-e-3", // 가장 품질이 좋은 모델
          prompt: prompt,
          n: 1,
          size: size,
        }),
      }).then(res => res.json());

      imagePromises.push(promise);
    }

    // 모든 이미지 생성이 완료될 때까지 대기
    const results = await Promise.all(imagePromises);

    // 결과에서 이미지 URL만 추출
    const images = results.map(data => {
      if (data.error) throw new Error(data.error.message);
      return data.data[0].url;
    });

    // 프론트엔드로 이미지 배열 전달
    return NextResponse.json({ images });

  } catch (error: any) {
    console.error("이미지 생성 에러:", error);
    return NextResponse.json(
      { error: error.message || '이미지 생성 중 오류가 발생했습니다.' }, 
      { status: 500 }
    );
  }
}