// components/Footer.tsx
'use client'; 

import Link from "next/link";
import { usePathname } from "next/navigation"; 

export default function Footer() {
  const pathname = usePathname(); 

  // 🌟 메인 페이지('/')에서는 이 서브용 푸터를 렌더링하지 않고 숨깁니다!
  if (pathname === '/') return null;

  // 🌟 1. 사이드바가 없는 예외 페이지 목록 (Sidebar.tsx와 동일하게 맞춰줍니다)
  const noSidebarPaths = ['/terms', '/privacy'];
  
  // 🌟 2. 현재 주소가 예외 목록에 포함되는지 확인합니다.
  const isNoSidebar = noSidebarPaths.includes(pathname);

  return (
    // 🌟 3. 예외 페이지면 ml-0(여백 없음), 일반 도구 페이지면 ml-[255px](사이드바 너비만큼 여백) 적용
    <footer className={`bg-white py-8 px-6 transition-all duration-300 ${isNoSidebar ? 'ml-0' : 'ml-[255px]'}`}>
      <div className="max-w-[1200px] mx-auto flex flex-col items-center text-center">
        
        <div className="text-[13px] text-gray-400 font-normal leading-tight space-y-1 mb-3">
          <p>
            서비스명: Ranking Pro <span className="text-gray-300 px-1.5">|</span> 상호명: 주식회사 티엠지 <span className="text-gray-200 px-1.5">|</span> 대표자명: 배상호 <span className="text-gray-200 px-1.5">|</span> 사업자등록번호: 113-86-40578 <span className="text-gray-200 px-1.5">|</span> 통신판매업신고번호: 제2014-서울금천-0414호
          </p>
          <p>
            사업장 소재지: 서울특별시 금천구 가산디지털1로 128 stx-v 타워 904호 <span className="text-gray-200 px-1.5">|</span> 고객센터: 02-2201-1881 <span className="text-gray-200 px-1.5">|</span> 이메일: con@tmgst.com
          </p>
        </div>

        <div className="flex items-center gap-4 mb-3">
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-gray-500 hover:text-gray-800 transition-colors">이용약관</Link>
          <span className="text-gray-200 text-xs">|</span>
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-gray-500 hover:text-gray-800 transition-colors">개인정보처리방침</Link>
          <span className="text-gray-200 text-xs">|</span>
          <Link href="/contact" rel="noopener noreferrer" className="text-[13px] font-medium text-gray-500 hover:text-gray-800 transition-colors">고객센터</Link>
        </div>

        <p className="text-gray-300 text-xs tracking-wider">
          Copyright © 2026 TMGst. All rights reserved.
        </p>

      </div>
    </footer>
  );
}