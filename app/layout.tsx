import type { Metadata } from "next"; 
import localFont from "next/font/local"; 
import "./globals.css";
import Header from "@/components/Header"; 
import MemoSidebar from "@/components/MemoSidebar"; // 1. 메모장 컴포넌트 추가

// 1. 나눔바른고딕 설정
const nanumBarunGothic = localFont({
  src: [
    { path: "../public/fonts/NanumBarunGothic.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/NanumBarunGothicBold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-nanum-barun",
});

// 2. 나눔스퀘어 설정
const nanumSquare = localFont({
  src: [
    { path: "../public/fonts/NanumSquareL.ttf", weight: "300", style: "normal" },
    { path: "../public/fonts/NanumSquareR.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/NanumSquareB.ttf", weight: "700", style: "normal" },
    { path: "../public/fonts/NanumSquareEB.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-nanum-square",
});

export const metadata: Metadata = {
  title: "TMG 랭킹 - 블로그 & 지식인 순위 분석", 
  description: "블로그와 지식인 노출 순위를 실시간으로 조회하고 분석하는 마케팅 도구입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${nanumBarunGothic.variable} ${nanumSquare.variable} antialiased`}
      >
        {/* 상단 네비게이션 바 */}
        <Header />
        
        {/* 우측 슬라이딩 메모장 (모든 페이지에서 따라다님) */}
        <MemoSidebar />
        
        <div className="pt-16 min-h-screen bg-gray-900 text-white">
          {children}
        </div>
      </body>
    </html>
  );
}