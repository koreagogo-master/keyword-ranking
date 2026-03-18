'use client';

import { useEffect, useState, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/app/utils/supabase/client';
import AdminTabs from '@/components/AdminTabs'; 

interface PointHistory {
  id: string;
  created_at: string;
  change_type: 'USE' | 'CHARGE' | 'ADMIN';
  change_amount: number;
  page_type: string;
  description: string;
  running_balance?: number; 
  profiles: { 
    email: string;
    purchased_points: number;
    bonus_points: number;
  } | null;
}

const TYPE_LABELS: Record<string, { text: string, color: string }> = {
  'USE': { text: 'S', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  'CHARGE': { text: 'P', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  'ADMIN': { text: 'A', color: 'bg-amber-100 text-amber-700 border-amber-200' }
};

const PAGE_META: Record<string, { name: string; url: string }> = {
  'SIGNUP': { name: '신규 가입', url: '' },
  'ANALYSIS': { name: '키워드 정밀 분석', url: '/analysis' },
  'RELATED': { name: '연관 키워드 조회', url: '/related-fast' },
  'BLOG': { name: '블로그 순위 확인', url: '/blog-rank-b' },
  'JISIKIN': { name: '지식인 순위 확인', url: '/kin-rank' },
  'TOTAL': { name: '통검 노출/순위 확인', url: '/blog-rank' },
  'GOOGLE': { name: '구글 키워드 분석', url: '/google-analysis' },
  'YOUTUBE': { name: '유튜브 트렌드', url: '/youtube-trend' },
  'SHOPPING': { name: '쇼핑 인사이트', url: '/shopping-insight' },
  'SHOPPING_RANK': { name: '상품 노출 순위 분석', url: '/shopping-rank' },
  'MANUAL': { name: '관리자 수동 조작', url: '/admin' }
};

export default function AdminHistoryPage() {
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [totalUsablePoints, setTotalUsablePoints] = useState<number>(0); 
  const [loading, setLoading] = useState(true);
  
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchEmail, setSearchEmail] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>(''); 
  const [startDate, setStartDate] = useState<string>(''); 
  const [endDate, setEndDate] = useState<string>(''); 

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; 
  const [chartOffset, setChartOffset] = useState(0);

  useEffect(() => {
    fetchHistoryAndStats();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, searchEmail, searchKeyword, startDate, endDate]);

  const fetchHistoryAndStats = async () => {
    setLoading(true);
    const supabase = createClient();
    
    const { data: historyData } = await supabase
      .from('point_history')
      .select(`*, profiles ( email, purchased_points, bonus_points )`)
      .order('created_at', { ascending: false })
      .limit(3000); 

    if (historyData) setHistory(historyData as any);

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('purchased_points, bonus_points');

    if (profilesData) {
      const sum = profilesData.reduce((acc, profile) => {
        return acc + (profile.purchased_points || 0) + (profile.bonus_points || 0);
      }, 0);
      setTotalUsablePoints(sum);
    }

    setLoading(false);
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const todayStats = useMemo(() => {
    const todayStr = getTodayString();
    let used = 0;
    let charged = 0;
    let signup = 0;

    history.forEach(item => {
      if (item.created_at.startsWith(todayStr)) {
        if (item.change_type === 'USE') {
          used += Math.abs(item.change_amount);
        } else if (item.page_type === 'SIGNUP') {
          signup += item.change_amount;
        } else if (item.change_type === 'CHARGE' || (item.change_type === 'ADMIN' && item.change_amount > 0)) {
          charged += item.change_amount;
        }
      }
    });

    const net = charged + signup - used;
    return { used, charged, signup, net };
  }, [history]);

  const weeklyStats = useMemo(() => {
    const stats: Record<string, { used: number, charged: number, signup: number, net: number }> = {};
    
    for(let i=6; i>=0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i - (chartOffset * 7)); 
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      stats[dateStr] = { used: 0, charged: 0, signup: 0, net: 0 };
    }

    history.forEach(item => {
      const itemDate = item.created_at.split('T')[0];
      if (stats[itemDate]) {
        if (item.change_type === 'USE') {
          stats[itemDate].used += Math.abs(item.change_amount);
        } else if (item.page_type === 'SIGNUP') {
          stats[itemDate].signup += item.change_amount;
        } else if (item.change_type === 'CHARGE' || (item.change_type === 'ADMIN' && item.change_amount > 0)) {
          stats[itemDate].charged += item.change_amount;
        }
      }
    });

    Object.keys(stats).forEach(date => {
      stats[date].net = stats[date].charged + stats[date].signup - stats[date].used;
    });

    return Object.entries(stats);
  }, [history, chartOffset]);

  const historyWithBalances = useMemo(() => {
    const userTrackedBalances: Record<string, number> = {};

    return history.map((item) => {
      const email = item.profiles?.email;
      if (!email) return { ...item, running_balance: 0 };

      if (userTrackedBalances[email] === undefined) {
        userTrackedBalances[email] = (item.profiles?.purchased_points || 0) + (item.profiles?.bonus_points || 0);
      }

      const displayBalance = userTrackedBalances[email];
      userTrackedBalances[email] -= item.change_amount;

      return {
        ...item,
        running_balance: displayBalance
      };
    });
  }, [history]);

  const filteredHistory = useMemo(() => {
    return historyWithBalances.filter(item => {
      // 🌟 신규가입 필터 로직 추가 (충전과 가입 분리)
      let matchType = false;
      if (filterType === 'ALL') {
        matchType = true;
      } else if (filterType === 'SIGNUP') {
        matchType = item.page_type === 'SIGNUP';
      } else if (filterType === 'CHARGE') {
        matchType = item.change_type === 'CHARGE' && item.page_type !== 'SIGNUP';
      } else {
        matchType = item.change_type === filterType;
      }

      const matchEmail = item.profiles?.email.toLowerCase().includes(searchEmail.toLowerCase()) || false;
      const matchKeyword = item.description?.toLowerCase().includes(searchKeyword.toLowerCase()) || false;
      
      const itemDate = item.created_at.split('T')[0];
      const matchStartDate = startDate ? itemDate >= startDate : true;
      const matchEndDate = endDate ? itemDate <= endDate : true;

      return matchType && matchEmail && matchKeyword && matchStartDate && matchEndDate;
    });
  }, [historyWithBalances, filterType, searchEmail, searchKeyword, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getPageNumbers = () => {
    const maxPagesToShow = 5;
    let start = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let end = Math.min(totalPages, start + maxPagesToShow - 1);

    if (end - start + 1 < maxPagesToShow) {
      start = Math.max(1, end - maxPagesToShow + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      
      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        <Sidebar />
        
        <main className="flex-1 ml-64 p-10 relative">
          <div className="max-w-[1200px] mx-auto">
            
            <AdminTabs />

            <div className="mb-8 text-center relative">
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2 flex items-center justify-center gap-2">
                포인트/결제 감사 로그 (History)
              </h1>
              <p className="text-sm text-slate-500">
                모든 유저의 포인트 사용, 결제, 관리자 수동 조작 내역이 실시간으로 100% 기록됩니다.
              </p>
              
              <div className="absolute right-0 bottom-0">
                <button onClick={fetchHistoryAndStats} className="inline-flex items-center gap-1.5 text-[14px] font-bold !text-slate-500 hover:!text-[#5244e8] transition-colors !bg-white px-4 py-2 rounded-sm border border-gray-200 shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  새로고침
                </button>
              </div>
            </div>

            {/* 🌟 수정: 2개의 큰 박스(오늘, 전체 누적)로 통합 및 정렬 최적화 */}
            <div className="flex gap-4 mb-6">
              {/* 1. [오늘] 박스 */}
              <div className="flex-[3] bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <p className="text-[14px] font-extrabold text-slate-700 mb-4 text-left">오늘</p>
                <div className="flex items-center justify-between divide-x divide-gray-100">
                  <div className="flex-1 px-4 first:pl-0">
                    <p className="text-[12px] font-bold text-slate-500 mb-1 text-right">충전</p>
                    <p className="text-[20px] font-black text-indigo-600 text-right">+{todayStats.charged.toLocaleString()} <span className="text-[11px] text-indigo-400 font-bold">P</span></p>
                  </div>
                  <div className="flex-1 px-4">
                    <p className="text-[12px] font-bold text-slate-500 mb-1 text-right">가입</p>
                    <p className="text-[20px] font-black text-emerald-600 text-right">+{todayStats.signup.toLocaleString()} <span className="text-[11px] text-emerald-400 font-bold">P</span></p>
                  </div>
                  <div className="flex-1 px-4">
                    <p className="text-[12px] font-bold text-slate-500 mb-1 text-right">소진</p>
                    <p className="text-[20px] font-black text-rose-600 text-right">-{todayStats.used.toLocaleString()} <span className="text-[11px] text-rose-400 font-bold">P</span></p>
                  </div>
                  <div className="flex-1 px-4 last:pr-0">
                    <p className="text-[12px] font-bold text-slate-500 mb-1 text-right">잔여</p>
                    <p className={`text-[20px] font-black text-right ${todayStats.net > 0 ? 'text-indigo-600' : todayStats.net < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                      {todayStats.net > 0 ? '+' : ''}{todayStats.net.toLocaleString()} <span className="text-[11px] font-bold opacity-70">P</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. [전체 누적] 박스 */}
              <div className="flex-[1] bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col justify-between">
                <p className="text-[14px] font-extrabold text-slate-700 mb-4 text-left">전체 누적</p>
                <div className="mt-auto">
                  <p className="text-[12px] font-bold text-slate-500 mb-1 text-right">전체 잔여</p>
                  <p className="text-[20px] font-black text-slate-800 text-right">{totalUsablePoints.toLocaleString()} <span className="text-[11px] text-slate-400 font-bold">P</span></p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5 mb-8 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[13px] font-extrabold text-slate-700">최근 7일 포인트 흐름</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setChartOffset(prev => prev + 1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold !text-slate-600 !bg-white border border-slate-200 rounded-md hover:!bg-slate-50 transition-colors shadow-sm">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    이전 주
                  </button>
                  {chartOffset > 0 && (
                    <button onClick={() => setChartOffset(prev => Math.max(0, prev - 1))} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold !text-slate-600 !bg-white border border-slate-200 rounded-md hover:!bg-slate-50 transition-colors shadow-sm">
                      이번 주
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                {/* 🌟 맨 왼쪽 범례 (우측 데이터 영역과 글자 크기 및 구조를 동기화하여 완벽한 줄맞춤) */}
                <div className="w-12 flex flex-col items-end justify-center py-3">
                  {/* 우측의 날짜 공간(mb-2)과 동일하게 밀어주기 위한 투명 텍스트 배치 */}
                  <span className="text-[12px] font-bold mb-2 opacity-0">날짜</span>
                  
                  <div className="w-full flex flex-col space-y-2 text-[13px] font-extrabold pr-2">
                    <div className="text-indigo-400 text-right">충전</div>
                    <div className="text-emerald-500 text-right">가입</div>
                    <div className="text-rose-400 text-right">소진</div>
                    <div className="text-slate-500 text-right border-t border-slate-200 pt-1.5">잔여</div>
                  </div>
                </div>

                {weeklyStats.map(([date, stats], idx) => {
                  const isToday = date === getTodayString() && chartOffset === 0;
                  return (
                    <div key={date} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-md border ${isToday ? 'bg-[#5244e8]/5 border-[#5244e8]/20' : 'bg-slate-50/50 border-transparent'}`}>
                      <span className={`text-[12px] font-bold mb-2 ${isToday ? 'text-[#5244e8]' : 'text-slate-500'}`}>
                        {date.substring(5).replace('-', '/')} {isToday && '(오늘)'}
                      </span>
                      <div className="w-full px-4 space-y-2 text-right">
                        <div className="text-[13px] text-indigo-700 font-black">{stats.charged > 0 ? '+' : ''}{stats.charged.toLocaleString()}</div>
                        <div className="text-[13px] text-emerald-600 font-black">{stats.signup > 0 ? '+' : ''}{stats.signup.toLocaleString()}</div>
                        <div className="text-[13px] text-rose-600 font-black">-{stats.used.toLocaleString()}</div>
                        <div className={`text-[13px] font-black border-t border-slate-200/80 pt-1.5 ${stats.net > 0 ? 'text-indigo-600' : stats.net < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                          {stats.net > 0 ? '+' : ''}{stats.net.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 shadow-sm space-y-4">
              <div className="flex gap-6 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-extrabold text-slate-700 w-16">기간 설정</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8]" />
                  <span className="text-gray-400">~</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8]" />
                </div>
                <div className="w-px h-5 bg-gray-200"></div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-extrabold text-slate-700 w-16">유형 분류</span>
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8] cursor-pointer min-w-[150px]">
                    <option value="ALL">전체 보기</option>
                    <option value="USE">S (사용)</option>
                    <option value="CHARGE">P (충전/결제)</option>
                    {/* 🌟 신규 가입 옵션 추가됨 */}
                    <option value="SIGNUP">N (신규 가입)</option>
                    <option value="ADMIN">A (관리자)</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-6 items-center pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-[13px] font-extrabold text-slate-700 w-16 shrink-0">e-mail / ID</span>
                  <input type="text" placeholder="유저 이메일로 검색" value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8]" />
                </div>
                <div className="w-px h-5 bg-gray-200"></div>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-[13px] font-extrabold text-slate-700 w-16 shrink-0 text-center">상세 검색</span>
                  <input type="text" placeholder="검색어 또는 사유 입력 (예: 다이어트)" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8]" />
                </div>
              </div>
            </div>

            <div className="text-sm font-bold text-slate-500 mb-3 ml-1">
              총 <span className="text-[#5244e8]">{filteredHistory.length.toLocaleString()}</span> 건의 내역이 조회되었습니다.
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm mb-6">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 text-[13px] uppercase tracking-wider font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 w-40">날짜</th>
                    <th className="px-6 py-4 w-44">e-mail / ID</th>
                    <th className="px-6 py-4 text-center w-20">분류</th>
                    <th className="px-6 py-4 text-center w-36">사용처</th>
                    <th className="px-6 py-4">상세 내역 (검색어 / 사유)</th>
                    <th className="px-6 py-4 text-right w-32">추가/소진</th>
                    <th className="px-6 py-4 text-right w-32 bg-slate-100/50">포인트</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[14px]">
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-10 text-slate-500 font-bold">데이터를 불러오는 중입니다...</td></tr>
                  ) : paginatedHistory.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-slate-500 font-bold">해당하는 내역이 없습니다.</td></tr>
                  ) : (
                    paginatedHistory.map((item) => {
                      const label = item.page_type === 'SIGNUP' 
                        ? { text: 'N', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
                        : TYPE_LABELS[item.change_type] || { text: '?', color: 'bg-gray-100 text-gray-500' };
                      
                      const isMinus = item.change_amount < 0;
                      
                      const meta = PAGE_META[item.page_type];
                      const displayPageName = meta ? meta.name : (item.page_type || '-');
                      const displayPageUrl = meta ? meta.url : '';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-slate-500 font-medium text-[13px]">
                            {formatDateTime(item.created_at)}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800 truncate" title={item.profiles?.email}>
                            {item.profiles?.email || '탈퇴한 유저'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-[13px] font-black border shadow-sm ${label.color}`}>
                              {label.text}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span 
                              className={`font-bold ${item.page_type === 'SIGNUP' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 bg-slate-100'} text-[13px] px-2 py-1.5 rounded-sm cursor-help whitespace-nowrap`}
                              title={displayPageUrl ? `페이지 경로: ${displayPageUrl}` : ''}
                            >
                              {displayPageName}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-700 font-medium">
                            {item.description || '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`font-black text-[15px] ${isMinus ? 'text-rose-600' : 'text-indigo-600'}`}>
                              {isMinus ? '' : '+'}{item.change_amount.toLocaleString()} P
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right bg-slate-50/50">
                            <span className="font-extrabold text-[14px] text-slate-600">
                              {(item.running_balance || 0).toLocaleString()} <span className="text-[12px] font-bold text-slate-400">P</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filteredHistory.length > 0 && (
              <div className="flex justify-center items-center gap-2 pb-10">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-md border border-gray-200 bg-white !text-slate-600 font-bold disabled:opacity-30 hover:bg-slate-50 transition-colors"
                >
                  이전
                </button>
                
                {getPageNumbers().map(num => (
                  <button
                    key={num}
                    onClick={() => setCurrentPage(num)}
                    className={`w-9 h-9 rounded-md flex items-center justify-center font-bold transition-colors ${
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
                  className="px-4 py-2 rounded-md border border-gray-200 bg-white !text-slate-600 font-bold disabled:opacity-30 hover:bg-slate-50 transition-colors"
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