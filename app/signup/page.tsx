'use client';

import { useState } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // 구글 OAuth — /login 페이지와 동일한 방식
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
  };

  // 기존 이메일 회원가입 로직 (변경 없음)
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        alert("회원가입 실패: " + error.message);
      } else {
        try {
          await fetch('/api/notify-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newUserEmail: email }),
          });
        } catch (mailErr) {
          console.error('관리자 알림 메일 발송 실패:', mailErr);
        }

        setIsSent(true);
      }
    } catch (err) {
      console.error(err);
      alert("알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 이메일 인증 발송 완료 화면 (기존 유지)
  if (isSent) {
    return (
      <div className="min-h-[calc(100vh-160px)] flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white p-10 rounded-[32px] shadow-xl border border-gray-100 text-center">
          <div className="mb-6 inline-flex items-center justify-center w-20 h-20 bg-indigo-50 rounded-full text-indigo-500">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-4">이메일을 확인해주세요!</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            <span className="font-bold text-indigo-600">{email}</span> 주소로 인증 링크를 보냈습니다.<br />
            메일함의 링크를 클릭하시면 가입이 완료됩니다.
          </p>
          <Link href="/login" className="inline-block w-3/5 text-center bg-gray-800 text-white px-8 py-4 rounded-2xl font-black hover:bg-gray-900 transition-all shadow-lg">
            로그인 화면으로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center bg-gray-50 px-4 pt-10">
      <div className="max-w-md w-full bg-white p-10 rounded-[32px] shadow-xl border border-gray-100">

        {/* 헤더 */}
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-black text-indigo-600 cursor-pointer">Ranking Pro</Link>
          <h2 className="text-xl font-bold text-gray-900 mt-4">무료로 시작하기</h2>
          <p className="text-gray-400 mt-2 font-medium text-sm leading-relaxed">
            네이버·구글 아이디로 간편하게 시작하거나<br />이메일로 계정을 만들 수 있습니다.
          </p>
        </div>

        <div className="space-y-6">

          {/* ── 1. 소셜 간편 시작 버튼 ── */}
          <div className="space-y-3">
            {/* 네이버 버튼 — /login과 동일한 방식 */}
            <button
              type="button"
              onClick={() => { window.location.href = '/api/auth/naver'; }}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold transition-all active:scale-95 cursor-pointer shadow-sm !text-white"
              style={{ backgroundColor: '#03C75A' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white">
                <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
              </svg>
              네이버로 계속하기
            </button>

            {/* 구글 버튼 — /login과 동일한 방식 */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-gray-50 !text-gray-700 py-4 rounded-2xl font-bold border border-gray-300 hover:bg-gray-100 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
              Google로 계속하기
            </button>
          </div>

          {/* ── 2. 구분선 ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">또는 이메일로 회원가입</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* ── 3. 이메일 회원가입 폼 (기존 로직 그대로) ── */}
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">이메일 주소</label>
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
              <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">비밀번호</label>
              <input
                type="password"
                className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 outline-none focus:border-indigo-500 transition-all text-gray-900"
                placeholder="8자 이상 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">비밀번호 확인</label>
              <input
                type="password"
                className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 outline-none focus:border-indigo-500 transition-all text-gray-900"
                placeholder="한 번 더 입력"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-3/5 mx-auto block bg-gray-800 text-white py-4 rounded-2xl font-black hover:bg-gray-900 transition-all active:scale-95 shadow-lg disabled:bg-gray-300 mt-4 cursor-pointer"
            >
              {loading ? "처리 중..." : "이메일로 회원가입"}
            </button>
          </form>

          {/* ── 4. 로그인 유도 ── */}
          <div className="pt-2 text-center text-sm border-t border-gray-100">
            <span className="text-gray-400">이미 계정이 있으신가요? </span>
            <Link href="/login" className="text-indigo-600 font-bold hover:underline cursor-pointer">로그인하기</Link>
          </div>

        </div>
      </div>
    </div>
  );
}
