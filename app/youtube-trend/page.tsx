'use client';

// 🌟 useEffect와 useRef 추가
import { useState, useEffect, useRef } from 'react';
// 🌟 URL 파라미터를 읽기 위해 추가
import { useSearchParams } from 'next/navigation';

import Sidebar from "@/components/Sidebar";
import GoogleTabs from "@/components/GoogleTabs";

import { createClient } from "@/app/utils/supabase/client";
import { useAuth } from '@/app/contexts/AuthContext';
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";

import { usePoint } from '@/app/hooks/usePoint'; 

const formatNum = (numStr: string) => {
  if (!numStr) return '0';
  return Number(numStr).toLocaleString('ko-KR');
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function YouTubeTrendPage() {
  const { user } = useAuth();
  const { deductPoints } = usePoint(); 
  
  // 🌟 URL 쿼리 파라미터 읽기
  const searchParams = useSearchParams();
  const urlKeyword = searchParams.get('keyword');
  
  // 🌟 중복 실행 방지를 위한 Ref
  const isSearchExecuted = useRef(false);

  const [keyword, setKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [videoList, setVideoList] = useState<any[]>([]);
  const [suggestedList, setSuggestedList] = useState<string[]>([]);
  const [searchedKeyword, setSearchedKeyword] = useState("");

  const [descModal, setDescModal] = useState<{isOpen: boolean, text: string, title: string}>({isOpen: false, text: '', title: ''});
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSearch = async (targetKeyword?: string) => {
    const k = (typeof targetKeyword === 'string' ? targetKeyword : keyword).trim();
    if (!k) return;

    const isPaySuccess = await deductPoints(user?.id, 10, 1, k);
    if (!isPaySuccess) return; 
    
    setKeyword(k);
    setIsSearching(true);
    setHasSearched(false);
    setVideoList([]);
    setSuggestedList([]); 
    setSearchedKeyword(k);
    setExpandedTags({}); 

    try {
      const res = await fetch(`/api/youtube-search?keyword=${encodeURIComponent(k)}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '데이터를 가져오는데 실패했습니다.');
      setVideoList(data.data || []);

      try {
        const suggestRes = await fetch(`/api/youtube-suggest?keyword=${encodeURIComponent(k)}`);
        const suggestData = await suggestRes.json();
        if (suggestData.success) {
          setSuggestedList(suggestData.suggested || []);
        }
      } catch (e) {
        console.error("자동완성 호출 실패:", e);
      }

    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  // 🌟 자동 검색 센서 로직 시작
  useEffect(() => {
    // URL 파라미터가 존재하고, 아직 검색이 실행되지 않았을 때만 작동
    if (urlKeyword && !isSearchExecuted.current) {
      isSearchExecuted.current = true; // 중복 실행 방지 락 걸기
      
      setKeyword(urlKeyword);

      // 약간의 딜레이를 주어 상태 업데이트가 화면에 반영될 시간을 확보
      setTimeout(() => {
        handleSearch(urlKeyword);
      }, 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKeyword]);

  const handleCopyUrls = () => {
    if (videoList.length === 0) return;
    const urls = videoList.map(v => `https://www.youtube.com/watch?v=${v.videoId}`).join('\n');
    navigator.clipboard.writeText(urls).then(() => {
      alert(`✅ 총 ${videoList.length}개의 타겟 영상 주소가 복사되었습니다!\n구글 Ads 게재위치 타겟팅에 바로 붙여넣기 하세요.`);
    }).catch(err => {
      alert('복사에 실패했습니다.');
    });
  };

  const toggleTags = (videoId: string) => {
    setExpandedTags(prev => ({
      ...prev,
      [videoId]: !prev[videoId]
    }));
  };

  const handleSaveCurrentSetting = async () => {
    if (!keyword) {
      alert("키워드를 입력한 후 저장해주세요.");
      return;
    }
    if (!user) {
      alert('로그인 정보가 만료되었거나 확인할 수 없습니다. 다시 로그인해주세요.');
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user?.id,
      page_type: 'YOUTUBE',
      nickname: '',
      keyword: keyword
    });

    if (!error) alert("현재 설정이 안전하게 저장되었습니다.");
    else alert("저장 중 오류가 발생했습니다.");
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false); 
    setKeyword(item.keyword);
    handleSearch(item.keyword); 
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <div className="flex min-h-screen bg-[#f8f9fa] !text-black antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        <Sidebar />
        
        <main className="flex-1 ml-64 p-10 relative">
          <div className="max-w-7xl mx-auto">
            
            <GoogleTabs />
            
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold !text-black mb-2">유튜브 트렌드 분석</h1>
                <p className="text-sm text-slate-500 mt-1">* 상위 노출 영상의 조회수, 숨겨진 태그를 분석하고 구글 Ads 타겟팅용 URL을 일괄 추출합니다.</p>
              </div>
              <div className="flex items-center gap-2 mt-1 shrink-0">
                <button 
                  onClick={handleSaveCurrentSetting}
                  disabled={!keyword || !user}
                  className={`px-4 py-2 text-sm font-bold text-white rounded-md shadow-sm flex items-center gap-1.5 transition-colors
                    ${(!keyword || !user) ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-800'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  현재 설정 저장
                </button>
                <button 
                  onClick={() => setIsDrawerOpen(true)}
                  className="px-4 py-2 text-sm font-bold text-white bg-slate-700 rounded-sm hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                  저장된 목록 보기
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-sm flex items-center shadow-md focus-within:border-[#5244e8]/50 overflow-hidden max-w-2xl mb-8">
              <input 
                type="text" 
                value={keyword} 
                onChange={(e) => setKeyword(e.target.value)} 
                onKeyDown={(e) => e.key === "Enter" && handleSearch()} 
                className="flex-1 py-3 px-4 text-base outline-none !text-black bg-white" 
                placeholder="분석할 유튜브 검색어 입력 (예: 다이어트 식단)" 
              />
              <button 
                onClick={() => handleSearch()} 
                disabled={isSearching} 
                className="px-10 py-3.5 font-bold bg-[#5244e8] hover:bg-[#4336c9] text-white transition-colors text-base whitespace-nowrap border-l border-gray-200 disabled:opacity-70"
              >
                {isSearching ? "조회 중..." : "조회"}
              </button>
            </div>

            {hasSearched && (
              <div className="space-y-6 animate-in fade-in duration-500">
                
                {suggestedList.length > 0 && (
                  <div className="bg-white p-5 border border-gray-200 shadow-sm rounded-sm">
                    <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                      "{searchedKeyword}" 유튜브 자동완성 키워드
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {suggestedList.map((item, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => handleSearch(item)} 
                          className="!text-black px-3 py-1.5 border border-gray-300 bg-gray-50 font-medium text-[13px] rounded-sm hover:bg-[#5244e8]/10 hover:border-[#5244e8] hover:text-[#5244e8] transition-colors cursor-pointer"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {videoList.length > 0 ? (
                  <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-700 text-sm">
                        "<span className="text-[#5244e8]">{searchedKeyword}</span>" 상위 노출 영상 TOP <span className="text-[#5244e8]">{videoList.length}</span>
                      </h3>
                      
                      <button 
                        onClick={handleCopyUrls}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-[12px] font-bold rounded-sm transition-colors shadow-sm flex items-center gap-1"
                      >
                        🔗 타겟 URL 일괄 복사
                      </button>
                    </div>
                    
                    <table className="w-full text-left border-collapse table-fixed">
                      <thead className="bg-white border-b border-gray-200">
                        <tr className="text-[13px]">
                          <th className="px-5 py-4 font-bold text-slate-500 text-center w-16">순위</th>
                          <th className="px-5 py-4 font-bold text-slate-500 w-48">썸네일</th>
                          <th className="px-5 py-4 font-bold text-slate-500 w-auto">영상 정보 & 숨겨진 태그</th>
                          <th className="px-5 py-4 font-bold text-slate-500 text-right w-28">조회수</th>
                          <th className="px-5 py-4 font-bold text-slate-500 text-right w-24">좋아요</th>
                          <th className="px-5 py-4 font-bold text-slate-500 text-right w-24">댓글</th>
                          <th className="px-5 py-4 font-bold text-slate-500 text-center w-28">업로드일</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {videoList.map((video, idx) => (
                          <tr key={video.videoId} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 text-center text-slate-400 font-bold text-[14px]">
                              {idx + 1}
                            </td>
                            <td className="px-5 py-3">
                              <div className="relative w-full">
                                <img 
                                  src={video.thumbnail} 
                                  alt="thumbnail" 
                                  className="w-full h-auto rounded-sm shadow-sm border border-gray-200 object-cover aspect-video"
                                  loading="lazy"
                                />
                                {video.isShorts && (
                                  <span className="absolute bottom-1.5 right-1.5 bg-[#5244e8] text-white text-[10px] font-black px-1.5 py-0.5 rounded-sm shadow-sm border border-[#4336c9]">
                                    SHORTS
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <a 
                                href={`https://www.youtube.com/watch?v=${video.videoId}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="!text-black font-bold text-[14px] hover:text-[#5244e8] hover:underline line-clamp-2 mb-1 leading-snug block"
                              >
                                {video.title}
                              </a>
                              
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[13px] text-slate-500 font-medium">{video.channelTitle}</span>
                                <span className="text-[11px] bg-[#5244e8]/5 text-[#5244e8] px-1.5 py-0.5 rounded-sm border border-[#5244e8]/20 font-bold whitespace-nowrap">
                                  구독자 {formatNum(video.subscriberCount)}명
                                </span>
                                
                                {video.description && video.description.trim() !== '' && (
                                  <button 
                                    onClick={() => setDescModal({isOpen: true, text: video.description, title: video.title})}
                                    className="text-[11px] bg-slate-100 !text-black hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 rounded-sm font-bold transition-colors"
                                  >
                                    상세 설명 보기
                                  </button>
                                )}
                              </div>
                              
                              {video.tags && video.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2 p-2 bg-[#f8f9fa] rounded-sm border border-gray-100 items-center">
                                  <span className="text-[12px] font-bold text-slate-700 mr-1 flex items-center whitespace-nowrap">
                                    숨은 태그:
                                  </span>
                                  
                                  {(expandedTags[video.videoId] ? video.tags : video.tags.slice(0, 5)).map((tag: string, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-white text-slate-600 text-[12px] rounded-sm font-medium border border-gray-200 shadow-sm">
                                      #{tag}
                                    </span>
                                  ))}
                                  
                                  {!expandedTags[video.videoId] && video.tags.length > 5 && (
                                    <button 
                                      onClick={() => toggleTags(video.videoId)}
                                      className="px-2 py-1 !text-[#5244e8] hover:!text-black text-[11px] font-bold flex items-center bg-gray-200 rounded-sm cursor-pointer transition-colors"
                                    >
                                      +{video.tags.length - 5} 더보기
                                    </button>
                                  )}
                                  
                                  {expandedTags[video.videoId] && video.tags.length > 5 && (
                                    <button 
                                      onClick={() => toggleTags(video.videoId)}
                                      className="px-2 py-1 !text-[#5244e8] hover:!text-black text-[11px] font-bold flex items-center bg-gray-200 rounded-sm cursor-pointer transition-colors"
                                    >
                                      접기
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right font-extrabold text-[#5244e8] text-[14px]">
                              {formatNum(video.viewCount)}
                            </td>
                            <td className="px-5 py-3 text-right font-medium text-slate-600 text-[13px]">
                              {formatNum(video.likeCount)}
                            </td>
                            <td className="px-5 py-3 text-right font-medium text-slate-600 text-[13px]">
                              {formatNum(video.commentCount)}
                            </td>
                            <td className="px-5 py-3 text-center text-slate-500 text-[13px] tracking-tighter">
                              {formatDate(video.publishedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-white p-12 border border-gray-200 shadow-sm rounded-sm text-center">
                    <span className="text-4xl mb-4 block">🚫</span>
                    <h3 className="font-bold text-slate-700 text-lg mb-2">검색 결과가 없습니다.</h3>
                    <p className="text-[14px] text-slate-500 max-w-lg mx-auto leading-relaxed">
                      입력하신 키워드와 일치하는 유튜브 동영상을 찾을 수 없거나,<br/>
                      일시적인 통신 오류일 수 있습니다. 다른 검색어로 다시 시도해 주세요.
                    </p>
                  </div>
                )}

              </div>
            )}

          </div>
          
          {descModal.isOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999] p-4 backdrop-blur-sm">
              <div className="bg-white rounded-sm w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-slate-50 rounded-t-sm">
                  <h4 className="font-bold text-slate-800 text-[15px] truncate pr-4 border-l-4 border-[#5244e8] pl-2">
                    상세 설명 (더보기란)
                  </h4>
                  <button 
                    onClick={() => setDescModal({isOpen: false, text: '', title: ''})} 
                    className="text-gray-400 hover:text-red-500 font-bold text-2xl leading-none"
                  >
                    &times;
                  </button>
                </div>
                <div className="p-6 overflow-y-auto whitespace-pre-wrap text-[14px] text-slate-700 leading-relaxed font-medium">
                  {descModal.text || '상세 설명이 없습니다.'}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
      
      <SavedSearchesDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        pageType="YOUTUBE" 
        onSelect={handleApplySavedSetting} 
      />
    </>
  );
}