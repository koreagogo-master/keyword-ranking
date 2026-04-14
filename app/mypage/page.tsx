'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";

import { createClient } from "@/app/utils/supabase/client";

const PAGE_META: Record<string, string> = {
  'SIGNUP': '신규 가입 축하 보너스',
  'ANALYSIS': '키워드 정밀 분석',
  'RELATED': '연관 키워드 조회',
  'BLOG': '블로그 순위 확인',
  'JISIKIN': '지식인 순위 확인',
  'TOTAL': '통검 노출/순위 확인',
  'GOOGLE': '구글 키워드 분석',
  'YOUTUBE': '유튜브 트렌드',
  'SHOPPING': '쇼핑 인사이트',
  'SEO_TITLE': '쇼핑 상품명 최적화',
  'SHOPPING_RANK': '상품 노출 순위 분석',
  'MANUAL': '관리자 조정 포인트',
  'CHARGE': '포인트 자동 충전',
  'AI_BLOG': 'Dual AI 포스팅',
  'AI_PRESS': 'AI 언론 보도자료',
  'INDEX_CHECK': '블로그 노출 진단'
};

const getPastDate = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split('T')[0];
};
const getToday = () => new Date().toISOString().split('T')[0];

function MyPageContent() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();

  // 🌟 결제 데이터 낚아채기 추가
  const searchParams = useSearchParams();
  const paymentKey = searchParams.get('paymentKey');
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');

  const [activeTab, setActiveTab] = useState<'ALL' | 'CHARGE' | 'USE'>('ALL');

  const [filterMonths, setFilterMonths] = useState<number>(1);
  const [startDate, setStartDate] = useState(getPastDate(1));
  const [endDate, setEndDate] = useState(getToday());
  const [searchTrigger, setSearchTrigger] = useState(0);

  const [history, setHistory] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  // 🌟 방어막 깃발 추가
  const isProcessingRef = useRef(false);

  // 🌟 여기서부터 추가: 결제 승인 및 포인트 자동 지급 로직
  useEffect(() => {
    if (paymentKey && orderId && amount && user && profile) {
      // 이미 처리 중이면 두 번 실행하지 않고 바로 종료
      if (isProcessingRef.current) return;
      isProcessingRef.current = true; // 문 잠그기

      processPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentKey, orderId, amount, user, profile]);

  const processPayment = async () => {
    const supabase = createClient();
    
    // 🌟 수정 1: single()을 maybeSingle()로 변경하여 406 에러(경고) 해결
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (existingPayment) {
      router.replace('/mypage'); 
      return;
    }

    try {
      const res = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) })
      });
      const result = await res.json();

      if (result.success) {
        let pointsToAdd = 0;
        let planId = '';
        if (Number(amount) === 10000) { pointsToAdd = 10000; planId = 'starter'; }
        else if (Number(amount) === 30000) { pointsToAdd = 36000; planId = 'pro'; }
        else if (Number(amount) === 50000) { pointsToAdd = 60000; planId = 'agency'; }

        if (pointsToAdd > 0) {
          await supabase.from('payments').insert({
            user_id: user.id,
            order_id: orderId,
            payment_key: paymentKey,
            plan_id: planId,
            amount: Number(amount),
            status: 'DONE',
          });

          const newPoints = (profile.purchased_points || 0) + pointsToAdd;
          await supabase.from('profiles').update({
            purchased_points: newPoints,
            grade: planId
          }).eq('id', user.id);

          // 🌟 수정 2: change_type: '충전' 이라는 필수 값을 추가하여 에러 완벽 해결!
          const { error: historyError } = await supabase.from('point_history').insert({
            user_id: user.id,
            change_amount: pointsToAdd,
            page_type: 'CHARGE',
            change_type: '충전', 
            description: `${planId.toUpperCase()} 요금제`
          });

          if (historyError) {
            console.error('내역 저장 에러:', historyError);
            alert(`내역 기록 실패 원인: ${historyError.message}`); 
          } else {
            alert('결제가 성공적으로 완료되어 포인트가 지급되었습니다!');
            window.location.href = '/mypage'; 
          }
        }
      } else {
        alert(`결제 승인 실패: ${result.message}`);
        router.replace('/mypage');
      }
    } catch (err) {
      console.error(err);
      alert('결제 처리 중 서버와 연결이 끊어졌습니다.');
      router.replace('/mypage');
    }
  };
  // 🌟 여기까지 추가 완료

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user && profile) {
      fetchUserHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, currentPage, searchTrigger]);

  const fetchUserHistory = async () => {
    setLoadingHistory(true);
    const supabase = createClient();

    let countQuery = supabase.from('point_history').select('*', { count: 'exact', head: true }).eq('user_id', user?.id);
    if (startDate) countQuery = countQuery.gte('created_at', `${startDate}T00:00:00`);
    if (endDate) countQuery = countQuery.lte('created_at', `${endDate}T23:59:59`);
    if (activeTab === 'CHARGE') countQuery = countQuery.gt('change_amount', 0);
    if (activeTab === 'USE') countQuery = countQuery.lt('change_amount', 0);

    const { count } = await countQuery;
    setTotalCount(count || 0);

    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;

    let dataQuery = supabase.from('point_history').select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (startDate) dataQuery = dataQuery.gte('created_at', `${startDate}T00:00:00`);
    if (endDate) dataQuery = dataQuery.lte('created_at', `${endDate}T23:59:59`);
    if (activeTab === 'CHARGE') dataQuery = dataQuery.gt('change_amount', 0);
    if (activeTab === 'USE') dataQuery = dataQuery.lt('change_amount', 0);

    const { data } = await dataQuery;

    if (data && data.length > 0 && profile) {
      let pageStartBalance = (profile.purchased_points || 0) + (profile.bonus_points || 0);
      const firstItemDate = data[0].created_at;

      const { data: newerChanges } = await supabase
        .from('point_history')
        .select('change_amount')
        .eq('user_id', user?.id)
        .gt('created_at', firstItemDate);

      const sumNewer = newerChanges?.reduce((acc, curr) => acc + curr.change_amount, 0) || 0;
      pageStartBalance -= sumNewer;

      const historyWithBalance = data.map((item) => {
        let displayBalance = 0;
        if (activeTab === 'ALL') {
          displayBalance = pageStartBalance;
          pageStartBalance -= item.change_amount;
        }
        return { ...item, running_balance: displayBalance };
      });
      setHistory(historyWithBalance);
    } else {
      setHistory([]);
    }
    setLoadingHistory(false);
  };

  const handleTabChange = (tab: 'ALL' | 'CHARGE' | 'USE') => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchTrigger(prev => prev + 1);
  };

  const handleFilterChange = (months: number) => {
    setFilterMonths(months);
    setStartDate(getPastDate(months));
    setEndDate(getToday());
    setCurrentPage(1);
    setSearchTrigger(prev => prev + 1);
  };

  const handleManualSearch = () => {
    setCurrentPage(1);
    setSearchTrigger(prev => prev + 1);
  };

  const handleOpenMemo = () => {
    window.dispatchEvent(new Event('open-memo-sidebar'));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "정보 없음";
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const handleWithdraw = async () => {
    const isConfirm = window.confirm("정말로 탈퇴하시겠습니까? 탈퇴 시 서비스 이용이 제한됩니다.");
    if (!isConfirm) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (error) {
        console.error("탈퇴 처리 중 오류 발생:", error);
        alert("탈퇴 처리 중 문제가 발생했습니다. 다시 시도해주세요.");
        return;
      }

      await supabase.auth.signOut();
      alert("성공적으로 탈퇴 처리되었습니다. 그동안 이용해주셔서 감사합니다.");
      router.push("/");

    } catch (err) {
      console.error(err);
      alert("오류가 발생했습니다.");
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-gray-500 font-bold">내 정보를 불러오는 중입니다...</span>
      </div>
    );
  }

  const totalPoints = (profile?.bonus_points || 0) + (profile?.purchased_points || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  return (
    <div className="flex bg-gray-50 min-h-[calc(100vh-4rem)]">
      
      <div className="flex-1 ml-64 p-6 md:p-10">
        <div className="max-w-4xl mx-auto">

          {/* 🌟 1. 타이틀 수정: text-center 추가 */}
          <h1 className="text-2xl font-bold mb-6 text-gray-900 text-center">
            마이페이지
          </h1>

          {/* 기본 정보 */}
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm mb-6">
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2.5 mb-6">
                <div className="w-1 h-5 bg-[#5244e8] rounded-sm"></div>
                기본 정보
              </h2>
              <div className="flex items-center">
                <label className="text-gray-500 text-sm font-semibold w-28">ID (이메일)</label>
                <p className="text-base font-medium text-gray-900">{profile.email}</p>
              </div>
              <div className="flex items-center">
                <label className="text-gray-500 text-sm font-semibold w-28">내 등급</label>
                <span className={`text-base font-bold uppercase ${profile.grade === 'agency' ? 'text-purple-600' :
                  profile.grade === 'pro' ? 'text-blue-600' :
                    profile.grade === 'starter' ? 'text-green-600' :
                      'text-gray-600'
                  }`}>
                  {profile.grade || 'FREE'}
                </span>
              </div>
              <div className="flex items-center gap-8 pt-4 mt-2 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <label className="text-gray-400 text-sm font-semibold">가입일</label>
                  <p className="text-sm text-gray-700">{formatDate(user?.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-gray-400 text-sm font-semibold">최근 접속일</label>
                  <p className="text-sm text-gray-700">{formatDate(profile?.last_login_at || user?.last_sign_in_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 포인트 잔액 정보 */}
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2.5 mb-6">
              <div className="w-1 h-5 bg-[#5244e8] rounded-sm"></div>
              포인트 및 결제
            </h2>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 bg-[#5244e8]/5 border border-[#5244e8]/20 rounded-xl p-6 flex flex-col items-center justify-center">
                <span className="text-sm font-bold text-gray-500 mb-2">총 사용 가능 포인트</span>
                <div className="text-3xl font-bold text-[#5244e8]">
                  {totalPoints.toLocaleString()} <span className="text-lg font-bold ml-0.5">P</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center gap-3">
                <div className="flex justify-between items-center px-2">
                  <span className="text-sm font-semibold text-gray-600">결제한 포인트</span>
                  <span className="text-[15px] font-semibold text-gray-700">{profile?.purchased_points?.toLocaleString() || 0} P</span>
                </div>
                <div className="flex justify-between items-center px-2">
                  <span className="text-sm font-semibold text-green-600">보너스 포인트</span>
                  <span className="text-[15px] font-semibold text-green-600">{profile?.bonus_points?.toLocaleString() || 0} P</span>
                </div>
                <div className="w-full h-px bg-gray-100 my-2"></div>

                <button
                  onClick={() => router.push('/charge')}
                  className="cursor-pointer w-full py-3 bg-[#5244e8] hover:bg-[#4336c9] text-white rounded-xl text-[14px] font-bold transition-colors shadow-sm flex items-center justify-center gap-2 mt-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  포인트 충전하기
                </button>
              </div>
            </div>
          </div>

          {/* 포인트 이용 내역 */}
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2.5 mb-5">
              <div className="w-1 h-5 bg-[#5244e8] rounded-sm"></div>
              포인트 이용 내역
            </h2>

            {/* 🌟 2. 탭 영역 수정 */}
            <div className="flex justify-center border-b border-gray-200 mb-6 relative">
              <button
                onClick={() => handleTabChange('ALL')}
                className={`pb-3 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'ALL' ? 'border-[#5244e8] !text-[#5244e8]' : 'border-transparent !text-slate-600 hover:!text-gray-800'
                  }`}
              >
                전체 내역
              </button>
              <button
                onClick={() => handleTabChange('CHARGE')}
                className={`pb-3 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'CHARGE' ? 'border-[#5244e8] !text-[#5244e8]' : 'border-transparent !text-slate-600 hover:!text-gray-800'
                  }`}
              >
                충전 내역 (+)
              </button>
              <button
                onClick={() => handleTabChange('USE')}
                className={`pb-3 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'USE' ? 'border-[#5244e8] !text-[#5244e8]' : 'border-transparent !text-slate-600 hover:!text-gray-800'
                  }`}
              >
                사용 내역 (-)
              </button>
            </div>

            {/* 날짜 필터 영역 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2">
                <button onClick={() => handleFilterChange(1)} className={`px-4 py-1.5 text-[12px] font-bold rounded-md border transition-colors ${filterMonths === 1 ? 'bg-indigo-600 !text-white border-indigo-600' : 'bg-white !text-gray-600 border-gray-200 hover:bg-gray-50'}`}>1개월</button>
                <button onClick={() => handleFilterChange(3)} className={`px-4 py-1.5 text-[12px] font-bold rounded-md border transition-colors ${filterMonths === 3 ? 'bg-indigo-600 !text-white border-indigo-600' : 'bg-white !text-gray-600 border-gray-200 hover:bg-gray-50'}`}>3개월</button>
                <button onClick={() => handleFilterChange(6)} className={`px-4 py-1.5 text-[12px] font-bold rounded-md border transition-colors ${filterMonths === 6 ? 'bg-indigo-600 !text-white border-indigo-600' : 'bg-white !text-gray-600 border-gray-200 hover:bg-gray-50'}`}>6개월</button>
              </div>
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setFilterMonths(0); }} className="border border-gray-300 rounded-md px-3 py-1.5 text-[12px] font-medium text-gray-700 outline-none focus:border-indigo-500" />
                <span className="text-gray-400 font-bold">~</span>
                <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setFilterMonths(0); }} className="border border-gray-300 rounded-md px-3 py-1.5 text-[12px] font-medium text-gray-700 outline-none focus:border-indigo-500" />
                <button onClick={handleManualSearch} className="bg-slate-700 hover:bg-slate-800 !text-white px-4 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-sm">
                  조회
                </button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden min-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 text-[13px] font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3.5 text-center w-20">유형</th>
                    <th className="px-5 py-3.5">상세 내용</th>
                    <th className="px-5 py-3.5 w-[180px] text-center">이용 일시</th>
                    <th className="px-5 py-3.5 text-right w-28">포인트</th>
                    {activeTab === 'ALL' && <th className="px-5 py-3.5 text-right w-28 bg-slate-100/50">잔여</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[14px]">
                  {loadingHistory ? (
                    <tr><td colSpan={activeTab === 'ALL' ? 5 : 4} className="text-center py-10 text-slate-500 font-medium">이용 내역을 불러오는 중입니다...</td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan={activeTab === 'ALL' ? 5 : 4} className="text-center py-10 text-slate-500 font-medium">해당 내역이 없습니다.</td></tr>
                  ) : (
                    history.map((item) => {
                      const isUse = item.change_amount < 0;
                      const isSignup = item.page_type === 'SIGNUP';
                      const displayPage = PAGE_META[item.page_type] || item.page_type;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-2 text-center">
                            <span className={`inline-block px-2 py-1 rounded-md text-[11px] font-bold border
                              ${isSignup ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                isUse ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                  'bg-indigo-50 text-indigo-600 border-indigo-200'}
                            `}>
                              {isSignup ? '가입' : isUse ? '사용' : '충전'}
                            </span>
                          </td>
                          <td className="px-5 py-2">
                            <div className="font-bold text-slate-800 text-[13px]">{displayPage}</div>
                            {item.description && item.page_type !== 'SIGNUP' && (
                              <div className="text-[12px] text-slate-500 mt-0.5">{item.description}</div>
                            )}
                          </td>
                          <td className="px-5 py-2 text-slate-500 text-[12px] text-center font-medium">
                            {formatDate(item.created_at)}
                          </td>
                          <td className="px-5 py-2 text-right">
                            <span className={`font-bold text-[14px] ${isUse ? 'text-rose-600' : 'text-indigo-600'}`}>
                              {isUse ? '' : '+'}{item.change_amount.toLocaleString()}
                            </span>
                          </td>
                          {activeTab === 'ALL' && (
                            <td className="px-5 py-2 text-right bg-slate-50/50 font-bold text-slate-600 text-[13px]">
                              {item.running_balance.toLocaleString()}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {!loadingHistory && totalCount > 0 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded border border-gray-200 bg-white !text-slate-600 text-[13px] font-bold disabled:opacity-30 hover:bg-slate-50 transition-colors"
                >
                  이전
                </button>
                <span className="text-[13px] font-bold text-slate-500 px-3">
                  <span className="text-[#5244e8]">{currentPage}</span> / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded border border-gray-200 bg-white !text-slate-600 text-[13px] font-bold disabled:opacity-30 hover:bg-slate-50 transition-colors"
                >
                  다음
                </button>
              </div>
            )}
          </div>

          {/* 내 메모 */}
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2.5">
                <div className="w-1 h-5 bg-[#5244e8] rounded-sm"></div>
                내 메모
              </h2>
              <button
                onClick={handleOpenMemo}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white text-[13px] font-bold rounded-xl shadow-sm transition-all cursor-pointer hover:bg-slate-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
                메모 수정하기
              </button>
            </div>

            <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 min-h-[150px] whitespace-pre-wrap text-gray-700 text-[14px] leading-relaxed">
              {profile.memo_content ? (
                profile.memo_content
              ) : (
                <span className="text-gray-400 italic">저장된 메모가 없습니다. 우측 수정하기 버튼을 눌러 메모를 작성해보세요!</span>
              )}
            </div>
          </div>

          {/* 회원 탈퇴 */}
          <div className="flex justify-center mb-10 mt-4">
            <button
              onClick={handleWithdraw}
              className="!text-gray-500 hover:!text-rose-500 text-[14px] font-bold underline underline-offset-4 transition-colors cursor-pointer"
            >
              회원 탈퇴하기
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// 🌟 파일 제일 밑에 이 코드를 통째로 추가합니다.
export default function MyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-slate-500">결제 정보 확인 중...</div>}>
      <MyPageContent />
    </Suspense>
  );
}