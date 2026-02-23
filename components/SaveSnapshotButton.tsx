'use client';

import { useState } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from "@/app/contexts/AuthContext";

// 🌟 추가: 버튼이 '페이지 이름'도 넘겨받을 수 있도록 이름표를 달아줍니다.
interface Props {
  keyword: string;
  resultData: any;
  pageName: string; 
}

export default function SaveSnapshotButton({ keyword, resultData, pageName }: Props) {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) {
      alert("로그인이 필요한 기능입니다.");
      return;
    }
    if (!keyword || !resultData) {
      alert("먼저 키워드를 검색해 주세요.");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from('search_snapshots')
        .insert({
          user_id: user.id,
          keyword: keyword,
          result_data: resultData,
          page_name: pageName // 🌟 추가: 아까 만든 데이터베이스 빈칸에 페이지 이름을 쏙 넣습니다.
        });
      
      if (error) throw error;
      
      alert(`[${keyword}] 검색 결과가 보관함에 저장되었습니다! 💾`);
    } catch (error) {
      console.error(error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <button
      onClick={handleSave}
      disabled={isSaving}
      className="fixed top-24 right-10 z-[9000] flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-[13px] font-bold rounded-full shadow-lg transition-all cursor-pointer group"
    >
      <svg 
        className={`w-4 h-4 ${isSaving ? 'animate-spin' : 'transition-transform group-hover:scale-110'}`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        {isSaving ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        )}
      </svg>
      {isSaving ? "저장 중..." : "현재 결과 저장"}
    </button>
  );
}