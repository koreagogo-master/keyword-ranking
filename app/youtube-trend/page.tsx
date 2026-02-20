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

  const handleSearch = async (targetKeyword?: string) => {
    const k = (typeof targetKeyword === 'string' ? targetKeyword : keyword).trim();
    if (!k) return;
    
    setKeyword(k);
    setIsSearching(true);
    setHasSearched(false);
    setVideoList([]);
    setSuggestedList([]); 
    setSearchedKeyword(k);

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

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] !text-black">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-10">
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
                      "<span className="text-[#ea4335]">{searchedKeyword}</span>" 상위 노출 영상 TOP 10
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
                            <img 
                              src={video.thumbnail} 
                              alt="thumbnail" 
                              className="w-full h-auto rounded-md shadow-sm border border-gray-200 object-cover aspect-video"
                              loading="lazy"
                            />
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
                            <p className="text-[13px] text-slate-500 font-medium mb-2">{video.channelTitle}</p>
                            
                            {/* 🌟 [수정됨] 태그 영역을 더 눈에 띄는 박스 형태로 변경 */}
                            {video.tags && video.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2 p-2 bg-[#f8f9fa] rounded-md border border-gray-100">
                                {video.tags.slice(0, 5).map((tag: string, i: number) => (
                                  <span key={i} className="px-2 py-1 bg-white text-slate-600 text-[12px] rounded-sm font-medium border border-gray-200 shadow-sm">
                                    #{tag}
                                  </span>
                                ))}
                                {video.tags.length > 5 && (
                                  <span className="px-2 py-1 text-slate-400 text-[11px] font-bold flex items-center">
                                    +{video.tags.length - 5}
                                  </span>
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
      </main>
    </div>
  );
}