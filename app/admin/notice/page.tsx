'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AdminTabs from '@/components/AdminTabs';
import { createClient } from '@/app/utils/supabase/client';

interface Notice {
  id: string;
  title: string;
  content: string;
  view_count: number;
  is_pinned: boolean;
  created_at: string;
}

export default function AdminNoticePage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  
  // 🌟 날짜 수정을 위한 상태 추가
  const [createdDate, setCreatedDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchNotices();
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
      setNotices(data);
    }
    setLoading(false);
  };

  const handleWriteClick = () => {
    setEditId(null);
    setTitle('');
    setContent('');
    setIsPinned(false);
    // 🌟 새 글 작성 시 기본값을 오늘 날짜로 세팅
    setCreatedDate(formatDate(new Date().toISOString()));
    setIsEditing(true);
  };

  const handleEditClick = (notice: Notice) => {
    setEditId(notice.id);
    setTitle(notice.title);
    setContent(notice.content);
    setIsPinned(notice.is_pinned || false);
    // 🌟 수정 시 기존 글의 날짜를 세팅
    setCreatedDate(formatDate(notice.created_at));
    setIsEditing(true);
  };

  const handleDeleteClick = async (id: string) => {
    const isConfirm = window.confirm('정말로 이 공지사항을 삭제하시겠습니까?');
    if (!isConfirm) return;

    const supabase = createClient();
    const { error } = await supabase.from('notices').delete().eq('id', id);

    if (error) {
      alert('삭제 중 오류가 발생했습니다.');
      console.error(error);
    } else {
      alert('성공적으로 삭제되었습니다.');
      fetchNotices();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해 주세요.');
      return;
    }
    if (!createdDate) {
      alert('등록일을 선택해 주세요.');
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      // 🌟 입력받은 YYYY-MM-DD 날짜를 DB에 저장할 수 있는 표준 시간(ISO) 형식으로 변환
      const submitDate = new Date(createdDate).toISOString();

      if (editId) {
        const { error } = await supabase
          .from('notices')
          // 🌟 created_at (날짜) 업데이트 포함
          .update({ title, content, is_pinned: isPinned, created_at: submitDate }) 
          .eq('id', editId);
        if (error) throw error;
        alert('공지사항이 수정되었습니다.');
      } else {
        const { error } = await supabase
          .from('notices')
          // 🌟 created_at (날짜) 등록 포함
          .insert({ title, content, is_pinned: isPinned, created_at: submitDate }); 
        if (error) throw error;
        alert('새 공지사항이 등록되었습니다.');
      }

      setIsEditing(false);
      fetchNotices();
    } catch (error) {
      console.error(error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 날짜 형식 포맷터 (YYYY-MM-DD)
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043]">
      <Sidebar />

      <main className="flex-1 ml-64 p-10 relative">
        <div className="max-w-[1200px] mx-auto">
          
          <AdminTabs />

          <div className="mb-10 relative text-center">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">공지사항 관리</h1>
            <p className="text-sm text-slate-500">고객에게 안내할 시스템 점검, 업데이트 등의 공지사항을 작성합니다.</p>
          </div>

          {isEditing ? (
            <div className="bg-white p-8 rounded-xl border border-[#5244e8]/30 shadow-md mb-10">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-[#5244e8] rounded-full"></span>
                {editId ? '공지사항 수정' : '새 공지사항 작성'}
              </h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                
                {/* 🌟 옵션 설정 영역 (맨 위 고정 & 날짜 선택) */}
                <div className="flex flex-wrap items-center gap-4 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="pin-checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="w-4 h-4 text-[#5244e8] rounded border-gray-300 focus:ring-[#5244e8]"
                    />
                    <label htmlFor="pin-checkbox" className="text-[14px] font-bold text-indigo-900 cursor-pointer">
                      맨 위 고정
                    </label>
                  </div>
                  
                  <div className="w-px h-5 bg-indigo-200 hidden md:block"></div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-[14px] font-bold text-indigo-900">등록일</label>
                    <input
                      type="date"
                      value={createdDate}
                      onChange={(e) => setCreatedDate(e.target.value)}
                      className="px-3 py-1.5 rounded-md border border-indigo-200 text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#5244e8]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] font-bold text-gray-700 mb-2">제목</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="공지사항 제목을 입력해 주세요."
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#5244e8] outline-none transition-all text-[14px] font-medium"
                    maxLength={150}
                  />
                </div>
                <div>
                  <label className="block text-[14px] font-bold text-gray-700 mb-2">내용</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="안내할 내용을 상세히 적어주세요."
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-[#5244e8] outline-none transition-all text-[14px] h-64 resize-none leading-relaxed"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2.5 rounded-lg font-bold !text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors text-[14px]"
                  >
                    목록으로
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-2.5 bg-[#5244e8] hover:bg-[#4035ba] !text-white rounded-lg font-bold transition-all shadow-sm disabled:opacity-50 text-[14px]"
                  >
                    {isSubmitting ? '저장 중...' : '저장하기'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleWriteClick}
                  className="px-5 py-2.5 bg-[#5244e8] !text-white text-[13px] font-bold rounded-lg shadow-sm hover:bg-[#4035ba] transition-colors flex items-center gap-2"
                >
                  + 새 공지사항 작성
                </button>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 text-[13px] tracking-wider font-bold border-b border-gray-200">
                    <tr>
                      {/* 🌟 No. 칸을 w-20 에서 w-24 로 넓혔습니다 */}
                      <th className="px-6 py-4 w-24 text-center">No.</th>
                      <th className="px-6 py-4">제목</th>
                      <th className="px-6 py-4 w-32 text-center">조회수</th>
                      <th className="px-6 py-4 w-32 text-center">등록일</th>
                      <th className="px-6 py-4 w-36 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[14px]">
                    {loading ? (
                      <tr><td colSpan={5} className="text-center py-10 text-slate-500 font-bold">공지사항을 불러오는 중입니다...</td></tr>
                    ) : notices.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-slate-500 font-bold">등록된 공지사항이 없습니다. 첫 공지를 작성해 보세요!</td></tr>
                    ) : (
                      notices.map((notice, idx) => (
                        <tr key={notice.id} className={`hover:bg-slate-50 transition-colors ${notice.is_pinned ? 'bg-indigo-50/30' : ''}`}>
                          <td className="px-6 py-4 text-center">
                            {notice.is_pinned ? (
                              <span className="inline-block px-2.5 py-1 rounded text-[11px] font-black bg-indigo-100 !text-indigo-600 whitespace-nowrap">공지</span>
                            ) : (
                              <span className="text-slate-400 font-black text-[12px]">{notices.length - idx}</span>
                            )}
                          </td>
                          <td className={`px-6 py-4 font-bold truncate max-w-md ${notice.is_pinned ? '!text-indigo-900' : '!text-slate-800'}`}>
                            {notice.title}
                          </td>
                          <td className="px-6 py-4 text-center !text-slate-500 font-medium">{notice.view_count.toLocaleString()}</td>
                          <td className="px-6 py-4 text-center !text-slate-500 font-medium">{formatDate(notice.created_at)}</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button onClick={() => handleEditClick(notice)} className="text-[12px] font-bold !text-indigo-600 hover:underline">수정</button>
                              <span className="text-gray-300">|</span>
                              <button onClick={() => handleDeleteClick(notice.id)} className="text-[12px] font-bold !text-rose-500 hover:underline">삭제</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}