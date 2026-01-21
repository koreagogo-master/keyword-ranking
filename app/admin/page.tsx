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

  // 1. 관리자 여부 확인 및 유저 목록 가져오기
  const checkAdminAndFetchUsers = async () => {
    // A. 현재 로그인한 사람 확인
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert("로그인이 필요합니다.");
      router.push("/");
      return;
    }

    // B. 이 사람이 진짜 관리자(admin)인지 DB에서 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      alert("관리자만 접근할 수 있습니다. 썩 물러가라! 🛡️");
      router.push("/"); // 메인으로 쫓아냄
      return;
    }

    setIsAdmin(true);

    // C. 모든 유저 목록 가져오기
    fetchUsers();
  };

  const fetchUsers = async () => {
    // profiles 테이블의 모든 정보를 가져옴 (최신 가입순)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    else setUsers(data || []);
    
    setLoading(false);
  };

  // 2. 등급 변경 함수 (Premium <-> Free)
  const updateGrade = async (userId: string, newGrade: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ grade: newGrade })
      .eq('id', userId);

    if (error) {
      alert("등급 변경 실패: " + error.message);
    } else {
      alert("등급이 변경되었습니다!");
      fetchUsers(); // 목록 새로고침
    }
  };

  if (loading) return <div className="p-10 text-white">로딩 중... (권한 확인)</div>;
  if (!isAdmin) return null; // 관리자 아니면 아무것도 안 보여줌

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white p-10">
      <h1 className="text-3xl font-bold mb-8 text-blue-400">👑 관리자 대시보드</h1>
      
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-700 text-gray-300">
            <tr>
              <th className="p-4">이메일</th>
              <th className="p-4">가입일</th>
              <th className="p-4">현재 등급</th>
              <th className="p-4">등급 관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="p-4">{user.email}</td>
                <td className="p-4 text-gray-400 text-sm">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    user.grade === 'premium' ? 'bg-yellow-500 text-black' : 'bg-gray-600'
                  }`}>
                    {user.grade.toUpperCase()}
                  </span>
                </td>
                <td className="p-4">
                  <select 
                    className="bg-gray-900 border border-gray-600 rounded p-2 text-sm"
                    value={user.grade}
                    onChange={(e) => updateGrade(user.id, e.target.value)}
                  >
                    <option value="free">Free (무료)</option>
                    <option value="basic">Basic (기본)</option>
                    <option value="premium">Premium (유료)</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}