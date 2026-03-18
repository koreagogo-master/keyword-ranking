'use client';

import { createClient } from "@/app/utils/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AdminTabs from '@/components/AdminTabs';

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
    return () => { isMounted = false; };
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

    const diff = newVal - currentVal;
    if (diff === 0) return;

    const memo = window.prompt(
      `[히스토리 기록용]\n유저에게 지급/차감하는 사유를 입력해주세요.\n(예: CS 보상, 오류 복구, 이벤트 당첨 등)\n*취소를 눌러도 포인트는 변경되지만 '사유 없음'으로 기록됩니다.`
    );

    const { error } = await supabase
      .from('profiles')
      .update({ [column]: newVal })
      .eq('id', userId);

    if (!error) {
      await supabase.from('point_history').insert({
        user_id: userId,
        change_type: 'ADMIN',
        change_amount: diff,
        page_type: 'MANUAL',
        description: `${label} : ${currentVal.toLocaleString()} -> ${newVal.toLocaleString()} | ${memo || '사유 없음'}`
      });

      alert("포인트가 변경되고 히스토리에 안전하게 기록되었습니다.");
      fetchUsers();
    } else {
      alert("포인트 수정 중 오류가 발생했습니다.");
    }
  };

  // 🌟 강제 탈퇴 처리 함수 추가
  const handleDeleteUser = async (userId: string, email: string) => {
    const confirmDelete = window.confirm(`⚠️ 정말 ${email} 유저를 강제 탈퇴시키겠습니까?\n(이 작업은 절대 되돌릴 수 없으며, 남은 포인트와 이용 내역이 모두 소멸됩니다.)`);

    if (!confirmDelete) return;

    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('강제 탈퇴 처리가 완료되었습니다.');
        fetchUsers(); // 🌟 삭제 성공 시 목록 새로고침
      } else {
        alert(`탈퇴 실패: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('서버와의 통신에 실패했습니다. (API 라우트를 확인해주세요.)');
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (status === 'checking' || status === 'redirecting') return <div className="min-h-screen bg-[#f8f9fa]"></div>;

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        <Sidebar />

        <main className="flex-1 ml-64 p-10 relative">
          <div className="max-w-[1200px] mx-auto">

            <AdminTabs />

            <div className="mb-8 text-center">
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2 flex items-center justify-center gap-2">
                관리자 전용 대시보드
              </h1>
              <p className="text-sm text-slate-500">
                가입한 유저들의 목록을 확인하고, 등급 및 보유 포인트를 직접 관리할 수 있습니다.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead className="bg-slate-50 text-slate-600 text-[13px] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="p-4 border-b border-gray-200 text-center w-16">No.</th>
                    <th className="p-4 border-b border-gray-200">이메일</th>
                    <th className="p-4 border-b border-gray-200 text-center">가입일</th>
                    <th className="p-4 border-b border-gray-200 text-center text-blue-600">최종 접속일</th>
                    <th className="p-4 border-b border-gray-200 text-center">등급 관리</th>

                    <th className="p-4 border-b border-gray-200 text-right text-slate-500">누적 결제 P</th>
                    <th className="p-4 border-b border-gray-200 text-right text-slate-500">결제 잔여 P</th>
                    <th className="p-4 border-b border-gray-200 text-right text-slate-500">보너스 P</th>
                    <th className="p-4 border-b border-gray-200 text-right font-black text-slate-800">총 사용가능</th>
                    {/* 🌟 관리 칼럼 추가 */}
                    <th className="p-4 border-b border-gray-200 text-center text-slate-500 w-24">관리</th>
                  </tr>
                </thead>
                <tbody className="text-[14px]">
                  {users.map((u, index) => {
                    const totalPoints = (u.purchased_points || 0) + (u.bonus_points || 0);
                    const userNumber = users.length - index;

                    return (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-center font-bold text-slate-400">{userNumber}</td>
                        <td className="p-4 font-bold text-gray-800">{u.email}</td>
                        <td className="p-4 text-center text-slate-500 text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="p-4 text-center text-blue-500 font-medium text-sm">{formatDateTime(u.last_login_at)}</td>
                        <td className="p-4 text-center">
                          <select
                            className={`bg-white border border-gray-300 rounded-md py-1.5 px-3 text-sm font-bold focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8] cursor-pointer shadow-sm
                              ${u.grade === 'agency' ? 'text-purple-600' :
                                u.grade === 'pro' ? 'text-blue-600' :
                                  u.grade === 'starter' ? 'text-green-600' : 'text-slate-600'}`}
                            value={u.grade || 'free'}
                            onChange={(e) => updateGrade(u.id, e.target.value)}
                          >
                            <option value="free" className="text-slate-600">Free</option>
                            <option value="starter" className="text-green-600">Starter</option>
                            <option value="pro" className="text-blue-600">Pro</option>
                            <option value="agency" className="text-purple-600">Agency</option>
                          </select>
                        </td>

                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleUpdatePoint(u.id, 'total_purchased_points', u.total_purchased_points, '누적 결제 포인트')}
                            className="hover:bg-slate-200 px-2 py-1.5 rounded transition-colors font-extrabold !text-slate-700"
                          >
                            {(u.total_purchased_points || 0).toLocaleString()}
                          </button>
                        </td>

                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleUpdatePoint(u.id, 'purchased_points', u.purchased_points, '결제 잔여 포인트')}
                            className="hover:bg-indigo-100 px-2 py-1.5 rounded transition-colors font-extrabold !text-indigo-700"
                          >
                            {(u.purchased_points || 0).toLocaleString()}
                          </button>
                        </td>

                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleUpdatePoint(u.id, 'bonus_points', u.bonus_points, '보너스 포인트')}
                            className="hover:bg-emerald-100 px-2 py-1.5 rounded transition-colors font-extrabold !text-emerald-700"
                          >
                            {(u.bonus_points || 0).toLocaleString()}
                          </button>
                        </td>

                        <td className="p-4 text-right">
                          <span className="font-black !text-gray-900 bg-slate-100 px-3 py-1.5 rounded-md border border-gray-200 inline-block">
                            {totalPoints.toLocaleString()} <span className="text-[11px] font-bold text-slate-500 ml-0.5">P</span>
                          </span>
                        </td>

                        {/* 🌟 강퇴 버튼 수정 (글씨색 강제 지정 !important 적용) */}
                        <td className="p-4 text-center">
                          {u.email !== 'a01091944465@gmail.com' && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              className="text-xs font-black !text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 hover:!text-red-700 px-3 py-1.5 rounded transition-colors shadow-sm"
                            >
                              강퇴
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </main>
      </div>
    </>
  );
}