// components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from "react"; 
import { useAuth } from "@/app/contexts/AuthContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, profile, isLoading, handleLogout } = useAuth();

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
              {/* 🌟 수정: FREE 뱃지를 메인 컬러 톤에 맞춤 */}
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
        { name: "쇼핑 경쟁강도", href: "/shopping-insight" },
        { name: "수익률 계산기", href: "/calculator" },
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
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-50">

        {/* 1. 회원 정보 영역 */}
        {isLoading ? (
          <div className="px-6 py-7 border-b border-gray-100 bg-gray-50/30 flex items-center justify-center h-[130px]">
            <span className="text-xs text-gray-400 font-bold">정보 불러오는 중...</span>
          </div>
        ) : user ? (
          <div className="px-6 py-7 border-b border-gray-100 bg-gray-50/30">
            <div className="mb-4">
              <p className="text-gray-400 font-medium text-[11px] mb-1">Signed in as</p>
              <p className="text-gray-800 font-bold text-[13px] break-all leading-snug">
                {user.email}
              </p>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Grade</span>
              <span className="text-[11px] font-extrabold text-[#ff8533] px-2 py-0.5 bg-orange-50 rounded border border-orange-100">
                {profile?.grade?.toUpperCase() || 'STANDARD'}
              </span>
            </div>

            <div className="mt-3 mb-4 p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-bold tracking-wider">접속 IP</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-black text-gray-600">{clientIp || '확인 중...'}</span>
              </div>
            </div>

            <div className="flex gap-2 w-full mt-2">
              <Link
                href="/mypage"
                className="flex-1 flex items-center justify-center border border-gray-200 bg-white hover:border-[#ff8533] hover:text-[#ff8533] text-gray-600 text-[12px] font-bold py-2 rounded-lg transition-all shadow-sm"
              >
                My page
              </Link>
              <button
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center border border-gray-200 bg-white hover:border-red-500 transition-all shadow-sm group rounded-lg"
              >
                <span className="text-gray-600 group-hover:text-red-500 text-[12px] font-bold">
                  Log out
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-7 border-b border-gray-100 bg-gray-50/30 flex items-center justify-center h-[130px]">
            <Link href="/login" className="text-[13px] font-bold text-[#ff8533] hover:underline">
              로그인이 필요합니다
            </Link>
          </div>
        )}

        {/* 2. 메뉴 목록 */}
        <nav className="flex-1 py-6 overflow-y-auto">
          <ul>
            {menuGroups.map((group, groupIdx) => (
              <li key={groupIdx} className="mb-6">
                <div
                  className="px-6 py-2 text-[13px] font-semibold text-gray-500 tracking-tight"
                  style={{ fontFamily: "'NanumSquare', sans-serif" }}
                >
                  {group.title}
                </div>
                <ul className="mt-1">
                  {group.items.map((item, itemIdx) => {
                    const isActive = pathname === item.href;
                    return (
                      <li key={itemIdx}>
                        {/* 🌟 수정: 메뉴 활성화 시 파란색 대신 #5244e8 컬러 적용 */}
                        <Link href={item.href} className={`
                        px-6 py-2.5 flex items-center gap-3 transition-all text-[14px]
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
          <div className="p-3 rounded-lg border border-gray-200 bg-white">
            <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Enterprise Mode</p>
            <p className="text-[12px] text-gray-600 font-medium">실시간 API 분석 활성화</p>
          </div>
        </div>
      </aside>
    </>
  );
}