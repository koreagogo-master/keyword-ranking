import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ error: '키워드가 필요합니다.' }, { status: 400 });
  }

  // 🌟 .env 파일에 있는 변수명 사용 (정상 작동 확인된 키)
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    // 🌟 다시 가장 안전한 공식 API로 롤백하되, 요청 개수(display)를 40개로 늘렸습니다.
    const response = await fetch(`https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(keyword)}&display=40`, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.errorMessage || '네이버 API 호출에 실패했습니다.');
    }

    // 🌟 프론트엔드와 규격을 맞추기 위해 데이터 정제 (리뷰 등은 추후 하이브리드로 채울 자리)
    const items = data.items.map((item: any) => ({
      title: item.title,
      link: item.link,
      image: item.image, 
      mallName: item.mallName,
      price: parseInt(item.lprice, 10),
      category1: item.category1,
      category2: item.category2,
      category3: item.category3,
      reviews: 0,        // 2차 로직에서 채울 항목
      purchases: 0,      // 2차 로직에서 채울 항목
      regDate: '-',      // 2차 로직에서 채울 항목
    }));

    return NextResponse.json({
      success: true,
      total: data.total,
      items: items, 
    });

  } catch (error: any) {
    console.error("Official API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}