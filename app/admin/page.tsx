'use client';

import { createClient } from "@/app/utils/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [status, setStatus] = useState<'checking' | 'admin' | 'redirecting'>('checking');
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    const safeAuthCheck = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user || user.email !== 'a01091944465@gmail.com') {
          if (isMounted) {
            setStatus('redirecting'); 
            window.location.replace("/");
          }
          return;
        }

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
      alert("등급이 성공적으로 변경되었습니다!");
      fetchUsers();
    } else {
      alert("등급 변경 중 오류가 발생했습니다.");
    }
  };

  const handleUpdatePoint = async (userId: string, column: string, currentVal: number, label: string) => {
    const input = window.prompt(
      `[${label}] 값을 수정합니다.\n지급하거나 차감할 '최종 숫자'를 입력하세요.\n(현재: ${currentVal || 0} P)`, 
      String(currentVal || 0)
    );
    
    if (input === null) return; 

    const newVal = parseInt(input.replace(/,/g, ''), 10);
    if (isNaN(newVal) || newVal < 0) {
      alert("0 이상의 올바른 숫자를 입력해주세요.");
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ [column]: newVal })
      .eq('id', userId);

    if (!error) {
      fetchUsers(); 
    } else {
      alert("포인트 수정 중 오류가 발생했습니다.");
    }
  };

  // 날짜를 보기 좋게 변환하는 함수 (최종 접속일용)
  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (status === 'checking' || status === 'redirecting') {
    return <div className="min-h-screen bg-gray-900"></div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-10 pt-24">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-blue-400">👑 관리자 전용 대시보드</h1>
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto shadow-2xl">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="bg-gray-700/50 text-gray-300 text-[13px] uppercase tracking-wider">
              <tr>
                {/* 🌟 No. 추가 */}
                <th className="p-4 border-b border-gray-700 text-center w-16">No.</th>
                <th className="p-4 border-b border-gray-700">이메일</th>
                <th className="p-4 border-b border-gray-700 text-center">가입일</th>
                {/* 🌟 최종 접속일 추가 */}
                <th className="p-4 border-b border-gray-700 text-center text-blue-300">최종 접속일</th>
                <th className="p-4 border-b border-gray-700 text-center">등급 관리</th>
                <th className="p-4 border-b border-gray-700 text-right">누적 결제 P</th>
                <th className="p-4 border-b border-gray-700 text-right text-indigo-300">결제 잔여 P</th>
                <th className="p-4 border-b border-gray-700 text-right text-emerald-300">보너스 P</th>
                <th className="p-4 border-b border-gray-700 text-right font-black text-white">총 사용가능</th>
              </tr>
            </thead>
            <tbody className="text-[14px]">
              {users.map((u, index) => {
                const totalPoints = (u.purchased_points || 0) + (u.bonus_points || 0);
                // 🌟 최신 가입자가 1번이 되도록 역순 넘버링
                const userNumber = users.length - index;

                return (
                  <tr key={u.id} className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors">
                    <td className="p-4 text-center font-bold text-gray-500">{userNumber}</td>
                    <td className="p-4 font-medium text-gray-200">{u.email}</td>
                    <td className="p-4 text-center text-gray-400 text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                    
                    {/* 🌟 최종 접속일 표시 */}
                    <td className="p-4 text-center text-blue-200/70 text-sm">{formatDateTime(u.last_login_at)}</td>
                    
                    <td className="p-4 text-center">
                      {/* 🌟 4단계 등급(Free, Starter, Pro, Agency) 적용 */}
                      <select 
                        className={`bg-gray-900 border border-gray-600 rounded-lg py-1.5 px-3 text-sm font-bold focus:border-blue-500 focus:outline-none cursor-pointer
                          ${u.grade === 'agency' ? 'text-purple-400' : 
                            u.grade === 'pro' ? 'text-blue-400' : 
                            u.grade === 'starter' ? 'text-green-400' : 'text-gray-300'}`}
                        value={u.grade || 'free'}
                        onChange={(e) => updateGrade(u.id, e.target.value)}
                      >
                        <option value="free">Free</option>
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="agency">Agency</option>
                      </select>
                    </td>
                    
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleUpdatePoint(u.id, 'total_purchased_points', u.total_purchased_points, '누적 결제 포인트')}
                        className="hover:bg-gray-600 px-2 py-1 rounded transition-colors text-gray-400 hover:text-white"
                      >
                        {(u.total_purchased_points || 0).toLocaleString()}
                      </button>
                    </td>

                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleUpdatePoint(u.id, 'purchased_points', u.purchased_points, '결제 잔여 포인트')}
                        className="hover:bg-indigo-900/50 px-2 py-1 rounded transition-colors font-bold text-indigo-300 hover:text-indigo-200"
                      >
                        {(u.purchased_points || 0).toLocaleString()}
                      </button>
                    </td>

                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleUpdatePoint(u.id, 'bonus_points', u.bonus_points, '보너스 포인트')}
                        className="hover:bg-emerald-900/50 px-2 py-1 rounded transition-colors font-bold text-emerald-400 hover:text-emerald-300"
                      >
                        {(u.bonus_points || 0).toLocaleString()}
                      </button>
                    </td>

                    <td className="p-4 text-right">
                      <span className="font-black text-white bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-600">
                        {totalPoints.toLocaleString()} <span className="text-[11px] font-normal text-gray-400">P</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}