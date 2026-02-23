import type { Metadata } from "next"; 
import localFont from "next/font/local"; 
import "./globals.css";
import Header from "@/components/Header"; 
import MemoSidebar from "@/components/MemoSidebar"; 
import Footer from "@/components/Footer"; 
// 🌟 1. 방금 1단계에서 만든 중앙 통제실(AuthProvider)을 불러옵니다.
import { AuthProvider } from "@/app/contexts/AuthContext";

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
        {/* 🌟 2. AuthProvider로 웹사이트 전체 화면(Header, 콘텐츠, Footer 등)을 싹 감싸줍니다. */}
        <AuthProvider>
          {/* 상단 네비게이션 바 */}
          <Header />
          
          {/* 우측 슬라이딩 메모장 (모든 페이지에서 따라다님) */}
          <MemoSidebar />
          
          {/* 메인 콘텐츠 영역 */}
          <div className="pt-16 min-h-screen bg-gray-900 text-white">
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