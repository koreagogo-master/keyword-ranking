// components/GoogleTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function GoogleTabs() {
  const pathname = usePathname();

  const tabs = [
    { name: '구글 키워드 분석', href: '/google-analysis' },
    { name: '유튜브 트렌드', href: '/youtube-trend' },
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
                ? 'border-[#5244e8] text-[#5244e8]'
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