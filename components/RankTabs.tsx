// components/RankTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function RankTabs() {
  const pathname = usePathname();

  // 🌟 [수정] 텍스트를 가장 직관적이고 짧게 압축했습니다.
  const tabs = [
    { name: '정밀 분석', href: '/analysis' },
    { name: '검색결과 구성', href: '/search-structure', badge: 'FREE' },
    { name: '연관 키워드', href: '/related-fast' },
    { name: '블로그 순위', href: '/blog-rank-b' },
    { name: '노출 진단', href: '/index-check' },
    { name: '지식인 순위', href: '/kin-rank' },
    { name: '통검 노출', href: '/blog-rank' },
    { name: '조회수 확인', href: '/keyword-volume' },
    { name: '키워드 생성', href: '/keyword-generator' },
    { name: '플레이스 순위', href: '/place-rank' },
  ];

  return (
    <div className="flex border-b border-gray-200 mb-8 antialiased overflow-x-auto whitespace-nowrap pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-5 py-3 text-[14px] transition-all duration-200 ease-in-out border-b-[3px] -mb-[1px] shrink-0 flex items-center gap-1 ${
              isActive
                ? 'border-[#5244e8] text-[#5244e8] font-bold'
                : 'border-transparent text-gray-500 font-medium hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            {tab.name}
            {tab.badge && (
              <span className="ml-0.5 rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 leading-tight whitespace-nowrap">
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}