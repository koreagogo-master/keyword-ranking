import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 👇 로그인 중복 실행 방지 (기존 설정 유지)
  reactStrictMode: false,

  // 👇 HTTP/WWW 요청을 HTTPS/Non-WWW로 리디렉션하는 설정 추가
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.tmgad.com',
          },
        ],
        destination: 'https://tmgad.com/:path*',
        permanent: true,
      },
    ];
  },

  // 👇 에러가 나는 부분은 일단 삭제합니다. (기존 설정 유지)
  // eslint: { ignoreDuringBuilds: true }, 
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;