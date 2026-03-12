// components/Header.tsx
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
  
  const [clientIp, setClientIp] = useState<string | null>(null);
  
  const { user, profile, isLoading, handleLogout } = useAuth();

  useEffect(() => {
    const timer = setInterval(() => {
      setNoticeIndex((prev) => (prev + 1) % NOTICES.length);
    }, 4000);

    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setClientIp(data.ip))
      .catch(() => setClientIp('확인 불가'));

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="w-full h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 fixed top-0 left-0 z-[9999] shadow-sm">
      
      <div className="flex items-center gap-6 z-10">
        <Link href="/" className={`flex items-center gap-2 group ${montserrat.className}`}>
          <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-sm group-hover:bg-indigo-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span className="text-gray-900 text-2xl font-black tracking-tight group-hover:text-indigo-600 transition-colors">
            Ranking<span className="text-indigo-600 ml-0.5">Pro</span>
          </span>
        </Link>
      </div>

      <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 justify-center items-center h-full w-full max-w-xl pointer-events-none">
        <div className="bg-indigo-50 border border-indigo-100 text-indigo-600 text-[13px] font-bold px-5 py-1.5 rounded-full flex items-center gap-2 shadow-sm transition-all duration-500 ease-in-out pointer-events-auto">
          <span className="animate-fade-in-up">
            {NOTICES[noticeIndex]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm font-medium z-10">
        
        {/* 🌟 핵심 변경: 현재 페이지(pathname)가 메인('/')일 때만 IP 뱃지를 보여주도록 조건(pathname === '/')을 걸었습니다. */}
        {pathname === '/' && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg mr-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-bold text-gray-500 tracking-wider">
              IP: <span className="text-gray-700">{clientIp || '로딩중...'}</span>
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="w-20 h-9"></div> 
        ) : user ? (
          <>
            {profile?.role?.toLowerCase() === 'admin' && (
              <Link href="/admin" className="flex items-center justify-center bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-xl text-[13px] font-bold transition shadow-sm">
                관리자
              </Link>
            )}
            
            {pathname === '/' && (
              <>
                <Link href="/mypage" className="flex items-center justify-center bg-white border border-gray-200 hover:border-indigo-600 hover:text-indigo-600 text-gray-600 px-4 py-2 rounded-xl text-[13px] font-bold transition shadow-sm">
                  My page
                </Link>
                
                <button 
                  onClick={handleLogout}
                  className="flex items-center justify-center bg-white border border-gray-200 hover:border-indigo-600 transition shadow-sm rounded-xl px-4 py-2 group"
                >
                  <span className="text-gray-600 group-hover:text-indigo-600 text-[13px] font-bold transition-colors">
                    Log out
                  </span>
                </button>
              </>
            )}
          </>
        ) : (
          pathname === '/' && (
            <Link href="/login" className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition shadow-md shadow-indigo-100">
              로그인
            </Link>
          )
        )}
      </div>
    </header>
  );
}