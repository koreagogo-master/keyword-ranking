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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  // 사용자 프로필 데이터를 가져오는 함수 (통신 중단 방어 로직 포함)
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
        // [방어] 통신 중단(Abort) 에러는 무시하여 UI 멈춤 방지
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
        // 초기 로드 시 발생하는 비정상 중단은 조용히 처리
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

  // [강화된 로그아웃 로직] 
  const handleLogout = async () => {
    try {
      // 1. Supabase 세션 종료
      await supabase.auth.signOut();
      
      // 2. 브라우저 로컬 저장소 강제 초기화 (세션 꼬임 원천 차단)
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
        window.sessionStorage.clear();
      }

      alert("로그아웃 되었습니다.");
      
      // 3. 단순 이동이 아닌 '페이지 리셋'을 통해 모든 컴포넌트 강제 재시작
      window.location.replace("/"); 
    } catch (err) {
      console.error("로그아웃 실행 중 오류:", err);
      window.location.replace("/");
    }
  };

  return (
    <>
      <header className="w-full h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 fixed top-0 left-0 z-[9999] shadow-sm">
        <div className="flex items-center gap-6">
          <Link href="/" className={`flex items-center ${montserrat.className}`}>
            <span style={{ color: '#ff8533' }} className="text-3xl font-[700] tracking-tight">TMG</span>
            <span style={{ color: '#111827' }} className="text-xl font-normal italic ml-1">ad</span>
            <span className="mx-3 text-gray-200 font-light">|</span>
            <span style={{ color: '#1a73e8' }} className="text-2xl font-bold tracking-tight">Ranking Pro</span>
          </Link>
          
          {user && (
            <button onClick={() => setIsModalOpen(true)} className="text-xs font-bold bg-orange-50 text-[#ff8533] px-3 py-1.5 rounded-full border border-orange-100 hover:bg-orange-100 transition-all">
              도구 모음
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm font-medium">
          {user ? (
            <>
              <div className="text-right hidden sm:block mr-2">
                <p className="text-gray-900 font-bold leading-none">{user.email?.split('@')[0]}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">
                  GRADE: <span className="text-[#ff8533]">{profile?.grade?.toUpperCase() || 'STANDARD'}</span>
                </p>
              </div>
              {profile?.role?.toLowerCase() === 'admin' ? (
                <Link href="/admin" className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-xl transition shadow-sm">관리자</Link>
              ) : (
                <Link href="/mypage" className="bg-[#ff8533] hover:bg-[#e6772e] text-white px-4 py-2 rounded-xl transition shadow-md shadow-orange-100">마이페이지</Link>
              )}
              {/* 로그아웃 버튼 */}
              <button 
                onClick={handleLogout} 
                className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-xl transition shadow-sm font-bold ml-2"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link href="/login" className="bg-[#ff8533] hover:bg-[#e6772e] text-white px-6 py-2 rounded-xl font-bold transition shadow-md shadow-orange-100">로그인</Link>
          )}
        </div>
      </header>

      {/* 메뉴 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20 backdrop-blur-sm px-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white p-8 rounded-[32px] shadow-2xl border border-gray-100 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-900">분석 도구</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="grid gap-3">
              <Link href="/blog-rank" target="_blank" className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-orange-50 hover:text-[#ff8533] transition-all font-bold"><span>통합 분석</span></Link>
              <Link href="/blog-rank-b" target="_blank" className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-orange-50 hover:text-[#ff8533] transition-all font-bold"><span>블로그 순위</span></Link>
              <Link href="/kin-rank" target="_blank" className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-orange-50 hover:text-[#ff8533] transition-all font-bold"><span>지식인 순위</span></Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}