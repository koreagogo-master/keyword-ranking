'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/app/utils/supabase/client';

interface PointHistory {
  id: string;
  created_at: string;
  change_type: 'USE' | 'CHARGE' | 'ADMIN';
  change_amount: number;
  page_type: string;
  description: string;
  profiles: { email: string } | null;
}

const TYPE_LABELS: Record<string, { text: string, color: string }> = {
  'USE': { text: '서비스 사용', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  'CHARGE': { text: '포인트 충전', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  'ADMIN': { text: '관리자 조작', color: 'bg-amber-100 text-amber-700 border-amber-200' }
};

// 🌟 추가: DB 코드(RELATED)를 한글 이름과 URL로 예쁘게 바꿔주는 사전
const PAGE_META: Record<string, { name: string; url: string }> = {
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
  const [loading, setLoading] = useState(true);
  
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchEmail, setSearchEmail] = useState<string>('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('point_history')
      .select(`
        *,
        profiles ( email )
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (data) setHistory(data as any);
    setLoading(false);
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const filteredHistory = history.filter(item => {
    const matchType = filterType === 'ALL' || item.change_type === filterType;
    const matchEmail = item.profiles?.email.toLowerCase().includes(searchEmail.toLowerCase()) || false;
    return matchType && matchEmail;
  });

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      
      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        <Sidebar />
        
        <main className="flex-1 ml-64 p-10 relative">
          <div className="max-w-[1200px] mx-auto">
            
            <Link 
              href="/admin" 
              className="inline-flex items-center gap-1.5 text-[14px] font-bold text-slate-500 hover:text-[#5244e8] mb-6 transition-colors bg-white px-4 py-2 rounded-sm border border-gray-200 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              관리자 홈으로 돌아가기
            </Link>

            <div className="mb-8 border-b border-gray-200 pb-4 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 mb-2 flex items-center gap-2">
                  포인트/결제 감사 로그 (History)
                </h1>
                <p className="text-sm text-slate-500">
                  모든 유저의 포인트 사용, 결제, 관리자 수동 조작 내역이 실시간으로 100% 기록됩니다.<br/>
                  (CS 응대 시 증거 자료로 활용하세요. 최근 500건 노출)
                </p>
              </div>
              <button onClick={fetchHistory} className="inline-flex items-center gap-1.5 text-[14px] font-bold !text-slate-500 hover:!text-[#5244e8] transition-colors !bg-white px-4 py-2 rounded-sm border border-gray-200 shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                새로고침
              </button>
            </div>

            {/* 필터 바 */}
            <div className="bg-transparent mb-6 flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-600">유형 필터:</span>
                <select 
                  value={filterType} 
                  onChange={(e) => setFilterType(e.target.value)}
                  className="inline-flex items-center text-[14px] font-bold !text-slate-500 hover:!text-[#5244e8] transition-colors !bg-white px-4 py-2 rounded-sm border border-gray-200 shadow-sm focus:outline-none focus:border-[#5244e8] cursor-pointer"
                >
                  <option value="ALL" className="!text-slate-800 !bg-white font-medium">전체 보기</option>
                  <option value="USE" className="!text-slate-800 !bg-white font-medium">서비스 사용 내역만</option>
                  <option value="CHARGE" className="!text-slate-800 !bg-white font-medium">포인트 충전 내역만</option>
                  <option value="ADMIN" className="!text-slate-800 !bg-white font-medium">관리자 조작 내역만</option>
                </select>
              </div>
              <div className="w-px h-5 bg-gray-300 mx-2"></div>
              <div className="flex items-center gap-2 flex-1 max-w-sm relative">
                <span className="text-sm font-bold text-slate-600 shrink-0">이메일 검색:</span>
                {/* 🌟 수정: 실시간 검색임을 나타내는 돋보기 아이콘 추가 */}
                <div className="relative w-full">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <input 
                    type="text" 
                    placeholder="이메일을 입력하면 실시간으로 찾아드려요!" 
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="inline-flex items-center text-[14px] font-bold !text-slate-800 transition-colors !bg-white pl-9 pr-4 py-2 rounded-sm border border-gray-200 shadow-sm w-full focus:outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8]"
                  />
                </div>
              </div>
            </div>

            {/* 테이블 영역 */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 text-[13px] uppercase tracking-wider font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 w-40">발생 일시</th>
                    <th className="px-6 py-4 w-48">유저 이메일</th>
                    <th className="px-6 py-4 text-center w-32">분류</th>
                    <th className="px-6 py-4 text-center w-40">사용처</th>
                    <th className="px-6 py-4">상세 내역 (검색어 / 사유)</th>
                    <th className="px-6 py-4 text-right w-36">변동 포인트</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[14px]">
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-500 font-bold">데이터를 불러오는 중입니다...</td></tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-500 font-bold">해당하는 내역이 없습니다.</td></tr>
                  ) : (
                    filteredHistory.map((item) => {
                      const label = TYPE_LABELS[item.change_type] || { text: '알 수 없음', color: 'bg-gray-100 text-gray-500' };
                      const isMinus = item.change_amount < 0;
                      
                      // 🌟 수정: RELATED 등을 한글로 맵핑하고 마우스 오버 시 URL 표시
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
                            <span className={`px-2.5 py-1 rounded-sm text-[12px] font-extrabold border ${label.color}`}>
                              {label.text}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {/* 🌟 마우스 오버(title) 시 페이지 주소가 뜹니다! */}
                            <span 
                              className="font-bold text-slate-600 text-[13px] bg-slate-100 px-2 py-1.5 rounded-sm cursor-help whitespace-nowrap"
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