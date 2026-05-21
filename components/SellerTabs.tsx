'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SellerTabs() {
  const pathname = usePathname();

  const tabs = [
    { name: '쇼핑 키워드 인사이트', href: '/shopping-insight' },
    { name: '쇼핑 상품명 최적화', href: '/seo-title' },
    { name: '내 상품명 진단', href: '/seo-check' },
    { name: '상품 노출 순위 분석', href: '/shopping-rank' },
    { name: '우편번호 대량 변환기', href: '/postcode-bulk' },
  ];

  return (
    <div className="flex border-b border-gray-200 mb-8 antialiased overflow-x-auto whitespace-nowrap pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-5 py-3 text-[14px] transition-all duration-200 ease-in-out border-b-[3px] -mb-[1px] shrink-0 ${
              isActive
                ? 'border-[#5244e8] text-[#5244e8] font-bold'
                : 'border-transparent text-gray-500 font-medium hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}