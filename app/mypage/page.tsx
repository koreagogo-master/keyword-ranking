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

  // 🌟 우측 슬라이딩 메모장을 열라고 신호를 보내는 함수
  const handleOpenMemo = () => {
    window.dispatchEvent(new Event('open-memo-sidebar'));
  };

  // 🌟 날짜를 보기 좋게(YYYY년 MM월 DD일 오전/오후 HH:MM) 바꿔주는 함수
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

  return (
    <div className="flex bg-gray-50 min-h-[calc(100vh-4rem)]">
      <Sidebar />
      <div className="flex-1 ml-64 p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-6 text-gray-900">👋 마이페이지</h1>
          
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm mb-6">
            
            <div className="flex flex-col gap-4">
              {/* 1. ID (이메일) 한 줄 배치 */}
              <div className="flex items-center">
                <label className="text-gray-500 text-sm font-semibold w-28">ID (이메일)</label>
                <p className="text-base font-medium text-gray-900">{profile.email}</p>
              </div>
              
              {/* 2. 내 등급 한 줄 배치 (둥근 박스/볼드 제거, 색상 유지) */}
              <div className="flex items-center">
                <label className="text-gray-500 text-sm font-semibold w-28">내 등급</label>
                <span className={`text-base ${
                  profile.grade === 'premium' 
                    ? 'text-[#ff8533]' 
                    : 'text-gray-600'
                }`}>
                  {profile.grade?.toUpperCase() || 'STANDARD'}
                </span>
              </div>

              {/* 3. 가입일 & 최근 접속일 한 줄 나란히 배치 */}
              <div className="flex items-center gap-8 pt-4 mt-2 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <label className="text-gray-400 text-sm font-semibold">가입일</label>
                  <p className="text-sm text-gray-700">{formatDate(user?.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-gray-400 text-sm font-semibold">최근 접속일</label>
                  <p className="text-sm text-gray-700">{formatDate(user?.last_sign_in_at)}</p>
                </div>
              </div>
            </div>

            {profile.grade !== 'premium' && (
              <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 font-medium">
                💡 프리미엄 등급으로 업그레이드 하시면 더 많은 키워드를 조회할 수 있습니다.
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
            {/* 메모장 타이틀과 수정 버튼 */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                📝 내 메모
              </h2>
              <button 
                onClick={handleOpenMemo}
                className="flex items-center gap-2 px-4 py-2 bg-[#ff8533] text-white text-[13px] font-black rounded-xl shadow-md transition-all cursor-pointer hover:bg-[#e6772e]"
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