'use client';

// 🌟 useRef 추가
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';


import AdminTabs from '@/components/AdminTabs';
import { createClient } from '@/app/utils/supabase/client';

interface Inquiry {
  id: string;
  no: number;
  user_id: string;
  title: string;
  content: string;
  answer: string | null;
  status: string;
  created_at: string;
  answered_at: string | null;
  user_email?: string;
}

export default function AdminCSPage() {
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  // 🌟 알림 중복 방지용 기억 장치
  const alertShown = useRef(false);

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🌟 철통 보안 로직 (1회만 알림)
  useEffect(() => {
    if (!isAuthLoading) {
      if (!user || profile?.role?.toLowerCase() !== 'admin') {
        if (!alertShown.current) {
          alert('접근 권한이 없습니다.');
          alertShown.current = true;
          router.replace('/'); 
        }
      }
    }
  }, [user, profile, isAuthLoading, router]);

  useEffect(() => {
    if (profile?.role?.toLowerCase() === 'admin') {
      fetchInquiries();
    }
  }, [profile?.role]);

  const fetchInquiries = async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: inquiryData, error: inquiryError } = await supabase
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false });

    if (inquiryError || !inquiryData) {
      console.error(inquiryError);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(inquiryData.map((item) => item.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    const combinedData = inquiryData.map((inq, idx) => {
      const profile = profilesData?.find((p) => p.id === inq.user_id);
      return { 
        ...inq, 
        no: inquiryData.length - idx, 
        user_email: profile?.email || '알 수 없는 사용자' 
      };
    });

    setInquiries(combinedData);
    setLoading(false);
  };

  const toggleRow = (id: string, currentAnswer: string | null) => {
    if (expandedId === id) {
      setExpandedId(null);
      setAnswerText('');
    } else {
      setExpandedId(id);
      setAnswerText(currentAnswer || ''); 
    }
  };

  const handleAnswerSubmit = async (inquiryId: string) => {
    if (!answerText.trim()) {
      alert('답변 내용을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/answer-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId, answerText }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? response.statusText);
      }

      const data = await response.json();
      const answeredAt = data.answered_at;

      alert('답변이 성공적으로 등록되었습니다.');

      window.dispatchEvent(new Event('inquiryAnswered'));

      setInquiries((prev) =>
        prev.map((inq) =>
          inq.id === inquiryId
            ? { ...inq, answer: answerText.trim(), status: '답변완료', answered_at: answeredAt }
            : inq
        )
      );
      setExpandedId(null);
      setAnswerText('');
    } catch (error) {
      console.error('답변 등록 오류:', error);
      alert('답변 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const pendingInquiries = inquiries.filter(inq => inq.status === '대기중');
  const completedInquiries = inquiries.filter(inq => inq.status === '답변완료');

  const renderTableRows = (list: Inquiry[], isPending: boolean) => {
    if (list.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="text-center py-10 text-slate-400 font-bold bg-slate-50/50">
            {isPending ? "미처리된 문의가 없습니다. 👏" : "답변 완료된 문의가 없습니다."}
          </td>
        </tr>
      );
    }

    return list.map((inq) => (
      <React.Fragment key={inq.id}>
        <tr 
          className={`transition-colors cursor-pointer ${expandedId === inq.id ? (isPending ? 'bg-rose-50/50' : 'bg-indigo-50/50') : 'hover:bg-slate-50'}`}
          onClick={() => toggleRow(inq.id, inq.answer)}
        >
          <td className="px-6 py-4 text-center text-slate-400 font-black text-[12px]">{inq.no}</td>
          <td className="px-6 py-4 text-center">
            {isPending ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-black bg-rose-100 text-rose-600 border border-rose-200 shadow-sm animate-pulse">
                대기중
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                답변완료
              </span>
            )}
          </td>
          <td className="px-6 py-4 text-slate-500 font-medium text-[13px]">{formatDate(inq.created_at)}</td>
          <td className="px-6 py-4 font-bold text-slate-800 truncate" title={inq.user_email}>{inq.user_email}</td>
          <td className="px-6 py-4 text-slate-800 font-bold truncate max-w-xs">{inq.title}</td>
          <td className="px-6 py-4 text-center">
            <button className="text-[12px] font-black !text-slate-900 hover:underline">
              {expandedId === inq.id ? '닫기 ▲' : '열기 ▼'}
            </button>
          </td>
        </tr>

        {expandedId === inq.id && (
          <tr className="bg-slate-50 border-b border-gray-200">
            <td colSpan={6} className="px-8 py-6">
              <div className="flex flex-col gap-6">
                
                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[12px] font-black">Q</span>
                    <h4 className="font-bold text-slate-800 text-[15px]">{inq.title}</h4>
                  </div>
                  <p className="text-slate-600 text-[14px] leading-relaxed whitespace-pre-wrap pl-8">{inq.content}</p>
                </div>

                <div className={`${isPending ? 'bg-rose-50 border-rose-100' : 'bg-indigo-50/50 border-indigo-100'} p-5 rounded-lg border shadow-sm`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-[12px] font-black ${isPending ? 'bg-rose-500' : 'bg-[#5244e8]'}`}>A</span>
                    <h4 className={`font-bold text-[15px] ${isPending ? 'text-rose-600' : 'text-[#5244e8]'}`}>
                      관리자 답변 {!isPending && <span className="text-[12px] text-slate-400 font-normal ml-2">({formatDate(inq.answered_at!)})</span>}
                    </h4>
                  </div>
                  
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="고객에게 전달할 답변을 입력해 주세요."
                    className="w-full px-4 py-3 rounded-md border border-slate-200 focus:ring-2 focus:ring-[#5244e8] outline-none transition-all text-[14px] h-32 resize-none bg-white mb-3 shadow-inner"
                  />
                  
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => toggleRow(inq.id, null)}
                      className="px-5 py-2 rounded-md font-bold text-slate-500 hover:bg-slate-200 transition-colors text-[13px]"
                    >
                      닫기
                    </button>
                    <button
                      onClick={() => handleAnswerSubmit(inq.id)}
                      disabled={isSubmitting}
                      className={`px-6 py-2 text-white rounded-md font-bold transition-all shadow-sm disabled:opacity-50 text-[13px] ${isPending ? 'bg-rose-500 hover:bg-rose-600' : 'bg-[#5244e8] hover:bg-[#4035ba]'}`}
                    >
                      {isSubmitting ? '등록 중...' : (isPending ? '답변 등록하기' : '답변 수정하기')}
                    </button>
                  </div>
                </div>

              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    ));
  };

  if (isAuthLoading) {
    return <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center font-bold text-slate-500">권한 확인 중...</div>;
  }
  if (!user || profile?.role?.toLowerCase() !== 'admin') {
    return null; 
  }

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />

      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        

        <main className="flex-1 ml-64 p-10 relative">
          <div className="max-w-[1200px] mx-auto">
            
            <AdminTabs />

            <div className="mb-10 relative max-w-[1200px] mx-auto text-center">
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">1:1 문의 관리</h1>
              <p className="text-sm text-slate-500">고객의 문의 사항을 확인하고 신속하게 답변을 등록할 수 있습니다.</p>
            </div>

            {loading ? (
              <div className="text-center py-20 text-slate-500 font-bold">데이터를 불러오는 중입니다...</div>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between ml-1">
                  <h3 className="text-[16px] font-black text-rose-600 flex items-center gap-2">
                    🚨 답변 대기 <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full text-[12px]">{pendingInquiries.length}</span>
                  </h3>
                </div>
                <div className="bg-white rounded-lg border-2 border-rose-200 overflow-hidden shadow-sm mb-12">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-rose-50/50 text-rose-700 text-[13px] uppercase tracking-wider font-bold border-b border-rose-200">
                      <tr>
                        <th className="px-6 py-3 w-16 text-center">No.</th>
                        <th className="px-6 py-3 w-32 text-center">상태</th>
                        <th className="px-6 py-3 w-48">작성일</th>
                        <th className="px-6 py-3 w-56">작성자 (이메일)</th>
                        <th className="px-6 py-3">문의 제목</th>
                        <th className="px-6 py-3 w-28 text-center">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[14px]">
                      {renderTableRows(pendingInquiries, true)}
                    </tbody>
                  </table>
                </div>

                <div className="mb-2 flex items-center justify-between ml-1">
                  <h3 className="text-[16px] font-extrabold text-slate-700 flex items-center gap-2">
                    ✅ 답변 완료 <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[12px]">{completedInquiries.length}</span>
                  </h3>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm mb-16 opacity-90">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100/50 text-slate-600 text-[13px] uppercase tracking-wider font-bold border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 w-16 text-center">No.</th>
                        <th className="px-6 py-3 w-32 text-center">상태</th>
                        <th className="px-6 py-3 w-48">작성일</th>
                        <th className="px-6 py-3 w-56">작성자 (이메일)</th>
                        <th className="px-6 py-3">문의 제목</th>
                        <th className="px-6 py-3 w-28 text-center">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[14px]">
                      {renderTableRows(completedInquiries, false)}
                    </tbody>
                  </table>
                </div>
              </>
            )}

          </div>
        </main>
      </div>
    </>
  );
}