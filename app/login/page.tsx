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