// app/rss.xml/route.ts

export async function GET() {
  const siteURL = "https://tmgad.com";

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0">
    <channel>
      <title>Ranking Pro - 마케팅 키워드 분석의 정밀 솔루션 tmgad.com</title>
      <link>${siteURL}</link>
      <description>Naver API와 Google API를 기반으로 GPT-4o(구조 기획)와 Claude 3.5(자연스러운 문장) 듀얼 엔진을 접목한 마케터 전용 사이트.</description>
      
      <item>
        <title>키워드 정밀 분석 | Ranking Pro</title>
        <link>${siteURL}/analysis</link>
        <description>네이버 검색 트렌드와 검색량, 클릭률 데이터를 바탕으로 핵심 마케팅 키워드를 정밀하게 분석합니다.</description>
      </item>

      <item>
        <title>연관 키워드 조회 | Ranking Pro</title>
        <link>${siteURL}/related</link>
        <description>타겟 키워드와 관련된 파생 키워드 및 롱테일 키워드를 발굴하여 검색 노출 기회를 확장합니다.</description>
      </item>

      <item>
        <title>블로그 순위 확인 | Ranking Pro</title>
        <link>${siteURL}/blog-rank</link>
        <description>네이버 블로그 및 스마트블록의 실시간 노출 순위를 추적하고 경쟁 상태를 모니터링합니다.</description>
      </item>

      <item>
        <title>지식인 순위 확인 | Ranking Pro</title>
        <link>${siteURL}/kin-rank</link>
        <description>네이버 지식iN 검색 결과의 상위 노출 순위를 확인하고 여론 형성 상태를 점검합니다.</description>
      </item>

      <item>
        <title>통검 노출/순위 확인 | Ranking Pro</title>
        <link>${siteURL}/section-check</link>
        <description>네이버 통합검색 화면에서 브랜드와 타겟 키워드가 어떤 섹션에 노출되고 있는지 종합적으로 분석합니다.</description>
      </item>

      <item>
        <title>키워드 생성기 | Ranking Pro</title>
        <link>${siteURL}/keyword-generator</link>
        <description>마케팅 목적에 맞는 최적의 조합 키워드를 자동으로 생성하여 광고 효율을 극대화합니다.</description>
      </item>

      <item>
        <title>Dual AI 포스팅 | Ranking Pro</title>
        <link>${siteURL}/ai-blog</link>
        <description>GPT-4o와 Claude 3.5 듀얼 엔진을 활용하여 검색 엔진에 최적화된 고품질 마케팅 블로그 원고를 자동으로 작성합니다.</description>
      </item>

      <item>
        <title>AI 언론 보도자료 | Ranking Pro</title>
        <link>${siteURL}/ai-press</link>
        <description>전문적인 기사 구조와 자연스러운 문맥을 갖춘 언론 홍보용 보도자료를 AI가 신속하게 작성합니다.</description>
      </item>

      <item>
        <title>쇼핑 키워드 인사이트 | Ranking Pro</title>
        <link>${siteURL}/shopping-insight</link>
        <description>네이버 쇼핑 검색 트렌드와 구매 의도가 높은 커머스 타겟 키워드를 분석하여 스마트스토어 셀러의 매출을 돕습니다.</description>
      </item>

      <item>
        <title>쇼핑 상품명 최적화 | Ranking Pro</title>
        <link>${siteURL}/seo-title</link>
        <description>검색 알고리즘에 맞춘 최적의 상품명 조합을 제안하여 쇼핑몰 상위 노출 확률을 높입니다.</description>
      </item>

      <item>
        <title>내 상품명 진단 | Ranking Pro</title>
        <link>${siteURL}/seo-check</link>
        <description>현재 사용 중인 상품명의 SEO 점수를 진단하고 개선점을 파악하여 쇼핑 검색 노출 경쟁력을 강화합니다.</description>
      </item>

      <item>
        <title>상품 노출 순위 분석 | Ranking Pro</title>
        <link>${siteURL}/shopping-rank</link>
        <description>네이버 쇼핑 내에서 내 상품과 경쟁사 상품의 실시간 랭킹 및 노출 순위를 정확하게 추적합니다.</description>
      </item>

      <item>
        <title>구글 키워드 분석 | Ranking Pro</title>
        <link>${siteURL}/google-analysis</link>
        <description>구글 검색 엔진의 글로벌 및 국내 검색량, 경쟁도 데이터를 기반으로 구글 SEO 최적화 전략을 수립합니다.</description>
      </item>

      <item>
        <title>유튜브 트렌드 | Ranking Pro</title>
        <link>${siteURL}/youtube-trend</link>
        <description>실시간 유튜브 인기 검색어 및 급상승 트렌드 데이터를 분석하여 최적의 영상 콘텐츠 기획 전략을 제안합니다.</description>
      </item>
    </channel>
  </rss>`;

  return new Response(rssFeed, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}