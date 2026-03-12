// components/MainFooter.tsx
import Link from "next/link";

export default function MainFooter() {
  return (
    // 🌟 bg-white를 bg-gray-50으로 변경하고, 안정감을 위해 위아래 여백을 살짝 늘렸습니다(py-10).
    <footer className="bg-gray-50 py-10 px-6">
      <div className="max-w-[1200px] mx-auto flex flex-col items-center text-center">
        
        {/* 상호명 ~ 이메일 2줄 (배경색에 맞춰 구분선 | 색상을 gray-300으로 살짝 진하게 조정) */}
        <div className="text-[13px] text-gray-500 font-medium leading-tight space-y-1 mb-3">
          <p>
            상호명: 주식회사 티엠지 <span className="text-gray-300 px-1.5">|</span> 대표자명: 배상호 <span className="text-gray-300 px-1.5">|</span> 사업자등록번호: 113-86-40578 <span className="text-gray-300 px-1.5">|</span> 통신판매업신고번호: 제2014-서울금천-0414호
          </p>
          <p>
            사업장 소재지: 서울특별시 금천구 가산디지털1로 128 stx-v 타워 904호 <span className="text-gray-300 px-1.5">|</span> 고객센터: 02-2201-1881 <span className="text-gray-300 px-1.5">|</span> 이메일: con@tmgst.com
          </p>
        </div>

        {/* 이용약관 등 필수 링크 (기호 색상 gray-300으로 조정) */}
        <div className="flex items-center gap-4 mb-4">
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-gray-500 hover:text-gray-800 transition-colors">이용약관</Link>
          <span className="text-gray-300 text-xs">|</span>
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-gray-500 hover:text-gray-800 transition-colors">개인정보처리방침</Link>
          <span className="text-gray-300 text-xs">|</span>
          <Link href="/contact" target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-gray-500 hover:text-gray-800 transition-colors">고객센터</Link>
        </div>

        {/* Copyright (배경색에 맞춰 gray-400으로 가독성 확보) */}
        <p className="text-gray-400 text-xs tracking-wider">
          Copyright © 2026 TMGst. All rights reserved.
        </p>

      </div>
    </footer>
  );
}