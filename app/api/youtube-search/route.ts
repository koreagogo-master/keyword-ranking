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
    // 🌟 [수정됨] maxResults=10 이었던 부분을 원하시는 대로 maxResults=25 로 늘렸습니다.
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=${encodeURIComponent(keyword)}&type=video&regionCode=KR&key=${apiKey}`;
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
    const channelIds = [...new Set(videoItems.map((item: any) => item.snippet.channelId))].join(',');

    // 🌟 [유지됨] part에 contentDetails를 추가하여 영상 길이를 가져옵니다.
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    const statsData = await statsRes.json();

    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds}&key=${apiKey}`;
    const channelRes = await fetch(channelUrl);
    const channelData = await channelRes.json();

    const channelStatsMap: Record<string, string> = {};
    if (channelData.items) {
      channelData.items.forEach((ch: any) => {
        channelStatsMap[ch.id] = ch.statistics.subscriberCount || '0';
      });
    }

    const finalData = statsData.items.map((item: any) => {
      const chId = item.snippet.channelId;
      
      // 🌟 [유지됨] 유튜브 영상 길이(ISO 8601 형식)를 분석하여 Shorts(60초 이하)인지 판별합니다.
      const duration = item.contentDetails?.duration || '';
      let isShorts = false;
      if (!duration.includes('H')) { // 시간이 포함되어 있으면 무조건 롱폼
        const matchM = duration.match(/(\d+)M/);
        const matchS = duration.match(/(\d+)S/);
        const m = matchM ? parseInt(matchM[1]) : 0;
        const s = matchS ? parseInt(matchS[1]) : 0;
        if (m * 60 + s <= 61) isShorts = true; // 61초 이하를 보통 Shorts로 분류
      }

      return {
        videoId: item.id,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        viewCount: item.statistics.viewCount || '0',
        likeCount: item.statistics.likeCount || '0',
        commentCount: item.statistics.commentCount || '0',
        subscriberCount: channelStatsMap[chId] || '0',
        tags: item.snippet.tags || [],
        
        // 🌟 [유지됨] 더보기란 원본 텍스트와 Shorts 여부를 함께 보냅니다.
        description: item.snippet.description || '',
        isShorts: isShorts,
      };
    });

    return NextResponse.json({ data: finalData });

  } catch (error: any) {
    console.error('YouTube API 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}