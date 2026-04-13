import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://tmgad.com';

  // page.tsx의 실제 href 경로를 100% 반영한 공개 페이지 목록
  const routes = [
    '',                   // 메인 페이지
    '/analysis',          // 키워드 정밀 분석
    '/related-fast',      // 연관 키워드 조회
    '/blog-rank-b',       // 블로그 순위 확인
    '/kin-rank',          // 지식인 순위 확인
    '/blog-rank',         // 통검 노출/순위 확인
    '/keyword-generator', // 키워드 생성기
    '/ai-blog',           // Dual AI 포스팅
    '/ai-press',          // AI 언론 보도자료
    '/google-analysis',   // 구글 키워드 분석 (추가 완료)
    '/youtube-trend',     // 유튜브 트렌드 (추가 완료)
    '/shopping-insight',  // 쇼핑 키워드 인사이트
    '/seo-title',         // 쇼핑 상품명 최적화
    '/seo-check',         // 내 상품명 진단
    '/shopping-rank',     // 상품 노출 순위 분석
    '/contact',           // 고객센터 (FAQ)
    '/notice',            // 공지사항
    '/charge'             // 포인트 충전소
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  return routes;
}