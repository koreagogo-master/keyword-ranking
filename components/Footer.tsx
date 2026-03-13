// components/Footer.tsx
'use client'; // 👈 1. 추가: 경로를 읽기 위해 클라이언트 모드로 설정

import Link from "next/link";
import { usePathname } from "next/navigation"; // 👈 2. 추가: 현재 페이지 경로를 읽는 도구 불러오기

export default function Footer() {
  const pathname = usePathname(); // 👈 3. 추가: 현재 경로 확인

  // 🌟 메인 페이지('/')에서는 이 서브용 푸터를 렌더링하지 않고 숨깁니다!
  if (pathname === '/') return null;

  return (
    <footer className="bg-white py-8 px-6">
      <div className="max-w-[1200px] mx-auto flex flex-col items-center text-center">
        
        {/* 💡 텍스트 굵기를 font-medium -> font-normal 로 낮춤 */}
        <div className="text-[13px] text-gray-400 font-normal leading-tight space-y-1 mb-3">
          <p>
            서비스명: Ranking Pro <span className="text-gray-300 px-1.5">|</span> 상호명: 주식회사 티엠지 <span className="text-gray-200 px-1.5">|</span> 대표자명: 배상호 <span className="text-gray-200 px-1.5">|</span> 사업자등록번호: 113-86-40578 <span className="text-gray-200 px-1.5">|</span> 통신판매업신고번호: 제2014-서울금천-0414호
          </p>
          <p>
            사업장 소재지: 서울특별시 금천구 가산디지털1로 128 stx-v 타워 904호 <span className="text-gray-200 px-1.5">|</span> 고객센터: 02-2201-1881 <span className="text-gray-200 px-1.5">|</span> 이메일: con@tmgst.com
          </p>
        </div>

        <div className="flex items-center gap-4 mb-3">
          {/* 💡 링크 텍스트 굵기를 font-bold -> font-medium 으로 낮춤 */}
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-gray-500 hover:text-gray-800 transition-colors">이용약관</Link>
          <span className="text-gray-200 text-xs">|</span>
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-gray-500 hover:text-gray-800 transition-colors">개인정보처리방침</Link>
          <span className="text-gray-200 text-xs">|</span>
          <Link href="/contact" target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-gray-500 hover:text-gray-800 transition-colors">고객센터</Link>
        </div>

        <p className="text-gray-300 text-xs tracking-wider">
          Copyright © 2026 TMGst. All rights reserved.
        </p>

      </div>
    </footer>
  );
}