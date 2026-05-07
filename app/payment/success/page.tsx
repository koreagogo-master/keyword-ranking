"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useAuth } from "@/app/contexts/AuthContext"; // 💡 로그인 정보 가져오기

function ReceiptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useAuth(); // 💡 현재 로그인한 유저 정보 꺼내기
  
  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId");
  const amount = searchParams.get("amount");

  const [status, setStatus] = useState<'loading' | 'success' | 'fail'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // 1. 정보가 로딩 중이면 대기
    if (!paymentKey || !orderId || !amount || isLoading) return;

    // 2. 로그인 정보가 없으면 에러 처리
    if (!user) {
      setErrorMessage('로그인 정보가 필요합니다.');
      setStatus('fail');
      return;
    }

    const confirmPayment = async () => {
      try {
        const response = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // 💡 핵심: 백엔드로 userId 를 함께 넘겨줍니다!
          body: JSON.stringify({ paymentKey, orderId, amount, userId: user.id }),
        });

        const data = await response.json();

        if (response.ok) {
          // 🌟 결제 성공 시 잔여 포인트 알림 상태 초기화
          if (typeof window !== 'undefined') {
            localStorage.removeItem('point_alert_shown_500');
            localStorage.removeItem('point_alert_shown_1000');
          }
          setStatus('success'); 
        } else {
          setStatus('fail');
          setErrorMessage(data.message || '결제 승인에 실패했습니다.');
        }
      } catch (error) {
        setStatus('fail');
        setErrorMessage('서버 통신 오류로 결제 승인에 실패했습니다.');
      }
    };

    confirmPayment();
  }, [paymentKey, orderId, amount, user, isLoading]);

  if (status === 'loading') {
    return (
      <div className="bg-white border border-gray-200 p-12 rounded-2xl w-full max-w-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] text-center">
         <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
         <h2 className="text-2xl font-bold !text-gray-900 mb-4">안전하게 결제를 승인하고 있습니다...</h2>
         <p className="!text-gray-500 font-medium">창을 닫지 말고 잠시만 기다려 주세요.</p>
      </div>
    );
  }

  if (status === 'fail') {
    return (
      <div className="bg-white border border-gray-200 p-12 rounded-2xl w-full max-w-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] text-center">
         <div className="w-20 h-20 bg-red-50 border-4 border-red-100 !text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl font-bold">!</div>
         <h2 className="text-3xl font-bold !text-gray-900 mb-4">최종 승인 실패</h2>
         <p className="!text-red-600 font-medium mb-8 bg-red-50 p-4 rounded-xl">{errorMessage}</p>
         <button onClick={() => router.push('/charge')} className="w-full bg-gray-900 !text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition-colors text-lg shadow-md">요금제로 돌아가기</button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 p-12 rounded-2xl w-full max-w-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
      <div className="text-center mb-10 mt-4">
        <div className="w-20 h-20 bg-blue-50 border-4 border-blue-100 !text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">✓</div>
        <h2 className="text-3xl font-bold !text-gray-900 mb-3">결제가 정상적으로 완료되었습니다</h2>
        <p className="!text-gray-500 text-lg">TMGad 서비스를 이용해 주셔서 감사합니다.</p>
      </div>
      <div className="bg-gray-50 rounded-xl p-8 space-y-4 border border-gray-100">
        <div className="flex justify-between items-center text-lg border-b border-gray-200 pb-4 mb-4">
          <span className="!text-gray-500 font-medium">주문번호</span>
          <span className="!text-gray-900 font-mono font-semibold">{orderId}</span>
        </div>
        <div className="flex justify-between items-center text-lg">
          <span className="!text-gray-500 font-medium">총 결제금액</span>
          <span className="!text-blue-600 font-extrabold text-2xl">{Number(amount).toLocaleString()}원</span>
        </div>
      </div>
      <button onClick={() => router.push('/')} className="w-full mt-10 bg-gray-900 !text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition-colors text-lg shadow-md">
        서비스로 돌아가기
      </button>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-20">
      <Suspense fallback={<div className="!text-gray-600 font-medium">로딩 중...</div>}>
        <ReceiptContent />
      </Suspense>
    </main>
  );
}