'use client';

import { useState, useEffect } from "react";
import { createClient } from "@/app/utils/supabase/client";

export default function MemoSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  const fetchMemo = async () => {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError && authError.name !== 'AbortError') throw authError;

      if (authUser) {
        setUser(authUser);
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('memo_content, grade')
          .eq('id', authUser.id)
          .single();
        
        if (!profileError && data) {
          setProfile(data);
          setContent(data.memo_content || "");
        }
      } else {
        setUser(null);
        setProfile(null);
        setContent("");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn("메모 정보 로드 일시 지연");
      }
    }
  };

  useEffect(() => {
    fetchMemo();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchMemo();
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const charLimit = profile?.grade === 'premium' ? 10000 : 1000;

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ memo_content: content })
        .eq('id', user.id);
      if (error) throw error;
      setTimeout(() => setIsSaving(false), 500);
    } catch (err) {
      alert("저장에 실패했습니다.");
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* 1. 열기 버튼 (닫혀 있을 때 보임) */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-[10000] bg-[#ff8533] text-white p-3 rounded-l-2xl shadow-2xl hover:pr-6 transition-all font-black flex flex-col items-center gap-2 group"
        >
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
          <span className="[writing-mode:vertical-lr] tracking-widest text-[10px]">MEMO</span>
        </button>
      )}

      {/* 2. 사이드바 본체 */}
      <div 
        className={`fixed top-[15%] bottom-[15%] right-6 w-80 bg-white shadow-[-10px_10px_40px_rgba(0,0,0,0.15)] z-[10001] transition-all duration-500 ease-in-out transform border border-gray-100 rounded-[40px] flex flex-col ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0 pointer-events-none'
        }`}
      >
        {/* [수정] 닫기 버튼: 가시성을 위해 배경색을 주황색(#ff8533)으로 변경 */}
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute left-[-48px] top-1/2 -translate-y-1/2 bg-[#ff8533] text-white p-3 rounded-l-2xl shadow-[-5px_0_15px_rgba(0,0,0,0.1)] hover:bg-[#e6772e] transition-all flex flex-col items-center gap-2 group"
        >
          <svg className="w-5 h-5 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
          </svg>
          <span className="[writing-mode:vertical-lr] tracking-widest text-[10px] font-black">CLOSE</span>
        </button>

        <div className="flex flex-col h-full overflow-hidden">
          {/* 헤더 부분 */}
          <div className="p-8 pb-4">
            <h3 className="text-xl font-black text-gray-900">나의 메모</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                {profile?.grade || 'FREE'} · {content.length}/{charLimit}자
              </p>
            </div>
          </div>

          {/* 입력창 부분 */}
          <div className="flex-1 px-8 py-2">
            <textarea
              className="w-full h-full p-6 bg-gray-50 rounded-[30px] border-none outline-none text-gray-700 resize-none text-sm leading-relaxed focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-gray-300"
              placeholder="오늘의 인사이트를 기록하세요..."
              value={content}
              maxLength={charLimit}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* 하단 저장 버튼 */}
          <div className="p-8 pt-4">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-[#ff8533] hover:bg-[#e6772e] text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-orange-100 active:scale-95 disabled:bg-gray-300"
            >
              {isSaving ? "저장 중..." : "안전하게 저장하기"}
            </button>
          </div>
        </div>
      </div>

      {/* 배경 흐림 효과 */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/5 backdrop-blur-[2px] z-[10000] transition-all"
        />
      )}
    </>
  );
}