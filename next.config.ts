import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // [복구] 다시 독립형 모드 활성화 (이게 가장 가볍고 빠릅니다)
  output: "standalone",
  
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;