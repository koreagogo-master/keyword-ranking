// components/AdminTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminTabs() {
  const pathname = usePathname();

  const tabs = [
    { name: '대시보드 홈', href: '/admin' },
    { name: '포인트 단가 설정', href: '/admin/points' },
    { name: '유저 사용 히스토리', href: '/admin/history' },
  ];

  return (
    // 🌟 flex에 justify-center를 추가하여 화면 중앙에 고정되게 만들었습니다.
    <div className="flex justify-center border-b border-gray-200 mb-8">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-8 py-3 text-sm font-bold transition-colors border-b-2 -mb-[2px] ${
              isActive
                ? 'border-[#5244e8] text-[#5244e8]'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}