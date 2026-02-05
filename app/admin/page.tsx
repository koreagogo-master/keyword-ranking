'use client';

import { createClient } from "@/app/utils/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAdminAndFetchUsers();
  }, []);

  const checkAdminAndFetchUsers = async () => {
    console.log("1. 보안 확인 시작...");
    try {
      // A. 세션 정보를 먼저 가져옵니다 (getUser보다 빠르고 안정적일 때가 있습니다)
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        console.log("2. 로그인 정보 없음 -> 로그인 페이지 이동");
        router.replace("/login");
        return;
      }

      console.log("2. 로그인 유저 확인 완료:", user.email);

      // B. 역할 확인
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const userRole = profile?.role?.toLowerCase();
      console.log("3. DB 권한 확인:", userRole);

      if (profileError || userRole !== 'admin') {
        console.warn("4. 관리자 아님 -> 메인으로 이동");
        alert("관리자 권한이 없습니다.");
        router.replace("/");
        return;
      }

      // C. 관리자 확인 완료
      console.log("4. 관리자 접속 허용");
      setIsAdmin(true);
      await fetchUsers();
      
    } catch (err) {
      console.error("보안 확인 중 예외 발생:", err);
      router.replace("/");
    } finally {
      // [핵심] 어떤 경우에도(성공, 실패, 에러 모두) 로딩은 끕니다.
      console.log("5. 로딩 해제");
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setUsers(data || []);
  };

  const updateGrade = async (userId: string, newGrade: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ grade: newGrade })
      .eq('id', userId);

    if (!error) {
      alert("등급이 변경되었습니다!");
      fetchUsers();
    }
  };

  // 로딩 화면
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="text-white text-xl font-bold">보안 확인 중...</div>
        <p className="text-gray-400 text-sm">잠시만 기다려주세요.</p>
      </div>
    );
  }

  // 관리자가 아닐 때 내용을 보여주지 않음
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-10 pt-24">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-blue-400">👑 관리자 전용 대시보드</h1>
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-700/50 text-gray-300">
              <tr>
                <th className="p-4 border-b border-gray-700">이메일</th>
                <th className="p-4 border-b border-gray-700">가입일</th>
                <th className="p-4 border-b border-gray-700">현재 등급</th>
                <th className="p-4 border-b border-gray-700">등급 관리</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors">
                  <td className="p-4">{u.email}</td>
                  <td className="p-4 text-gray-400 text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${u.grade === 'premium' ? 'bg-yellow-500 text-black' : 'bg-gray-600'}`}>
                      {u.grade || 'FREE'}
                    </span>
                  </td>
                  <td className="p-4">
                    <select 
                      className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-sm text-white"
                      value={u.grade || 'free'}
                      onChange={(e) => updateGrade(u.id, e.target.value)}
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}