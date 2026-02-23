'use client';

import { useState } from 'react';
import Sidebar from "@/components/Sidebar";

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
  const [keyword, setKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [videoList, setVideoList] = useState<any[]>([]);
  const [suggestedList, setSuggestedList] = useState<string[]>([]);
  const [searchedKeyword, setSearchedKeyword] = useState("");

  const [descModal, setDescModal] = useState<{isOpen: boolean, text: string, title: string}>({isOpen: false, text: '', title: ''});
  
  // 🌟 [추가됨] 어떤 영상의 '숨은 태그'가 펼쳐져 있는지 기억하는 상태 저장소
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});

  const handleSearch = async (targetKeyword?: string) => {
    const k = (typeof targetKeyword === 'string' ? targetKeyword : keyword).trim();
    if (!k) return;
    
    setKeyword(k);
    setIsSearching(true);
    setHasSearched(false);
    setVideoList([]);
    setSuggestedList([]); 
    setSearchedKeyword(k);
    setExpandedTags({}); // 🌟 새로운 검색 시 태그 펼침 상태 초기화

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

  const handleCopyUrls = () => {
    if (videoList.length === 0) return;
    const urls = videoList.map(v => `https://www.youtube.com/watch?v=${v.videoId}`).join('\n');
    navigator.clipboard.writeText(urls).then(() => {
      alert(`✅ 총 ${videoList.length}개의 타겟 영상 주소가 복사되었습니다!\n구글 Ads 게재위치 타겟팅에 바로 붙여넣기 하세요.`);
    }).catch(err => {
      alert('복사에 실패했습니다.');
    });
  };

  // 🌟 [추가됨] 태그 더보기/접기 버튼을 눌렀을 때 작동하는 함수
  const toggleTags = (videoId: string) => {
    setExpandedTags(prev => ({
      ...prev,
      [videoId]: !prev[videoId]
    }));
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] !text-black">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-10 relative">
        <div className="max-w-7xl mx-auto">
          
          <div className="mb-8">
            <h1 className="text-2xl font-bold !text-black">유튜브 트렌드 분석</h1>
            <p className="text-sm text-slate-500 mt-1">* 상위 노출 영상의 조회수, 숨겨진 태그를 분석하고 구글 Ads 타겟팅용 URL을 일괄 추출합니다.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm flex items-center shadow-md focus-within:border-red-400 overflow-hidden max-w-2xl mb-8">
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
              className="px-10 py-3.5 font-bold bg-[#ea4335] hover:bg-[#d33828] text-white transition-colors text-base whitespace-nowrap border-l border-gray-200 disabled:opacity-70"
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
                        style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca' }}
                        className="!text-[#ea4335] px-3 py-1.5 border font-medium text-[13px] rounded-md hover:bg-[#fee2e2] transition-colors cursor-pointer"
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
                      "<span className="text-[#ea4335]">{searchedKeyword}</span>" 상위 노출 영상 TOP <span className="text-[#ea4335]">{videoList.length}</span>
                    </h3>
                    
                    <button 
                      onClick={handleCopyUrls}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[12px] font-bold rounded-md transition-colors shadow-sm flex items-center gap-1"
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
                                className="w-full h-auto rounded-md shadow-sm border border-gray-200 object-cover aspect-video"
                                loading="lazy"
                              />
                              {video.isShorts && (
                                <span className="absolute bottom-1.5 right-1.5 bg-[#ea4335] text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm border border-[#d33828]">
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
                              className="!text-black font-bold text-[14px] hover:text-[#ea4335] hover:underline line-clamp-2 mb-1 leading-snug block"
                            >
                              {video.title}
                            </a>
                            
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[13px] text-slate-500 font-medium">{video.channelTitle}</span>
                              <span className="text-[11px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-bold whitespace-nowrap">
                                구독자 {formatNum(video.subscriberCount)}명
                              </span>
                              
                              {/* 🌟 [수정됨] 상세 설명 버튼 텍스트를 검은색(!text-black)으로 변경 */}
                              {video.description && video.description.trim() !== '' && (
                                <button 
                                  onClick={() => setDescModal({isOpen: true, text: video.description, title: video.title})}
                                  className="text-[11px] bg-slate-100 !text-black hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 rounded font-bold transition-colors"
                                >
                                  상세 설명 보기
                                </button>
                              )}
                            </div>
                            
                            {video.tags && video.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2 p-2 bg-[#f8f9fa] rounded-md border border-gray-100 items-center">
                                <span className="text-[12px] font-bold text-slate-700 mr-1 flex items-center whitespace-nowrap">
                                  숨은 태그:
                                </span>
                                
                                {/* 🌟 [수정됨] 펼침 상태(expandedTags)에 따라 5개만 보여줄지, 전부 다 보여줄지 결정 */}
                                {(expandedTags[video.videoId] ? video.tags : video.tags.slice(0, 5)).map((tag: string, i: number) => (
                                  <span key={i} className="px-2 py-1 bg-white text-slate-600 text-[12px] rounded-sm font-medium border border-gray-200 shadow-sm">
                                    #{tag}
                                  </span>
                                ))}
                                
                                {/* 접혀있고 태그가 5개 이상일 때 나타나는 [더보기] 버튼 */}
                                {!expandedTags[video.videoId] && video.tags.length > 5 && (
                                  <button 
                                    onClick={() => toggleTags(video.videoId)}
                                    className="px-2 py-1 !text-blue-600 hover:!text-black text-[11px] font-bold flex items-center bg-gray-200 rounded-sm cursor-pointer transition-colors"
                                  >
                                    +{video.tags.length - 5} 더보기
                                  </button>
                                )}
                                
                                {/* 펼쳐져 있을 때 나타나는 [접기] 버튼 */}
                                {expandedTags[video.videoId] && video.tags.length > 5 && (
                                  <button 
                                    onClick={() => toggleTags(video.videoId)}
                                    className="px-2 py-1 !text-blue-600 hover:!text-black text-[11px] font-bold flex items-center bg-gray-200 rounded-sm cursor-pointer transition-colors"
                                  >
                                    접기
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right font-extrabold text-[#ea4335] text-[14px]">
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
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
                <h4 className="font-bold text-slate-800 text-[15px] truncate pr-4 border-l-4 border-[#ea4335] pl-2">
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
  );
}