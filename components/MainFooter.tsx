// components/MainFooter.tsx
import Link from "next/link";

export default function MainFooter() {
  return (
    // 🌟 배경을 다크 슬레이트(bg-slate-900)로 변경하여 화면 하단에 묵직한 안정감을 줍니다.
    <footer className="bg-slate-900 py-12 px-6">
      <div className="max-w-[1200px] mx-auto flex flex-col items-center text-center">

        {/* 상호명 ~ 이메일 2줄 (어두운 배경에 맞춰 텍스트 색상을 밝은 슬레이트 톤으로 조정) */}
        <div className="text-[13px] text-slate-400 font-medium leading-tight space-y-1 mb-4">
          <p>
            서비스명: Ranking Pro <span className="text-slate-600 px-1.5">|</span> 상호명: 주식회사 티엠지 <span className="text-slate-600 px-1.5">|</span> 대표자명: 배상호 <span className="text-slate-600 px-1.5">|</span> 사업자등록번호: 113-86-40578 <span className="text-slate-600 px-1.5">|</span> 통신판매업신고번호: 제2014-서울금천-0414호
          </p>
          <p>
            사업장 소재지: 서울특별시 금천구 가산디지털1로 128 stx-v 타워 904호 <span className="text-slate-600 px-1.5">|</span> 고객센터: 02-2201-1881 <span className="text-slate-600 px-1.5">|</span> 이메일: con@tmgst.com
          </p>
        </div>

        {/* 이용약관 등 필수 링크 (기본은 밝은 회색, 마우스 오버 시 완전한 흰색으로 빛나도록 변경) */}
        <div className="flex items-center gap-4 mb-5">
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-slate-300 hover:text-white transition-colors">이용약관</Link>
          <span className="text-slate-600 text-xs">|</span>
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-slate-300 hover:text-white transition-colors">개인정보처리방침</Link>
          <span className="text-slate-600 text-xs">|</span>
          <Link href="/contact" target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-slate-300 hover:text-white transition-colors">고객센터</Link>
        </div>

        {/* Copyright */}
        <p className="text-slate-500 text-xs tracking-wider">
          Copyright © 2026 TMGst. All rights reserved.
        </p>

      </div>
    </footer>
  );
}