'use client';

// 🌟 useRef 추가
import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';

import Sidebar from '@/components/Sidebar';
import { createClient } from '@/app/utils/supabase/client';
import AdminTabs from '@/components/AdminTabs';

interface PointHistory {
  id: string;
  created_at: string;
  // 🌟 한글 호환 타입 추가
  change_type: 'USE' | 'CHARGE' | 'ADMIN' | '사용' | '충전' | '관리자'; 
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

// 🌟 대시보드에도 한글 라벨 완벽 호환되도록 수정!
const TYPE_LABELS: Record<string, { text: string, color: string }> = {
  'USE': { text: 'S', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  '사용': { text: 'S', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  'CHARGE': { text: 'P', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  '충전': { text: 'P', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  'ADMIN': { text: 'A', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  '관리자': { text: 'A', color: 'bg-amber-100 text-amber-700 border-amber-200' }
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
  'SHOPPING': { name: '쇼핑 키워드 인사이트', url: '/shopping-insight' },
  'SHOPPING_RANK': { name: '상품 노출 순위 분석', url: '/shopping-rank' },
  'MANUAL': { name: '관리자 수동 조작', url: '/admin' },
  // 🌟 사용처에 '포인트 자동 충전' 추가!
  'CHARGE': { name: '포인트 자동 충전', url: '/charge' } 
};

const NAVER_SEARCH_TYPES = ['RELATED', 'BLOG', 'JISIKIN', 'TOTAL', 'SHOPPING_RANK'];
const NAVER_DATALAB_TYPES = ['ANALYSIS', 'SHOPPING'];
const GOOGLE_TYPES = ['GOOGLE', 'YOUTUBE'];

export default function AdminDashboardPage() {
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  
  const alertShown = useRef(false);

  const [history, setHistory] = useState<PointHistory[]>([]);
  const [totalUsablePoints, setTotalUsablePoints] = useState<number>(0);
  const [userStats, setUserStats] = useState({ total: 0, paid: 0, free: 0, newToday: 0, withdrawn: 0 });
  const [loading, setLoading] = useState(true);

  const [apiTab, setApiTab] = useState<'naverSearch' | 'naverDatalab' | 'google'>('naverSearch');
  const [apiChartOffset, setApiChartOffset] = useState(0);

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

  useEffect(() => {
    if (profile?.role?.toLowerCase() === 'admin') {
      fetchHistoryAndStats();
    }
  }, [profile?.role]);

  const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const fetchHistoryAndStats = async () => {
    setLoading(true);
    const supabase = createClient();
    const todayStr = getTodayString();

    const { data: historyData } = await supabase
      .from('point_history')
      .select(`*, profiles ( email, purchased_points, bonus_points )`)
      .order('created_at', { ascending: false })
      .limit(5000);

    if (historyData) setHistory(historyData as any);

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('email, purchased_points, bonus_points, created_at');

    if (profilesData) {
      const adminEmails = ['a01091944465@gmail.com', 'lboll@naver.com', 'qairs@nate.com']; 
      const normalUsers = profilesData.filter(p => !adminEmails.includes(p.email));

      const sum = normalUsers.reduce((acc, profile) => acc + (profile.purchased_points || 0) + (profile.bonus_points || 0), 0);
      setTotalUsablePoints(sum);

      const total = normalUsers.length;
      const paid = normalUsers.filter(p => (p.purchased_points || 0) > 0).length;
      const free = total - paid;
      const newToday = normalUsers.filter(p => p.created_at.includes(todayStr)).length;
      const withdrawn = 0; 

      setUserStats({ total, paid, free, newToday, withdrawn });
    }

    setLoading(false);
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const todayStats = useMemo(() => {
    const todayStr = getTodayString();
    let used = 0, charged = 0, signup = 0;

    history.forEach(item => {
      if (item.created_at.startsWith(todayStr)) {
        if (item.change_type === 'USE' || item.change_type === '사용') {
          used += Math.abs(item.change_amount);
        } else if (item.page_type === 'SIGNUP') {
          signup += item.change_amount;
        } else if (item.change_type === 'CHARGE' || item.change_type === '충전' || ((item.change_type === 'ADMIN' || item.change_type === '관리자') && item.change_amount > 0)) {
          charged += item.change_amount;
        }
      }
    });

    const net = charged + signup - used;
    return { used, charged, signup, net };
  }, [history]);

  const recent28Days = useMemo(() => {
    return Array.from({ length: 28 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
  }, []);

  const apiRecent28Days = useMemo(() => {
    return Array.from({ length: 28 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i - (apiChartOffset * 7));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
  }, [apiChartOffset]);

  const NAVER_SEARCH_LIMIT = 25000;
  const NAVER_DATALAB_LIMIT = 1000;
  const GOOGLE_LIMIT = 100;

  const api28Stats = useMemo(() => {
    return apiRecent28Days.map(date => {
      const dayHistory = history.filter(h => h.created_at.startsWith(date) && (h.change_type === 'USE' || h.change_type === '사용'));
      const naverSearchCount = dayHistory.filter(h => NAVER_SEARCH_TYPES.includes(h.page_type)).length;
      const naverDatalabCount = dayHistory.filter(h => NAVER_DATALAB_TYPES.includes(h.page_type)).length;
      const googleCount = dayHistory.filter(h => GOOGLE_TYPES.includes(h.page_type)).length;

      const isToday = date === getTodayString();
      const displayDate = date.substring(2).replace(/-/g, '/');

      return {
        fullDate: date,
        displayDate,
        naverSearchCount,
        naverSearchPercent: ((naverSearchCount / NAVER_SEARCH_LIMIT) * 100).toFixed(1),
        naverDatalabCount,
        naverDatalabPercent: ((naverDatalabCount / NAVER_DATALAB_LIMIT) * 100).toFixed(1),
        googleCount,
        googlePercent: ((googleCount / GOOGLE_LIMIT) * 100).toFixed(1),
        isToday
      };
    });
  }, [history, apiRecent28Days]);

  const topPages = useMemo(() => {
    const counts: Record<string, number> = {};
    const recent7Days = recent28Days.slice(0, 7);
    history.forEach(item => {
      const itemDate = item.created_at.split('T')[0];
      if (recent7Days.includes(itemDate) && (item.change_type === 'USE' || item.change_type === '사용') && item.page_type && item.page_type !== 'MANUAL') {
        counts[item.page_type] = (counts[item.page_type] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ name: PAGE_META[type]?.name || type, count }));
  }, [history, recent28Days]);

  const topKeywords = useMemo(() => {
    const counts: Record<string, number> = {};
    const recent7Days = recent28Days.slice(0, 7);
    history.forEach(item => {
      const itemDate = item.created_at.split('T')[0];
      if (recent7Days.includes(itemDate) && (item.change_type === 'USE' || item.change_type === '사용') && item.description && item.page_type !== 'MANUAL') {
        counts[item.description] = (counts[item.description] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [history, recent28Days]);

  const weeklyStats = useMemo(() => {
    const stats: Record<string, { used: number, charged: number, signup: number, net: number }> = {};
    const recent7Days = recent28Days.slice(0, 7);

    recent7Days.forEach(date => {
      stats[date] = { used: 0, charged: 0, signup: 0, net: 0 };
    });

    history.forEach(item => {
      const itemDate = item.created_at.split('T')[0];
      if (stats[itemDate]) {
        if (item.change_type === 'USE' || item.change_type === '사용') {
          stats[itemDate].used += Math.abs(item.change_amount);
        } else if (item.page_type === 'SIGNUP') {
          stats[itemDate].signup += item.change_amount;
        } else if (item.change_type === 'CHARGE' || item.change_type === '충전' || ((item.change_type === 'ADMIN' || item.change_type === '관리자') && item.change_amount > 0)) {
          stats[itemDate].charged += item.change_amount;
        }
      }
    });

    return recent7Days.map(date => {
      const net = stats[date].charged + stats[date].signup - stats[date].used;
      return [date, { ...stats[date], net }] as const;
    });
  }, [history, recent28Days]);

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

  const recentHistoryList = historyWithBalances.slice(0, 10);

  // 🌟 (신규) 트렌드 키워드 렌더링 헬퍼 (1줄 인라인 유지 & 줄임표 방어)
  const renderTrendKeyword = (kw: string) => {
    const match = kw.match(/^(.*?)(\s*검색\s*\(\d+건\)?)$/);
    if (match) {
      const body = match[1];
      const tail = match[2];
      // 좁은 영역에 맞춰 70자 이상이면 2줄로 강제 절삭하여 꼬리표 공간 확보
      const truncatedBody = body.length > 70 ? body.slice(0, 70) + '...' : body;
      return (
        <div className="break-all leading-snug" title={kw}>
          <span>{truncatedBody}</span>
          <span className="text-[11px] text-slate-500 ml-1 whitespace-nowrap">{tail}</span>
        </div>
      );
    }
    // 일반 텍스트일 경우
    return <div className="line-clamp-2 break-all leading-snug" title={kw}>{kw}</div>;
  };

  // 🌟 (신규) 포인트 히스토리 렌더링 헬퍼 (폭 넓게 유지 & 줄임표 방어)
  const renderHistoryDescription = (desc: string) => {
    const match = desc.match(/^(.*?)(\s*검색\s*\(\d+건\)?)$/);
    if (match) {
      const body = match[1];
      const tail = match[2];
      // 넓은 영역에 맞춰 130자 이상이면 2줄로 강제 절삭하여 꼬리표 공간 확보
      const truncatedBody = body.length > 130 ? body.slice(0, 130) + '...' : body;
      return (
        <div className="break-all leading-snug" title={desc}>
          <span>{truncatedBody}</span>
          <span className="text-[11px] text-slate-500 ml-1 whitespace-nowrap">{tail}</span>
        </div>
      );
    }
    // 일반 텍스트일 경우
    return <div className="line-clamp-2 break-all leading-snug" title={desc}>{desc}</div>;
  };

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

            <div className="mb-10 text-center relative max-w-xl mx-auto">
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
                종합 대시보드
              </h1>
              <p className="text-sm text-slate-500">
                서비스 전체 가입자 현황 및 실시간 포인트 흐름을 한눈에 모니터링합니다.
              </p>
            </div>

            {/* 금일 포인트 & 전체 누적 */}
            <div className="flex gap-4 mb-8 items-stretch">
              <div className="flex-[3] flex flex-col">
                <div className="h-9 flex items-center justify-between mb-2 ml-1">
                  <h3 className="text-[15px] font-extrabold text-slate-800">금일 포인트</h3>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex-1 flex flex-col justify-center">
                  <div className="flex items-center justify-between divide-x divide-gray-100">
                    <div className="flex-1 px-4 first:pl-0">
                      <p className="text-[12px] font-bold text-slate-500 mb-1 text-left">충전</p>
                      <p className="text-[20px] font-black text-indigo-600 text-right">+{todayStats.charged.toLocaleString()} <span className="text-[11px] text-indigo-400 font-bold">P</span></p>
                    </div>
                    <div className="flex-1 px-4">
                      <p className="text-[12px] font-bold text-slate-500 mb-1 text-left">가입</p>
                      <p className="text-[20px] font-black text-emerald-600 text-right">+{todayStats.signup.toLocaleString()} <span className="text-[11px] text-emerald-400 font-bold">P</span></p>
                    </div>
                    <div className="flex-1 px-4">
                      <p className="text-[12px] font-bold text-slate-500 mb-1 text-left">소진</p>
                      <p className="text-[20px] font-black text-rose-600 text-right">-{todayStats.used.toLocaleString()} <span className="text-[11px] text-rose-400 font-bold">P</span></p>
                    </div>
                    <div className="flex-1 px-4 last:pr-0">
                      <p className="text-[12px] font-bold text-slate-500 mb-1 text-left">잔여</p>
                      <p className={`text-[20px] font-black text-right ${todayStats.net > 0 ? 'text-indigo-600' : todayStats.net < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                        {todayStats.net > 0 ? '+' : ''}{todayStats.net.toLocaleString()} <span className="text-[11px] font-bold opacity-70">P</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-[1] flex flex-col">
                <div className="h-9 flex justify-between items-center mb-2 ml-1">
                  <h3 className="text-[15px] font-extrabold text-slate-800">전체 누적</h3>
                  <button
                    onClick={fetchHistoryAndStats}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-900 transition-colors shadow-sm disabled:opacity-30 disabled:cursor-wait flex items-center gap-1.5"
                  >
                    <svg className={`w-3.5 h-3.5 text-white opacity-80 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    <span className="text-[12px] font-bold !text-white">{loading ? '...' : '새로고침'}</span>
                  </button>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex-1 flex flex-col justify-center">
                  <p className="text-[12px] font-bold text-slate-500 mb-1 text-left">잔여 포인트</p>
                  <p className="text-[20px] font-black text-slate-800 text-right">{totalUsablePoints.toLocaleString()} <span className="text-[11px] text-slate-400 font-bold">P</span></p>
                </div>
              </div>
            </div>

            {/* 회원 현황 통계 */}
            <div className="flex gap-4 mb-8 items-stretch">
              <div className="flex-[3] flex flex-col">
                <div className="h-9 flex items-center justify-between mb-2 ml-1">
                  <h3 className="text-[15px] font-extrabold text-slate-800">회원 현황</h3>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex-1 flex flex-col justify-center">
                  <div className="flex items-center justify-between divide-x divide-gray-100">
                    <div className="flex-1 px-4 first:pl-0">
                      <p className="text-[12px] font-bold text-slate-500 mb-1 text-left">유료 회원 (누적)</p>
                      <p className="text-[20px] font-black text-indigo-600 text-right">{userStats.paid.toLocaleString()} <span className="text-[11px] text-indigo-400 font-bold">명</span></p>
                    </div>
                    <div className="flex-1 px-4">
                      <p className="text-[12px] font-bold text-slate-500 mb-1 text-left">신규 회원 (금일)</p>
                      <p className="text-[20px] font-black text-emerald-600 text-right">+{userStats.newToday.toLocaleString()} <span className="text-[11px] text-emerald-400 font-bold">명</span></p>
                    </div>
                    <div className="flex-1 px-4">
                      <p className="text-[12px] font-bold text-slate-500 mb-1 text-left">무료 회원 (누적)</p>
                      <p className="text-[20px] font-black text-slate-700 text-right">{userStats.free.toLocaleString()} <span className="text-[11px] text-slate-400 font-bold">명</span></p>
                    </div>
                    <div className="flex-1 px-4 last:pr-0">
                      <p className="text-[12px] font-bold text-slate-500 mb-1 text-left">탈퇴 회원 (누적)</p>
                      <p className="text-[20px] font-black text-rose-600 text-right">-{userStats.withdrawn.toLocaleString()} <span className="text-[11px] text-rose-400 font-bold">명</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-[1] flex flex-col">
                <div className="h-9 flex justify-between items-center mb-2 ml-1">
                  <h3 className="text-[15px] font-extrabold text-slate-800">전체 회원</h3>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex-1 flex flex-col justify-center">
                  <p className="text-[12px] font-bold text-slate-500 mb-1 text-left">가입 회원 (누적)</p>
                  <p className="text-[20px] font-black text-slate-800 text-right">{userStats.total.toLocaleString()} <span className="text-[11px] text-slate-400 font-bold">명</span></p>
                </div>
              </div>
            </div>

            <div className="w-[80%] mx-auto border-t border-slate-200 mb-8"></div>

            {/* API 호출량 모니터링 */}
            <div className="flex flex-col mb-8">
              <div className="h-9 flex items-center justify-between mb-1 ml-1">
                <h3 className="text-[15px] font-extrabold text-slate-800 flex items-center gap-2">
                  최근 28일 API 호출량 모니터링
                </h3>
                <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
                  <button
                    onClick={() => setApiTab('naverSearch')}
                    className={`px-3 py-1.5 text-[12px] font-bold rounded-sm transition-colors ${apiTab === 'naverSearch' ? 'bg-white !text-emerald-600 shadow-sm border border-slate-200/50' : '!text-slate-500 hover:!text-slate-800'}`}
                  >
                    네이버 검색 ({NAVER_SEARCH_LIMIT.toLocaleString()}/일)
                  </button>
                  <button
                    onClick={() => setApiTab('naverDatalab')}
                    className={`px-3 py-1.5 text-[12px] font-bold rounded-sm transition-colors ${apiTab === 'naverDatalab' ? 'bg-white !text-teal-600 shadow-sm border border-slate-200/50' : '!text-slate-500 hover:!text-slate-800'}`}
                  >
                    네이버 데이터랩 ({NAVER_DATALAB_LIMIT.toLocaleString()}/일)
                  </button>
                  <button
                    onClick={() => setApiTab('google')}
                    className={`px-3 py-1.5 text-[12px] font-bold rounded-sm transition-colors ${apiTab === 'google' ? 'bg-white !text-indigo-600 shadow-sm border border-slate-200/50' : '!text-slate-500 hover:!text-slate-800'}`}
                  >
                    구글 ({GOOGLE_LIMIT.toLocaleString()}/일)
                  </button>
                </div>
              </div>

              <p className="text-[12px] font-bold text-slate-400 mb-3 ml-1 tracking-tight">
                <span className="text-emerald-600/80">N검색</span> : 연관 키워드, 블로그 순위, 지식인 순위, 통검 노출, 상품 순위 <span className="mx-2 text-slate-200">|</span>
                <span className="text-teal-600/80">N데이터랩</span> : 키워드 정밀 분석, 키워드 쇼핑 인사이트 <span className="mx-2 text-slate-200">|</span>
                <span className="text-indigo-600/80">구글</span> : 구글 키워드 분석, 유튜브 트렌드
              </p>

              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex items-center gap-2">
                <button
                  onClick={() => setApiChartOffset(prev => Math.max(0, prev - 1))}
                  disabled={apiChartOffset === 0}
                  className={`shrink-0 p-1 transition-colors ${apiChartOffset === 0 ? '!text-slate-200 cursor-not-allowed' : '!text-slate-400 hover:!text-[#5244e8]'}`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                </button>

                <div className="grid grid-cols-4 gap-4 flex-1 px-2">
                  {[0, 1, 2, 3].map(colIdx => (
                    <div key={colIdx} className="flex flex-col space-y-2">
                      {api28Stats.slice(colIdx * 7, (colIdx + 1) * 7).map(stat => {
                        let count = 0, percent = "0.0", limit = 100;
                        let themeColor = 'text-emerald-700';
                        let todayBgColor = 'bg-emerald-500/15 border-emerald-300/60 shadow-sm';

                        if (apiTab === 'naverSearch') {
                          count = stat.naverSearchCount; percent = stat.naverSearchPercent; limit = NAVER_SEARCH_LIMIT;
                          themeColor = 'text-emerald-700'; todayBgColor = 'bg-emerald-500/15 border-emerald-300/60 shadow-sm';
                        } else if (apiTab === 'naverDatalab') {
                          count = stat.naverDatalabCount; percent = stat.naverDatalabPercent; limit = NAVER_DATALAB_LIMIT;
                          themeColor = 'text-teal-700'; todayBgColor = 'bg-teal-500/15 border-teal-300/60 shadow-sm';
                        } else {
                          count = stat.googleCount; percent = stat.googlePercent; limit = GOOGLE_LIMIT;
                          themeColor = 'text-indigo-700'; todayBgColor = 'bg-indigo-500/15 border-indigo-300/60 shadow-sm';
                        }

                        const isDanger = count >= limit * 0.8;
                        if (isDanger) {
                          themeColor = 'text-rose-600';
                          todayBgColor = 'bg-rose-500/15 border-rose-300/60 shadow-sm';
                        }

                        return (
                          <div
                            key={stat.fullDate}
                            className={`flex items-center justify-between py-2 px-3 rounded-md border transition-colors ${stat.isToday ? todayBgColor : (isDanger ? 'bg-rose-50/50 border-rose-200 hover:bg-rose-100/50 hover:border-rose-300' : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:border-slate-200')}`}
                          >
                            <span className={`text-[12px] tracking-wide ${stat.isToday || isDanger ? `font-black ${themeColor}` : 'font-bold text-slate-500'}`}>
                              {stat.displayDate}
                            </span>
                            <span className={`text-[12px] font-bold font-mono tracking-tight ${isDanger ? 'text-rose-600' : 'text-slate-700'}`}>
                              <span className={stat.isToday || isDanger ? themeColor : ''}>{count.toLocaleString()}</span>
                              <span className={isDanger ? "text-rose-300 mx-1" : "text-slate-300 mx-1"}>/</span>
                              <span className={isDanger ? "text-rose-400" : "text-slate-400"}>{limit.toLocaleString()}</span>
                              <span className={`ml-1.5 font-sans text-[11px] ${isDanger ? "text-rose-500" : "text-slate-400"}`}>({percent}%)</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setApiChartOffset(prev => prev + 1)}
                  className="shrink-0 p-1 !text-slate-400 hover:!text-[#5244e8] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </button>

              </div>
            </div>

            {/* 기능 및 키워드 순위 */}
            <div className="flex gap-4 mb-8 items-stretch">
              <div className="flex-1 flex flex-col">
                <div className="h-9 flex items-center justify-between mb-2 ml-1">
                  <h3 className="text-[15px] font-extrabold text-slate-800">최근 7일 많이 사용된 기능 TOP 5</h3>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex-1 flex flex-col justify-center">
                  <div className="flex flex-col gap-1">
                    {topPages.length === 0 ? (
                      <p className="text-[13px] text-slate-400 font-bold w-full text-center py-4">데이터 수집 중입니다.</p>
                    ) : (
                      topPages.map((page, idx) => (
                        <div key={page.name} className="flex items-center justify-between w-full text-[13px] py-1.5 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-3">
                            <span className={`font-black w-4 text-center ${idx < 3 ? 'text-[#5244e8]' : 'text-slate-400'}`}>{idx + 1}</span>
                            <span className="font-bold text-slate-700">{page.name}</span>
                          </div>
                          <span className="font-bold text-slate-400">{page.count.toLocaleString()} <span className="text-[11px]">회</span></span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                <div className="h-9 flex items-center justify-between mb-2 ml-1">
                  <h3 className="text-[15px] font-extrabold text-slate-800 flex items-center gap-2">
                    최근 7일 트렌드 키워드 TOP 5
                    <span className="text-[11px] font-bold text-slate-400 font-normal">(2회 이상 중복 검색)</span>
                  </h3>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex-1 flex flex-col justify-center">
                  <div className="flex flex-col gap-1">
                    {topKeywords.length === 0 ? (
                      <p className="text-[13px] text-slate-400 font-bold w-full text-center py-4">트렌드 키워드 분석 중입니다.</p>
                    ) : (
                      topKeywords.map(([kw, count], idx) => (
                        <div key={kw} className="flex items-start justify-between w-full text-[13px] py-1.5 border-b border-gray-50 last:border-0 overflow-hidden">
                          <div className="flex items-start gap-3 flex-1 pr-4">
                            <span className={`font-black w-4 text-center mt-0.5 ${idx < 3 ? 'text-rose-500' : 'text-slate-400'}`}>{idx + 1}</span>
                            <div className="font-bold text-slate-700 flex-1">
                              {/* 🌟 헬퍼 함수를 통해 1줄/2줄 및 줄임표 방어 완벽 처리 */}
                              {renderTrendKeyword(kw)}
                            </div>
                          </div>
                          <span className="font-bold text-slate-400 whitespace-nowrap mt-0.5">{count.toLocaleString()} <span className="text-[11px]">회</span></span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 최근 포인트 변동 */}
            <div className="flex items-center justify-between mb-3 ml-1">
              <h3 className="text-[15px] font-extrabold text-slate-800">최근 포인트 변동</h3>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm mb-8">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed min-w-[700px]">
                  <thead className="bg-slate-50 text-slate-600 text-[13px] uppercase tracking-wider font-bold border-b border-gray-200">
                    <tr>
                      <th className="py-4 px-6 text-center w-[16%]">날짜</th>
                      <th className="py-4 px-6 text-center w-[21%]">충전 (+)</th>
                      <th className="py-4 px-6 text-center w-[21%]">가입 (+)</th>
                      <th className="py-4 px-6 text-center w-[21%]">사용 (-)</th>
                      <th className="py-4 px-6 text-center w-[21%]">잔여 (변동)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[14px]">
                    {weeklyStats.map(([date, stats]) => {
                      const isToday = date === getTodayString();
                      const displayDate = date.substring(2).replace(/-/g, '/');

                      return (
                        <tr key={date} className={`transition-colors ${isToday ? 'bg-[#5244e8]/10' : 'hover:bg-slate-50/50'}`}>
                          <td className={`py-4 px-6 text-center ${isToday ? 'text-indigo-700 font-black' : 'text-slate-500 font-medium'}`}>
                            {displayDate}
                          </td>
                          <td className="py-4 px-6 text-center text-indigo-600 font-black">
                            +{stats.charged.toLocaleString()} <span className="text-xs font-medium opacity-50">P</span>
                          </td>
                          <td className="py-4 px-6 text-center text-emerald-700 font-black">
                            +{stats.signup.toLocaleString()} <span className="text-xs font-medium opacity-50">P</span>
                          </td>
                          <td className="py-4 px-6 text-center text-rose-600 font-black">
                            -{stats.used.toLocaleString()} <span className="text-xs font-medium opacity-50">P</span>
                          </td>
                          <td className={`py-4 px-6 text-center font-extrabold ${stats.net < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>
                            {stats.net > 0 ? '+' : ''}{stats.net.toLocaleString()} <span className="text-xs font-medium opacity-50">P</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 최근 포인트 히스토리 */}
            <div className="flex items-center justify-between mb-3 ml-1 mt-10">
              <h3 className="text-[15px] font-extrabold text-slate-800">최근 포인트 히스토리</h3>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm mb-16">
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
                  ) : recentHistoryList.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-slate-500 font-bold">최근 내역이 없습니다.</td></tr>
                  ) : (
                    recentHistoryList.map((item) => {
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
                            {/* 🌟 헬퍼 함수 적용 & 기존의 꽉 막혀있던 max-w-[300px] 제거! */}
                            {renderHistoryDescription(item.description || '-')}
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

          </div>
        </main>
      </div>
    </>
  );
}