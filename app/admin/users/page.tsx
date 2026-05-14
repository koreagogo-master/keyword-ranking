'use client';

// 🌟 useRef 추가
import { useEffect, useState, useMemo, useRef } from "react";
import { createClient } from "@/app/utils/supabase/client";
// 🌟 수문장 역할을 할 모듈 추가
import { useRouter } from "next/navigation";
import { useAuth } from '@/app/contexts/AuthContext';

import AdminTabs from '@/components/AdminTabs';

// 통계 제외용 관리자 이메일
const adminEmails = ['a01091944465@gmail.com', 'lboll@naver.com'];

export default function AdminUsersPage() {
  // 🌟 권한 확인을 위한 수문장 호출
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  // 🌟 알림 중복 방지용 기억 장치
  const alertShown = useRef(false);

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PAID' | 'FREE'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [chartOffset, setChartOffset] = useState(0);

  const [sortConfig, setSortConfig] = useState<{ key: 'created_at' | 'last_login_at', direction: 'desc' | 'asc' }>({
    key: 'created_at',
    direction: 'desc'
  });
  
  const itemsPerPage = 20;

  const supabase = createClient();

  // 🌟 철통 보안 로직 (1회만 알림)
  useEffect(() => {
    if (!isAuthLoading) {
      if (!user || profile?.role?.toLowerCase() !== 'admin') {
        if (!alertShown.current) {
          alert('접근 권한이 없습니다.');
          alertShown.current = true;
          router.replace('/'); 
        }
      }
    }
  }, [user, profile, isAuthLoading, router]);

  // 🌟 관리자임이 확인되었을 때만 초기 데이터 불러오기
  useEffect(() => {
    if (profile?.role?.toLowerCase() === 'admin') {
      fetchUsers();
    }
  }, [profile?.role]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, sortConfig]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setUsers(data || []);
    setLoading(false);
  };

  const updateGrade = async (userId: string, newGrade: string) => {
    try {
      const res = await fetch('/api/admin/update-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, grade: newGrade }),
      });

      if (res.ok) {
        alert("등급이 성공적으로 변경되었습니다!");
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "등급 변경 중 오류가 발생했습니다.");
      }
    } catch {
      alert("등급 변경 중 오류가 발생했습니다.");
    }
  };

  const handleTogglePin = async (userId: string, currentState: boolean) => {
    const newState = !currentState;
    const { error } = await supabase
      .from('profiles')
      .update({ is_pinned: newState })
      .eq('id', userId);

    if (!error) {
      fetchUsers(); 
    } else {
      alert("고정 상태 변경 중 오류가 발생했습니다. (SQL 명령어로 is_pinned 컬럼을 추가했는지 확인해주세요!)");
    }
  };

  // 🌟 [추가] 무료 횟수 전용 수정 함수 (장부 기록 없이 깔끔하게 DB만 수정)
  const handleUpdateFreeCount = async (userId: string, currentVal: number) => {
    const input = window.prompt(
      `[무료 잔여 횟수]를 수정합니다.\n테스트를 위해 남은 횟수를 입력하세요.\n(현재: ${currentVal ?? 0} 회)`,
      String(currentVal ?? 0)
    );

    if (input === null) return;

    const newVal = parseInt(input.replace(/,/g, ''), 10);
    if (isNaN(newVal) || newVal < 0) {
      alert("0 이상의 올바른 숫자를 입력해주세요.");
      return;
    }

    if (newVal === (currentVal ?? 0)) return;

    try {
      const res = await fetch('/api/admin/update-free-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newVal }),
      });

      if (res.ok) {
        alert("무료 잔여 횟수가 변경되었습니다.");
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "무료 횟수 수정 중 오류가 발생했습니다.");
      }
    } catch {
      alert("무료 횟수 수정 중 오류가 발생했습니다.");
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

    if (newVal === (currentVal || 0)) return;

    const memo = window.prompt(
      `[히스토리 기록용]\n유저에게 지급/차감하는 사유를 입력해주세요.\n(예: CS 보상, 오류 복구, 이벤트 당첨 등)\n*취소를 눌러도 포인트는 변경되지만 '사유 없음'으로 기록됩니다.`
    );

    try {
      const response = await fetch('/api/admin/update-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, column, newVal, label, memo: memo || '사유 없음' }),
      });

      const result = await response.json();

      if (response.ok) {
        alert("포인트가 변경되고 히스토리에 안전하게 기록되었습니다.");
        fetchUsers();
      } else {
        alert(`포인트 수정 중 오류가 발생했습니다: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('서버와의 통신에 실패했습니다. (API 라우트를 확인해주세요.)');
    }
  };

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
        fetchUsers(); 
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

  const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const recent28Days = useMemo(() => {
    return Array.from({ length: 28 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i - (chartOffset * 7));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }); 
  }, [chartOffset]);

  const statUsers = useMemo(() => {
    return users.filter(u => !adminEmails.includes(u.email));
  }, [users]);

  const signup28Stats = useMemo(() => {
    return recent28Days.map(date => {
      const dayUsers = statUsers.filter(u => u.created_at.startsWith(date));
      const signups = dayUsers.length;
      const paidConversions = dayUsers.filter(u => ((u.total_purchased_points || 0) + (u.purchased_points || 0)) > 0).length;
      
      const cumulativeUsers = statUsers.filter(u => u.created_at.split('T')[0] <= date).length;

      const isToday = date === getTodayString();
      const displayDate = date.substring(2).replace(/-/g, '/');

      return { date, displayDate, signups, paidConversions, cumulativeUsers, isToday };
    });
  }, [statUsers, recent28Days]);

  const handleSort = (key: 'created_at' | 'last_login_at') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const filteredAndSortedUsers = useMemo(() => {
    let result = users.filter(user => {
      let matchFilter = true;
      const isPaid = ((user.total_purchased_points || 0) + (user.purchased_points || 0)) > 0;
      if (filterType === 'PAID') matchFilter = isPaid;
      if (filterType === 'FREE') matchFilter = !isPaid;

      const matchSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase());
      return matchFilter && matchSearch;
    });

    result.sort((a, b) => {
      // is_pinned(특별관리) 상태인 유저가 무조건 먼저 오도록 정렬
      const isPinnedA = !!a.is_pinned;
      const isPinnedB = !!b.is_pinned;

      if (isPinnedA && !isPinnedB) return -1;
      if (!isPinnedA && isPinnedB) return 1;

      // 그 다음 선택된 날짜 기준(가입일/접속일)으로 정렬
      const dateA = new Date(a[sortConfig.key] || 0).getTime();
      const dateB = new Date(b[sortConfig.key] || 0).getTime();
      
      if (sortConfig.direction === 'asc') return dateA - dateB;
      return dateB - dateA;
    });

    return result;
  }, [users, filterType, searchTerm, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedUsers.length / itemsPerPage));
  const paginatedUsers = filteredAndSortedUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getPageNumbers = () => {
    const maxPagesToShow = 5;
    let start = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let end = Math.min(totalPages, start + maxPagesToShow - 1);

    if (end - start + 1 < maxPagesToShow) {
      start = Math.max(1, end - maxPagesToShow + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  // 🌟 쫓겨나기 전 찰나의 순간에도 화면을 절대 보여주지 않는 철통 방어!
  if (isAuthLoading) {
    return <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center font-bold text-slate-500">권한 확인 중...</div>;
  }
  if (!user || profile?.role?.toLowerCase() !== 'admin') {
    return null; 
  }

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        

        <main className="flex-1 ml-64 p-10 relative">
          <div className="max-w-[1200px] mx-auto">

            <AdminTabs />

            <div className="mb-10 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 mb-2 flex items-center gap-2">
                  회원 현황 및 관리
                </h1>
                <p className="text-sm text-slate-500">
                  가입자 트렌드를 분석하고 전체 회원의 상태 및 포인트를 관리합니다.
                </p>
              </div>
              <button 
                onClick={fetchUsers} 
                disabled={loading}
                className="px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-900 transition-colors shadow-sm disabled:opacity-30 disabled:cursor-wait flex items-center gap-1.5"
              >
                <svg className={`w-3.5 h-3.5 text-white opacity-80 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                <span className="text-[12px] font-bold !text-white">{loading ? '...' : '새로고침'}</span>
              </button>
            </div>

            <div className="flex flex-col mb-10">
              <div className="h-9 flex items-center justify-between mb-1 ml-1">
                <h3 className="text-[15px] font-extrabold text-slate-800 flex items-center gap-2">
                  최근 28일 가입자 트렌드
                </h3>
              </div>
              
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex items-center gap-2">
                <button 
                  onClick={() => setChartOffset(prev => Math.max(0, prev - 1))}
                  disabled={chartOffset === 0}
                  className={`shrink-0 p-1 transition-colors ${chartOffset === 0 ? '!text-slate-200 cursor-not-allowed' : '!text-slate-400 hover:!text-[#5244e8]'}`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                </button>

                <div className="grid grid-cols-4 gap-4 flex-1 px-2">
                  {[0, 1, 2, 3].map(colIdx => (
                    <div key={colIdx} className="flex flex-col space-y-2">
                      {signup28Stats.slice(colIdx * 7, (colIdx + 1) * 7).map(stat => {
                        const themeColor = 'text-[#5244e8]';
                        const todayBgColor = 'bg-indigo-50/50 border-indigo-200/60 shadow-sm';
                        
                        return (
                          <div 
                            key={stat.date} 
                            className={`flex items-center justify-between py-2 px-3 rounded-md border transition-colors ${stat.isToday ? todayBgColor : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:border-slate-200'}`}
                          >
                            <span className={`text-[12px] tracking-tight ${stat.isToday ? `font-black ${themeColor}` : 'font-bold text-slate-500'}`}>
                              {stat.displayDate}
                            </span>
                            <span className="text-[11px] font-bold flex items-center gap-1.5 tracking-tight">
                              <span className={stat.signups > 0 ? "text-emerald-600" : "text-slate-400"}>
                                가입 {stat.signups > 0 ? '+' : ''}{stat.signups}
                              </span>
                              <span className="text-slate-200">|</span>
                              <span className={stat.paidConversions > 0 ? "text-indigo-500" : "text-slate-400"}>
                                유료 {stat.paidConversions > 0 ? '+' : ''}{stat.paidConversions}
                              </span>
                              <span className="text-slate-200">|</span>
                              <span className="text-slate-400">
                                총 {stat.cumulativeUsers}명
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setChartOffset(prev => prev + 1)}
                  className="shrink-0 p-1 !text-slate-400 hover:!text-[#5244e8] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>

            <div className="w-[80%] mx-auto border-t border-slate-200 mb-8"></div>

            <div className="flex items-center justify-between mb-3 ml-1">
              <h3 className="text-[15px] font-extrabold text-slate-800">전체 회원 리스트</h3>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
              <div className="flex gap-6 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-extrabold text-slate-700 w-16">회원 분류</span>
                  <select 
                    value={filterType} 
                    onChange={(e) => setFilterType(e.target.value as 'ALL' | 'PAID' | 'FREE')} 
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8] cursor-pointer min-w-[140px]"
                  >
                    <option value="ALL">전체 보기</option>
                    <option value="PAID">유료 회원만</option>
                    <option value="FREE">무료 회원만</option>
                  </select>
                </div>
                <div className="w-px h-5 bg-gray-200"></div>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-[13px] font-extrabold text-slate-700 w-16 shrink-0">계정 검색</span>
                  <input 
                    type="text" 
                    placeholder="이메일 주소로 검색..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full max-w-sm border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8]" 
                  />
                </div>
              </div>
            </div>

            <div className="text-[13px] font-bold text-slate-500 mb-3 ml-1">
              총 <span className="text-[#5244e8] font-black">{filteredAndSortedUsers.length.toLocaleString()}</span> 명의 회원이 조회되었습니다.
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm mb-6">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead className="bg-slate-50 text-slate-600 text-[12px] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-2.5 px-3 border-b border-gray-200 text-center w-12">No.</th>
                    <th className="py-2.5 px-3 border-b border-gray-200">이메일</th>
                    
                    <th 
                      onClick={() => handleSort('created_at')}
                      className="py-2.5 px-3 border-b border-gray-200 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                    >
                      가입일 <span className={`inline-block ml-1 ${sortConfig.key === 'created_at' ? 'text-indigo-500' : 'text-slate-300 group-hover:text-slate-400'}`}>{sortConfig.key === 'created_at' ? (sortConfig.direction === 'desc' ? '▼' : '▲') : '▼'}</span>
                    </th>
                    <th 
                      onClick={() => handleSort('last_login_at')}
                      className="py-2.5 px-3 border-b border-gray-200 text-center text-blue-600 cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                    >
                      최종 접속일 <span className={`inline-block ml-1 ${sortConfig.key === 'last_login_at' ? 'text-indigo-500' : 'text-slate-300 group-hover:text-slate-400'}`}>{sortConfig.key === 'last_login_at' ? (sortConfig.direction === 'desc' ? '▼' : '▲') : '▼'}</span>
                    </th>
                    
                    <th className="py-2.5 px-3 border-b border-gray-200 text-center">등급 관리</th>
                    {/* 🌟 무료 횟수 헤더 추가 */}
                    <th className="py-2.5 px-3 border-b border-gray-200 text-center text-orange-500 font-bold">무료 횟수</th>
                    <th className="py-2.5 px-3 border-b border-gray-200 text-right text-slate-500">누적 결제 P</th>
                    <th className="py-2.5 px-3 border-b border-gray-200 text-right text-slate-500">결제 잔여 P</th>
                    <th className="py-2.5 px-3 border-b border-gray-200 text-right text-slate-500">보너스 P</th>
                    <th className="py-2.5 px-3 border-b border-gray-200 text-right font-black text-slate-800">총 사용가능</th>
                    <th className="py-2.5 px-3 border-b border-gray-200 text-center text-slate-500 w-16">관리</th>
                  </tr>
                </thead>
                <tbody className="text-[13px]">
                  {loading ? (
                    <tr><td colSpan={11} className="text-center py-8 text-slate-500 font-bold">데이터를 불러오는 중입니다...</td></tr>
                  ) : paginatedUsers.length === 0 ? (
                    <tr><td colSpan={11} className="text-center py-8 text-slate-500 font-bold">조건에 맞는 회원이 없습니다.</td></tr>
                  ) : (
                    paginatedUsers.map((u, index) => {
                      const totalPoints = (u.purchased_points || 0) + (u.bonus_points || 0);
                      const userNumber = filteredAndSortedUsers.length - ((currentPage - 1) * itemsPerPage + index);

                      const isAdminEmail = adminEmails.includes(u.email);
                      const isPinned = !!u.is_pinned;

                      let rowStyle = 'hover:bg-slate-50 border-b border-gray-100';
                      if (isAdminEmail) rowStyle = 'bg-amber-50 hover:bg-amber-100 border-b border-amber-200/50';
                      else if (isPinned) rowStyle = 'bg-[#5244e8]/5 hover:bg-[#5244e8]/10 border-b border-[#5244e8]/10';

                      return (
                        <tr key={u.id} className={`transition-colors ${rowStyle}`}>
                          <td className="py-2 px-3 text-center font-bold text-slate-400 text-[12px]">
                            {userNumber}
                          </td>
                          <td className="py-2 px-3 font-bold text-gray-800 text-[13px]">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleTogglePin(u.id, isPinned)}
                                className={`text-[18px] transition-colors focus:outline-none leading-none pb-0.5 ${
                                  isPinned 
                                  ? '!text-[#5244e8] hover:!text-red-500' 
                                  : '!text-slate-400 hover:!text-slate-900'
                                }`}
                                title={isPinned ? '고정 해제' : '상단 고정'}
                              >
                                {isPinned ? '★' : '☆'}
                              </button>
                              <span>{u.email}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center text-slate-500 text-[12px]">{new Date(u.created_at).toLocaleDateString()}</td>
                          <td className="py-2 px-3 text-center text-blue-500 font-medium text-[12px]">{formatDateTime(u.last_login_at)}</td>
                          <td className="py-2 px-3 text-center">
                            <select
                              className={`bg-white border border-gray-300 rounded py-1 px-2 text-[12px] font-bold focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8] cursor-pointer shadow-sm
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
                          
                          {/* 🌟 무료 횟수 클릭 수정 버튼 추가 */}
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleUpdateFreeCount(u.id, u.free_search_count)}
                              className="hover:bg-orange-100 px-2 py-1 rounded transition-colors font-extrabold !text-orange-500 text-[12px]"
                              title="무료 횟수 수정"
                            >
                              {u.free_search_count ?? 0}
                            </button>
                          </td>

                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => handleUpdatePoint(u.id, 'total_purchased_points', u.total_purchased_points, '누적 결제 포인트')}
                              className="hover:bg-slate-200 px-2 py-1 rounded transition-colors font-extrabold !text-slate-700 text-[12px]"
                            >
                              {(u.total_purchased_points || 0).toLocaleString()}
                            </button>
                          </td>

                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => handleUpdatePoint(u.id, 'purchased_points', u.purchased_points, '결제 잔여 포인트')}
                              className="hover:bg-indigo-100 px-2 py-1 rounded transition-colors font-extrabold !text-indigo-700 text-[12px]"
                            >
                              {(u.purchased_points || 0).toLocaleString()}
                            </button>
                          </td>

                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => handleUpdatePoint(u.id, 'bonus_points', u.bonus_points, '보너스 포인트')}
                              className="hover:bg-emerald-100 px-2 py-1 rounded transition-colors font-extrabold !text-emerald-700 text-[12px]"
                            >
                              {(u.bonus_points || 0).toLocaleString()}
                            </button>
                          </td>

                          <td className="py-2 px-3 text-right">
                            <span className="font-black !text-gray-900 bg-slate-100 px-2 py-1 rounded border border-gray-200 inline-block text-[13px]">
                              {totalPoints.toLocaleString()} <span className="text-[10px] font-bold text-slate-500 ml-0.5">P</span>
                            </span>
                          </td>

                          <td className="py-2 px-3 text-center">
                            {!isAdminEmail && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.email)}
                                className="text-[11px] font-black !text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 hover:!text-red-700 px-2 py-1 rounded transition-colors shadow-sm"
                              >
                                강퇴
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이징 컨트롤 */}
            {!loading && filteredAndSortedUsers.length > 0 && (
              <div className="flex justify-center items-center gap-2 pb-10">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-[13px] !text-slate-600 font-bold disabled:opacity-30 hover:bg-slate-50 transition-colors"
                >
                  이전
                </button>
                
                {getPageNumbers().map(num => (
                  <button
                    key={num}
                    onClick={() => setCurrentPage(num)}
                    className={`w-8 h-8 rounded-md flex items-center justify-center text-[13px] font-bold transition-colors ${
                      currentPage === num 
                      ? 'bg-[#5244e8] !text-white border border-[#5244e8]' 
                      : 'bg-white !text-slate-600 border border-gray-200 hover:bg-slate-50'
                    }`}
                  >
                    {num}
                  </button>
                ))}

                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-[13px] !text-slate-600 font-bold disabled:opacity-30 hover:bg-slate-50 transition-colors"
                >
                  다음
                </button>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  );
}