// app/layout.tsx
import type { Metadata } from "next"; 
import localFont from "next/font/local"; 
// @ts-ignore
import "./globals.css";
import Header from "@/components/Header";
import MemoSidebar from "@/components/MemoSidebar"; 
import Footer from "@/components/Footer"; 
// 🌟 1. 방금 1단계에서 만든 중앙 통제실(AuthProvider)을 불러옵니다.
import { AuthProvider } from "@/app/contexts/AuthContext";

// 👇 🌟 여기에 수문장(모바일 차단막)을 불러오는 코드를 추가했습니다!
import MobileBlocker from "@/components/MobileBlocker"; 

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

// 👇 🌟 네이버 기준(제목 40자, 설명 80자)에 맞추고 OG 태그를 추가한 메타데이터입니다.
export const metadata: Metadata = {
  title: "Ranking Pro - 마케터를 위한 정밀 키워드 분석 솔루션", // 35자 (합격)
  description: "마케터 전용 정밀 키워드 분석 솔루션. 네이버·구글 검색 트렌드 분석과 AI 듀얼 엔진 포스팅으로 최적의 마케팅 전략을 제공합니다.", // 73자 (합격)
  openGraph: {
    title: "Ranking Pro - 마케터를 위한 정밀 키워드 분석 솔루션",
    description: "마케터 전용 정밀 키워드 분석 솔루션. 네이버·구글 검색 트렌드 분석과 AI 듀얼 엔진 포스팅으로 최적의 마케팅 전략을 제공합니다.",
    url: "https://tmgad.com",
    siteName: "Ranking Pro",
    locale: "ko_KR",
    type: "website",
  },
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
        {/* 🌟 2. AuthProvider로 웹사이트 전체 화면(Header, 콘텐츠, Footer 등)을 싹 감싸줍니다. */}
        <AuthProvider>
          
          {/* 👇 🌟 여기에 모바일 수문장을 세웠습니다! (모든 페이지에서 작동합니다) */}
          <MobileBlocker />
          
          {/* 상단 네비게이션 바 */}
          <Header />
          
          {/* 우측 슬라이딩 메모장 (모든 페이지에서 따라다님) */}
          <MemoSidebar />
          
          {/* 메인 콘텐츠 영역 */}
          <div className="pt-16 flex-1 bg-gray-50 text-slate-800">
            {children}
          </div>

          {/* 푸터 영역 (모든 페이지 하단에 공통 적용) */}
          <div className="ml-[255px]">
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}