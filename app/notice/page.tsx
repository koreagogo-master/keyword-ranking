'use client';

import React, { useEffect, useState } from 'react';

import { createClient } from '@/app/utils/supabase/client';

interface Notice {
  id: string;
  title: string;
  content: string;
  view_count: number;
  is_pinned: boolean;
  created_at: string;
}

export default function NoticePage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchNotices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchNotices = async () => {
    setLoading(true);
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      let loadedNotices = data;

      // 주소창의 꼬리표(id)를 확인하여 일치하는 글을 자동으로 펼칩니다.
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const targetId = params.get('id');

        if (targetId) {
          setExpandedId(targetId);
          
          const targetNotice = loadedNotices.find(n => n.id === targetId);
          if (targetNotice && !viewedIds.has(targetId)) {
            const newCount = targetNotice.view_count + 1;
            
            // 조회수 증가 처리 (백그라운드)
            await supabase
              .from('notices')
              .update({ view_count: newCount })
              .eq('id', targetId);
              
            loadedNotices = loadedNotices.map(n => 
              n.id === targetId ? { ...n, view_count: newCount } : n
            );
            
            setViewedIds(prev => new Set(prev).add(targetId));
          }
        }
      }

      setNotices(loadedNotices);
    }
    setLoading(false);
  };

  const handleRowClick = async (id: string, currentViewCount: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(id);

    if (!viewedIds.has(id)) {
      const supabase = createClient();
      
      const newCount = currentViewCount + 1;
      
      await supabase
        .from('notices')
        .update({ view_count: newCount })
        .eq('id', id);

      setNotices(prev => 
        prev.map(notice => 
          notice.id === id ? { ...notice, view_count: newCount } : notice
        )
      );
      
      setViewedIds(prev => new Set(prev).add(id));
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="flex min-h-[calc(100vh-160px)] bg-[#f8f9fa] text-[#3c4043]">
      

      <main className="flex-1 ml-64 p-10 relative">
        <div className="max-w-[1000px] mx-auto pt-8">
          
          <div className="mb-12 relative text-center">
            <h1 className="text-[24px] font-extrabold text-gray-900 mb-2">공지사항</h1>
            <p className="text-[14px] text-slate-500 font-medium">서비스의 새로운 소식과 주요 안내 사항을 확인해 보세요.</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex items-center px-6 py-4 bg-slate-50 border-b border-gray-200 text-[13px] font-bold text-slate-500">
              <div className="w-20 text-center shrink-0">No.</div>
              <div className="flex-1 px-4 text-center">제목</div>
              <div className="w-28 text-center shrink-0">등록일</div>
            </div>

            <div className="flex flex-col">
              {loading ? (
                <div className="text-center py-16 text-slate-500 font-bold text-[14px]">
                  공지사항을 불러오는 중입니다...
                </div>
              ) : notices.length === 0 ? (
                <div className="text-center py-16 text-slate-500 font-bold text-[14px]">
                  등록된 공지사항이 없습니다.
                </div>
              ) : (
                notices.map((notice, idx) => (
                  <div key={notice.id} className="flex flex-col border-b border-gray-100 last:border-0">
                    
                    <button
                      onClick={() => handleRowClick(notice.id, notice.view_count)}
                      className={`flex items-center w-full px-6 py-4 transition-colors text-left hover:bg-slate-50 ${expandedId === notice.id ? 'bg-slate-50' : ''}`}
                    >
                      <div className="w-20 text-center shrink-0">
                        {notice.is_pinned ? (
                          <span className="inline-block px-2.5 py-1 rounded text-[11px] font-black bg-indigo-50 !text-indigo-600 whitespace-nowrap border border-indigo-100">
                            중요
                          </span>
                        ) : (
                          <span className="text-slate-400 font-black text-[12px]">
                            {notices.length - idx}
                          </span>
                        )}
                      </div>
                      
                      <div className={`flex-1 px-4 font-bold truncate text-[14px] ${notice.is_pinned ? '!text-indigo-900' : '!text-slate-800'}`}>
                        {notice.title}
                      </div>
                      
                      <div className="w-28 text-center shrink-0 text-[13px] font-medium text-slate-400">
                        {formatDate(notice.created_at)}
                      </div>
                    </button>

                    {expandedId === notice.id && (
                      <div className="px-10 py-8 bg-slate-50/50 border-t border-gray-100">
                        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm text-slate-700 text-[14px] leading-relaxed whitespace-pre-wrap font-medium">
                          {notice.content}
                        </div>
                      </div>
                    )}

                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}