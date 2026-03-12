import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-8">
        {/* 왼쪽: 사업자 필수 정보 영역 (PG 심사 기준 완벽 충족) */}
        <div>
          <h2 className="text-xl font-black text-gray-900 mb-4 font-title">TMG AD.</h2>
          <div className="text-[13px] text-gray-500 font-medium leading-relaxed space-y-1.5">
            <p>
              상호명: 주식회사 티엠지 <span className="text-gray-300 px-1">|</span> 대표자명: 배상호
            </p>
            <p>
              사업장 소재지: 서울특별시 금천구 가산디지털1로 128 stx-v 타워 904호
            </p>
            <p>
              사업자등록번호: 113-86-40578 <span className="text-gray-300 px-1">|</span> 통신판매업신고번호: 제2014-서울금천-0414호
            </p>
            <p>
              고객센터: 02-2201-1881 <span className="text-gray-300 px-1">|</span> 이메일: con@tmgst.com
            </p>
            <p className="pt-3 text-gray-400 text-xs">
              Copyright © 2026 TMGst. All rights reserved.
            </p>
          </div>
        </div>
        
        {/* 오른쪽: 이용약관 등 필수 링크 영역 */}
        <div className="flex gap-6 mt-2 md:mt-0">
          <Link href="/terms" className="text-[13px] font-bold text-gray-400 hover:text-gray-700 transition-colors">이용약관</Link>
          <Link href="/privacy" className="text-[13px] font-bold text-gray-400 hover:text-gray-700 transition-colors">개인정보처리방침</Link>
          <Link href="/contact" className="text-[13px] font-bold text-gray-400 hover:text-gray-700 transition-colors">고객센터</Link>
        </div>
      </div>
    </footer>
  );
}