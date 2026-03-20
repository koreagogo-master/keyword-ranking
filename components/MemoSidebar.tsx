'use client';

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from "@/app/contexts/AuthContext";

type SaveState = 'IDLE' | 'SAVING' | 'SAVED';

export default function MemoSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isBottomMode, setIsBottomMode] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [saveState, setSaveState] = useState<SaveState>('IDLE');

  const { user, profile } = useAuth();

  useEffect(() => {
    const handleOpenMemo = () => setIsOpen(true);
    window.addEventListener('open-memo-sidebar', handleOpenMemo);
    return () => window.removeEventListener('open-memo-sidebar', handleOpenMemo);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); 
        if (isOpen && saveState === 'IDLE') {
          handleSave(); 
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, saveState]); 

  useEffect(() => {
    if (profile && !isLoaded) {
      const initialText = profile.memo_content || "";
      if (textRef.current) {
        textRef.current.value = initialText; 
      }
      setCharCount(initialText.length); 
      setIsLoaded(true);
      // 데이터를 처음 불러오면 무조건 '저장 완료' 상태로 둡니다.
      setSaveState('SAVED');
    }
  }, [profile, isLoaded]);

  const charLimit = 
  profile?.grade === 'agency' ? 10_000 : 
  profile?.grade === 'pro' ? 5_000 : 
  profile?.grade === 'starter' ? 1_000 : 
  500;

  const handleSave = async () => {
    if (!user || saveState !== 'IDLE') return;
    
    setSaveState('SAVING');

    try {
      const supabase = createClient();
      const currentContent = textRef.current?.value || ""; 
      const { error } = await supabase
        .from('profiles')
        .update({ memo_content: currentContent }) 
        .eq('id', user.id);
      
      if (error) throw error;
      
      // 타이머를 없애고, 텍스트가 수정되기 전까지는 계속 '저장 완료' 상태를 유지합니다.
      setSaveState('SAVED'); 

    } catch (err) {
      console.error("메모 저장 실패:", err);
      alert("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setSaveState('IDLE');
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCharCount(e.target.value.length);
    // 텍스트를 한 글자라도 수정하면 즉시 '저장' 버튼(IDLE)으로 활성화됩니다.
    if (saveState !== 'IDLE') {
      setSaveState('IDLE');
    }
  };

  if (!user) return null;

  const triggerClasses = isBottomMode
    ? "fixed bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl px-8 py-2 flex-row shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
    : "fixed right-0 top-1/2 -translate-y-1/2 rounded-l-2xl p-3 flex-col shadow-2xl hover:pr-6";

  const containerClasses = isBottomMode
    ? `fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-6xl h-80 ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0 pointer-events-none'}`
    : `fixed top-[15%] bottom-[15%] right-6 w-[500px] ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0 pointer-events-none'}`;

  const renderSaveButton = () => {
    switch (saveState) {
      case 'SAVING':
        return (
          <button 
            disabled
            className="px-6 py-2.5 flex items-center gap-2 bg-emerald-500 text-white rounded-lg font-black shadow-sm text-[13px] cursor-not-allowed"
          >
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            저장 중...
          </button>
        );
      case 'SAVED':
        return (
          <button 
            disabled
            className="px-6 py-2.5 bg-gray-400 text-white rounded-lg font-black shadow-sm text-[13px] cursor-not-allowed transition-all duration-300"
          >
            저장 완료
          </button>
        );
      case 'IDLE':
      default:
        return (
          <button 
            onClick={handleSave}
            className="px-7 py-2.5 bg-[#5244e8] hover:bg-[#4035ba] text-white rounded-lg font-black transition-all shadow-sm active:scale-95 text-[14px]"
          >
            저장
          </button>
        );
    }
  };

  return (
    <>
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className={`${triggerClasses} z-[10000] bg-[#5244e8] hover:bg-[#4035ba] text-white transition-all duration-300 font-black flex items-center gap-2 group`}
        >
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
          <span className={`${isBottomMode ? 'text-[12px] tracking-widest' : '[writing-mode:vertical-lr] tracking-widest text-[10px]'}`}>MEMO</span>
        </button>
      )}

      <div className={`${containerClasses} bg-white shadow-[-10px_10px_40px_rgba(0,0,0,0.15)] z-[10001] border border-gray-100 rounded-3xl flex flex-col`}>
        
        <button 
          onClick={() => setIsOpen(false)}
          className={`absolute ${isBottomMode ? 'top-[-34px] left-1/2 -translate-x-1/2 rounded-t-xl px-3 py-1.5' : 'right-full top-1/2 -translate-y-1/2 rounded-l-xl flex-col p-2.5'} bg-[#5244e8] text-white shadow-md hover:bg-[#4035ba] transition-all flex items-center justify-center gap-1.5 group`}
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
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  {profile?.grade || 'STANDARD'} · {charCount.toLocaleString()}/{charLimit.toLocaleString()}자
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">

              <button 
                onClick={() => setIsBottomMode(!isBottomMode)}
                className="flex items-center justify-center p-0.5 hover:bg-gray-100/70 text-gray-700 rounded-lg transition-all"
                title={isBottomMode ? "우측 모드로 전환" : "하단 모드로 전환"}
              >
                {isBottomMode ? (
                  <svg className="w-10 h-10" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="#4B5563" strokeWidth="1.5"/>
                    <rect x="15" y="4.5" width="5.5" height="15" rx="1.5" fill="#4B5563"/>
                  </svg>
                ) : (
                  <svg className="w-10 h-10" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="#4B5563" strokeWidth="1.5"/>
                    <rect x="3.5" y="14" width="17" height="5.5" rx="1.5" fill="#4B5563"/>
                  </svg>
                )}
              </button>
              
              {renderSaveButton()}

            </div>
          </div>

          <div className="flex flex-1 px-5 py-4">
            <textarea
              ref={textRef}
              className="flex-1 p-4 bg-gray-50 rounded-xl border border-gray-100 outline-none text-gray-700 resize-none text-sm leading-relaxed focus:ring-2 focus:ring-indigo-50 focus:bg-white transition-all placeholder:text-gray-300 
              [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400"
              placeholder="여기에 메모를 입력하세요 (Ctrl + S 로 빠른 저장)"
              maxLength={charLimit}
              onChange={handleTextChange}
            />
          </div>
        </div>
      </div>

      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/5 z-[10000]"
        />
      )}
    </>
  );
}