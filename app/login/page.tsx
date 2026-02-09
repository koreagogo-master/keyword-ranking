'use client';

import { useState } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Supabase 로그인 시도
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert("로그인 실패: " + error.message);
      } else {
        alert("로그인되었습니다!");
        // 로그인 성공 시 메인으로 이동
        router.push("/"); 
      }
    } catch (err: any) {
      // [수정 포인트] AbortError 처리 추가
      // 페이지 이동이나 통신 중단으로 인해 발생하는 에러는 무시하여 로그아웃 트리거를 방지합니다.
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        return;
      }
      
      console.error(err);
      alert("알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-10 rounded-[32px] shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-black text-[#ff8533] italic">TMG AD</Link>
          <p className="text-gray-400 mt-2 font-medium">서비스 이용을 위해 로그인해주세요.</p>
        </div>

        {/* 로그인 입력란 (Form) */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">이메일</label>
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#ff8533] text-white py-4 rounded-2xl font-black hover:bg-[#e6772e] transition-all active:scale-95 shadow-lg shadow-orange-100 disabled:bg-gray-300"
          >
            {loading ? "로그인 중..." : "로그인하기"}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <span className="text-gray-400">계정이 없으신가요? </span>
          <Link href="/signup" className="text-[#ff8533] font-bold hover:underline">회원가입</Link>
        </div>
      </div>
    </div>
  );
}