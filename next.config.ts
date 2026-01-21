import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 👇 로그인 중복 실행 방지 (필수)
  reactStrictMode: false,
  
  // 👇 에러가 나는 부분은 일단 삭제합니다. (로컬 개발에 지장 없음)
  // eslint: { ignoreDuringBuilds: true }, 
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;