import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ error: '키워드가 필요합니다.' }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'YouTube API 키가 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(keyword)}&type=video&regionCode=KR&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      throw new Error(searchData.error?.message || '검색 API 호출 실패');
    }

    const videoItems = searchData.items || [];
    if (videoItems.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const videoIds = videoItems.map((item: any) => item.id.videoId).join(',');

    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    const statsData = await statsRes.json();

    const finalData = statsData.items.map((item: any) => {
      return {
        videoId: item.id,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        viewCount: item.statistics.viewCount || '0',
        likeCount: item.statistics.likeCount || '0',
        // 🌟 이 부분이 추가되었습니다! (유튜버가 설정한 원본 태그 추출)
        tags: item.snippet.tags || [], 
      };
    });

    return NextResponse.json({ data: finalData });

  } catch (error: any) {
    console.error('YouTube API 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}