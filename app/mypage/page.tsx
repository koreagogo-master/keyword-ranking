'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import Sidebar from "@/components/Sidebar";

export default function MyPage() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/"); 
    }
  }, [user, isLoading, router]);

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-gray-500 font-bold">내 정보를 불러오는 중입니다...</span>
      </div>
    );
  }

  const handleOpenMemo = () => {
    window.dispatchEvent(new Event('open-memo-sidebar'));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "정보 없음";
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPoints = (profile?.bonus_points || 0) + (profile?.purchased_points || 0);

  return (
    <div className="flex bg-gray-50 min-h-[calc(100vh-4rem)]">
      <Sidebar />
      <div className="flex-1 ml-64 p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-6 text-gray-900">
            마이페이지
          </h1>
          
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm mb-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center">
                <label className="text-gray-500 text-sm font-semibold w-28">ID (이메일)</label>
                <p className="text-base font-medium text-gray-900">{profile.email}</p>
              </div>
              
              <div className="flex items-center">
                <label className="text-gray-500 text-sm font-semibold w-28">내 등급</label>
                <span className={`text-base font-bold uppercase ${
                  profile.grade === 'agency' ? 'text-purple-600' :
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

            {profile.grade !== 'agency' && (
              <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 font-medium flex items-center gap-2">
                <span className="font-bold">💡</span> 상위 등급으로 업그레이드 하시면 다중 IP 접속 등 더 많은 혜택을 누리실 수 있습니다.
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2.5 mb-6">
              <div className="w-1 h-5 bg-[#5244e8] rounded-sm"></div>
              내 포인트 및 결제 관리
            </h2>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 bg-[#5244e8]/5 border border-[#5244e8]/20 rounded-xl p-6 flex flex-col items-center justify-center">
                <span className="text-sm font-bold text-gray-500 mb-2">총 사용 가능 포인트</span>
                {/* 🌟 수정: 굵기 하향 (font-black -> font-bold) */}
                <div className="text-3xl font-bold text-[#5244e8]">
                  {totalPoints.toLocaleString()} <span className="text-lg font-bold ml-0.5">P</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center gap-3">
                <div className="flex justify-between items-center px-2">
                  <span className="text-sm font-semibold text-gray-600">결제한 포인트</span>
                  {/* 🌟 수정: 굵기 하향 (font-extrabold -> font-semibold) */}
                  <span className="text-[15px] font-semibold text-gray-700">{profile?.purchased_points?.toLocaleString() || 0} P</span>
                </div>
                <div className="flex justify-between items-center px-2">
                  <span className="text-sm font-semibold text-green-600">보너스 포인트</span>
                  {/* 🌟 수정: 굵기 하향 (font-extrabold -> font-semibold) */}
                  <span className="text-[15px] font-semibold text-green-600">{profile?.bonus_points?.toLocaleString() || 0} P</span>
                </div>
                <div className="w-full h-px bg-gray-100 my-2"></div>
                
                <button 
                  onClick={() => alert('추후 토스페이먼츠 / 포트원 등 실제 결제 모듈이 연동될 예정입니다!')}
                  className="w-full py-3 bg-[#5244e8] hover:bg-[#4336c9] text-white rounded-xl text-[14px] font-bold transition-colors shadow-sm flex items-center justify-center gap-2 mt-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  포인트 충전하기
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
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
          
        </div>
      </div>
    </div>
  );
}