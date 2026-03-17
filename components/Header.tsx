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
  "[공지1] 사이트 오픈!! 시스템 최적화 및 신규 기능 업데이트 안내",
  "[공지2] 회원 가입을 하시면 보다 많은 기능을 사용 하실 수 있습니다.",
];

export default function Header() {
  const pathname = usePathname(); 
  const [noticeIndex, setNoticeIndex] = useState(0);
  
  const { user, profile, isLoading, handleLogout } = useAuth();

  useEffect(() => {
    const timer = setInterval(() => {
      setNoticeIndex((prev) => (prev + 1) % NOTICES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="w-full h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 fixed top-0 left-0 z-[9999] shadow-sm">
      
      {/* 1. 로고 영역 */}
      <div className="flex items-center gap-6 z-10">
        <Link href="/" className={`flex items-center gap-2 group ${montserrat.className}`}>
          <div className="bg-[#5244e8] text-white p-1.5 rounded-lg shadow-sm group-hover:bg-[#4336c9] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span className="text-gray-900 text-2xl font-black tracking-tight group-hover:text-[#5244e8] transition-colors">
            Ranking<span className="text-[#5244e8] ml-0.5">Pro</span>
          </span>
        </Link>
      </div>

      {/* 2. 공지사항 영역 */}
      <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 justify-center items-center h-full w-full max-w-xl pointer-events-none">
        <div className="bg-indigo-50 border border-indigo-100 text-indigo-600 text-[13px] font-bold px-5 py-1.5 rounded-full flex items-center gap-2 shadow-sm transition-all duration-500 ease-in-out pointer-events-auto">
          <span className="animate-fade-in-up">
            {NOTICES[noticeIndex]}
          </span>
        </div>
      </div>

      {/* 3. 우측 컨트롤 영역 */}
      <div className="flex items-center gap-2.5 text-sm font-medium z-10">
        
        {isLoading ? (
          <div className="w-20 h-9"></div> 
        ) : user ? (
          <>
            {profile?.role?.toLowerCase() === 'admin' && (
              <Link href="/admin" className="flex items-center justify-center bg-gray-800 hover:bg-black text-white px-3 h-9 rounded-lg text-[12px] font-bold transition shadow-sm">
                관리자
              </Link>
            )}

            <div className="flex items-center px-3 h-9 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="text-[11px] font-bold text-gray-500 tracking-wider mr-1.5">Point:</span>
              <span className="text-[13px] font-medium text-gray-700">
                {((profile?.bonus_points || 0) + (profile?.purchased_points || 0)).toLocaleString()}
              </span>
            </div>
            
            <div className="flex items-center gap-2 ml-1.5 pl-3 border-l border-gray-200">
              
              {/* My page 버튼 */}
              <Link href="/mypage" className="flex items-center justify-center px-3 h-9 border border-gray-200 bg-white hover:bg-gray-50 hover:text-[#5244e8] hover:border-[#5244e8]/30 text-gray-600 rounded-lg text-[12px] font-bold transition-all shadow-sm">
                My page
              </Link>

              {/* 🌟 Log out 버튼: 텍스트 증발을 막기 위해 span 태그로 보호막 생성! */}
              <button onClick={handleLogout} className="group flex items-center justify-center px-3 h-9 border border-gray-200 bg-white hover:bg-red-50 hover:border-red-200 rounded-lg transition-all shadow-sm">
                <span className="text-gray-600 text-[12px] font-bold group-hover:text-red-500">
                  Log out
                </span>
              </button>

            </div>
          </>
        ) : (
          <Link href="/login" className="flex items-center justify-center h-9 bg-[#5244e8] hover:bg-[#4336c9] text-white px-5 rounded-lg text-[13px] font-bold transition shadow-sm">
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}