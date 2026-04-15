// components/HelpButton.tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';

interface HelpButtonProps {
  href?: string;       // 클릭 시 이동할 링크
  tooltip?: string;    // 마우스 올렸을 때 설명
}

export default function HelpButton({ href, tooltip }: HelpButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  // 🌟 나중에 아이콘을 바꾸고 싶다면 이 부분의 <svg>...</svg>만 교체하시면 됩니다!
  const Icon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const buttonContent = (
    <div
      // p-1과 rounded-full을 사용해 불필요한 옆 공간을 완전히 없애고 딱 붙게 만들었습니다.
      className="relative flex items-center justify-center p-1 text-slate-400 hover:text-[#5244e8] hover:bg-[#5244e8]/10 rounded-full transition-colors cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Icon />

      {tooltip && isHovered && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-xs px-2.5 py-1.5 bg-slate-800 text-white text-[12px] font-medium rounded-md shadow-lg z-50">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} target="_blank" rel="noopener noreferrer" className="inline-flex">
        {buttonContent}
      </Link>
    );
  }

  return buttonContent;
}