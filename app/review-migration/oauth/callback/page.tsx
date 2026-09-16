import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "카페24 연결 준비 중",
};

// 카페24 OAuth 콜백 자리입니다.
// 이번 단계에서는 인증 코드를 읽거나 토큰을 교환하지 않고, 상태 안내만 표시합니다.
export default function ReviewMigrationOAuthCallbackPage() {
  return (
    <div className="flex min-h-screen bg-[#f8f9fa] !text-black antialiased tracking-tight">
      <main className="flex-1 min-w-0 lg:ml-64 p-4 sm:p-6 lg:p-10">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-10 text-center">
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
              <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
              </svg>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold !text-gray-900 mb-3">
              OAuth 연결 준비 중
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              카페24 연동 기능은 아직 준비 중입니다.
              <br />
              현재 이 페이지는 연결 통로 자리만 만들어 둔 상태이며, 인증 처리나 토큰 저장은 하지 않습니다.
            </p>

            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-left">
              <p className="text-[13px] font-bold text-gray-700 mb-1">다음 단계에서 할 일</p>
              <ul className="text-[13px] text-gray-500 leading-relaxed list-disc pl-5">
                <li>카페24 앱 인증(OAuth) 연결</li>
                <li>상품 매칭</li>
                <li>리뷰 등록</li>
              </ul>
            </div>

            <Link
              href="/review-migration"
              className="inline-block mt-7 px-6 py-3 bg-[#5244e8] hover:bg-blue-700 !text-white font-bold text-sm rounded-md transition-colors shadow-sm"
            >
              리뷰 이전 화면으로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
