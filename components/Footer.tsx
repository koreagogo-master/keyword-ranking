import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <h2 className="text-xl font-black text-gray-900 mb-4 font-title">TMG AD.</h2>
          <p className="text-xs text-gray-400 font-medium leading-loose">
            주식회사 티엠지 | 서울특별시 금천구 가산디지털1로 128 stx-v 타워 904호 | 대표번호: 02-2201-1881<br/>
            Copyright © 2026 TMGst. All rights reserved.
          </p>
        </div>
        <div className="flex gap-8">
          <Link href="/terms" className="text-xs font-bold text-gray-400 hover:text-gray-600">이용약관</Link>
          <Link href="/privacy" className="text-xs font-bold text-gray-400 hover:text-gray-600">개인정보처리방침</Link>
          <Link href="/contact" className="text-xs font-bold text-gray-400 hover:text-gray-600">고객센터</Link>
        </div>
      </div>
    </footer>
  );
}