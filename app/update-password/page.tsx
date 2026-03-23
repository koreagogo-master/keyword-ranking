'use client';

import { useState, useEffect } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // 사용자가 유효한 재설정 링크를 타고 왔는지 세션 체크
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("유효하지 않은 접근이거나 보안 링크가 만료되었습니다. 로그인 페이지에서 다시 시도해주세요.");
        router.push("/login");
      }
    };
    checkSession();
  }, [router, supabase]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    if (password.length < 6) {
      alert("보안을 위해 비밀번호는 최소 6자 이상으로 설정해주세요.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        alert("비밀번호 변경 실패: " + error.message);
      } else {
        alert("비밀번호가 성공적으로 변경되었습니다! 새 비밀번호로 다시 로그인해주세요.");
        await supabase.auth.signOut(); // 안전하게 세션 종료
        router.push("/login"); // 로그인 페이지로 이동
      }
    } catch (err) {
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
          <Link href="/" className="text-3xl font-black text-indigo-600 italic">Ranking Pro</Link>
          <p className="text-gray-400 mt-2 font-medium">새로운 비밀번호를 설정해주세요.</p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">새 비밀번호</label>
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
            <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">새 비밀번호 확인</label>
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
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 disabled:bg-gray-300 mt-6"
          >
            {loading ? "변경 중..." : "비밀번호 변경완료"}
          </button>
        </form>
      </div>
    </div>
  );
}