'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { createClient } from '@/app/utils/supabase/client';
import Link from 'next/link';
// 🌟 불필요해진 Sidebar import 제거됨

interface MyInquiry {
  id: string;
  title: string;
  content: string;
  answer: string | null;
  status: string;
  created_at: string;
  answered_at: string | null;
}

export default function ContactPage() {
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [myInquiries, setMyInquiries] = useState<MyInquiry[]>([]);
  const [expandedMyInq, setExpandedMyInq] = useState<string | null>(null);

  const faqs = [
    { 
      q: "결제 후 환불 규정이 어떻게 되나요?", 
      a: "결제일로부터 7일 이내이며, 충전된 포인트를 전혀 사용하지 않은 경우에 한해 전액 결제 취소(환불)가 가능합니다. 포인트를 1P라도 사용하신 경우에는 데이터 제공 시스템 특성상 부분 취소 및 잔여 포인트 환불이 불가하오니 신중한 결제 부탁드립니다." 
    },
    { 
      q: "세금계산서나 현금영수증 발행이 가능한가요?", 
      a: "현재 저희 서비스는 '신용카드 결제'만 지원하고 있어 별도의 세금계산서 및 현금영수증은 발행되지 않습니다. 부가가치세법 제32조 2항에 따라 신용카드 매출전표가 세금계산서를 대체하여 매입세액 공제 및 지출증빙 효력을 갖습니다. 카드 전표는 결제 내역에서 확인하실 수 있습니다." 
    },
    { 
      q: "기능을 사용할 때 포인트는 어떻게 차감되나요?", 
      a: "키워드 정밀 분석, 순위 확인 등 각 기능을 조회하실 때마다 화면에 명시된 포인트가 즉시 차감됩니다. 단, 일시적인 시스템 오류나 포털 통신 지연으로 인해 분석 데이터를 정상적으로 제공받지 못한 경우에는 포인트가 차감되지 않으니 안심하세요." 
    },
    { 
      q: "결제한 포인트에 유효기간이 있나요?", 
      a: "유상으로 결제하신 포인트의 유효기간은 상법상 상사채권 소멸시효에 따라 결제일로부터 5년입니다. 단, 이벤트나 보상 등으로 무상 지급된 보너스 포인트는 지급일로부터 1년 후 자동 소멸됩니다." 
    },
    { 
      q: "포인트 충전 및 사용 내역은 어디서 확인하나요?", 
      a: "로그인 후 좌측 사이드바 메뉴 또는 우측 상단의 프로필을 클릭하여 '포인트 내역' 페이지로 이동하시면, 최근 충전 내역과 기능별 포인트 차감 내역을 상세하게 확인하실 수 있습니다." 
    }
  ];

  const fetchMyInquiries = async () => {
    if (!user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('inquiries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMyInquiries(data);
    }
  };

  useEffect(() => {
    fetchMyInquiries();
  }, [user]);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const toggleMyInq = (id: string) => {
    setExpandedMyInq(expandedMyInq === id ? null : id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert("제목과 내용을 모두 입력해주세요.");
      return;
    }
    if (!user) return;

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('inquiries').insert({
        user_id: user.id,
        title: title,
        content: content
      });

      if (error) throw error;

      alert("문의가 성공적으로 접수되었습니다. 빠르게 확인 후 답변해 드리겠습니다.");
      setTitle("");
      setContent("");
      fetchMyInquiries(); 
      
    } catch (error) {
      console.error(error);
      alert("문의 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 상세 보기용 날짜 포맷 (시간 포함)
  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // 리스트용 짧은 날짜 포맷 (년-월-일)
  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      
      {/* 🌟 ml-64 (사이드바 공간 비우기) 클래스를 제거하여 화면 전체를 사용하게 함 */}
      <div className="flex-1 py-16 px-6">
        <div className="max-w-4xl mx-auto mt-2">
          
          <div className="text-center mb-14">
            <h1 className="text-[22px] font-semibold text-gray-800 mb-2">고객센터</h1>
            <p className="text-[14px] text-gray-500">FAQ를 참고 하시고 추가로 궁금하신 사항이 있으면 1:1 문의를 이용 해 주세요.</p>
          </div>

          <div className="mb-14">
            <h2 className="text-[18px] font-semibold text-gray-800 mb-5 text-center">자주 묻는 질문 (FAQ)</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {faqs.map((faq, index) => (
                <div key={index} className="border-b border-gray-50 last:border-0">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-semibold text-gray-700 text-[15px]">Q. {faq.q}</span>
                    <span className={`text-gray-400 transition-transform duration-200 ${openFaq === index ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {openFaq === index && (
                    <div className="px-6 py-5 bg-slate-50 border-t border-gray-50 text-gray-600 leading-relaxed text-[14px]">
                      A. {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-14">
            <h2 className="text-[18px] font-semibold text-gray-800 mb-5 text-center">1:1 문의하기</h2>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              {user ? (
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div>
                    <label className="block text-[14px] font-semibold text-gray-700 mb-2">문의 제목</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="문의하실 내용의 제목을 입력해 주세요."
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#5244e8] focus:border-[#5244e8] outline-none transition-all text-[14px]"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-semibold text-gray-700 mb-2">문의 내용</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="빠르고 정확한 답변을 위해 문의 내용을 상세히 적어주세요. (최대 1000자)"
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#5244e8] focus:border-[#5244e8] outline-none transition-all text-[14px] h-48 resize-none"
                      maxLength={1000}
                    />
                  </div>
                  <div className="flex justify-center mt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-10 py-3 bg-[#5244e8] hover:bg-[#4035ba] text-white rounded-lg font-semibold transition-all shadow-sm disabled:bg-gray-300 w-full md:w-auto text-[15px]"
                    >
                      {isSubmitting ? "접수 중..." : "문의 접수하기"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-12">
                  <h3 className="text-[16px] font-semibold text-gray-800 mb-2">로그인이 필요한 서비스입니다</h3>
                  <p className="text-gray-500 mb-6 text-[14px]">고객님의 소중한 정보 보호와 정확한 답변을 위해<br/>1:1 문의는 로그인 후 이용하실 수 있습니다.</p>
                  <Link href="/login" className="inline-block px-8 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-semibold transition-all shadow-sm text-[14px]">
                    로그인하러 가기
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* 🌟 중단 3: 나의 문의 내역 */}
          {user && (
            <div className="mb-14">
              <h2 className="text-[18px] font-semibold text-gray-800 mb-5 text-center">나의 문의 내역</h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                
                {/* 🌟 리스트 컬럼 헤더 추가 */}
                <div className="flex items-center px-6 py-3 bg-gray-50 border-b border-gray-100 text-[13px] font-bold text-gray-500">
                  <div className="w-28 text-center shrink-0">작성일</div>
                  <div className="w-24 text-center shrink-0">상태</div>
                  <div className="flex-1 px-4 text-center">제  목</div>
                  <div className="w-6 shrink-0"></div>
                </div>

                {myInquiries.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-[14px]">
                    접수하신 문의 내역이 없습니다.
                  </div>
                ) : (
                  myInquiries.map((inq) => (
                    <div key={inq.id} className="border-b border-gray-50 last:border-0">
                      
                      {/* 🌟 리스트 항목 (날짜 -> 상태 -> 제목 -> 화살표 순서 정렬) */}
                      <button
                        onClick={() => toggleMyInq(inq.id)}
                        className="w-full px-6 py-4 text-left flex items-center hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-28 text-center text-gray-400 text-[13px] shrink-0 font-medium">
                          {formatShortDate(inq.created_at)}
                        </div>
                        
                        <div className="w-24 text-center shrink-0">
                          {inq.status === '대기중' ? (
                            <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-rose-50 text-rose-500 border border-rose-100">대기중</span>
                          ) : (
                            <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">답변완료</span>
                          )}
                        </div>

                        <div className="flex-1 px-4 font-semibold text-gray-700 text-[14px] truncate text-center">
                          {inq.title}
                        </div>
                        
                        <div className="w-6 shrink-0 text-right">
                          <span className={`inline-block text-gray-400 transition-transform duration-200 ${expandedMyInq === inq.id ? 'rotate-180' : ''}`}>▼</span>
                        </div>
                      </button>

                      {/* 펼쳐지는 상세 내용 */}
                      {expandedMyInq === inq.id && (
                        <div className="px-6 py-5 bg-slate-50 border-t border-gray-50 flex flex-col gap-4">
                          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm text-gray-600 text-[14px] leading-relaxed whitespace-pre-wrap">
                            <div className="font-bold mb-2 flex items-center justify-between">
                              <span className="text-gray-800">Q. 질문 내용</span>
                              <span className="text-[12px] text-gray-400 font-normal">{formatDateTime(inq.created_at)}</span>
                            </div>
                            {inq.content}
                          </div>
                          
                          {inq.answer ? (
                            <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 shadow-sm text-[#5244e8] text-[14px] leading-relaxed whitespace-pre-wrap">
                              <div className="font-bold mb-2 flex items-center justify-between">
                                <span>A. 관리자 답변</span>
                                <span className="text-[12px] text-[#5244e8]/60 font-normal">{formatDateTime(inq.answered_at!)}</span>
                              </div>
                              {inq.answer}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-[13px] text-gray-400 font-medium">
                              관리자가 내용을 확인하고 있습니다. 조금만 기다려 주세요!
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 text-center text-gray-500 text-[13px]">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-1.5">
              <span className="text-gray-600 font-semibold">전화 문의</span>
              <span>02-2201-1881</span> <span>(평일 10:00 ~ 16:00 / 점심시간 12:00 ~ 13:00)</span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-1.5">
              <span className="text-gray-600 font-semibold">이메일 문의</span>
              <span>con@tmgst.com</span> <span>(운영시간 외에는 이메일을 남겨주세요.)</span>
            </div>
          </div>

        </div>
      </div>
      
    </div>
  );
}