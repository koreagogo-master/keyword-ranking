import type { Metadata } from "next"; // 22번줄 Metadata 에러 해결
import localFont from "next/font/local"; // 2, 11번줄 localFont 에러 해결
import "./globals.css";
import Header from "@/components/Header"; // 36번줄 Header 에러 해결

// 1. 나눔바른고딕 설정 (작은 글씨 가독성용)
const nanumBarunGothic = localFont({
  src: [
    { path: "../public/fonts/NanumBarunGothic.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/NanumBarunGothicBold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-nanum-barun",
});

// 2. 나눔스퀘어 설정 (제목 및 큰 글씨용)
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
        {/* 사용자님께서 만드신 상단 바 컴포넌트입니다. Headers가 아니라 Header가 맞습니다. */}
        <Header />
        
        <div className="pt-16 min-h-screen bg-gray-900 text-white">
          {children}
        </div>
      </body>
    </html>
  );
}