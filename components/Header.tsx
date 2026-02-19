// keyword-ranking\components\Header.tsx
'use client';

import Link from "next/link";
import { createClient } from "@/app/utils/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
});

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  // 사용자 프로필 데이터를 가져오는 함수
  const fetchUserData = async (currentUser: any) => {
    try {
      if (!currentUser) {
        setUser(null);
        setProfile(null);
        return;
      }
      setUser(currentUser);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      if (error) {
        if (error.name === 'AbortError' || error.message?.includes('aborted')) return;
        if (error.code !== 'PGRST116') {
          console.warn("프로필 조회 알림:", error.message);
        }
      }
      setProfile(data || null);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) return;
      console.error("Header 프로필 로드 실패:", err);
    }
  };

  useEffect(() => {
    const initUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          if (error.name === 'AbortError' || error.message?.includes('aborted')) return;
          throw error;
        }
        await fetchUserData(user);
      } catch (err: any) {
        // 초기 로드 에러 무시
      }
    };
    initUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await fetchUserData(session?.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <>
      <header className="w-full h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 fixed top-0 left-0 z-[9999] shadow-sm">
        
        {/* 1. 좌측: 로고 및 도구 모음 */}
        <div className="flex items-center gap-6 min-w-[200px]">
          <Link href="/" className={`flex items-center ${montserrat.className}`}>
            <span style={{ color: '#ff8533' }} className="text-3xl font-[700] tracking-tight">TMG</span>
            <span style={{ color: '#111827' }} className="text-xl font-normal italic ml-1">ad</span>
            <span className="mx-3 text-gray-200 font-light">|</span>
            <span style={{ color: '#1a73e8' }} className="text-2xl font-bold tracking-tight">Ranking Pro</span>
          </Link>
        </div>

        {/* 2. 중앙: 공지사항 (새로 추가됨) */}
        <div className="hidden md:flex flex-1 justify-center items-center px-4">
          <div className="bg-orange-50/30 border border-orange-100 text-[#ff8533] text-[13px] font-bold px-5 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
            <span className="text-base">📢</span>
            <span>[공지] 사이트 오픈!! 시스템 최적화 및 신규 기능 업데이트 안내</span>
          </div>
        </div>

        {/* 3. 우측: 로그인/관리자 버튼 (일반 사용자는 비움) */}
        <div className="flex items-center gap-4 text-sm font-medium min-w-[200px] justify-end">
          {user ? (
            // 로그인 상태일 때: 관리자면 '관리자' 버튼, 아니면 빈칸
            profile?.role?.toLowerCase() === 'admin' && (
              <Link href="/admin" className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-xl transition shadow-sm">관리자</Link>
            )
          ) : (
            // 비로그인 상태일 때: 로그인 버튼
            <Link href="/login" className="bg-[#ff8533] hover:bg-[#e6772e] text-white px-6 py-2 rounded-xl font-bold transition shadow-md shadow-orange-100">로그인</Link>
          )}
        </div>
      </header>
    </>
  );
}