// keyword-ranking\components\Header.tsx
'use client';

import Link from "next/link";
import { createClient } from "@/app/utils/supabase/client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation"; 
import { Montserrat } from 'next/font/google';

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
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true); 
  
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname(); 
  const [noticeIndex, setNoticeIndex] = useState(0);

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
      
      console.log("현재 로그인된 유저의 DB 프로필 정보:", data);
      
      setProfile(data || null);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) return;
      console.error("Header 프로필 로드 실패:", err);
    }
  };

  useEffect(() => {
    const initUser = async () => {
      setIsLoading(true);
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          if (error.name === 'AbortError' || error.message?.includes('aborted')) return;
          throw error;
        }
        await fetchUserData(user);
      } catch (err: any) {
      } finally {
        setIsLoading(false);
      }
    };
    initUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsLoading(true);
      try {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await fetchUserData(session?.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      } finally {
        setIsLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNoticeIndex((prev) => (prev + 1) % NOTICES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
        window.sessionStorage.clear();
      }

      alert("로그아웃 되었습니다.");
      window.location.replace("/"); 
    } catch (err) {
      console.error("로그아웃 실행 중 오류:", err);
      window.location.replace("/");
    }
  };

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
        {pathname === '/' && (
          isLoading ? (
            <div className="w-20 h-9"></div> 
          ) : user ? (
            <>
              {profile?.role?.toLowerCase() === 'admin' && (
                <Link href="/admin" className="flex items-center justify-center bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-xl text-[13px] font-bold transition shadow-sm">
                  관리자
                </Link>
              )}
              
              {/* My page 버튼 */}
              <Link href="/mypage" className="flex items-center justify-center bg-white border border-gray-200 hover:border-[#ff8533] hover:text-[#ff8533] text-gray-600 px-4 py-2 rounded-xl text-[13px] font-bold transition shadow-sm">
                My page
              </Link>
              
              {/* Log out 버튼 (span 보호막 추가 및 디자인 완벽 통일) */}
              <button 
                onClick={handleLogout}
                className="flex items-center justify-center bg-white border border-gray-200 hover:border-[#ff8533] transition shadow-sm rounded-xl px-4 py-2 group"
              >
                <span className="text-gray-600 group-hover:text-[#ff8533] text-[13px] font-bold transition-colors">
                  Log out
                </span>
              </button>
            </>
          ) : (
            <Link href="/login" className="flex items-center justify-center bg-[#ff8533] hover:bg-[#e6772e] text-white px-6 py-2 rounded-xl font-bold transition shadow-md shadow-orange-100">
              로그인
            </Link>
          )
        )}
      </div>
    </header>
  );
}