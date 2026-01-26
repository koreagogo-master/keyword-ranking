// app/analysis/page.tsx
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

  // 등급 판정 로직
  const getGradeInfo = (rate: number) => {
    if (rate < 0.5) return { 
      label: "S", title: "압도적 황금 키워드", color: "from-yellow-400 to-orange-500", 
      desc: "검색량 대비 문서가 극히 적습니다. 지금 당장 포스팅하면 상단 점유가 확실시됩니다." 
    };
    if (rate < 1.5) return { 
      label: "A+", title: "최적의 공략 적기", color: "from-[#ff8533] to-[#ff6600]", 
      desc: "상단 노출 확률이 매우 높은 좋은 키워드입니다. 스마트블록 틈새를 공략해 보세요." 
    };
    if (rate < 5.0) return { 
      label: "B", title: "안정적 경쟁 중", color: "from-blue-500 to-indigo-600", 
      desc: "이미 많은 정보가 유통되고 있습니다. 차별화된 고퀄리티 내용이 필요합니다." 
    };
    return { 
      label: "C", title: "치열한 레드 오션", color: "from-gray-600 to-gray-800", 
      desc: "경쟁이 매우 치열하여 상단 노출이 어렵습니다. 세부 키워드 조합을 추천합니다." 
    };
  };

  const handleSearch = async (targetKeyword?: string) => {
    const searchTarget = targetKeyword || keyword;
    if (!searchTarget.trim()) return;
    
    if (targetKeyword) setKeyword(targetKeyword);
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

  const currentGrade = searchResult ? getGradeInfo(Number(searchResult.competitionRate)) : null;

  return (
    <div className="flex bg-gray-50 min-h-screen font-body text-gray-900">
      <Sidebar />
      <main className="flex-1 ml-64 p-10">
        <div className="max-w-6xl mx-auto">
          
          {/* 타이틀 */}
          <div className="mb-10 text-left">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-2 h-8 bg-[#ff8533] rounded-full"></span>
              <h1 className="text-3xl font-black text-gray-900 font-title tracking-tight">키워드 탐색기</h1>
            </div>
          </div>

          {/* 검색바 */}
          <div className="bg-white p-4 rounded-[28px] shadow-sm border border-gray-100 flex items-center mb-10">
            <input 
              type="text" 
              className="flex-1 px-6 outline-none text-lg font-bold text-gray-800 bg-transparent"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="분석할 키워드 입력"
            />
            <button onClick={() => handleSearch()} className="bg-[#ff8533] text-white px-8 py-3 rounded-2xl font-black font-title">
              {isSearching ? "분석 중..." : "실시간 분석"}
            </button>
          </div>

          {searchResult && currentGrade ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* 판정 카드 (도움말 아이콘 추가) */}
              <div className={`mb-10 p-8 rounded-[32px] bg-gradient-to-br ${currentGrade.color} text-white shadow-xl text-left relative overflow-hidden group`}>
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase">TMG AI 판정</span>
                      {/* 도움말 아이콘 및 툴팁 */}
                      <div className="relative group/tip">
                        <span className="cursor-help text-white/60 hover:text-white transition-colors">ⓘ</span>
                        <div className="absolute left-0 top-6 w-64 p-3 bg-black/80 backdrop-blur text-[11px] rounded-xl opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed font-medium">
                          본 등급은 네이버 광고 API의 월간 검색량과 블로그/카페 문서 발행량을 실시간으로 비교 분석하여 산출된 마케팅 지수입니다.
                        </div>
                      </div>
                    </div>
                    <h2 className="text-3xl font-black mb-2 font-title">
                      이 키워드는 현재 <span className="underline decoration-white/40 underline-offset-8">{currentGrade.title}</span>입니다.
                    </h2>
                    <p className="text-white/80 font-medium max-w-2xl leading-relaxed">{currentGrade.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-6xl font-black font-title leading-none">{currentGrade.label}</p>
                    <p className="text-[10px] font-bold text-white/60 mt-2 uppercase tracking-widest">Grade</p>
                  </div>
                </div>
              </div>

              {/* 인사이트/분포비 */}
              <div className="grid grid-cols-3 gap-6 mb-10">
                <div className="col-span-2 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm text-left">
                  <h3 className="font-title font-bold text-gray-800 mb-8 flex items-center gap-2">공략 골든타임 & 타겟팅</h3>
                  <div className="flex items-center justify-around gap-4 pb-4 font-title">
                    <div className="text-center">
                      <p className="text-gray-400 text-[10px] font-bold mb-2 uppercase">Primary Target</p>
                      <p className="text-xl font-black text-gray-800">{searchResult.demographics?.age || "30-40대"}</p>
                    </div>
                    <div className="h-10 w-px bg-gray-100"></div>
                    <div className="text-center">
                      <p className="text-gray-400 text-[10px] font-bold mb-2 uppercase">Gender Bias</p>
                      <p className="text-xl font-black text-[#ff8533]">{searchResult.demographics?.gender === 'm' ? "남성 위주" : "여성 위주"}</p>
                    </div>
                    <div className="h-10 w-px bg-gray-100"></div>
                    <div className="text-center">
                      <p className="text-gray-400 text-[10px] font-bold mb-2 uppercase">Best Day</p>
                      <p className="text-xl font-black text-blue-500">수요일 오후</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm text-left">
                  <h3 className="font-title font-bold text-gray-800 mb-6">콘텐츠 분포비</h3>
                  <div className="space-y-5">
                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-2 uppercase">
                        <span className="text-gray-500">블로그</span>
                        <span className="text-gray-900">{((searchResult.totalPostCount / (searchResult.totalPostCount + searchResult.totalCafeCount)) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-400 transition-all duration-1000" style={{ width: `${(searchResult.totalPostCount / (searchResult.totalPostCount + searchResult.totalCafeCount)) * 100}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-2 uppercase">
                        <span className="text-gray-500">카페</span>
                        <span className="text-gray-900">{((searchResult.totalCafeCount / (searchResult.totalPostCount + searchResult.totalCafeCount)) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 transition-all duration-1000" style={{ width: `${(searchResult.totalCafeCount / (searchResult.totalPostCount + searchResult.totalCafeCount)) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 메인 리포트 영역 (너비 조정 적용) */}
              <div className="grid grid-cols-12 gap-8">
                {/* 왼쪽: 연관 키워드 탐색 (width 축소) */}
                <div className="col-span-5 bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden text-left flex flex-col h-fit">
                   <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-800 font-title">연관키워드 탐색 상위 20</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[12px]">
                      <thead>
                        <tr className="bg-gray-50/50">
                          <th className="px-4 py-3 font-bold text-gray-500 border-b">키워드</th>
                          <th className="px-2 py-3 font-bold text-gray-500 border-b text-right">PC</th>
                          <th className="px-2 py-3 font-bold text-gray-500 border-b text-right">모바일</th>
                          <th className="px-4 py-3 font-bold text-gray-900 border-b text-right">합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResult.relatedKeywords?.slice(0, 20).map((item: any, index: number) => (
                          <tr key={index} onClick={() => handleSearch(item.relKeyword)} className="hover:bg-orange-50 cursor-pointer border-b border-gray-50 last:border-none group">
                            <td className="px-4 py-2 font-bold text-gray-700 group-hover:text-orange-500 transition-colors">{item.relKeyword}</td>
                            <td className="px-2 py-2 text-gray-400 text-right">{Number(item.monthlyPcQcCnt || 0).toLocaleString()}</td>
                            <td className="px-2 py-2 text-gray-400 text-right">{Number(item.monthlyMobileQcCnt || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 font-black text-gray-800 text-right">
                              {(Number(item.monthlyPcQcCnt || 0) + Number(item.monthlyMobileQcCnt || 0)).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 오른쪽: 블로그 실시간 순위 (width 확장) */}
                <div className="col-span-7 bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 text-left h-fit">
                  <h3 className="font-title font-bold text-xl mb-10 flex items-center gap-2">
                    <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-lg text-sm font-black">TOP 10</span> 
                    <span className="text-gray-800">블로그 실시간 순위</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    {blogList.map((blog, idx) => (
                      <a key={idx} href={blog.link} target="_blank" className="flex items-start gap-5 group pb-4 border-b border-gray-50 last:border-none">
                        <span className="text-lg font-black text-gray-200 group-hover:text-orange-500 transition-colors pt-1">{idx + 1}</span>
                        <div className="flex-1">
                          <div className="text-base font-bold text-gray-800 group-hover:text-orange-600 group-hover:underline leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: blog.title }} />
                          <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-500">{blog.bloggername}</span>
                            <span>{blog.postdate}</span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-40 animate-pulse text-gray-300">
              <span className="text-7xl mb-6">🔍</span>
              <p className="font-black text-lg">키워드를 입력하여 마케팅 로드맵을 설계하세요.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center font-bold">로딩 중...</div>}>
      <AnalysisContent />
    </Suspense>
  );
}