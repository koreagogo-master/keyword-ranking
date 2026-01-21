import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// 👇 1. 헤더 부품 불러오기
import Header from "@/app/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Keyword Ranking Tools",
  description: "Keyword Ranking Analysis Tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* 👇 2. 헤더를 본문 위에 고정 장착 */}
        <Header />
        
        {/* 👇 3. 헤더 높이(16)만큼 내용을 아래로 밀어주고, 배경색(다크모드)을 깔아줍니다 */}
        <div className="pt-16 min-h-screen bg-gray-900 text-white">
          {children}
        </div>
      </body>
    </html>
  );
}