// app/api/youtube-suggest/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ success: false, error: '키워드가 없습니다.' });
  }

  try {
    // 🌟 핵심: ds=yt (Data Source = YouTube) 파라미터를 붙여 유튜브 전용 검색어를 가져옵니다.
    const url = `http://suggestqueries.google.com/complete/search?client=chrome&ds=yt&q=${encodeURIComponent(keyword)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    // 데이터의 두 번째 배열에 자동완성 키워드 목록이 들어있습니다.
    const suggested = data[1] || [];

    return NextResponse.json({ success: true, suggested });
  } catch (error: any) {
    console.error('YouTube Suggest Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}