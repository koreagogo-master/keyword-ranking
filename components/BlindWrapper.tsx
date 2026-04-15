// components/BlindWrapper.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';

interface BlindWrapperProps {
  children: React.ReactNode;
  itemIndex: number; // 리스트의 몇 번째 아이템인지 번호
}

export default function BlindWrapper({ children, itemIndex }: BlindWrapperProps) {
  const { user, profile } = useAuth();

  // 1. 유료 회원이면 (포인트를 사용했거나 유료 등급이면) 무조건 다 보여줌
  const isPaidUser = profile?.grade && profile.grade !== 'free';
  
  // 💡 [핵심] 만약 이번 검색이 '포인트 차감'으로 이루어졌는지 체크하는 로직이 추가될 수 있습니다.
  // 지금은 일단 등급과 로그인 여부로만 구분합니다.
  if (isPaidUser) return <>{children}</>;

  // 2. 미가입자 (비로그인): 3개 초과 시 블라인드 (0, 1, 2번 인덱스만 허용)
  if (!user && itemIndex >= 3) {
    return (
      <div className="relative group cursor-not-allowed">
        <div className="blur-[5px] select-none pointer-events-none opacity-40">
          {children}
        </div>
        {itemIndex === 3 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/10">
            <Link href="/login" className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-lg hover:bg-indigo-700 transition-all">
              로그인하고 전체 보기 🔒
            </Link>
          </div>
        )}
      </div>
    );
  }

  // 3. 무료 가입 회원: 5개 초과 시 블라인드 (0~4번 인덱스만 허용)
  if (user && !isPaidUser && itemIndex >= 5) {
    return (
      <div className="relative group cursor-not-allowed">
        <div className="blur-[5px] select-none pointer-events-none opacity-40">
          {children}
        </div>
        {itemIndex === 5 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/10">
            <Link href="/charge" className="px-4 py-2 bg-[#5244e8] text-white text-xs font-bold rounded-full shadow-lg hover:bg-[#4035ba] transition-all">
              포인트 충전하고 전체 보기 💎
            </Link>
          </div>
        )}
      </div>
    );
  }

  // 4. 그 외(허용 범위 내)는 그냥 보여줌
  return <>{children}</>;
}