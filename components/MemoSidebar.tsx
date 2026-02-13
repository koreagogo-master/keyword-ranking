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

      {/* 2. 사이드바 본체 */}
      <div className={`${containerClasses} bg-white shadow-[-10px_10px_40px_rgba(0,0,0,0.15)] z-[10001] transition-all duration-500 ease-in-out transform border border-gray-100 rounded-[40px] flex flex-col`}>
        {/* [수정] 닫기 버튼: 하단 모드는 top-[-40px]로 밀착, 우측 모드는 left-[-52px]로 여백 확보 */}
        <button 
          onClick={() => setIsOpen(false)}
          className={`absolute ${isBottomMode ? 'top-[-40px] left-1/2 -translate-x-1/2 rounded-t-2xl' : 'left-[-52px] top-1/2 -translate-y-1/2 rounded-l-2xl'} bg-[#ff8533] text-white p-3 shadow-[-5px_0_15px_rgba(0,0,0,0.1)] hover:bg-[#e6772e] transition-all flex items-center gap-2 group`}
        >
          <svg className={`w-5 h-5 transition-transform group-hover:scale-125 ${isBottomMode ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
          </svg>
          <span className={`${isBottomMode ? 'text-[10px] font-black uppercase' : '[writing-mode:vertical-lr] tracking-widest text-[10px] font-black'}`}>CLOSE</span>
        </button>

        <div className="flex flex-col h-full overflow-hidden">
          <div className="px-8 py-6 flex justify-between items-center border-b border-gray-50">
            <div>
              <h3 className="text-xl font-black text-gray-900">나의 메모</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                  {profile?.grade || 'FREE'} · {content.length}/{charLimit}자
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsBottomMode(!isBottomMode)}
              className="flex items-center gap-2 px-4 py-2 bg-[#ff8533] hover:bg-[#e6772e] text-white rounded-xl transition-all shadow-md font-black text-[11px]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
              </svg>
              {isBottomMode ? "우측 모드 전환" : "하단 모드 전환"}
            </button>
          </div>

          <div className={`flex flex-1 gap-4 px-8 py-6 ${isBottomMode ? 'flex-row' : 'flex-col'}`}>
            <textarea
              className="flex-1 p-6 bg-gray-50 rounded-[30px] border-none outline-none text-gray-700 resize-none text-sm leading-relaxed focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-gray-300"
              placeholder="내용이 길어지면 하단 모드를 활용해 보세요..."
              value={content}
              maxLength={charLimit}
              onChange={(e) => setContent(e.target.value)}
            />
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={`${isBottomMode ? 'w-40' : 'w-full'} bg-[#ff8533] hover:bg-[#e6772e] text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-orange-100 active:scale-95 disabled:bg-gray-300`}
            >
              {isSaving ? "..." : "저장"}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/5 backdrop-blur-[2px] z-[10000] transition-all"
        />
      )}
    </>
  );
}