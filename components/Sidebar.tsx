'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  const menuGroups = [
    {
      title: "Naver 분석",
      items: [
        { name: "키워드 정밀 분석", href: "/analysis" },
        { name: "연관 검색어 분석", href: "/related" }, // ✅ 신규 추가
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
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-50">
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <span 
          className="text-lg font-extrabold text-[#1a73e8] tracking-tight antialiased"
          style={{ fontFamily: "'NanumSquare', sans-serif" }}
        >
          Ranking Pro
        </span>
      </div>

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
  );
}