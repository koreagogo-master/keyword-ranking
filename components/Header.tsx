'use client';

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Montserrat } from 'next/font/google';
import { useAuth } from "@/app/contexts/AuthContext";
import { createClient } from "@/app/utils/supabase/client";

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
});

interface NoticeHeader {
  id: string;
  title: string;
}

export default function Header() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const { user, profile, isLoading, handleLogout, refreshProfile } = useAuth();

  const [dynamicNotices, setDynamicNotices] = useState<NoticeHeader[]>([]);
  const [noticeIndex, setNoticeIndex] = useState(0);
  const [isLoadingNotices, setIsLoadingNotices] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshPoints = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await refreshProfile();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    const fetchPinnedNotices = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('notices')
        .select('id, title')
        .eq('is_pinned', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setDynamicNotices(data);
      }
      setIsLoadingNotices(false);
    };

    fetchPinnedNotices();
  }, []);

  useEffect(() => {
    if (isLoadingNotices || dynamicNotices.length === 0) return;

    const timer = setInterval(() => {
      setNoticeIndex((prev) => (prev + 1) % dynamicNotices.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isLoadingNotices, dynamicNotices.length]);

  return (
    <header className="w-full h-16 bg-white border-b border-gray-100 fixed top-0 left-0 z-[9999] shadow-sm">
      <div
        className={`relative w-full h-full px-6 flex items-center justify-between ${
          isHomePage ? "max-w-[1400px] mx-auto" : ""
        }`}
      >

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

        <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 justify-center items-center h-full w-full max-w-xl pointer-events-none">
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-600 text-[13px] font-bold px-5 py-1.5 rounded-full flex items-center gap-2 shadow-sm transition-all duration-500 ease-in-out pointer-events-auto">
            {isLoadingNotices ? (
              <span className="text-gray-400">정보 불러오는 중...</span>
            ) : dynamicNotices.length === 0 ? (
              <span className="text-gray-400">등록된 중요 공지가 없습니다.</span>
            ) : (
              <Link href={`/notice?id=${dynamicNotices[noticeIndex].id}`} className="hover:text-[#5244e8] transition-colors">
                <span className="animate-fade-in-up">
                  {dynamicNotices[noticeIndex].title}
                </span>
              </Link>
            )}
          </div>
        </div>

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

              <div className="flex items-center gap-1.5">
                <div className="flex items-center px-3 h-9 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="text-[11px] font-bold text-gray-500 tracking-wider mr-1.5">Point:</span>
                  <span className="text-[13px] font-medium text-gray-700">
                    {((profile?.bonus_points || 0) + (profile?.purchased_points || 0)).toLocaleString()}
                  </span>
                </div>
                <button onClick={handleRefreshPoints} disabled={isRefreshing} className="w-[36px] h-9 flex shrink-0 items-center justify-center bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors shadow-sm">
                  <svg className={`w-[14px] h-[14px] ${!isRefreshing ? 'text-[#5244e8]' : 'animate-spin text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2 ml-1.5 pl-3 border-l border-gray-200">

                <Link href="/mypage" className="flex items-center justify-center px-3 h-9 border border-gray-200 bg-white hover:bg-gray-50 hover:text-[#5244e8] hover:border-[#5244e8]/30 text-gray-600 rounded-lg text-[12px] font-bold transition-all shadow-sm">
                  My page
                </Link>

                <button onClick={handleLogout} className="group flex items-center justify-center px-3 h-9 border border-gray-200 bg-white hover:bg-red-50 hover:border-red-200 rounded-lg transition-all shadow-sm">
                  <span className="text-gray-600 text-[12px] font-bold group-hover:text-red-500">
                    Log out
                  </span>
                </button>

              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/signup" className="flex items-center justify-center h-9 border border-[#5244e8] bg-white hover:bg-indigo-50 text-[#5244e8] px-4 rounded-lg text-[13px] font-bold transition shadow-sm">
                무료 시작
              </Link>
              <Link href="/login" className="flex items-center justify-center h-9 bg-[#5244e8] hover:bg-[#4336c9] text-white px-5 rounded-lg text-[13px] font-bold transition shadow-sm">
                로그인
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}