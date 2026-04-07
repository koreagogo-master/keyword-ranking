import { NextResponse } from 'next/server';

// 🌟 1. 픽사베이 이미지 가져오기 함수
async function fetchPixabay(query: string, perPage: number = 20) {
  if (!query.trim()) return [];
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  
  const url = `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=${perPage}&lang=ko`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.hits?.map((hit: any) => hit.webformatURL) || [];
  } catch (e) {
    console.error("Pixabay Error:", e);
    return [];
  }
}

// 🌟 2. 펙셀스(감성 사진) 이미지 가져오기 함수
async function fetchPexels(query: string, perPage: number = 20) {
  if (!query.trim()) return [];
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  
  // landscape(가로형) 비율로 블로그에 최적화
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&locale=ko-KR&orientation=landscape`;
  try {
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.photos?.map((photo: any) => photo.src.landscape) || [];
  } catch (e) {
    console.error("Pexels Error:", e);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 프론트엔드에서 메인키워드와 서브키워드를 따로따로 받아옵니다.
    const manualKeyword = body.keyword || ''; // 검색창 수동 검색 시
    const mainKeyword = body.mainKeyword || manualKeyword;
    const subKeyword = body.subKeyword || '';

    if (!mainKeyword) {
      return NextResponse.json({ error: '검색할 키워드가 없습니다.' }, { status: 400 });
    }

    const allImagesArray: string[] = [];
    const uniqueSet = new Set<string>(); // 완벽히 동일한 URL 중복 제거용

    // 배열에 이미지를 넣는 도우미 함수 (중복 체크 포함)
    const addImage = (url: string) => {
      if (url && !uniqueSet.has(url)) {
        uniqueSet.add(url);
        allImagesArray.push(url);
      }
    };

    if (subKeyword) {
      // 🌟 [트리플 믹스 가동!] 3가지 경우의 수를 2개 사이트에서 동시에 검색 (총 6번)
      const [
        pixabayExact, pexelsExact,
        pixabayMain, pexelsMain,
        pixabaySub, pexelsSub
      ] = await Promise.all([
        fetchPixabay(`${mainKeyword} ${subKeyword}`, 15),
        fetchPexels(`${mainKeyword} ${subKeyword}`, 15),
        fetchPixabay(mainKeyword, 15),
        fetchPexels(mainKeyword, 15),
        fetchPixabay(subKeyword, 15),
        fetchPexels(subKeyword, 15),
      ]);

      const maxLength = Math.max(
        pixabayExact.length, pexelsExact.length,
        pixabayMain.length, pexelsMain.length,
        pixabaySub.length, pexelsSub.length
      );

      // 🌟 지퍼(Zipper) 방식으로 골고루 섞기
      for (let i = 0; i < maxLength; i++) {
        if (pexelsExact[i]) addImage(pexelsExact[i]); // 감성적인 펙셀스를 먼저 노출
        if (pixabayExact[i]) addImage(pixabayExact[i]);
        if (pexelsMain[i]) addImage(pexelsMain[i]);
        if (pixabayMain[i]) addImage(pixabayMain[i]);
        if (pexelsSub[i]) addImage(pexelsSub[i]);
        if (pixabaySub[i]) addImage(pixabaySub[i]);
      }
    } else {
      // 서브키워드가 없는 경우 (수동 검색창 이용 시 포함)
      const [pixabayMain, pexelsMain] = await Promise.all([
        fetchPixabay(mainKeyword, 30),
        fetchPexels(mainKeyword, 30)
      ]);
      
      const maxLength = Math.max(pixabayMain.length, pexelsMain.length);
      for (let i = 0; i < maxLength; i++) {
        if (pexelsMain[i]) addImage(pexelsMain[i]);
        if (pixabayMain[i]) addImage(pixabayMain[i]);
      }
    }

    return NextResponse.json({ images: allImagesArray });

  } catch (error: any) {
    console.error("무료 이미지 검색 에러:", error);
    return NextResponse.json(
      { error: error.message || '이미지 검색 중 서버 오류가 발생했습니다.' }, 
      { status: 500 }
    );
  }
}