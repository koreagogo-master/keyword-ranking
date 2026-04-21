'use client';

import { useState } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // 비밀번호 찾기 모드 상태
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // 기존 로그인 핸들러
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert("로그인 실패: " + error.message);
      } else {
        router.push("/"); 
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        return;
      }
      console.error(err);
      alert("알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 비밀번호 재설정 이메일 발송 핸들러
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      alert("가입하신 이메일을 입력해주세요.");
      return;
    }
    setResetLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`, // 이메일 링크 클릭 시 돌아올 주소
      });

      if (error) {
        alert("이메일 전송 실패: " + error.message);
      } else {
        alert("비밀번호 재설정 링크가 이메일로 발송되었습니다. 메일함을 확인해주세요.");
        setIsResetMode(false); // 전송 성공 후 다시 로그인 모드로 전환
      }
    } catch (err) {
      console.error(err);
      alert("알 수 없는 오류가 발생했습니다.");
    } finally {
      setResetLoading(false);
    }
  };

  // 구글 OAuth 로그인 핸들러
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-10 rounded-[32px] shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-black text-indigo-600 cursor-pointer">Ranking Pro</Link>
          <p className="text-gray-400 mt-2 font-medium">
            {isResetMode ? "비밀번호 재설정" : "서비스 이용을 위해 로그인해주세요."}
          </p>
        </div>

        {!isResetMode ? (
          /* 🌟 로그인 폼 */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">이메일</label>
              <input 
                type="email" 
                className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 outline-none focus:border-indigo-500 transition-all text-gray-900"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              {/* 🌟 사용자 요청: 라벨과 버튼을 한 줄에 배치하고 색상 변경 */}
              <div className="flex justify-between items-end mb-1 ml-1 mr-1">
                <label className="block text-sm font-bold text-gray-700">비밀번호</label>
                {/* 🌟 사용자 요청: '비밀번호' 라벨과 동일한 어두운 색상(text-gray-700)으로 변경 및 cursor-pointer 추가 */}
                <button 
                  type="button" 
                  onClick={() => setIsResetMode(true)}
                  className="text-xs font-bold !text-gray-700 hover:text-indigo-700 transition-colors cursor-pointer"
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>
              <input 
                type="password" 
                className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 outline-none focus:border-indigo-500 transition-all text-gray-900"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {/* 🌟 cursor-pointer 추가 */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 disabled:bg-gray-300 mt-2 cursor-pointer"
            >
              {loading ? "로그인 중..." : "로그인하기"}
            </button>

            {/* ── 구분선 ── */}
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-xs text-gray-400 font-medium whitespace-nowrap">또는 간편 로그인</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            {/* ── 구글 로그인 버튼 ── */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white !text-gray-700 py-4 rounded-2xl font-bold border border-gray-200 hover:bg-gray-50 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              {/* 구글 G 로고 SVG */}
              <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              Google로 계속하기
            </button>

            {/* ── 네이버 로그인 버튼 ── */}
            <button
              type="button"
              onClick={() => { window.location.href = '/api/auth/naver'; }}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold transition-all active:scale-95 cursor-pointer shadow-sm !text-white"
              style={{ backgroundColor: '#03C75A' }}
            >
              {/* 네이버 N 로고 SVG */}
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white">
                <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/>
              </svg>
              네이버로 시작하기
            </button>
          </form>
        ) : (
          /* 🌟 비밀번호 찾기 폼 */
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">가입한 이메일</label>
              <input 
                type="email" 
                className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 outline-none focus:border-indigo-500 transition-all text-gray-900"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-xs text-gray-400 mt-2 ml-2 leading-relaxed">
                입력하신 이메일로 비밀번호 재설정 링크를 보내드립니다.
              </p>
            </div>
            <div className="space-y-3 pt-2">
              {/* 🌟 cursor-pointer 추가 */}
              <button 
                type="submit" 
                disabled={resetLoading}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 disabled:bg-gray-300 cursor-pointer"
              >
                {resetLoading ? "전송 중..." : "재설정 링크 받기"}
              </button>
              {/* 🌟 cursor-pointer 추가 */}
              <button 
                type="button" 
                onClick={() => setIsResetMode(false)}
                className="w-full bg-white !text-gray-500 border border-gray-200 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all active:scale-95 cursor-pointer"
              >
                로그인으로 돌아가기
              </button>
            </div>
          </form>
        )}

        {!isResetMode && (
          <div className="mt-8 text-center text-sm">
            <span className="text-gray-400">계정이 없으신가요? </span>
            <Link href="/signup" className="text-indigo-600 font-bold hover:underline cursor-pointer">회원가입</Link>
          </div>
        )}
      </div>
    </div>
  );
}