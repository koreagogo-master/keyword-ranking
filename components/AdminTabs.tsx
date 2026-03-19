'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminTabs() {
  const pathname = usePathname();

  const tabs = [
    { name: '종합 대시보드', href: '/admin' },
    { name: '회원 관리', href: '/admin/users' },
    { name: '포인트 설정', href: '/admin/points' },
    { name: '포인트 히스토리', href: '/admin/history' },
  ];

  return (
    // 🌟 대표님께서 세팅하신 중앙 정렬을 그대로 살렸습니다!
    <div className="flex justify-center border-b border-gray-200 mb-8 mt-4">
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