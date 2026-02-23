// keyword-ranking/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 🌟 1. 중앙 통제실 스위치를 가져옵니다.
import { useAuth } from "@/app/contexts/AuthContext";
import SnapshotSidebar from "@/components/SnapshotSidebar";

export default function Sidebar() {
  const pathname = usePathname();
  
  // 🌟 2. 수십 줄의 코드를 지우고, 여기서도 게시판 정보만 쓱 읽어옵니다.
  const { user, profile, isLoading, handleLogout } = useAuth();

  const menuGroups = [
    {
      title: "Naver 분석",
      items: [
        { name: "키워드 정밀 분석", href: "/analysis" },
        { name: "연관 키워드 조회", href: "/related-fast" },
        { name: "통검 순위", href: "/blog-rank" },
        { name: "블로그 순위", href: "/blog-rank-b" },
        { name: "지식인 순위", href: "/kin-rank" },
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
    <SnapshotSidebar />
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
          
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Grade</span>
            <span className="text-[11px] font-extrabold text-[#ff8533] px-2 py-0.5 bg-orange-50 rounded border border-orange-100">
              {profile?.grade?.toUpperCase() || 'STANDARD'}
            </span>
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
          {/* 🌟 추가: 스냅샷 보관함 열기 신호를 보내는 버튼 */}
          <button 
            onClick={() => window.dispatchEvent(new Event('open-snapshot-sidebar'))}
            className="w-full mt-2 flex items-center justify-center gap-1.5 bg-[#1a73e8] hover:bg-blue-700 text-white text-[12px] font-bold py-2.5 rounded-lg transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
            저장된 키워드 보기
          </button>
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
                      <Link href={item.href} className={`
                        px-6 py-2.5 flex items-center gap-3 transition-all text-[14px]
                        ${isActive 
                          ? 'bg-blue-50 text-[#1a73e8] border-r-[3px] border-[#1a73e8] font-semibold' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                      `}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#1a73e8]' : 'bg-gray-200'}`}></span>
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