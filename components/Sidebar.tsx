// components/Sidebar.tsx
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  // 개발 예정인 모든 메뉴 리스트 (하나씩 박살 작전!)
  const menuSections = [
    {
      title: "네이버 분석 (NAVER)",
      items: [
        { name: "키워드 탐색기", href: "/analysis", icon: "🔍" },
        { name: "통합 순위 분석", href: "/blog-rank", icon: "📊" },
        { name: "블로그 순위 추적", href: "/blog-rank-b", icon: "📈" },
        { name: "지식인 순위 추적", href: "/kin-rank", icon: "🙋" },
      ]
    },
    {
      title: "구글 & 유튜브 (GOOGLE)",
      items: [
        { name: "구글 키워드 분석", href: "/google-analysis", icon: "🌐" },
        { name: "유튜브 트렌드", href: "/youtube-trend", icon: "🎥" },
      ]
    },
    {
      title: "셀러 도구 (SELLER)",
      items: [
        { name: "쇼핑 경쟁강도", href: "/shopping-comp", icon: "🛒" },
        { name: "수익률 계산기", href: "/margin-calc", icon: "🧮" },
      ]
    },
    {
      title: "시스템 (ADMIN)",
      items: [
        { name: "분석 히스토리", href: "/history", icon: "🕒" },
        { name: "사용자 설정", href: "/settings", icon: "⚙️" },
      ]
    }
  ];

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-white border-r border-gray-100 p-6 z-40 overflow-y-auto font-body custom-scrollbar">
      <div className="space-y-8">
        {menuSections.map((section, idx) => (
          <div key={idx}>
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 pl-2 font-title">
              {section.title}
            </h2>
            <nav className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all text-sm ${
                      isActive 
                        ? "bg-orange-50 text-[#ff8533] shadow-sm shadow-orange-100/50" 
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                    }`}
                  >
                    <span className={`text-lg ${isActive ? "opacity-100" : "opacity-50"}`}>
                      {item.icon}
                    </span>
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="mt-10 p-6 bg-gray-50 rounded-[32px] border border-gray-100">
        <p className="text-[10px] text-gray-400 font-bold leading-relaxed text-center">
          TMG AD Intelligence<br/>
          <span className="text-[#ff8533]">Premium v1.0.0</span>
        </p>
      </div>
    </aside>
  );
}