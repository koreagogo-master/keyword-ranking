// components/AiTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AiTabs() {
  const pathname = usePathname();

  const tabs = [
    { name: '블로그 포스팅 AI', href: '/ai-blog' },
    { name: '언론보도 보도자료 AI', href: '/ai-press' },
    { name: '리뷰 답글 AI', href: '/review-ai' },
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
