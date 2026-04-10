"use client";

import Sidebar from "@/components/Sidebar";
import AdminTabs from "@/components/AdminTabs";
import { useAuth } from "@/app/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/app/utils/supabase/client";

interface PaymentData {
  id: string;
  user_id: string;
  order_id: string;
  payment_key: string;
  plan_id: string;
  amount: number;
  status: string;
  method: string | null;
  receipt_url: string | null;
  created_at: string;
  profiles: {
    email: string;
  } | null;
}

export default function AdminPaymentsPage() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const alertShown = useRef(false);

  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [cancelingKey, setCancelingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) {
      if (!user || profile?.role?.toLowerCase() !== 'admin') {
        if (!alertShown.current) {
          alert('접근 권한이 없습니다.');
          alertShown.current = true;
          router.replace('/'); 
        }
      }
    }
  }, [user, profile, isLoading, router]);

  useEffect(() => {
    if (profile?.role?.toLowerCase() === 'admin') {
      fetchPayments();
    }
  }, [profile?.role]);

  const fetchPayments = async () => {
    setIsFetching(true);
    const supabase = createClient();
    
    try {
      const { data: payData, error: payError } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (payError) throw payError;

      const { data: profData, error: profError } = await supabase
        .from('profiles')
        .select('id, email');

      if (profError) throw profError;

      const combinedData = (payData || []).map((payment) => {
        const matchedProfile = (profData || []).find((p) => p.id === payment.user_id);
        return {
          ...payment,
          profiles: matchedProfile ? { email: matchedProfile.email } : null
        };
      });

      setPayments(combinedData as PaymentData[]);
    } catch (err) {
      console.error("결제 내역 조회 상세 에러:", err);
      alert("결제 내역을 불러오는데 실패했습니다.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleCancelPayment = async (payment: PaymentData) => {
    if (!confirm(`[${payment.profiles?.email || '고객'}]님의 ${payment.amount.toLocaleString()}원 결제를 정말 취소(환불)하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    const reason = prompt("환불 사유를 입력해주세요 (예: 고객 단순 변심, 서비스 불만족 등)");
    if (!reason) {
      alert("환불 사유를 입력해야 취소가 가능합니다.");
      return;
    }

    setCancelingKey(payment.payment_key);

    try {
      const response = await fetch('/api/payments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentKey: payment.payment_key,
          reason: reason
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '환불 처리 중 오류가 발생했습니다.');
      }

      alert("✅ 토스페이먼츠 환불 및 DB 취소 처리가 완료되었습니다.");
      fetchPayments(); 

    } catch (error: any) {
      alert(`❌ 환불 실패: ${error.message}`);
    } finally {
      setCancelingKey(null);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const filteredPayments = payments.filter((payment) => {
    const searchLower = searchTerm.toLowerCase();
    const matchEmail = payment.profiles?.email?.toLowerCase().includes(searchLower);
    const matchOrderId = payment.order_id.toLowerCase().includes(searchLower);
    return matchEmail || matchOrderId;
  });

  if (isLoading) return <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center font-bold text-slate-500">권한 확인 중...</div>;
  if (!user || profile?.role?.toLowerCase() !== 'admin') return null;

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        <Sidebar />
        
        <main className="flex-1 ml-64 p-10 relative">
          <div className="max-w-[1200px] mx-auto">
            
            <AdminTabs />

            <div className="mb-10 text-center relative max-w-xl mx-auto">
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">결제 및 매출 관리</h1>
              <p className="text-sm text-slate-500">고객들의 포인트 결제 내역을 확인하고 환불을 처리할 수 있습니다.</p>
            </div>

            <div className="flex items-center justify-between mb-3 ml-1">
              <h3 className="text-[15px] font-extrabold text-slate-800">전체 결제 내역</h3>
              
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="이메일 또는 주문번호 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-[13px] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all w-60"
                />
                <button 
                  onClick={fetchPayments} 
                  disabled={isFetching}
                  className="px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-900 transition-colors shadow-sm disabled:opacity-30 flex items-center gap-1.5"
                >
                  <span className="text-[12px] font-bold !text-white">{isFetching ? '불러오는 중...' : '새로고침'}</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm mb-16">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 text-[13px] uppercase tracking-wider font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 w-40">결제 일시</th>
                    <th className="px-6 py-4">사용자 이메일</th>
                    <th className="px-6 py-4">요금제 (주문번호)</th>
                    <th className="px-6 py-4 text-right w-32">결제 금액</th>
                    <th className="px-6 py-4 text-center w-28">상태</th>
                    <th className="px-6 py-4 text-center w-32">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[14px]">
                  {isFetching ? (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-500 font-bold">결제 데이터를 불러오는 중입니다...</td></tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-500 font-bold">검색된 결제 내역이 없습니다.</td></tr>
                  ) : (
                    filteredPayments.map((payment) => {
                      const isDone = payment.status === 'DONE';
                      const isCanceled = payment.status === 'CANCELED';
                      const isProcessing = cancelingKey === payment.payment_key;
                      
                      return (
                        <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-slate-500 font-medium text-[13px]">
                            {formatDateTime(payment.created_at)}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800">
                            {payment.profiles?.email || '알 수 없는 사용자'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-indigo-600 uppercase mb-0.5">{payment.plan_id}</div>
                            <div className="text-[11px] text-slate-400 font-mono tracking-tight">{payment.order_id}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`font-black text-[15px] ${isCanceled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                              {payment.amount.toLocaleString()} <span className="text-[12px] font-bold">원</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isDone && <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[12px] font-bold">결제완료</span>}
                            {isCanceled && <span className="inline-block px-2 py-1 bg-rose-100 text-rose-700 border border-rose-200 rounded text-[12px] font-bold">결제취소</span>}
                            {!isDone && !isCanceled && <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded text-[12px] font-bold">{payment.status}</span>}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isDone ? (
                              <button 
                                onClick={() => handleCancelPayment(payment)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 bg-white border border-rose-200 !text-rose-600 hover:bg-rose-50 rounded text-[12px] font-bold transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"
                              >
                                {isProcessing ? '처리중..' : '결제 취소'}
                              </button>
                            ) : (
                              <span className="text-slate-300 text-[12px] font-bold">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </main>
      </div>
    </>
  );
}