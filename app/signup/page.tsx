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
  const [isSent, setIsSent] = useState(false); // 이메일 발송 여부 상태
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);

    try {
      // Supabase 회원가입 시도
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // 가입 후 이메일 링크를 클릭했을 때 돌아올 주소 (메인 페이지)
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        alert("회원가입 실패: " + error.message);
      } else {
        // 성공 시 안내 문구 표시
        setIsSent(true);
      }
    } catch (err) {
      console.error(err);
      alert("알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 이메일 발송 완료 화면
  if (isSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white p-10 rounded-[32px] shadow-xl border border-gray-100 text-center">
          <div className="mb-6 inline-flex items-center justify-center w-20 h-20 bg-orange-50 rounded-full text-[#ff8533]">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-4">이메일을 확인해주세요!</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            <span className="font-bold text-[#ff8533]">{email}</span> 주소로 인증 링크를 보냈습니다.<br/>
            메일함의 링크를 클릭하시면 가입이 완료됩니다.
          </p>
          <Link href="/login" className="inline-block bg-[#ff8533] text-white px-8 py-4 rounded-2xl font-black hover:bg-[#e6772e] transition-all shadow-lg shadow-orange-100">
            로그인 화면으로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 pt-10">
      <div className="max-w-md w-full bg-white p-10 rounded-[32px] shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-black text-[#ff8533] italic">TMG AD</Link>
          <h2 className="text-xl font-bold text-gray-900 mt-4">로그인 계정 생성</h2>
          <p className="text-gray-400 mt-2 font-medium">무료 계정 생성 후 유료로 전환 하시면<br />보다 다양한 도구를 이용하실 수 있습니다.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">이메일 주소</label>
            <input 
              type="email" 
              className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 outline-none focus:border-[#ff8533] transition-all text-gray-900"
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
              className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 outline-none focus:border-[#ff8533] transition-all text-gray-900"
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
              className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 outline-none focus:border-[#ff8533] transition-all text-gray-900"
              placeholder="한 번 더 입력"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#ff8533] text-white py-4 rounded-2xl font-black hover:bg-[#e6772e] transition-all active:scale-95 shadow-lg shadow-orange-100 disabled:bg-gray-300 mt-4"
          >
            {loading ? "처리 중..." : "회원가입 신청하기"}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <span className="text-gray-400">이미 계정이 있으신가요? </span>
          <Link href="/login" className="text-[#ff8533] font-bold hover:underline">로그인하기</Link>
        </div>
      </div>
    </div>
  );
}