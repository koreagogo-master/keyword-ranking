'use client';

import { useState, useEffect } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from "@/app/contexts/AuthContext";

interface SavedSearchesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pageType: "BLOG" | "JISIKIN" | "TOTAL" | "ANALYSIS" | "RELATED" | "GOOGLE" | "YOUTUBE" | "SHOPPING" | "SHOPPING_RANK" | "SEO_TITLE" | "AIBLOG" | "AI_PRESS" | "INDEX_CHECK" | "KEYWORD_VOLUME"; onSelect: (item: any) => void;
}
export default function SavedSearchesDrawer({ isOpen, onClose, pageType, onSelect }: SavedSearchesDrawerProps) {
  const { user } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchList();
    }
  }, [isOpen, user, pageType]);

  const fetchList = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', user?.id)
      .eq('page_type', pageType)
      .order('created_at', { ascending: false });

    if (!error && data) setList(data);
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 항목을 삭제하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').delete().eq('id', id);
    if (!error) {
      setList(list.filter(item => item.id !== id));
    } else {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    const year = d.getFullYear().toString().slice(2);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  const getPageName = () => {
    if (pageType === 'BLOG') return 'N 모바일 블로그';
    if (pageType === 'JISIKIN') return 'N 모바일 지식인';
    if (pageType === 'TOTAL') return 'N 통검 노출/순위';
    if (pageType === 'ANALYSIS') return '키워드 정밀 분석';
    if (pageType === 'RELATED') return '연관 키워드 조회';
    if (pageType === 'GOOGLE') return '구글 키워드 분석';
    if (pageType === 'YOUTUBE') return '유튜브 트렌드';
    if (pageType === 'SHOPPING') return '쇼핑 인사이트';
    // 🌟 SEO 타이틀 페이지 이름 추가
    if (pageType === 'SEO_TITLE') return '쇼핑 상품명 최적화';
    if (pageType === 'KEYWORD_VOLUME') return '키워드별 조회수';
    return '';
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/20 z-[99998]" onClick={onClose} />}

      <div className={`fixed top-0 right-0 h-full w-[380px] bg-white shadow-2xl z-[99999] transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
            📂 저장된 설정 불러오기
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-sm transition-colors text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          {isLoading ? (
            <div className="text-center text-gray-400 mt-10 text-sm font-bold">데이터를 불러오는 중...</div>
          ) : list.length === 0 ? (
            <div className="text-center text-gray-400 mt-10 text-sm">저장된 내역이 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {list.map((item) => (
                <div key={item.id} className="group flex flex-col p-4 bg-white border border-gray-200 rounded-sm hover:border-[#5244e8] hover:shadow-md transition-all">

                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                      <span>{formatDate(item.created_at)}</span>
                      <span>|</span>
                      <span className="text-[#5244e8] font-bold">{getPageName()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => onSelect(item)} title="이 설정으로 바로 검색" className="p-1.5 bg-[#5244e8] hover:bg-[#4336c9] text-white rounded-sm transition-colors shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(item.id)} title="기록 삭제" className="p-1.5 bg-red-400 hover:bg-red-500 text-white rounded-sm transition-colors shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>

                  {pageType === 'BLOG' || pageType === 'TOTAL' ? (
                    <>
                      <div className="text-[12px] text-gray-500 mb-1">닉네임: <span className="font-bold text-gray-800">{item.nickname}</span></div>
                      <div className="text-[13px] font-bold text-gray-800 line-clamp-2 leading-snug">
                        {item.keyword}
                      </div>
                    </>
                  ) : (
                    <div className="text-[12px] text-gray-500 mb-1">
                      {/* 👇 조건문을 확장했습니다: INDEX_CHECK면 '블로그 ID:', SEO_TITLE이면 '핵심 품목명:', 그 외에는 '키워드:' */}
                      {pageType === 'INDEX_CHECK'
                        ? '블로그 ID:'
                        : pageType === 'SEO_TITLE'
                          ? '핵심 품목명:'
                          : '키워드:'
                      }
                      <span className="text-[13px] font-bold text-gray-800 line-clamp-2 leading-snug ml-1">
                        {item.keyword}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}