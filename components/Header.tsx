// keyword-ranking/components/Header.tsx
'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation"; 
import { Montserrat } from 'next/font/google';
import { useAuth } from "@/app/contexts/AuthContext";

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
});

const NOTICES = [
  "📢 [공지1] 사이트 오픈!! 시스템 최적화 및 신규 기능 업데이트 안내",
  "🎉 [공지2] 회원 가입을 하시면 보다 많은 기능을 사용 하실 수 있습니다.",
];

export default function Header() {
  const pathname = usePathname(); 
  const [noticeIndex, setNoticeIndex] = useState(0);
  
  // 중앙 통제실에서 정보 가져오기
  const { user, profile, isLoading, handleLogout } = useAuth();

  useEffect(() => {
    const timer = setInterval(() => {
      setNoticeIndex((prev) => (prev + 1) % NOTICES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="w-full h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 fixed top-0 left-0 z-[9999] shadow-sm">
      
      <div className="flex items-center gap-6 z-10">
        <Link href="/" className={`flex items-center ${montserrat.className}`}>
          <span style={{ color: '#ff8533' }} className="text-3xl font-[700] tracking-tight">TMG</span>
          <span style={{ color: '#111827' }} className="text-xl font-normal italic ml-1">ad</span>
          <span className="mx-3 text-gray-200 font-light">|</span>
          <span style={{ color: '#1a73e8' }} className="text-2xl font-bold tracking-tight">Ranking Pro</span>
        </Link>
      </div>

      <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 justify-center items-center h-full w-full max-w-xl pointer-events-none">
        <div className="bg-orange-50/30 border border-orange-100 text-[#ff8533] text-[13px] font-bold px-5 py-1.5 rounded-full flex items-center gap-2 shadow-sm transition-all duration-500 ease-in-out pointer-events-auto">
          <span className="animate-fade-in-up">
            {NOTICES[noticeIndex]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm font-medium z-10">
        {isLoading ? (
          <div className="w-20 h-9"></div> 
        ) : user ? (
          <>
            {/* 🌟 1. 관리자 버튼: 조건 없이, 관리자 등급이면 무조건 상단에 노출 */}
            {profile?.role?.toLowerCase() === 'admin' && (
              <Link href="/admin" className="flex items-center justify-center bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-xl text-[13px] font-bold transition shadow-sm">
                관리자
              </Link>
            )}
            
            {/* 🌟 2. My page & Log out 버튼: 메인 페이지('/')에서만 노출 */}
            {pathname === '/' && (
              <>
                <Link href="/mypage" className="flex items-center justify-center bg-white border border-gray-200 hover:border-[#ff8533] hover:text-[#ff8533] text-gray-600 px-4 py-2 rounded-xl text-[13px] font-bold transition shadow-sm">
                  My page
                </Link>
                
                <button 
                  onClick={handleLogout}
                  className="flex items-center justify-center bg-white border border-gray-200 hover:border-[#ff8533] transition shadow-sm rounded-xl px-4 py-2 group"
                >
                  <span className="text-gray-600 group-hover:text-[#ff8533] text-[13px] font-bold transition-colors">
                    Log out
                  </span>
                </button>
              </>
            )}
          </>
        ) : (
          /* 비로그인 상태의 로그인 버튼도 메인 페이지에서만 노출 */
          pathname === '/' && (
            <Link href="/login" className="flex items-center justify-center bg-[#ff8533] hover:bg-[#e6772e] text-white px-6 py-2 rounded-xl font-bold transition shadow-md shadow-orange-100">
              로그인
            </Link>
          )
        )}
      </div>
    </header>
  );
}