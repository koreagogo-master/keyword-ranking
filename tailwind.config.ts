import type { Config } from "tailwindcss";

const config: Config = {
  // Tailwind를 적용할 파일 경로들을 지정합니다.
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // layout.tsx에서 정의한 CSS 변수를 fontFamily로 등록합니다.
      fontFamily: {
        // 제목용: 나눔바른고딕
        title: ["var(--font-nanum-barun)", "sans-serif"],
        // 내용용: 나눔스퀘어
        body: ["var(--font-nanum-square)", "sans-serif"],
      },
      // 브랜드 컬러 오렌지색도 등록해두면 편리합니다.
      colors: {
        tmgOrange: "#ff8533",
      },
    },
  },
  plugins: [],
};

export default config;