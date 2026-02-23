'use client';

import { useState, useEffect } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from "@/app/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function SnapshotSidebar() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-snapshot-sidebar', handleOpen);
    return () => window.removeEventListener('open-snapshot-sidebar', handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen && user) {
      fetchSnapshots();
    }
  }, [isOpen, user]);

  const fetchSnapshots = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('search_snapshots')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) setSnapshots(data);
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 키워드를 삭제하시겠습니까?")) return;
    
    const supabase = createClient();
    const { error } = await supabase.from('search_snapshots').delete().eq('id', id);
    
    if (!error) {
      setSnapshots(snapshots.filter(snap => snap.id !== id));
      alert("삭제되었습니다.");
    } else {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const handleSearchAgain = (keyword: string) => {
    setIsOpen(false);
    router.push(`/analysis?keyword=${encodeURIComponent(keyword)}`);
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    const year = d.getFullYear().toString().slice(2);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  if (!user) return null;

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/20 z-[99998]" onClick={() => setIsOpen(false)} />}

      <div className={`fixed top-0 right-0 h-full w-[380px] bg-white shadow-2xl z-[99999] transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
            📁 저장된 키워드 불러오기
          </h2>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center text-gray-400 mt-10 text-sm font-bold">데이터를 불러오는 중...</div>
          ) : snapshots.length === 0 ? (
            <div className="text-center text-gray-400 mt-10 text-sm">저장된 키워드가 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {snapshots.map((snap) => (
                <div key={snap.id} className="group flex items-center justify-between p-3.5 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all">
                  
                  <div className="flex flex-col overflow-hidden mr-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium mb-0.5">
                      <span>{formatDate(snap.created_at)}</span>
                      <span>|</span>
                      <span className="text-blue-500">{snap.page_name || "키워드 분석"}</span>
                    </div>
                    <span className="text-[14px] font-bold text-gray-800 truncate">
                      {snap.keyword}
                    </span>
                  </div>

                  {/* 🌟 수정: 엑셀 버튼을 지우고, 다시 검색(파란색)과 삭제(빨간색) 버튼만 남겼습니다. */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handleSearchAgain(snap.keyword)} title="이 키워드로 다시 검색" className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                    <button onClick={() => handleDelete(snap.id)} title="기록 삭제" className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}