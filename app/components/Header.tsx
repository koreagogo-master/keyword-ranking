'use client';

import Link from "next/link";
import { createClient } from "@/app/utils/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  // 로그인 정보와 프로필(등급) 가져오기
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(data);
      }
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    alert("로그아웃 되었습니다.");
    window.location.href = "/"; // 메인으로 새로고침 이동
  };

  return (
    <header className="w-full h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6 fixed top-0 left-0 z-50 shadow-md">
      {/* 1. 로고 (클릭 시 메인으로) */}
      <Link href="/" className="text-xl font-bold text-blue-400 hover:text-blue-300">
        TMG Tools
      </Link>

      {/* 2. 우측 메뉴 (로그인 상태에 따라 다름) */}
      <div className="flex items-center gap-4 text-sm">
        {user ? (
          <>
            {/* 내 정보 표시 */}
            <div className="text-right hidden sm:block mr-2">
              <p className="text-gray-200 font-bold">{user.email}</p>
              <p className="text-xs text-gray-400">
                등급: <span className="text-yellow-400">{profile?.grade?.toUpperCase() || 'LOADING...'}</span>
              </p>
            </div>

            {/* 관리자 vs 일반유저 분기 버튼 */}
            {profile?.role === 'admin' ? (
              <Link href="/admin" className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded transition">
                관리자 페이지
              </Link>
            ) : (
              <Link href="/mypage" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded transition">
                마이페이지
              </Link>
            )}

            {/* 로그아웃 버튼 */}
            <button onClick={handleLogout} className="text-gray-400 hover:text-white underline">
              로그아웃
            </button>
          </>
        ) : (
          /* 로그인 안 했을 때 */
          <Link href="/" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}