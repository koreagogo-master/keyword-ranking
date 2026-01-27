'use client';

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";

function AnalysisContent() {
  const [keyword, setKeyword] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [blogList, setBlogList] = useState<any[]>([]); 
  const [isSearching, setIsSearching] = useState(false);
  
  const searchParams = useSearchParams();

  useEffect(() => {
    const queryKeyword = searchParams.get('keyword');
    if (queryKeyword && queryKeyword !== keyword) {
      setKeyword(queryKeyword);
      const timer = setTimeout(() => handleSearch(queryKeyword), 100);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const handleSearch = async (targetKeyword?: string) => {
    const searchTarget = targetKeyword || keyword;
    if (!searchTarget.trim()) return;
    if (targetKeyword) setKeyword(searchTarget);
    setIsSearching(true);

    try {
      const res = await fetch(`/api/keyword?keyword=${encodeURIComponent(searchTarget)}`);
      if (!res.ok) throw new Error('네트워크 응답 오류');
      const data = await res.json();
      setSearchResult(data);
      if (data.blogList) setBlogList(data.blogList); 
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      alert("데이터를 가져오는데 실패했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const HorizontalBarChart = ({ value1, value2, label1, label2, color1, color2 }: any) => {
    const v1 = Number(value1) || 0;
    const v2 = Number(value2) || 0;
    const total = v1 + v2;
    const ratio1 = total > 0 ? (v1 / total) * 100 : 50;
    const ratio2 = 100 - ratio1;

    return (
      <div className="w-full px-2">
        <div className="flex h-12 w-full mb-4 border border-gray-100">
          <div style={{ width: `${ratio1}%`, backgroundColor: color1 }} className="h-full transition-all duration-1000" />
          <div style={{ width: `${ratio2}%`, backgroundColor: color2 }} className="h-full transition-all duration-1000" />
        </div>
        <div className="flex justify-between items-center text-sm font-black">
          <div style={{ color: color1 }}>{label1} {ratio1.toFixed(1)}%</div>
          <div style={{ color: color2 }}>{ratio2.toFixed(1)}% {label2}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex bg-gray-50 min-h-screen font-body text-gray-900">
      <Sidebar />
      <main className="flex-1 ml-64 p-10">
        <div className="max-w-6xl mx-auto">
          
          <div className="bg-white p-2 border border-gray-200 flex items-center mb-10 shadow-sm">
            <input 
              type="text" 
              className="flex-1 px-6 outline-none text-lg font-bold text-gray-800 bg-transparent"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="분석할 키워드 입력"
            />
            <button onClick={() => handleSearch()} className="bg-[#ff8533] text-white px-10 py-4 font-black hover:bg-[#e6762e]">
              {isSearching ? "분석 중..." : "실시간 분석"}
            </button>
          </div>

          {searchResult ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
              
              <div className="grid grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-8 border border-gray-200 shadow-sm">
                  {/* 메뉴명 스타일 조정 및 간격 좁힘 */}
                  <h3 className="font-bold text-gray-600 mb-5 text-left text-[15px] border-l-4 border-[#ff8533] pl-3">PC / Mobile 검색비율</h3>
                  <HorizontalBarChart 
                    value1={searchResult.analysis?.deviceMix?.mobile} 
                    value2={searchResult.analysis?.deviceMix?.pc} 
                    label1="Mobile"
                    label2="PC"
                    color1="#ff8533" 
                    color2="#60a5fa" 
                  />
                </div>

                <div className="bg-white p-8 border border-gray-200 shadow-sm">
                  <h3 className="font-bold text-gray-600 mb-5 text-left text-[15px] border-l-4 border-[#ff8533] pl-3">성별 검색 비율</h3>
                  {searchResult.analysis?.genderRatio ? (
                    <HorizontalBarChart 
                      value1={searchResult.analysis?.genderRatio?.female} 
                      value2={searchResult.analysis?.genderRatio?.male} 
                      label1="여성"
                      label2="남성"
                      color1="#fb7185" 
                      color2="#60a5fa" 
                    />
                  ) : (
                    <div className="h-24 flex items-center justify-center text-gray-400 text-xs font-bold bg-gray-50">데이터 분석 불가</div>
                  )}
                </div>

                <div className="bg-white p-8 border border-gray-200 shadow-sm">
                  <h3 className="font-bold text-gray-600 mb-5 text-left text-[15px] border-l-4 border-[#ff8533] pl-3">블로그 / 카페 콘텐츠 분포</h3>
                  <HorizontalBarChart 
                    value1={searchResult.totalPostCount} 
                    value2={searchResult.totalCafeCount} 
                    label1="블로그"
                    label2="카페"
                    color1="#ff8533" 
                    color2="#60a5fa" 
                  />
                </div>
              </div>

              <div className="space-y-6 mb-10 text-left">
                
                <div className="bg-white p-8 border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-end mb-8">
                    <h3 className="font-bold text-gray-600 text-[15px] border-l-4 border-[#ff8533] pl-3">월간 검색량 상세 분석</h3>
                    <div className="text-right">
                      <span className="text-gray-400 text-[10px] font-bold uppercase block mb-1">월간 총 검색량</span>
                      <span className="text-3xl font-black text-gray-800">
                        {(searchResult.monthlyPcQcCnt + searchResult.monthlyMobileQcCnt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex h-16 w-full border border-gray-100">
                      <div 
                        style={{ width: `${(searchResult.monthlyMobileQcCnt / (searchResult.monthlyPcQcCnt + searchResult.monthlyMobileQcCnt)) * 100}%` }} 
                        className="bg-orange-400 h-full flex items-center px-4 overflow-hidden"
                      >
                        <span className="text-white text-sm font-black whitespace-nowrap">MO {searchResult.monthlyMobileQcCnt.toLocaleString()}</span>
                      </div>
                      <div 
                        style={{ width: `${(searchResult.monthlyPcQcCnt / (searchResult.monthlyPcQcCnt + searchResult.monthlyMobileQcCnt)) * 100}%` }} 
                        className="bg-blue-400 h-full flex items-center justify-end px-4 overflow-hidden"
                      >
                        <span className="text-white text-sm font-black whitespace-nowrap">PC {searchResult.monthlyPcQcCnt.toLocaleString()}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold text-center uppercase tracking-widest">
                      모바일 vs PC 실제 검색량 비교
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white p-8 border border-gray-200 shadow-sm">
                    <h4 className="text-sm font-bold text-gray-600 mb-8 uppercase tracking-widest border-l-4 border-[#ff8533] pl-3">월별 검색 비율</h4>
                    <div className="flex items-end justify-between h-32 gap-1">
                      {searchResult.analysis?.monthlyTrend?.map((item: any, i: number) => (
                        <div key={i} className="flex flex-col items-center flex-1">
                          <div className="w-full bg-blue-100 hover:bg-blue-400 transition-all" style={{ height: `${item.value}%` }}></div>
                          <span className="text-[9px] text-gray-400 mt-2 font-bold">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white p-8 border border-gray-200 shadow-sm">
                    <h4 className="text-sm font-bold text-gray-600 mb-8 uppercase tracking-widest border-l-4 border-[#ff8533] pl-3">요일별 검색 비율</h4>
                    <div className="flex items-end justify-between h-32 gap-3">
                      {searchResult.analysis?.weeklyTrend?.map((item: any, i: number) => (
                        <div key={i} className="flex flex-col items-center flex-1">
                          <div className="w-full bg-blue-400 opacity-80" style={{ height: `${item.value}%` }}></div>
                          <span className="text-[10px] text-gray-400 mt-2 font-bold">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 border border-gray-200 shadow-sm">
                  <h4 className="text-sm font-bold text-gray-600 mb-8 uppercase tracking-widest border-l-4 border-[#ff8533] pl-3">연령별 검색 비율</h4>
                  <div className="flex items-end justify-between h-32 gap-6 px-4">
                    {searchResult.analysis?.ageTrend?.map((item: any, i: number) => (
                      <div key={i} className="flex flex-col items-center flex-1">
                        <div className="w-full bg-indigo-500" style={{ height: `${item.value}%` }}></div>
                        <span className="text-[11px] text-gray-500 mt-3 font-black">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 shadow-sm overflow-hidden text-left">
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-sm font-bold text-gray-600 border-l-4 border-[#ff8533] pl-3">연관검색어 상세 리포트</h3>
                  </div>
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-6 py-4 font-black text-gray-500">키워드</th>
                        <th className="px-4 py-4 font-black text-gray-500 text-right">월간 검색량</th>
                        <th className="px-4 py-4 font-black text-gray-400 text-right italic">PC</th>
                        <th className="px-4 py-4 font-black text-gray-400 text-right italic">MO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResult.relatedKeywords?.slice(0, 15).map((item: any, index: number) => (
                        <tr key={index} className="hover:bg-orange-50/30 border-b border-gray-50 last:border-none cursor-pointer group" onClick={() => handleSearch(item.relKeyword)}>
                          <td className="px-6 py-4 font-bold text-gray-700 group-hover:text-orange-600">{item.relKeyword}</td>
                          <td className="px-4 py-4 font-black text-gray-900 text-right">{(Number(item.monthlyPcQcCnt) + Number(item.monthlyMobileQcCnt)).toLocaleString()}</td>
                          <td className="px-4 py-4 text-gray-400 text-right">{Number(item.monthlyPcQcCnt || 0).toLocaleString()}</td>
                          <td className="px-4 py-4 text-gray-400 text-right">{Number(item.monthlyMobileQcCnt || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-gray-200 shadow-sm p-8 text-left mb-10">
                <h3 className="font-bold text-gray-600 text-base mb-10 border-l-4 border-[#ff8533] pl-4 uppercase">실시간 블로그 순위 TOP 10</h3>
                <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                  {blogList.map((blog, idx) => (
                    <a key={idx} href={blog.link} target="_blank" className="flex items-center gap-5 group py-4 border-b border-gray-50 last:border-none">
                      <span className="text-2xl font-black text-gray-100 group-hover:text-orange-500 transition-colors w-8">{idx + 1}</span>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-800 group-hover:underline mb-1 line-clamp-1" dangerouslySetInnerHTML={{ __html: blog.title }} />
                        <div className="flex items-center gap-3 text-[11px] text-gray-400 font-bold uppercase">
                          <span className="text-gray-600">{blog.bloggername}</span>
                          <span>{blog.postdate}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-48 text-center border-2 border-dashed border-gray-200 bg-white">
              <h2 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-widest">분석 데이터 허브</h2>
              <p className="text-gray-400 font-bold">분석할 키워드를 입력하고 정밀 리포트를 확인하세요.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black text-gray-400 uppercase tracking-widest">Loading...</div>}>
      <AnalysisContent />
    </Suspense>
  );
}