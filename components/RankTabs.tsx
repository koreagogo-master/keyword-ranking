// components/RankTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function RankTabs() {
  const pathname = usePathname();

  // 🌟 [수정] 텍스트를 가장 직관적이고 짧게 압축했습니다.
  const tabs = [
    { name: '정밀 분석', href: '/analysis' },
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
    // 🌟 [수정] 스크롤바를 시각적으로 숨기면서 가로 스크롤은 가능하게 만드는 CSS 클래스 추가
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