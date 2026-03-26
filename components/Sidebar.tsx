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
  '/kin-rank': 'JISIKIN',
  '/blog-rank': 'TOTAL',
  '/google-analysis': 'GOOGLE',
  '/youtube-trend': 'YOUTUBE',
  '/shopping-insight': 'SHOPPING',
  '/shopping-rank': 'SHOPPING_RANK',
  '/seo-title': 'SEO_TITLE'
};

export default function Sidebar() {
  const pathname = usePathname();
  // 🌟 [추가됨] refreshProfile 함수를 가져옵니다.
  const { user, profile, isLoading, refreshProfile } = useAuth();

  const [clientIp, setClientIp] = useState<string | null>(null);
  const [pointPolicies, setPointPolicies] = useState<Record<string, number>>({});
  
  // 🌟 [추가됨] 새로고침 중 빙글빙글 도는 효과를 위한 상태
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // 🌟 [추가됨] 수동 새로고침 버튼 클릭 시 실행되는 함수
  const handleRefreshPoints = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await refreshProfile(); // DB에서 최신 포인트 불러오기!
    setTimeout(() => setIsRefreshing(false), 500); // 아이콘이 0.5초 동안 예쁘게 돌게 함
  };

  const menuGroups = [
    {
      title: "Naver 분석",
      items: [
        { name: "키워드 정밀 분석", href: "/analysis" },
        { name: "연관 키워드 조회", href: "/related-fast" },
        { name: "블로그 순위 확인", href: "/blog-rank-b" },
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
      title: "Google & YouTube",
      items: [
        { name: "구글 키워드 분석", href: "/google-analysis" },
        { name: "유튜브 트렌드", href: "/youtube-trend" },
      ]
    },
    {
      title: "Seller Tools",
      items: [
        { name: "쇼핑 키워드 인사이트", href: "/shopping-insight" },
        { name: "쇼핑 상품명 최적화", href: "/seo-title" },
        { name: "상품 노출 순위 분석", href: "/shopping-rank" }
      ]
    },
    {
      title: "System",
      items: [
        { name: "저장된 목록 보기", href: "/history" },
        { name: "고객센터 (FAQ)", href: "/contact" },
        { name: "공지사항", href: "/notice" }
      ]
    }
  ];

  return (
    <>
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-50 pt-10">

        {isLoading ? (
          <div className="px-4 pt-4 pb-4 border-b border-gray-100 bg-gray-50/30 flex items-center justify-center">
            <span className="text-xs text-gray-400 font-bold">정보 불러오는 중...</span>
          </div>
        ) : user ? (
          <div className="px-4 pt-0 pb-4 border-b border-gray-100 bg-gray-50/30">

            <div className="flex items-center gap-1.5 mb-2.5 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] font-bold text-gray-400 tracking-wider">
                IP: <span className="text-gray-600">{clientIp || '로딩중...'}</span>
              </span>
            </div>

            <div className="p-3 bg-white border border-[#5244e8]/20 rounded-lg shadow-sm">
              <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-100">
                <span className="text-[11px] text-gray-400 font-black tracking-widest uppercase">My Grade</span>

                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase
                  ${profile?.grade === 'agency' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                    profile?.grade === 'pro' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                      profile?.grade === 'starter' ? 'bg-green-50 text-green-600 border-green-200' :
                        'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {profile?.grade || 'FREE'}
                </span>
              </div>

              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] text-gray-500 font-bold tracking-tight">결제한 포인트</span>
                <span className="text-[11px] font-semibold text-gray-600">{profile?.purchased_points?.toLocaleString() || 0} P</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] text-green-600 font-bold tracking-tight">보너스 포인트</span>
                <span className="text-[11px] font-semibold text-green-600">{profile?.bonus_points?.toLocaleString() || 0} P</span>
              </div>
              <div className="w-full h-px bg-gray-100 mb-2.5"></div>

              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] text-[#5244e8] font-bold tracking-tight">사용 가능 포인트</span>
                <span className="text-[13px] font-bold text-[#5244e8]">
                  {((profile?.bonus_points || 0) + (profile?.purchased_points || 0)).toLocaleString()} <span className="text-[11px]">P</span>
                </span>
              </div>

              {/* 🌟 [수정됨] 충전 버튼과 새로고침 버튼을 가로로 나란히 배치 */}
              <div className="flex gap-2 w-full">
                <Link
                  href="/charge"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#5244e8]/80 hover:bg-[#5244e8] text-white rounded-md text-[12px] font-bold transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  포인트 충전하기
                </Link>
                <button
                  onClick={handleRefreshPoints}
                  disabled={isRefreshing}
                  title="포인트 새로고침"
                  className="w-[36px] flex shrink-0 items-center justify-center bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-500 rounded-md transition-colors shadow-sm"
                >
                  <svg className={`w-[14px] h-[14px] ${!isRefreshing ? 'text-[#5244e8]' : 'animate-spin text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

            </div>
          </div>
        ) : (
          <div className="px-4 pt-4 pb-4 border-b border-gray-100 bg-gray-50/30 flex items-center justify-center">
            <Link href="/login" className="text-[12px] font-bold text-[#5244e8] hover:underline">
              로그인이 필요합니다
            </Link>
          </div>
        )}

        <nav className="flex-1 py-4 overflow-y-auto">
          <ul>
            {menuGroups.map((group, groupIdx) => (
              <li key={groupIdx} className="mb-4">
                <div
                  className="px-6 py-1.5 text-[12px] font-bold text-gray-400 tracking-wider uppercase"
                  style={{ fontFamily: "'NanumSquare', sans-serif" }}
                >
                  {group.title}
                </div>
                <ul className="mt-0.5">
                  {group.items.map((item, itemIdx) => {
                    const isActive = pathname === item.href;
                    const pageType = URL_TO_PAGE_TYPE[item.href as string];
                    const pointCost = pageType && pointPolicies[pageType] !== undefined ? pointPolicies[pageType] : null;

                    return (
                      <li key={itemIdx}>
                        <Link
                          href={item.href}
                          onClick={(e) => {
                            if ((item as any).isPreparing) {
                              e.preventDefault();
                              alert('해당 기능은 현재 준비 중입니다! 곧 멋진 모습으로 찾아뵙겠습니다. 🚀');
                            }
                          }}
                          className={`
                            px-6 py-2 flex items-center gap-3 transition-all text-[13.5px]
                            ${isActive
                              ? 'bg-[#5244e8]/10 text-[#5244e8] border-r-[3px] border-[#5244e8] font-semibold'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                            ${(item as any).isPreparing ? 'opacity-60 cursor-not-allowed' : ''}
                          `}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-[#5244e8]' : 'bg-gray-200'}`}></span>

                          <div className="flex items-center">
                            {typeof item.name === 'string' ? item.name : item.name}

                            {typeof item.name === 'string' && pointCost !== null && (
                              pointCost === 0 ? (
                                <span className="ml-2 px-1.5 py-[2px] bg-[#5244e8]/10 text-[#5244e8] rounded-sm text-[10px] font-black tracking-wide border border-[#5244e8]/20 shadow-sm">
                                  FREE
                                </span>
                              ) : (
                                <span className={`ml-2 px-1.5 py-[2px] rounded-sm text-[10px] font-bold tracking-wide border shadow-sm transition-colors ${isActive
                                    ? 'bg-[#5244e8]/5 text-[#5244e8] border-[#5244e8]/20'
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                  }`}>
                                  {pointCost}P
                                </span>
                              )
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="p-3 rounded-lg border border-gray-200 bg-white shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-gray-400 mb-0.5 uppercase tracking-widest">System</p>
              <p className="text-[11px] text-gray-600 font-bold">Enterprise Mode</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></span>
          </div>
        </div>
      </aside>
    </>
  );
}