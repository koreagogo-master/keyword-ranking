'use client';

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/app/utils/supabase/client";
// 🌟 1. 중앙 통제실 스위치를 가져옵니다!
import { useAuth } from "@/app/contexts/AuthContext";

export default function MemoSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isBottomMode, setIsBottomMode] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 🌟 2. 복잡한 통신 코드 다 지우고, 통제실에서 바로 꺼내옵니다.
  const { user, profile } = useAuth();

  // 🌟 3. 마이페이지에서 보낸 '열려라!' 신호를 받는 안테나 설치
  useEffect(() => {
    const handleOpenMemo = () => setIsOpen(true);
    window.addEventListener('open-memo-sidebar', handleOpenMemo);
    return () => window.removeEventListener('open-memo-sidebar', handleOpenMemo);
  }, []);

  // 메모장 초기 데이터 불러오기
  useEffect(() => {
    if (profile && !isLoaded) {
      const initialText = profile.memo_content || "";
      if (textRef.current) {
        textRef.current.value = initialText; // 화면에 내용 세팅
      }
      setCharCount(initialText.length); // 글자 수 초기화
      setIsLoaded(true);
    }
  }, [profile, isLoaded]);

  const charLimit = profile?.grade === 'premium' ? 10000 : 1000;

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // 🌟 4. 서버 통신 도구는 글자를 칠 때가 아니라, 오직 '저장'할 때만 한 번 꺼내 씁니다.
      const supabase = createClient();
      const currentContent = textRef.current?.value || ""; // 저장할 때만 텍스트 꺼내기
      const { error } = await supabase
        .from('profiles')
        .update({ memo_content: currentContent }) // 꺼낸 텍스트를 저장
        .eq('id', user.id);
      
      if (error) throw error;
      
      // 약간의 지연 후 상태 변경 (UI 부드럽게 보이도록)
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

  // 🌟 5. 모드 전환 시 버벅임을 줄이기 위해 width 값을 명확하게 고정(w-[350px])
  const containerClasses = isBottomMode
    ? `fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-6xl h-80 ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0 pointer-events-none'}`
    : `fixed top-[15%] bottom-[15%] right-6 w-[500px] ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0 pointer-events-none'}`;

  return (
    <>
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className={`${triggerClasses} z-[10000] bg-[#ff8533] text-white transition-all duration-300 font-black flex items-center gap-2 group`}
        >
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
          <span className={`${isBottomMode ? 'text-[12px] tracking-widest' : '[writing-mode:vertical-lr] tracking-widest text-[10px]'}`}>MEMO</span>
        </button>
      )}

      {/* 애니메이션(transition, duration, animate 등) 제거됨 */}
      <div className={`${containerClasses} bg-white shadow-[-10px_10px_40px_rgba(0,0,0,0.15)] z-[10001] border border-gray-100 rounded-3xl flex flex-col`}>
        
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
          <div className="px-6 py-4 flex justify-between items-center border-b border-gray-50">
            <div>
              <h3 className="text-lg font-black text-gray-900">나의 메모</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {/* 깜빡임 애니메이션 제거됨 */}
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {profile?.grade || 'STANDARD'} · {charCount}/{charLimit}자
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

          <div className={`flex flex-1 gap-3 px-5 py-4 ${isBottomMode ? 'flex-row' : 'flex-col'}`}>
            <textarea
              ref={textRef}
              className="flex-1 p-4 bg-gray-50 rounded-xl border border-gray-100 outline-none text-gray-700 resize-none text-sm leading-relaxed focus:ring-2 focus:ring-orange-50 focus:bg-white transition-all placeholder:text-gray-300"
              placeholder="여기에 메모를 입력하세요..."
              maxLength={charLimit}
              onChange={(e) => setCharCount(e.target.value.length)}
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

      {/* 배경 흐림 애니메이션 제거됨 */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/5 z-[10000]"
        />
      )}
    </>
  );
}