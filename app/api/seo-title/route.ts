import { NextResponse } from 'next/server';

const limitTitleLength = (title: string, maxLength = 45): string => {
    const words = title.split(/\s+/);
    let finalTitle = words.join(' ');

    while (finalTitle.length > maxLength && words.length > 1) {
        words.pop();
        finalTitle = words.join(' ');
    }
    return finalTitle;
};

export async function POST(request: Request) {
    try {
        const { keyword, productName, excludeKeyword } = await request.json();

        if (!keyword) {
            return NextResponse.json({ success: false, message: '키워드가 없습니다.' }, { status: 400 });
        }

        const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
        const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return NextResponse.json({ success: false, message: '서버에 네이버 API 키가 설정되지 않았습니다.' }, { status: 500 });
        }

        const searchKeyword = keyword.replace(/[,_]/g, ' ').replace(/\s+/g, ' ').trim();

        const excludeArray = excludeKeyword
            ? excludeKeyword.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0)
            : [];

        const apiUrl = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(searchKeyword)}&display=40`;

        const response = await fetch(apiUrl, {
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret,
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`Naver API 통신 실패 (상태 코드: ${response.status})`);
        }

        const data = await response.json();

        // 🌟 [수정됨] 10개가 아닌 상위 40개 전체의 상품명을 넘겨줍니다.
        const top40Titles = data.items ? data.items.map((item: any) => item.title.replace(/<[^>]+>/g, '')) : [];

        const categoryMap: Record<string, number> = {};
        let totalCategories = 0;
        const wordCount: Record<string, number> = {};

        if (data.items) {
            data.items.forEach((item: any) => {
                const catPath = [item.category1, item.category2, item.category3, item.category4]
                    .filter(c => c !== "")
                    .join(' > ');
                
                if (catPath) {
                    categoryMap[catPath] = (categoryMap[catPath] || 0) + 1;
                    totalCategories++;
                }

                const cleanTitle = item.title.replace(/<[^>]+>/g, '').replace(/[\[\]()+\-]/g, ' ');
                const words = cleanTitle.split(/\s+/);

                words.forEach((word: string) => {
                    const w = word.trim();
                    const isExcluded = excludeArray.some((ex: string) => w.includes(ex));

                    if (w.length >= 2 && !searchKeyword.includes(w) && !w.includes(searchKeyword) && !isExcluded) {
                        wordCount[w] = (wordCount[w] || 0) + 1;
                    }
                });
            });
        }

        const categoryStats = Object.entries(categoryMap)
            .map(([path, count]) => ({
                path,
                percentage: Math.round((count / totalCategories) * 100)
            }))
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 5);

        const BLACKLIST = ['무료배송', '무배', '특가', '할인', '이벤트', '1+1', '증정', '사은품', '당일발송', '당일출고', '최저가', '정품', '도매', '이월'];

        const topWordsForTags = Object.entries(wordCount)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0])
            .slice(0, 20);

        const recommendedTags = topWordsForTags.map(word => {
            const isBanned = BLACKLIST.some(banned => word.includes(banned));
            return { word, isBanned };
        });

        let relatedKeywords = topWordsForTags.slice(0, 10);
        const defaultKeywords = ['초특가', '가성비', '인기', '추천', '신상품', '대용량', '베스트', '프리미엄', '한정특가', '휴대용'];

        if (relatedKeywords.length < 4) {
            relatedKeywords = [...relatedKeywords, ...defaultKeywords];
        }

        const uniqueKeywords = Array.from(new Set(relatedKeywords)).slice(0, 10);
        const [w1='', w2='', w3='', w4='', w5='', w6='', w7='', w8='', w9=''] = uniqueKeywords;

        const prefix = productName ? `${productName} ` : '';

        const rawTitlesData = [
            { text: `${prefix}${searchKeyword} ${w1} ${w2} ${w3} ${w4}`, pattern: '정석 (메인 수식어형)' },
            { text: `${prefix}${w1} ${w2} ${searchKeyword} ${w3} ${w4} ${w5}`, pattern: '핵심 수식어 강조형' },
            { text: `${prefix}${w3} ${w4} ${searchKeyword} ${w1} ${w2}`, pattern: '모바일용 간결형' },
            { text: `${prefix}${w2} ${w1} ${searchKeyword} ${w5} ${w6}`, pattern: '서브 수식어 변형' },
            { text: `${prefix}${w4} ${w5} ${w6} ${searchKeyword} ${w1} ${w2}`, pattern: '서브 키워드 강조형' }
        ];

        const generatedTitles = rawTitlesData.map(item => {
            const words = item.text.split(/\s+/);
            const uniqueWordsInTitle = Array.from(new Set(words));
            const uniqueTitle = uniqueWordsInTitle.join(' ').trim();
            
            return {
                title: limitTitleLength(uniqueTitle, 45),
                pattern: item.pattern
            };
        });

        return NextResponse.json({
            success: true,
            titles: generatedTitles,
            keywordsUsed: uniqueKeywords.slice(0, 8),
            categoryStats: categoryStats,
            tags: recommendedTags,
            top40Titles: top40Titles // 🌟 프론트엔드로 40개 전송
        });

    } catch (error: any) {
        console.error('SEO Title API Error:', error);
        return NextResponse.json({ success: false, message: `데이터 조립 중 시스템 오류가 발생했습니다.` }, { status: 500 });
    }
}