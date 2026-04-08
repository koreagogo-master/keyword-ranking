'use client';

import React, { useState } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';

import Sidebar from '@/components/Sidebar';


const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_pP2YxJ4K871G1QRB72BJVRGZwXLO';

const PLANS = [
  { id: 'starter', tag: 'STARTER', name: '스타터', price: 10000, points: 10000, bonus: '+0 P', desc: '개인 및 1인 셀러를 위한 플랜', ip: 'IP 1개 접속 가능', color: 'text-emerald-500', border: 'border-emerald-200' },
  { id: 'pro', tag: 'PRO', name: '프로', price: 30000, points: 36000, bonus: '+6,000 P', desc: '전문 마케터를 위한 베스트 플랜', ip: 'IP 1개 접속 가능', color: 'text-[#5244e8]', border: 'border-[#5244e8]', isPopular: true },
  { id: 'agency', tag: 'AGENCY', name: '에이전시', price: 50000, points: 60000, bonus: '+10,000 P', desc: '대행사 및 대용량 분석용 플랜', ip: 'IP 다중 접속 가능', color: 'text-purple-500', border: 'border-purple-200' },
];

export default function ChargePage() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 💡 수정된 부분 1: '카드'를 기본 결제 수단으로 설정
  const [payMethod, setPayMethod] = useState<'카드' | '계좌이체'>('카드');
  
  // 화면에 띄울 알림 메시지 상태
  const [toastMessage, setToastMessage] = useState('');

  const handlePayment = async (plan: typeof PLANS[0]) => {
    if (!user) {
      alert('로그인 후 결제가 가능합니다.');
      router.push('/login');
      return;
    }

    setIsProcessing(true);
    try {
      const tossPayments = await loadTossPayments(clientKey);
      const orderId = `ORDER_${new Date().getTime()}_${Math.random().toString(36).slice(2, 7)}`;

      await tossPayments.requestPayment(payMethod, {
        amount: plan.price,
        orderId: orderId,
        orderName: `Ranking Pro - ${plan.name} 포인트 충전`,
        customerName: profile?.email?.split('@')[0] || '고객',
        customerEmail: profile?.email || 'test@test.com',
        successUrl: `${window.location.origin}/mypage?pay_status=success&amount=${plan.price}`,
        failUrl: `${window.location.origin}/mypage?pay_status=fail`,
      });

    } catch (error: any) {
      const isCancel = error.code === 'USER_CANCEL' || error.code === 'PAY_PROCESS_CANCELED' || error.message?.includes('취소');
      
      if (isCancel) {
        setToastMessage('결제 진행이 취소되었습니다.');
        setTimeout(() => setToastMessage(''), 3000);
      } else {
        console.error('결제 에러:', error);
        alert('결제 진행 중 오류가 발생했습니다.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 font-bold text-gray-500">로딩 중...</div>;

  return (
    <div className="flex bg-gray-50 min-h-[calc(100vh-4rem)] relative">
      <Sidebar />
      
      {/* 알림 메시지 (토스트 창) UI */}
      {toastMessage && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] bg-white border-2 border-emerald-400 text-gray-700 px-8 py-4 rounded-2xl shadow-2xl font-medium transition-all duration-300 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          {toastMessage}
        </div>
      )}
      
      <div className="flex-1 ml-64 p-6 md:p-10">
        <div className="max-w-4xl mx-auto">

          <h1 className="text-2xl font-bold mb-2 text-gray-900 text-center">
            포인트 요금 충전
          </h1>
          <p className="text-center text-gray-500 font-medium mb-8 text-[15px]">
            원하시는 요금제를 선택해 결제를 진행해 보세요.
          </p>

          {/* 💡 수정된 부분 2, 3: 버튼 순서 변경 및 '심사중' 텍스트 삭제 */}
          <div className="flex justify-center mb-10">
            <div className="bg-gray-50 p-1.5 rounded-xl border border-gray-200 shadow-inner inline-flex gap-2">
              <button
                onClick={() => setPayMethod('카드')}
                className={`px-6 py-2.5 rounded-lg font-medium text-[15px] transition-all border ${
                  payMethod === '카드'
                    ? 'bg-[#5244e8] border-[#5244e8] !text-white shadow-md'
                    : 'bg-white border-gray-200 !text-gray-500 hover:!text-gray-800 hover:border-gray-300 shadow-sm'
                }`}
              >
                신용카드
              </button>
              
              <button
                onClick={() => setPayMethod('계좌이체')}
                className={`px-6 py-2.5 rounded-lg font-medium text-[15px] transition-all border ${
                  payMethod === '계좌이체'
                    ? 'bg-[#5244e8] border-[#5244e8] !text-white shadow-md'
                    : 'bg-white border-gray-200 !text-gray-500 hover:!text-gray-800 hover:border-gray-300 shadow-sm'
                }`}
              >
                계좌이체
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {PLANS.map((plan) => (
              <div key={plan.id} className={`relative bg-white rounded-2xl border-2 ${plan.border} p-10 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center`}>
                {plan.isPopular && (
                  <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 bg-[#5244e8] text-white text-[12px] font-bold px-4 py-1 rounded-full shadow-sm tracking-wide">
                    BEST PICK
                  </div>
                )}
                
                <span className="text-sm font-medium tracking-widest text-gray-400 mb-2">{plan.tag}</span>
                <h3 className="text-4xl font-bold text-gray-800 mb-4">{plan.name}</h3>
                
                <p className="text-[15px] text-gray-500 mb-6">{plan.desc}</p>
                
                <div className="mb-8 w-full">
                  <p className="flex items-baseline justify-center gap-1.5 text-5xl font-light text-gray-700 mb-3 tracking-tight">
                    {plan.points.toLocaleString()} <span className="text-lg font-medium tracking-wide">Point</span>
                  </p>
                  <p className="text-base text-gray-600 font-medium">
                    ₩ {plan.price.toLocaleString()} <span className={`${plan.color} ml-1 font-medium`}>({plan.bonus})</span>
                  </p>
                </div>

                <div className="mb-8">
                  <p className="text-lg text-gray-600 font-semibold">{plan.ip}</p>
                </div>

                <button 
                  onClick={() => handlePayment(plan)}
                  disabled={isProcessing}
                  className={`cursor-pointer mt-auto w-full py-4 rounded-xl font-medium text-white transition-all shadow-sm ${
                    isProcessing ? 'bg-gray-400 cursor-wait' :
                    plan.isPopular ? 'bg-[#5244e8] hover:bg-[#4336c9] hover:shadow-md' : 'bg-gray-800 hover:bg-gray-900'
                  }`}
                >
                  {isProcessing ? '진행 중...' : '결제하기'}
                </button>
              </div>
            ))}
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2.5 mb-6">
              <div className="w-1 h-5 bg-[#5244e8] rounded-sm"></div>
              결제 및 환불 유의사항
            </h2>
            <ul className="text-[14px] text-gray-600 space-y-3 font-medium pl-2">
              <li className="flex gap-2"><span className="text-gray-400">•</span> 결제 완료 시 포인트는 즉시 계정으로 지급되며, 모든 서비스(검색량 조회, 순위 확인 등)에 자유롭게 사용하실 수 있습니다.</li>
              <li className="flex gap-2"><span className="text-gray-400">•</span> 포인트 결제 후 7일 이내, 포인트를 전혀 사용하지 않은 상태에 한하여 전액 결제 취소(환불)가 가능합니다.</li>
              <li className="flex gap-2"><span className="text-gray-400">•</span> 1P라도 사용했거나 결제 후 7일이 경과한 경우, 그리고 프로모션으로 지급된 '보너스 포인트'는 환불 대상에서 제외됩니다.</li>
              <li className="flex gap-2"><span className="text-gray-400">•</span> 기타 결제 및 환불 관련 문의는 하단의 고객센터 이메일을 통해 접수해 주시면 영업일 기준 1~2일 내로 신속하게 안내해 드립니다.</li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}