// components/RankTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function RankTabs() {
  const pathname = usePathname();

  const tabs = [
    { name: 'N 모바일 통검', path: '/blog-rank' },
    { name: 'N 모바일 블로그탭', path: '/blog-rank-b' },
    { name: 'N 모바일 지식인탭', path: '/kin-rank' },
  ];

  return (
    <div className="flex space-x-2 mb-8 border-b border-gray-700 pb-1">
      {tabs.map((tab) => {
        // 현재 주소와 탭의 주소가 같으면 '활성화된 스타일' 적용
        const isActive = pathname === tab.path;
        
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors duration-200 
              ${isActive 
                ? 'bg-blue-600 text-white border-b-2 border-blue-400' // 활성화 상태
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200' // 비활성화 상태
              }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}