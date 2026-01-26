import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Header from "@/components/Header";

// 1. 나눔바른고딕 설정 (파일명: NanumBarunGothic.ttf)
const nanumBarunGothic = localFont({
  src: "../public/fonts/NanumBarunGothic.ttf", 
  variable: "--font-nanum-barun",
});

// 2. 나눔스퀘어 설정 (파일명: NanumSquareR.otf)
// 이미지 목록에 있는 'NanumSquareR.otf'로 이름을 맞췄습니다.
const nanumSquare = localFont({
  src: "../public/fonts/NanumSquareR.otf", 
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
        <Header />
        
        {/* 기존 다크모드 배경(bg-gray-900) 유지 */}
        <div className="pt-16 min-h-screen bg-gray-900 text-white">
          {children}
        </div>
      </body>
    </html>
  );
}