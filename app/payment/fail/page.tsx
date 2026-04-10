"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function FailContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "결제 진행 중 문제가 발생했습니다.";

  return (
    <div className="bg-white border border-gray-200 p-12 rounded-2xl w-full max-w-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>

      <div className="w-20 h-20 bg-red-50 border-4 border-red-100 !text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl font-bold mt-4">
        !
      </div>
      <h2 className="text-3xl font-bold !text-gray-900 mb-4">결제 실패</h2>
      <p className="!text-red-600 text-lg mb-10 bg-red-50 p-6 rounded-xl border border-red-100 inline-block font-medium">
        {message}
      </p>

      <button 
        onClick={() => window.location.href = '/'}
        className="w-full bg-gray-900 !text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition-colors text-lg shadow-md"
      >
        다시 시도하기
      </button>
    </div>
  );
}

export default function FailPage() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-20">
      <Suspense fallback={<div className="!text-gray-600 font-medium">정보를 불러오는 중입니다...</div>}>
        <FailContent />
      </Suspense>
    </main>
  );
}