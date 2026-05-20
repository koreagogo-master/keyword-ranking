'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GuestLimitModal() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('show-guest-limit-modal', handler);
    return () => window.removeEventListener('show-guest-limit-modal', handler);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed top-16 left-64 right-0 bottom-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 flex flex-col items-center">
        {/* X 닫기 버튼 */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 !text-gray-400 hover:!text-gray-800 transition-colors bg-transparent border-none p-1 rounded-full hover:bg-gray-100"
          aria-label="닫기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 아이콘 */}
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 !text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* 제목 */}
        <h2 className="text-xl font-black !text-gray-900 mb-3 text-center">
          오늘의 무료 체험을 모두 사용했습니다
        </h2>

        {/* 본문 */}
        <div className="text-sm !text-gray-500 text-center leading-relaxed mb-7 space-y-3">
          <p>
            비로그인 상태에서는 하루 1회까지<br />
            무료로 검색을 체험할 수 있습니다.
          </p>
          <p>
            회원가입하면 매일 5회<br />
            무료 검색을 사용할 수 있습니다.
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex flex-col w-full gap-3">
          <button
            onClick={() => { setIsOpen(false); router.push('/login'); }}
            className="w-full py-3 bg-[#5244e8] rounded-lg font-bold !text-white hover:bg-[#4336c9] transition-colors"
          >
            로그인하기
          </button>
          <button
            onClick={() => { setIsOpen(false); router.push('/signup'); }}
            className="w-full py-3 bg-white border-2 border-[#5244e8] rounded-lg font-bold !text-[#5244e8] hover:bg-indigo-50 transition-colors"
          >
            무료 회원가입
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-2 !text-gray-400 hover:!text-gray-600 text-sm font-medium transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
