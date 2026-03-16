import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ success: false, error: '키워드가 필요합니다.' });
  }

  try {
    // 네이버 모바일 자동완성 공식 오픈 주소입니다.
    const url = `https://mac.search.naver.com/mobile/ac?q=${encodeURIComponent(keyword)}&st=100&r_format=json`;
    const response = await fetch(url);
    const data = await response.json();

    // 네이버 데이터 구조에서 키워드 텍스트만 쏙 빼내어 최대 10개까지만 자릅니다.
    let autocompleteList: string[] = [];
    if (data.items && data.items[0] && data.items[0].length > 0) {
      autocompleteList = data.items[0].map((item: any) => item[0]).slice(0, 10);
    }

    return NextResponse.json({ success: true, keywords: autocompleteList });
  } catch (error) {
    console.error("자동완성 API 에러:", error);
    return NextResponse.json({ success: false, error: '데이터를 불러오지 못했습니다.' });
  }
}