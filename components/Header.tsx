'use client';

import Link from "next/link";
import { createClient } from "@/app/utils/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const fetchUserData = async (currentUser: any) => {
    try {
      if (!currentUser) {
        setUser(null);
        setProfile(null);
        return;
      }
      setUser(currentUser);
      const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
      
      // PGRST116은 데이터가 없을 때의 정상이므로 에러 처리에서 제외합니다.
      if (error && error.code !== 'PGRST116' && error.name !== 'AbortError') {
        console.warn("프로필 조회 중 알림:", error.message);
      }
      setProfile(data || null);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Header 프로필 로드 실패:", err);
      }
    }
  };

  useEffect(() => {
    const initUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error && error.name !== 'AbortError') throw error;
        await fetchUserData(user);
      } catch (err: any) {
        // AbortError는 무시하여 빨간 화면을 방지합니다.
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
      } catch (err) {
        // 상태 변경 시 발생하는 일시적 에러 방어
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      alert("로그아웃 되었습니다.");
      window.location.href = "/";
    } catch (err) {
      window.location.href = "/";
    }
  };

  // ... (이하 return 부분은 기존과 동일하므로 생략하지만 실제 파일엔 그대로 두시면 됩니다) ...
  return (
    <>
      <header className="w-full h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 fixed top-0 left-0 z-[9999] shadow-sm">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-2xl font-black text-[#ff8533] tracking-tighter italic">TMG AD</Link>
          {user && (
            <button onClick={() => setIsModalOpen(true)} className="text-xs font-bold bg-orange-50 text-[#ff8533] px-3 py-1.5 rounded-full border border-orange-100 hover:bg-orange-100 transition-all">
              [기존 메뉴 A,B,C]
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
              <button onClick={handleLogout} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-xl transition shadow-sm font-bold ml-2">로그아웃</button>
            </>
          ) : (
            <Link href="/login" className="bg-[#ff8533] hover:bg-[#e6772e] text-white px-6 py-2 rounded-xl font-bold transition shadow-md shadow-orange-100">로그인</Link>
          )}
        </div>
      </header>

      {/* 모달 부분 생략 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm px-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white p-8 rounded-[32px] shadow-2xl border border-gray-100 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-900">기존 도구 (Legacy)</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="grid gap-3">
              <Link href="/blog-rank" target="_blank" className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-orange-50 hover:text-[#ff8533] transition-all font-bold group"><span>통합 분석 (Type A)</span></Link>
              <Link href="/blog-rank-b" target="_blank" className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-orange-50 hover:text-[#ff8533] transition-all font-bold group"><span>블로그 순위 (Type B)</span></Link>
              <Link href="/kin-rank" target="_blank" className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-orange-50 hover:text-[#ff8533] transition-all font-bold group"><span>지식인 순위 (Type C)</span></Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}