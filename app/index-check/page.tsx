// app/index-check/page.tsx
"use client";

import { useState } from "react";

import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from '@/app/contexts/AuthContext';
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";

// 🌟 [추가] 공통 탭 컴포넌트 불러오기
import RankTabs from "@/components/RankTabs";

// 🌟 1. 포인트 차감 기능을 위해 usePoint 훅을 불러옵니다.
import { usePoint } from '@/app/hooks/usePoint'; 
import HelpButton from '@/components/HelpButton';

interface BlogPost {
  title: string;
  link: string;
  category?: string;
  pubDate: string;
  status: "pending" | "indexed" | "missing" | "error";
}

const cleanUrl = (rawUrl: string) => {
  if (!rawUrl) return '';
  return rawUrl.replace('<![CDATA[', '').replace(']]>', '');
};

export default function IndexCheckPage() {
  const { user } = useAuth(); 
  // 🌟 2. 포인트 차감 함수를 준비합니다.
  const { deductPoints } = usePoint(); 

  const [blogId, setBlogId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [results, setResults] = useState<BlogPost[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [blogMeta, setBlogMeta] = useState({ title: "", description: "" });
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBlogId(e.target.value);
    setIsSaved(false);
  };

  const fetchItems = async (startIndex: number, overrideId?: string) => {
    const targetId = overrideId || blogId.trim();

    if (startIndex === 0 && !targetId) {
      alert("아이디를 넣어 주세요.");
      return;
    }

    const isFirst = startIndex === 0;

    // 🌟 3. [핵심] 조회를 처음 시작할 때 포인트를 차감합니다.
    if (isFirst) {
      // deductPoints 함수에 'INDEX_CHECK'를 넘겨주면, 
      // 관리자 페이지에서 설정한 'INDEX_CHECK' 단가만큼 차감 시도합니다.
      const success = await deductPoints(user?.id, 20, 1, targetId);
      
      // 포인트가 모자라거나 차감에 실패하면 여기서 중단합니다.
      if (!success) return; 

      setLoading(true); 
      setResults([]); 
    } else { 
      setLoadingMore(true); 
    }

    try {
      const response = await fetch("/api/index-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogId: targetId, start: startIndex, limit: 10 }),
      });
      const data = await response.json();

      if (!response.ok || !data.results) {
        alert("존재하지 않는 블로그이거나 데이터를 불러올 수 없습니다. 아이디를 다시 확인해 주세요.");
        if (isFirst) {
          setResults([]); 
          setBlogMeta({ title: "", description: "" });
        }
        return;
      }

      if (isFirst) {
        setResults(data.results || []);
        setBlogMeta(data.blogInfo || { title: "", description: "" });
      } else {
        setResults((prev) => [...prev, ...(data.results || [])]);
      }
      setTotalCount(data.total || 0);
      setHasMore(data.hasMore || false);

    } catch (error) {
      alert("진단 중 오류가 발생했습니다. 아이디를 다시 확인해 주세요.");
      if (isFirst) {
        setResults([]); 
        setBlogMeta({ title: "", description: "" });
      }
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  };

  const handleSaveCurrentSetting = async () => {
    if (!blogId) {
      alert("아이디를 입력한 후 저장해주세요.");
      return;
    }
    if (!user) {
        alert('로그인 정보가 만료되었거나 확인할 수 없습니다. 다시 로그인해주세요.');
        return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user?.id,
      page_type: 'INDEX_CHECK', 
      nickname: '', 
      keyword: blogId
    });

    if (!error) {
      alert("현재 설정이 안전하게 저장되었습니다.");
      setIsSaved(true);
    } else {
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false); 
    setBlogId(item.keyword);
    setIsSaved(true);
    setResults([]);
    setBlogMeta({ title: "", description: "" }); 
  };

  const isSaveDisabled = !blogId || !user || isSaved;

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <div className="flex min-h-screen bg-[#f8f9fa] !text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        
        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">
            
            {/* 🌟 [핵심] 공통 탭 컴포넌트를 이식한 위치입니다. */}
            <RankTabs />

            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold !text-black">블로그 검색 노출 진단</h1>
                  <HelpButton href="https://blog.naver.com/lboll/224254481124" tooltip="도움말" />
                </div>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">아이디만 입력하면 최근 포스팅 50개를 분석하여 노출 여부를 판단합니다.</p>
              </div>
              <div className="flex items-center gap-2 mt-1 shrink-0">
                <button 
                  onClick={handleSaveCurrentSetting}
                  disabled={isSaveDisabled}
                  className={`px-4 py-2 text-sm font-bold text-white rounded-md shadow-sm flex items-center gap-1.5 transition-colors
                    ${isSaveDisabled 
                      ? 'bg-[#9ba5b5] cursor-not-allowed opacity-90' 
                      : 'bg-[#626e82] hover:bg-[#4f5969]' 
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  {isSaved ? "저장 완료" : "현재 설정 저장"}
                </button>
                <button 
                  onClick={() => setIsDrawerOpen(true)}
                  className="px-4 py-2 text-sm font-bold text-white bg-[#354153] rounded-md hover:bg-[#252f3e] transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                  저장된 목록 보기
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-6 relative">
              
              <div className="flex flex-col lg:flex-row gap-6 items-start w-full relative">
                
                {/* 1. 원래 크기의 입력창 영역 (고정 420px) */}
                <div className="w-full lg:w-[420px] shrink-0 sticky top-[64px] z-30 space-y-3 bg-[#f8f9fa]">
                  <div className="bg-white border border-gray-200 rounded-sm flex items-center shadow-md focus-within:border-[#5244e8]/50 overflow-hidden transition-colors">
                    <input
                      type="text"
                      value={blogId}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                          if (e.nativeEvent.isComposing) return;
                          if (e.key === "Enter" && !loading) fetchItems(0);
                      }}
                      className="flex-1 py-3 px-4 text-base outline-none !text-black bg-white"
                      placeholder="네이버 아이디 입력"
                      style={{ fontFamily: "sans-serif" }} 
                    />
                    <button
                      onClick={() => fetchItems(0)}
                      disabled={loading}
                      className="px-10 py-3.5 font-bold bg-[#5244e8] hover:bg-[#4336c9] text-white transition-colors text-base whitespace-nowrap border-l border-gray-200 disabled:opacity-70"
                    >
                      {loading ? "조회중" : "조회"}
                    </button>
                  </div>
                </div>

                {/* 2. 결과 대시보드 카드 영역 (나머지 공간 채움) */}
                {results && results.length > 0 && (
                  <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-500">
                    <div className="bg-white p-5 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center relative overflow-hidden min-h-[96px]">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[#5244e8]"></div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-slate-400">TARGET BLOG</span>
                        <button onClick={() => window.open(`https://blog.naver.com/${blogId}`, '_blank')} className="text-[11px] font-bold px-3 py-1 bg-slate-50 hover:bg-slate-100 !text-slate-600 rounded-full transition-colors flex items-center gap-1 shadow-sm border border-slate-200">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          바로가기
                        </button>
                      </div>
                      <span className="text-[15px] font-extrabold text-slate-800 break-keep leading-snug mb-1">{blogMeta.title}</span>
                      <span className="text-[12px] font-medium text-slate-500 truncate">{blogMeta.description}</span>
                    </div>

                    <div className="bg-white p-5 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center relative overflow-hidden min-h-[96px]">
                      <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                      <span className="text-xs font-bold text-slate-400 mb-1">정상 노출</span>
                      <div className="flex items-end gap-1">
                        <span className="text-2xl font-bold text-green-600">{results.filter(r => r.status === "indexed").length}</span>
                        <span className="text-xs font-medium text-slate-400 mb-1">건</span>
                      </div>
                    </div>

                    <div className="bg-white p-5 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center relative overflow-hidden min-h-[96px]">
                      <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                      <span className="text-xs font-bold text-slate-400 mb-1">누락 의심</span>
                      <div className="flex items-end gap-1">
                        <span className="text-2xl font-bold text-red-500">{results.filter(r => r.status === "missing").length}</span>
                        <span className="text-xs font-medium text-slate-400 mb-1">건</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-full">
                {results && results.length > 0 && (
                  <div className="bg-white border border-gray-300 shadow-sm overflow-visible rounded-sm">
                    <table className="w-full text-left border-collapse table-fixed">
                      <thead className="sticky top-[64px] z-20 bg-slate-50 border-b border-gray-200">
                        <tr className="text-[13px]">
                          <th className="px-4 py-4 text-center w-16 font-bold text-slate-500">No.</th>
                          <th className="px-4 py-4 font-bold text-slate-500 text-center w-40">발행시간</th>
                          <th className="px-4 py-4 font-bold text-slate-500 text-center w-36">카테고리</th>
                          <th className="px-4 py-4 font-bold text-slate-500 text-left">포스팅 제목</th>
                          <th className="px-4 py-4 font-bold text-slate-500 text-center w-28">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {results.map((post, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-center text-slate-400 font-medium text-[13px]">{index + 1}</td>
                            <td className="px-4 py-3 text-center text-slate-500 text-[13px] tracking-tighter">
                              {new Date(post.pubDate).toLocaleString('ko-KR', {
                                year: 'numeric', month: '2-digit', day: '2-digit',
                                hour: '2-digit', minute: '2-digit', second: '2-digit',
                                hour12: false
                              })}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-block px-2.5 py-1 bg-indigo-50 !text-indigo-600 rounded-sm text-[12px] font-bold border border-indigo-100 truncate max-w-[100px]">{post.category || '일반'}</span>
                            </td>
                            <td className="px-4 py-3 pr-6">
                              <a href={cleanUrl(post.link)} target="_blank" rel="noopener noreferrer" className="!text-black font-bold text-[13px] hover:text-[#5244e8] hover:underline text-left truncate w-full cursor-pointer block">
                                {post.title}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {post.status === "indexed" ? (
                                <span className="inline-block px-2.5 py-1 bg-green-50 text-green-700 rounded-sm text-[12px] font-bold border border-green-200">정상 노출</span>
                              ) : post.status === "missing" ? (
                                <span className="inline-block px-2.5 py-1 bg-red-50 text-red-700 rounded-sm text-[12px] font-bold border border-red-200">누락 의심</span>
                              ) : (
                                <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-500 rounded-sm text-[12px] font-bold border border-slate-200">검사중</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {hasMore && (
                      <div className="p-4 bg-gray-50 flex justify-center border-t border-gray-100">
                        <button onClick={() => fetchItems(results.length)} disabled={loadingMore} className="px-6 py-2 bg-white border border-gray-200 rounded-sm shadow-sm text-[13px] font-bold !text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all">
                          {loadingMore ? "분석 중..." : `+ 10개 더보기 (${results.length}/${totalCount})`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </main>

        {saveToast && (
        <div className="fixed top-24 right-12 z-[9999] flex items-center gap-3 bg-[#5244e8]/80 text-white text-[15px] font-bold px-7 py-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(82,68,232,0.6)] border border-indigo-400/30 animate-fade-in-down backdrop-blur-sm">
          <svg className="w-6 h-6 text-indigo-100 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          현재 설정이 성공적으로 저장되었습니다.
        </div>
      )}

      <SavedSearchesDrawer 
          isOpen={isDrawerOpen} 
          onClose={() => setIsDrawerOpen(false)} 
          pageType="INDEX_CHECK" 
          onSelect={handleApplySavedSetting} 
        />
      </div>
    </>
  );
}