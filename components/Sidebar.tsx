// components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from "@/app/contexts/AuthContext";
import { createClient } from "@/app/utils/supabase/client";

const URL_TO_PAGE_TYPE: Record<string, string> = {
  '/analysis': 'ANALYSIS',
  '/related-fast': 'RELATED',
  '/blog-rank-b': 'BLOG',
  '/index-check': 'INDEX_CHECK',
  '/kin-rank': 'JISIKIN',
  '/blog-rank': 'TOTAL',
  '/google-analysis': 'GOOGLE',
  '/youtube-trend': 'YOUTUBE',
  '/shopping-insight': 'SHOPPING',
  '/seo-title': 'SEO_TITLE',
  '/seo-check': 'SEO_CHECK',
  '/shopping-rank': 'SHOPPING_RANK',
  '/ai-blog': 'AI_BLOG',
  '/ai-press': 'AI_PRESS'
};

export default function Sidebar() {
  const pathname = usePathname();
  
  // 🌟 [수정] 무조건 모든 Hook(useState, useEffect, useAuth)을 맨 위로 끌어올립니다!
  const [isMounted, setIsMounted] = useState(false);
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const [clientIp, setClientIp] = useState<string | null>(null);
  const [pointPolicies, setPointPolicies] = useState<Record<string, number>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const bannerCopies = [
    "마케터를 위한 스마트 메모장. 무거운 에버노트를 완벽히 대체합니다.",
    "방금 분석한 그 키워드, 날아가기 전에 노트T에 바로 기록하세요.",
    "마케터를 위한 스마트 메모장. 구글 캘린더와 드라이브까지 한 번에!"
  ];
  const [bannerText, setBannerText] = useState(bannerCopies[0]);

  const menuGroups = [
    {
      title: "Naver TOOLS",
      items: [
        { name: "키워드 정밀 분석", href: "/analysis" },
        { name: "연관 키워드 조회", href: "/related-fast" },
        { name: "블로그 순위 확인", href: "/blog-rank-b" },
        { name: "블로그 노출 진단", href: "/index-check" },
        { name: "지식인 순위 확인", href: "/kin-rank" },
        { name: "통검 노출/순위 확인", href: "/blog-rank" },
        {
          name: (
            <div className="flex items-center">
              키워드 생성기
              <span className="ml-1.5 px-1.5 py-[2px] bg-[#5244e8]/10 text-[#5244e8] rounded-sm text-[10px] font-black tracking-wide border border-[#5244e8]/20">FREE</span>
            </div>
          ),
          href: "/keyword-generator"
        },
      ]
    },
    {
      title: "AI TOOLS",
      items: [
        { name: "+ Dual AI 포스팅", href: "/ai-blog" },
        { name: "+ AI 언론 보도자료", href: "/ai-press" },
      ]
    },
    {
      title: "Seller Tools",
      items: [
        { name: "쇼핑 키워드 인사이트", href: "/shopping-insight" },
        { name: "쇼핑 상품명 최적화", href: "/seo-title" },
        { name: "내 상품명 진단", href: "/seo-check" },
        { name: "상품 노출 순위 분석", href: "/shopping-rank" },
      ]
    },
    {
      title: "Google & YouTube",
      items: [
        { name: "구글 키워드 분석", href: "/google-analysis" },
        { name: "유튜브 트렌드", href: "/youtube-trend" },
      ]
    },
  ];

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    const activeGroup = menuGroups.find(group =>
      group.items.some(item => item.href === pathname)
    );
    menuGroups.forEach(group => {
      initialState[group.title] = activeGroup ? group.title === activeGroup.title : true;
    });
    return initialState;
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const activeGroup = menuGroups.find(group =>
      group.items.some(item => item.href === pathname)
    );
    if (activeGroup) {
      setOpenGroups(prev => ({
        ...prev,
        [activeGroup.title]: true 
      }));
    }
  }, [pathname]);

  useEffect(() => {
    setBannerText(bannerCopies[Math.floor(Math.random() * bannerCopies.length)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setClientIp(data.ip))
      .catch(() => setClientIp('확인 불가'));

    const fetchPolicies = async () => {
      const supabase = createClient();
      const { data } = await supabase.from('point_policies').select('page_type, point_cost');
      if (data) {
        const policyMap: Record<string, number> = {};
        data.forEach(item => {
          policyMap[item.page_type] = item.point_cost;
        });
        setPointPolicies(policyMap);
      }
    };
    fetchPolicies();
  }, []);

  const handleRefreshPoints = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await refreshProfile();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // 🌟 [수정] 모든 Hook 선언이 끝난 가장 안전한 이 위치에서 return 처리를 합니다!
  if (!isMounted) return null;

  const excludeKeywords = ['/login', '/signup', '/terms', '/privacy', '/contact'];
  const isExcluded = pathname === '/' || excludeKeywords.some(keyword => pathname.startsWith(keyword));
  
  if (isExcluded) return <div className="hidden"></div>;

  return (
    <>
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed top-[64px] h-[calc(100vh-64px)] z-40">

        {isLoading ? (
          <div className="px-4 pt-4 pb-4 border-b border-gray-100 bg-gray-50/30 flex items-center justify-center">
            <span className="text-xs text-gray-400 font-bold">정보 불러오는 중...</span>
          </div>
        ) : user ? (
          <div className="px-4 pt-3 pb-3 border-b border-gray-100 bg-gray-50/30">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-bold text-gray-400 tracking-wider">
                  IP: <span className="text-gray-600">{clientIp || '로딩중...'}</span>
                </span>
              </div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase
                ${profile?.grade === 'agency' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                  profile?.grade === 'pro' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                    profile?.grade === 'starter' ? 'bg-green-50 text-green-600 border-green-200' :
                      'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {profile?.grade || 'FREE'}
              </span>
            </div>
            <div className="p-2.5 bg-white border border-[#5244e8]/20 rounded-lg shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-gray-500 font-bold tracking-tight">결제한 포인트</span>
                <span className="text-[11px] font-semibold text-gray-600">{profile?.purchased_points?.toLocaleString() || 0} P</span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-green-600 font-bold tracking-tight">보너스 포인트</span>
                <span className="text-[11px] font-semibold text-green-600">{profile?.bonus_points?.toLocaleString() || 0} P</span>
              </div>
              <div className="w-full h-px bg-gray-100 my-1.5"></div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] text-[#5244e8] font-bold tracking-tight">사용 가능 포인트</span>
                <span className="text-[13px] font-bold text-[#5244e8]">
                  {((profile?.bonus_points || 0) + (profile?.purchased_points || 0)).toLocaleString()} <span className="text-[11px]">P</span>
                </span>
              </div>
              <div className="flex gap-2 w-full">
                <Link href="/charge" className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#5244e8]/80 hover:bg-[#5244e8] text-white rounded-md text-[12px] font-bold transition-colors shadow-sm">
                  충전하기
                </Link>
                <button onClick={handleRefreshPoints} disabled={isRefreshing} className="w-[36px] flex shrink-0 items-center justify-center bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-500 rounded-md transition-colors shadow-sm">
                  <svg className={`w-[14px] h-[14px] ${!isRefreshing ? 'text-[#5244e8]' : 'animate-spin text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 pt-4 pb-4 border-b border-gray-100 bg-gray-50/30 flex items-center justify-center">
            <Link href="/login" className="text-[12px] font-bold text-[#5244e8] hover:underline">로그인이 필요합니다</Link>
          </div>
        )}

        <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
          <ul>
            {menuGroups.map((group, groupIdx) => {
              const isGroupActive = group.items.some(item => item.href === pathname);

              return (
                <li key={groupIdx} className="mb-1 pb-1 border-b border-gray-100 last:border-b-0">
                  <div
                    onClick={() => toggleGroup(group.title)}
                    className={`px-4 py-2 text-[11.5px] font-extrabold tracking-widest uppercase border-b flex items-center justify-between cursor-pointer transition-all font-sans antialiased
      ${isGroupActive
                        ? 'text-[#5244e8] border-[#5244e8]/40 bg-[#5244e8]/5'
                        : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-50'}`}
                  >
                    {group.title}
                    <svg
                      className={`w-3 h-3 transition-transform duration-200 ${openGroups[group.title] ? '' : '-rotate-90'}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  <div className={`grid transition-all duration-300 ease-in-out ${openGroups[group.title] ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <ul className="overflow-hidden mt-0.5">
                      {group.items.map((item, itemIdx) => {
                        const isActive = pathname === item.href;
                        const pageType = URL_TO_PAGE_TYPE[item.href as string];
                        const pointCost = pageType && pointPolicies[pageType] !== undefined
                          ? pointPolicies[pageType]
                          : (item.href === '/ai-blog' ? 30 : item.href === '/ai-press' ? 50 : null);

                        return (
                          <li key={itemIdx}>
                            <Link
                              href={item.href}
                              className={`group mx-3 pl-7 pr-4 py-1.5 flex items-center transition-colors duration-200 text-[13.5px] font-medium relative
                                ${isActive
                                  ? 'bg-[#5244e8]/10 text-[#5244e8]'
                                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-[3px] transition-all ${isActive ? 'bg-[#5244e8]' : 'bg-gray-200 group-hover:bg-[#5244e8]/40'
                                }`}></div>

                              <div className="flex-1 flex items-center justify-between">
                                <span>{typeof item.name === 'string' ? item.name : item.name}</span>
                                {typeof item.name === 'string' && pointCost !== null && (
                                  <span className={`px-1.5 py-[2px] rounded-sm text-[10px] font-bold tracking-wide border shadow-sm transition-colors ${isActive ? 'bg-[#5244e8]/5 text-[#5244e8] border-[#5244e8]/20' : 'bg-slate-50 text-slate-500 border-slate-200'
                                    }`}>
                                    {pointCost === 0 ? 'FREE' : `${pointCost}P`}
                                  </span>
                                )}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* 저장된 목록 보기 - 독립 단일 링크 */}
          <div className="px-3 pt-2 pb-1 border-t border-gray-100 mt-1">
            <Link
              href="/history"
              className={`group flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[13px] font-bold transition-all
                ${pathname === '/history'
                  ? 'bg-[#5244e8]/10 text-[#5244e8]'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <svg className="w-4 h-4 shrink-0 text-[#5244e8] transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path className="group-hover:fill-[#5244e8]/20 transition-all duration-200" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2H5z" />
              </svg>
              저장된 목록 보기
            </Link>
          </div>
        </nav>

        <div className="p-3 border-t border-gray-100">
          <a
            href="https://notetapp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-indigo-50 hover:bg-indigo-100 transition-colors rounded-xl p-4 cursor-pointer"
          >
            <div className="flex items-start justify-between mb-1">
              <span className="text-[11px] text-indigo-600 font-bold">✨ 추천 도구</span>
              <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </div>
            <p className="text-[14px] text-gray-900 font-bold leading-tight">Note T (노트티)</p>
            <p className="text-[12px] text-gray-500 mt-1 leading-snug">{isMounted ? bannerText : bannerCopies[0]}</p>
          </a>
        </div>
      </aside>
    </>
  );
}