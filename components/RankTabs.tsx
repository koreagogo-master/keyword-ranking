// components/RankTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function RankTabs() {
  const pathname = usePathname();

  const tabs = [
    { name: '키워드 정밀 분석', href: '/analysis' },
    { name: '연관 키워드 조회', href: '/related-fast' },
    { name: 'N 모바일 블로그', href: '/blog-rank-b' },
    { name: 'N 모바일 지식인', href: '/kin-rank' },
    { name: 'N 모바일 통검 노출/순위 확인', href: '/blog-rank' },
    { name: '키워드별 조회수', href: '/keyword-volume' },
    { name: "키워드 생성기", href: "/keyword-generator" },
  ];

  return (
    <div className="flex border-b border-gray-200 mb-8 antialiased">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-6 py-3 text-sm transition-all duration-200 ease-in-out border-b-2 -mb-[2px] ${
              isActive
                ? 'border-[#5244e8] text-[#5244e8] font-semibold'
                : 'border-transparent text-gray-500 font-medium hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}