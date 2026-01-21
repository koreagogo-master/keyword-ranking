'use client';

import Link from "next/link";
import { createClient } from "@/app/utils/supabase/client";
import { useEffect, useState } from "react";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // 이메일 로그인용 state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false); // 회원가입 모드인지 여부

  const supabase = createClient();

  // 1. 초기 로그인 확인
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (e) {
        // 에러 무시
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  // 2. 이메일 로그인 처리 함수
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // 새로고침 방지
    
    if (!email || !password) {
      alert("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    try {
      if (isSignUp) {
        // [회원가입]
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert("회원가입 성공! (이메일 확인이 필요할 수 있습니다)\n이제 로그인해주세요.");
        setIsSignUp(false); // 로그인 모드로 전환
      } else {
        // [로그인]
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        setUser(data.user);
        alert("로그인 되었습니다!");
        // 로그인 성공 시 페이지 새로고침하여 상태 확실히 반영
        window.location.reload(); 
      }
    } catch (error: any) {
      alert(isSignUp ? "가입 실패: " + error.message : "로그인 실패: " + error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    alert("로그아웃 되었습니다!");
    window.location.reload();
  };

  if (loading) return <div className="min-h-screen bg-gray-900" />;

  return (
    <main className="min-h-screen relative bg-gray-900 text-white overflow-hidden">
      
      {/* 메인 콘텐츠 (비로그인 시 흐림 처리) */}
      <div className={`
          flex flex-col items-center justify-center min-h-screen p-6 transition-all duration-500
          ${!user ? 'blur-md opacity-40 pointer-events-none select-none' : 'blur-0 opacity-100'}
        `}
      >
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl border border-gray-700 shadow-lg">
          <h1 className="text-3xl font-bold mb-10 text-center text-blue-400">
            Keyword Ranking Tools
          </h1>
          
          {user && (
             <div className="mb-6 text-center">
                <p className="text-gray-300 mb-2">{user.email}님 환영합니다!</p>
                <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300 underline">
                  로그아웃
                </button>
             </div>
          )}

          <div className="flex flex-col gap-4">
            <Link href="/blog-rank" className="block w-full text-center py-4 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 transition-all text-white shadow-md">
              통합 Rank (Type A)
            </Link>
            <Link href="/blog-rank-b" className="block w-full text-center py-4 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 transition-all text-white shadow-md">
              블로그 Rank (Type B)
            </Link>
            <Link href="/kin-rank" className="block w-full text-center py-4 rounded-lg font-bold bg-purple-600 hover:bg-purple-500 transition-all text-white shadow-md">
              지식인 Rank (Type C)
            </Link>
          </div>
        </div>
      </div>

      {/* 로그인 팝업 (비로그인 시 등장) */}
      {!user && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-500">
          <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-600 w-full max-w-sm">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              {isSignUp ? "회원가입" : "로그인"}
            </h2>
            
            <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
              <input 
                type="email" 
                placeholder="이메일 주소" 
                className="p-3 rounded bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input 
                type="password" 
                placeholder="비밀번호" 
                className="p-3 rounded bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              
              <button 
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-500 transition-colors shadow-lg mt-2"
              >
                {isSignUp ? "가입하기" : "로그인하기"}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-gray-400 hover:text-white underline"
              >
                {isSignUp ? "이미 계정이 있으신가요? 로그인" : "계정이 없으신가요? 회원가입"}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}