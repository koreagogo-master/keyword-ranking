// app/layout.tsx
// app/layout.tsx 파일 상단에 추가
import Sidebar from "@/components/Sidebar";
import type { Metadata } from "next";
import localFont from "next/font/local";
// @ts-ignore
import "./globals.css";
import Header from "@/components/Header";
import MemoSidebar from "@/components/MemoSidebar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/app/contexts/AuthContext";
import MobileBlocker from "@/components/MobileBlocker";

// 🌟 1. 사이드바를 뼈대용으로 불러옵니다.


const nanumBarunGothic = localFont({
  src: [
    { path: "../public/fonts/NanumBarunGothic.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/NanumBarunGothicBold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-nanum-barun",
});

const nanumSquare = localFont({
  src: [
    { path: "../public/fonts/NanumSquareL.ttf", weight: "300", style: "normal" },
    { path: "../public/fonts/NanumSquareR.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/NanumSquareB.ttf", weight: "700", style: "normal" },
    { path: "../public/fonts/NanumSquareEB.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-nanum-square",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  // 🌟 1. 동적 타이틀 세팅 (템플릿 적용)
  title: {
    default: "Ranking Pro - 마케터를 위한 정밀 키워드 분석 솔루션", // 메인 페이지 이름
    template: "%s | Ranking Pro", // 세부 페이지 이름 뼈대
  },
  description: "마케터 전용 정밀 키워드 분석 솔루션. 네이버·구글 검색 트렌드 분석과 AI 듀얼 엔진 포스팅으로 최적의 마케팅 전략을 제공합니다.",

  // 🌟 2. 카카오톡/슬랙 썸네일(Open Graph) 세팅
  openGraph: {
    title: "Ranking Pro - 마케터를 위한 정밀 키워드 분석 솔루션",
    description: "마케터 전용 정밀 키워드 분석 솔루션. 네이버·구글 검색 트렌드 분석과 AI 듀얼 엔진 포스팅으로 최적의 마케팅 전략을 제공합니다.",
    url: "https://tmgad.com",
    siteName: "Ranking Pro",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "https://tmgad.com/tmgad-cover.jpg", // 업로드하신 썸네일 이미지 적용
        width: 600,
        height: 315,
        alt: "Ranking Pro 대표 이미지",
      },
    ],
  },

  // 기존 네이버 소유권 확인 태그 (원래 있던 것 그대로 유지)
  verification: {
    other: {
      "naver-site-verification": ["a6ef7f0c6159e0a643424685bf07ced6eca6ea1e"],
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${nanumBarunGothic.variable} ${nanumSquare.variable} antialiased flex flex-col min-h-screen`}
      >
        <AuthProvider>
          <MobileBlocker />
          <Header />

          {/* 🌟 2. 뼈대에 사이드바를 고정합니다! 이제 모든 페이지에 자동으로 나옵니다. */}
          <Sidebar />

          <MemoSidebar />

          <div className="pt-16 flex-1 bg-gray-50 text-slate-800">
            {children}
          </div>

          <Footer />

        </AuthProvider>
      </body>
    </html>
  );
}