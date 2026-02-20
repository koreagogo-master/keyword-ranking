'use client';

import { createClient } from "@/app/utils/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  
  // 1. 컴포넌트가 엉키지 않도록 세 가지 상태로 명확히 나눕니다.
  const [status, setStatus] = useState<'checking' | 'admin' | 'redirecting'>('checking');
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // React 생명주기 안전장치 (화면이 전환될 때 메모리 누수 방지)
    let isMounted = true;

    const safeAuthCheck = async () => {
      try {
        // [수정됨] getSession 대신 getUser를 사용하여 서버에서 가장 정확한 상태를 확인합니다.
        const { data: { user }, error } = await supabase.auth.getUser();

        // [수정됨] 에러가 있거나, 유저가 없거나, 관리자 이메일이 아닌 경우 (일반 사용자)
        if (error || !user || user.email !== 'a01091944465@gmail.com') {
          if (isMounted) {
            // 1. 화면을 더 이상 그리지 않도록 'redirecting' 상태로 고정합니다.
            setStatus('redirecting'); 
            
            // 2. [수정됨] Next.js 라우터 대신 브라우저의 강력한 이동(새로고침 동반)을 사용합니다.
            // 이 방식을 통해 메인 페이지의 헤더와 서브 페이지의 사이드바가 로그인 상태를 잃지 않고 정상 작동하게 됩니다.
            window.location.replace("/");
          }
          return;
        }

        // 관리자인 경우 정상 작동
        if (isMounted) {
          setStatus('admin');
          fetchUsers();
        }
      } catch (error) {
        if (isMounted) {
          setStatus('redirecting');
          window.location.replace("/");
        }
      }
    };

    safeAuthCheck();

    // 컴포넌트가 사라질 때 실행되는 정리(Cleanup) 함수
    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // 2. 확인 중이거나 튕겨내는 중일 때는 까만 화면만 띄워 UI 충돌을 완벽히 방지합니다.
  if (status === 'checking' || status === 'redirecting') {
    return <div className="min-h-screen bg-gray-900"></div>;
  }

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