import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/mypage',     // 개인정보 보호 (수집 금지)
        '/login',      // 로그인/회원가입 페이지 (수집 금지)
        '/api/',       // 내부 API 통신 경로 (수집 금지)
        '/admin/',
      ],
    },
    sitemap: 'https://tmgad.com/sitemap.xml',
  };
}