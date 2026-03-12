import type { Metadata } from "next"; 
import localFont from "next/font/local"; 
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

export const metadata: Metadata = {
  title: "Ranking Pro - 마케팅 키워드 분석의 정밀 솔루션", 
  description: "Naver API와 Google API를 기반으로 한 정밀 데이터 분석과 시각화 솔루션인 Ranking Pro로 마케팅 키워드 전략을 혁신하세요. 실시간 트렌드 분석, 경쟁사 비교, 키워드 성과 추적 등 다양한 기능을 제공합니다.",
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