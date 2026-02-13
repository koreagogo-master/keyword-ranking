'use client';

import { useState, useEffect } from "react";
import { createClient } from "@/app/utils/supabase/client";

export default function MemoSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isBottomMode, setIsBottomMode] = useState(false);
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
      alert("저장되었습니다.");
    } catch (err) {
      alert("저장에 실패했습니다.");
      setIsSaving(false);
    }
  };

  if (!user) return null;

  const triggerClasses = isBottomMode
    ? "fixed bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl px-8 py-2 flex-row shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
    : "fixed right-0 top-1/2 -translate-y-1/2 rounded-l-2xl p-3 flex-col shadow-2xl hover:pr-6";

  const containerClasses = isBottomMode
    ? `fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-6xl h-80 ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0 pointer-events-none'}`
    : `fixed top-[15%] bottom-[15%] right-6 w-85 ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0 pointer-events-none'}`;

  return (
    <>
      {/* 1. 열기 버튼 */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className={`${triggerClasses} z-[10000] bg-[#ff8533] text-white transition-all font-black flex items-center gap-2 group`}
        >
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
          <span className={`${isBottomMode ? 'text-[12px] tracking-widest' : '[writing-mode:vertical-lr] tracking-widest text-[10px]'}`}>MEMO</span>
        </button>
      )}

      {/* 2. 사이드바 본체 - 테두리 곡률을 rounded-3xl로 조정하여 공간 확보 */}
      <div className={`${containerClasses} bg-white shadow-[-10px_10px_40px_rgba(0,0,0,0.15)] z-[10001] transition-all duration-500 ease-in-out transform border border-gray-100 rounded-3xl flex flex-col`}>
        
        {/* [수정] 닫기 버튼: 우측 모드 left 위치 조정 및 하단 모드 밀착도 개선 */}
        <button 
          onClick={() => setIsOpen(false)}
          className={`absolute ${isBottomMode ? 'top-[-36px] left-1/2 -translate-x-1/2 rounded-t-xl' : 'left-[-46px] top-1/2 -translate-y-1/2 rounded-l-xl'} bg-[#ff8533] text-white p-2.5 shadow-md hover:bg-[#e6772e] transition-all flex items-center gap-1.5 group`}
        >
          <svg className={`w-5 h-5 transition-transform group-hover:scale-110 ${isBottomMode ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
          </svg>
          <span className={`${isBottomMode ? 'text-[10px] font-black' : '[writing-mode:vertical-lr] tracking-widest text-[9px] font-black'}`}>CLOSE</span>
        </button>

        <div className="flex flex-col h-full overflow-hidden">
          {/* 헤더 여백 조정 (px-8 -> px-6, py-6 -> py-4) */}
          <div className="px-6 py-4 flex justify-between items-center border-b border-gray-50">
            <div>
              <h3 className="text-lg font-black text-gray-900">나의 메모</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {profile?.grade || 'FREE'} · {content.length}/{charLimit}자
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsBottomMode(!isBottomMode)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#ff8533] hover:bg-[#e6772e] text-white rounded-lg transition-all shadow-sm font-black text-[10px]"
            >
              {isBottomMode ? "우측 모드" : "하단 모드"}
            </button>
          </div>

          {/* [수정] 텍스트 영역: 여백을 대폭 줄이고 곡률을 완만하게(rounded-xl) 하여 입력 공간 극대화 */}
          <div className={`flex flex-1 gap-3 px-5 py-4 ${isBottomMode ? 'flex-row' : 'flex-col'}`}>
            <textarea
              className="flex-1 p-4 bg-gray-50 rounded-xl border border-gray-100 outline-none text-gray-700 resize-none text-sm leading-relaxed focus:ring-2 focus:ring-orange-50 focus:bg-white transition-all placeholder:text-gray-300"
              placeholder="여기에 메모를 입력하세요..."
              value={content}
              maxLength={charLimit}
              onChange={(e) => setContent(e.target.value)}
            />
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={`${isBottomMode ? 'w-32' : 'w-full'} bg-[#ff8533] hover:bg-[#e6772e] text-white py-3.5 rounded-xl font-black transition-all shadow-md active:scale-95 disabled:bg-gray-300 text-sm`}
            >
              {isSaving ? "..." : "저장"}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/5 backdrop-blur-[1px] z-[10000] transition-all"
        />
      )}
    </>
  );
}