'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SellerTabs() {
  const pathname = usePathname();

  // 탭 목록과 업무 흐름 순서 정의
  const tabs = [
    { name: '쇼핑 키워드 인사이트', href: '/shopping-insight' },
    { name: '쇼핑 상품명 최적화', href: '/seo-title' },
    { name: '상품 노출 순위 분석', href: '/shopping-rank' },
  ];

  return (
    <div className="flex border-b border-gray-200 mb-8 overflow-x-auto overflow-y-hidden">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] whitespace-nowrap ${
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