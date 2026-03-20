'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';

export default function AdminTabs() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    // 1. 처음 화면 켤 때 미처리 건수 가져오기
    const fetchPendingCount = async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from('inquiries')
        .select('*', { count: 'exact', head: true })
        .eq('status', '대기중');

      if (!error && count !== null) {
        setPendingCount(count);
      }
    };

    fetchPendingCount();

    // 🌟 2. 비밀 통신망 구축: CS 관리 페이지에서 '답변 달았어!'라는 신호를 보내면 숫자를 즉시 1개 뺍니다.
    const handleInquiryAnswered = () => {
      setPendingCount((prev) => Math.max(0, prev - 1));
    };

    window.addEventListener('inquiryAnswered', handleInquiryAnswered);

    // 컴포넌트가 꺼질 때 리스너 정리
    return () => {
      window.removeEventListener('inquiryAnswered', handleInquiryAnswered);
    };
  }, []);

  const tabs = [
    { name: '종합 대시보드', href: '/admin' },
    { name: '회원 관리', href: '/admin/users' },
    { name: '포인트 설정', href: '/admin/points' },
    { name: '포인트 히스토리', href: '/admin/history' },
    { name: '고객센터 관리', href: '/admin/cs', hasBadge: true },
    { name: '공지사항 관리', href: '/admin/notice' },
  ];

  return (
    <div className="flex justify-center border-b border-gray-200 mb-8 mt-4">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-8 py-3 text-sm font-bold transition-colors border-b-2 -mb-[2px] flex items-center ${
              isActive
                ? 'border-[#5244e8] text-[#5244e8]'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            {tab.name}
            
            {tab.hasBadge && pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-black text-white bg-rose-500 rounded-full shadow-sm px-1.5 transition-all">
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}