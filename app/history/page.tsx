'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/app/utils/supabase/client';
import { useAuth } from '@/app/contexts/AuthContext';

const PAGE_INFO: Record<string, { name: string, path: string }> = {
  'ANALYSIS': { name: '키워드 정밀 분석', path: '/analysis' },
  'RELATED': { name: '연관 키워드 조회', path: '/related-fast' },
  'BLOG': { name: '블로그 순위 확인', path: '/blog-rank-b' },
  'JISIKIN': { name: '지식인 순위 확인', path: '/kin-rank' },
  'TOTAL': { name: '통검 노출/순위 확인', path: '/blog-rank' },
  'GOOGLE': { name: '구글 키워드 분석', path: '/google-analysis' },
  'YOUTUBE': { name: '유튜브 트렌드', path: '/youtube-trend' },
  'SHOPPING': { name: '쇼핑 인사이트', path: '/shopping-insight' },
  'SHOPPING_RANK': { name: '상품 노출 순위 분석', path: '/shopping-rank' },
  'SEO_TITLE': { name: '쇼핑 상품명 최적화', path: '/seo-title' }, // 💡 대표님이 찾아내신 누락분 추가!
  'AIBLOG': { name: 'AI 블로그', path: '/ai-blog' }               // 💡 이번에 새로 만든 기능 추가!
};

interface SearchHistory {
  id: string;
  page_type: string;
  keyword: string;
  nickname: string | null;
  created_at: string;
  jisikin_data?: any; // 🌟 지식인 전용 데이터를 받을 수 있도록 타입 추가
}

export default function HistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [historyList, setHistoryList] = useState<SearchHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.id) {
      fetchHistory(user.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchHistory = async (userId: string) => {
    setLoading(true);
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('saved_searches')
      // 🌟 DB에서 가져올 때 jisikin_data 컬럼도 함께 가져오도록 추가
      .select('id, page_type, keyword, nickname, created_at, jisikin_data')
      .eq('user_id', userId) 
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setHistoryList(data);
    }
    setLoading(false);
  };

  const handleResearch = (item: SearchHistory) => {
    const info = PAGE_INFO[item.page_type];
    if (!info) {
      alert('이동할 수 없는 메뉴입니다.');
      return;
    }
    
    const url = new URL(window.location.origin + info.path);
    
    // 🌟 지식인 페이지로 갈 때는 jisikin_data 배열을 통째로 포장해서 보냅니다.
    if (item.page_type === 'JISIKIN' && item.jisikin_data) {
      url.searchParams.append('jisikin_data', encodeURIComponent(JSON.stringify(item.jisikin_data)));
    } else {
      if (item.keyword && item.keyword !== 'NULL') {
        url.searchParams.append('keyword', item.keyword);
      }
      if (item.nickname && item.nickname !== 'EMPTY' && item.nickname !== 'NULL') {
        url.searchParams.append('nickname', item.nickname);
      }
    }
    
    router.push(url.pathname + url.search);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "날짜 정보 없음";
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (authLoading) return <div className="min-h-screen bg-[#f8f9fa]"></div>;

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043]">
      <Sidebar />

      <main className="flex-1 ml-64 p-10 relative">
        <div className="max-w-[1000px] mx-auto pt-8">
          
          <div className="mb-8 relative text-center">
            <h1 className="text-[24px] font-extrabold text-gray-900 mb-2">저장된 목록 보기</h1>
            <p className="text-[14px] text-slate-500 font-medium leading-relaxed">
              검색하고 분석하여 저장된 키워드 내역을 확인하고 빠르게 다시 검색할 수 있습니다.<br />
              [다시 검색]을 클릭하시면 현재 시점의 최신 실시간 데이터를 새롭게 분석하여 제공하며, 각 메뉴 정책에 따라 <span className="font-bold text-rose-500">포인트가 차감</span>됩니다.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 text-[13px] tracking-wider font-bold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 w-48 text-center">검색 일시</th>
                  <th className="px-4 py-2.5 w-40 text-center">페이지</th>
                  <th className="px-4 py-2.5 text-center">키워드 / 조건</th>
                  <th className="px-4 py-2.5 w-32 text-center">다시 검색</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[14px]">
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-10 text-slate-500 font-bold">기록을 불러오는 중입니다...</td></tr>
                ) : historyList.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-slate-500 font-bold">아직 저장된 기록이 없습니다. 다양한 분석 기능을 활용해 보세요!</td></tr>
                ) : (
                  historyList.map((item) => {
                    const info = PAGE_INFO[item.page_type] || { name: item.page_type, path: '#' };
                    
                    // 🌟 표에 보여주기 위한 키워드/닉네임 가공 로직
                    let displayKeyword = item.keyword;
                    let displayNickname = item.nickname;

                    // 지식인 데이터일 경우, 배열을 풀어서 키워드만 쉼표로 연결해서 보여줍니다.
                    if (item.page_type === 'JISIKIN' && item.jisikin_data && Array.isArray(item.jisikin_data)) {
                      displayKeyword = item.jisikin_data.map((d: any) => d.keyword).join(', ');
                      displayNickname = null; // 지식인은 닉네임 표기 생략
                    }

                    const hasNickname = displayNickname && displayNickname !== 'EMPTY' && displayNickname !== 'NULL';
                    const hasKeyword = displayKeyword && displayKeyword !== 'NULL' && displayKeyword !== '';
                    
                    return (
                      <tr key={item.id} className="hover:bg-yellow-50 transition-colors duration-200">
                        
                        <td className="px-4 py-2 text-center text-[13px] font-medium text-slate-400">
                          {formatDate(item.created_at)}
                        </td>

                        <td className="px-4 py-2 text-center">
                          <span className="inline-block w-[130px] text-center px-2 py-1 rounded-md text-[11px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100 whitespace-nowrap tracking-tight">
                            {info.name}
                          </span>
                        </td>

                        <td className="px-4 py-2">
                          <div className="flex flex-col gap-0.5">
                            {hasKeyword ? (
                              <span className="font-bold text-slate-800 text-[13px]">{displayKeyword}</span>
                            ) : (
                              <span className="italic text-slate-400 text-[12px]">키워드 없음</span>
                            )}
                            {hasNickname && (
                              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                {displayNickname}
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleResearch(item)}
                            className="w-[90px] mx-auto py-1.5 bg-[#7a6df4] hover:bg-[#5244e8] text-white text-[12px] font-bold rounded-lg transition-all shadow-sm flex items-center justify-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            다시 검색
                          </button>
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
  );
}