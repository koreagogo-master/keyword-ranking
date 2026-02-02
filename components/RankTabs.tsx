'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function RankTabs() {
  const pathname = usePathname();

  const tabs = [
    { name: '키워드 분석', href: '/analysis' },
    { name: '연관 검색어 분석', href: '/related' }, // ✅ 신규 추가
    { name: 'N 모바일 통검', href: '/blog-rank' },
    { name: 'N 모바일 블로그', href: '/blog-rank-b' },
    { name: 'N 지식인', href: '/kin-rank' },
  ];

  return (
    <div className="flex border-b border-gray-200 mb-8">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] ${
              isActive
                ? 'border-[#1a73e8] text-[#1a73e8]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}