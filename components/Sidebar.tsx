// components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from "@/app/contexts/AuthContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, profile, isLoading } = useAuth();
  
  const [clientIp, setClientIp] = useState<string | null>(null);
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setClientIp(data.ip))
      .catch(() => setClientIp('확인 불가'));
  }, []);

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
              <span className="ml-1.5 px-1.5 py-0.5 bg-[#5244e8]/10 text-[#5244e8] rounded text-[10px] font-black">FREE</span>
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
        { name: "쇼핑 인사이트", href: "/shopping-insight" },
        { name: "상품 노출 순위 분석", href: "/shopping-rank" }
      ]
    },
    {
      title: "System",
      items: [
        { name: "분석 히스토리", href: "/history" },
        { name: "사용자 설정", href: "/settings" },
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
          /* 🌟 수정: 상단 휑한 여백(pt-4)을 과감히 줄여서(pt-2.5) 헤더 아래로 바짝 붙임 */
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
              
              <Link 
                href="/mypage" 
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#5244e8]/80 hover:bg-[#5244e8] text-white rounded-md text-[12px] font-bold transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                포인트 충전하기
              </Link>
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
                    return (
                      <li key={itemIdx}>
                        <Link href={item.href} className={`
                        px-6 py-2 flex items-center gap-3 transition-all text-[13.5px]
                        ${isActive
                            ? 'bg-[#5244e8]/10 text-[#5244e8] border-r-[3px] border-[#5244e8] font-semibold'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                      `}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#5244e8]' : 'bg-gray-200'}`}></span>
                          {item.name}
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