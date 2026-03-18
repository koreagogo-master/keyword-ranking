'use client';

import { createClient } from "@/app/utils/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar"; 

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

  // 🌟 업그레이드: 포인트 변경 시 사유를 묻고 히스토리 장부에 남기는 로직
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
    if (diff === 0) return; // 변경사항이 없으면 조용히 종료

    // 🌟 사유 입력받기 (CS 로그용)
    const memo = window.prompt(
      `[히스토리 기록용]\n유저에게 지급/차감하는 사유를 입력해주세요.\n(예: CS 보상, 오류 복구, 이벤트 당첨 등)\n*취소를 눌러도 포인트는 변경되지만 '사유 없음'으로 기록됩니다.`
    );

    const { error } = await supabase
      .from('profiles')
      .update({ [column]: newVal })
      .eq('id', userId);

    if (!error) {
      // 🌟 히스토리 테이블에 관리자 조작 증거 남기기!
      await supabase.from('point_history').insert({
        user_id: userId,
        change_type: 'ADMIN',
        change_amount: diff, // +면 지급, -면 차감으로 정확하게 저장됨
        page_type: 'MANUAL',
        description: `[관리자 수동변경] ${label} 변경: ${currentVal} ➡️ ${newVal} | 사유: ${memo || '사유 없음'}`
      });

      alert("포인트가 변경되고 히스토리에 안전하게 기록되었습니다.");
      fetchUsers(); 
    } else {
      alert("포인트 수정 중 오류가 발생했습니다.");
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
          <div className="max-w-[1400px] mx-auto">
            
            <Link 
              href="/admin/points" 
              className="inline-flex items-center gap-1.5 text-[14px] font-bold text-slate-500 hover:text-[#5244e8] mb-6 transition-colors bg-white px-4 py-2 rounded-sm border border-gray-200 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              서비스 포인트 단가 설정
            </Link>

            <div className="mb-8 border-b border-gray-200 pb-4">
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2 flex items-center gap-2">
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