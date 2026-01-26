'use client';

import { createClient } from "@/app/utils/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'naver' | 'google' | 'seller'>('naver');
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (e) {} finally { setLoading(false); }
    };
    checkUser();
  }, []);

  // --- 분석 실행 함수 (기능 확장) ---
  const handleKeywordSearch = async (targetKeyword?: string) => {
    // 만약 인자로 키워드가 들어오면(클릭 시), 그 키워드로 검색을 수행합니다.
    const searchTarget = targetKeyword || keyword;
    
    if (!searchTarget.trim()) return alert("키워드를 입력해주세요.");
    
    // 클릭한 키워드를 검색창에도 보여줍니다.
    if (targetKeyword) setKeyword(targetKeyword);
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/keyword?keyword=${encodeURIComponent(searchTarget)}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setSearchResult(data);
      
      // 검색 후 화면 최상단으로 부드럽게 스크롤 (옵션)
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      alert("데이터를 가져오는 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("회원가입 성공!");
        setIsSignUp(false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setUser(data.user);
        window.location.reload(); 
      }
    } catch (error: any) { alert(error.message); }
  };

  if (loading) return <div className="min-h-screen bg-white" />;

  return (
    <main className="min-h-screen bg-white text-gray-900 pt-16 font-body">
      
      <div className={`transition-all duration-700 ${!user ? 'blur-xl opacity-20 pointer-events-none' : 'blur-0 opacity-100'}`}>
        
        <header className="py-24 bg-white text-center px-4">
          <h1 className="text-5xl font-black mb-6 tracking-tight leading-tight font-title">
            성공적인 마케팅을 위한 <br/>
            <span className="text-[#ff8533]">정밀 데이터 분석 인텔리전스</span>
          </h1>
          <p className="text-gray-400 text-lg mb-12 max-w-2xl mx-auto font-medium">
            TMGst.의 기술력으로 완성된 통합 키워드 분석 로드맵입니다.
          </p>
          
          <div className="max-w-2xl mx-auto relative group">
            <div className="relative flex items-center bg-white rounded-3xl p-2 shadow-[0_20px_50px_rgba(255,133,51,0.15)] border border-gray-100">
              <input 
                type="text" 
                placeholder="분석할 키워드를 입력하세요" 
                className="flex-1 bg-transparent px-6 py-4 outline-none text-lg font-medium" 
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleKeywordSearch()}
              />
              <button 
                onClick={() => handleKeywordSearch()}
                disabled={isSearching}
                className="bg-[#ff8533] text-white px-12 py-4 rounded-2xl font-bold whitespace-nowrap hover:bg-[#e6772e] transition-all active:scale-95 disabled:opacity-50 font-title"
              >
                {isSearching ? "분석 중..." : "분 석"}
              </button>
            </div>
          </div>

          {searchResult && (
            <>
              {/* 대시보드 카드 섹션 */}
              <div className="max-w-5xl mx-auto mt-12 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                <div className="bg-white p-6 rounded-[24px] border border-orange-50 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 mb-2 font-title uppercase tracking-wider">PC 검색량</p>
                  <p className="text-xl font-black text-gray-800 font-title">{searchResult.monthlyPcQcCnt?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-[24px] border border-orange-50 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 mb-2 font-title uppercase tracking-wider">모바일 검색량</p>
                  <p className="text-xl font-black text-gray-800 font-title">{searchResult.monthlyMobileQcCnt?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-[24px] border border-orange-50 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 mb-2 font-title uppercase tracking-wider">블로그 문서수</p>
                  <p className="text-xl font-black text-gray-800 font-title">{searchResult.totalPostCount?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-white p-6 rounded-[24px] border-2 border-[#ff8533]/20 shadow-md">
                  <p className="text-xs font-bold text-[#ff8533] mb-2 font-title uppercase tracking-wider">경쟁 강도</p>
                  <div className="flex flex-col items-center">
                    <p className={`text-xl font-black font-title ${
                      Number(searchResult.competitionRate) < 1 ? 'text-blue-500' : 
                      Number(searchResult.competitionRate) < 5 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {searchResult.competitionRate}
                    </p>
                    <span className={`text-[10px] mt-1 font-bold px-2 py-0.5 rounded-full border font-title ${
                      Number(searchResult.competitionRate) < 1 ? 'text-blue-500 border-blue-200 bg-blue-50' : 
                      Number(searchResult.competitionRate) < 5 ? 'text-green-500 border-green-200 bg-green-50' : 'text-red-500 border-red-200 bg-red-50'
                    }`}>
                      {Number(searchResult.competitionRate) < 1 ? '💎 BLUE OCEAN' : 
                       Number(searchResult.competitionRate) < 5 ? '✅ NORMAL' : '🔥 RED OCEAN'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 연관 키워드 테이블 (클릭 기능 추가) */}
              <div className="max-w-5xl mx-auto mt-12 bg-white rounded-[32px] border border-gray-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 text-left">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                  <h3 className="text-xl font-bold text-gray-800 font-title">연관 키워드 분석 결과</h3>
                  <span className="text-sm text-gray-400 font-medium font-body tracking-tight">마우스로 클릭 시 즉시 분석됩니다.</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-body">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="p-5 text-sm font-bold text-gray-500 border-b font-title">키워드</th>
                        <th className="p-5 text-sm font-bold text-gray-500 border-b text-right font-title">PC 검색량</th>
                        <th className="p-5 text-sm font-bold text-gray-500 border-b text-right font-title">모바일 검색량</th>
                        <th className="p-5 text-sm font-bold text-gray-500 border-b text-right font-title">합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResult.relatedKeywords?.slice(0, 20).map((item: any, index: number) => (
                        <tr 
                          key={index} 
                          // 👇 행 클릭 시 해당 키워드로 검색 함수 호출
                          onClick={() => handleKeywordSearch(item.relKeyword)}
                          className="hover:bg-orange-50/50 transition-colors group cursor-pointer border-b border-gray-50 last:border-none"
                        >
                          <td className="p-5 text-sm font-bold text-gray-700 group-hover:text-[#ff8533]">{item.relKeyword}</td>
                          <td className="p-5 text-sm text-gray-600 text-right font-medium">{item.monthlyPcQcCnt?.toLocaleString()}</td>
                          <td className="p-5 text-sm text-gray-600 text-right font-medium">{item.monthlyMobileQcCnt?.toLocaleString()}</td>
                          <td className="p-5 text-sm font-black text-gray-800 text-right">
                            {(Number(item.monthlyPcQcCnt || 0) + Number(item.monthlyMobileQcCnt || 0)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </header>

        {/* 메뉴 탭 및 로드맵 카드 섹션 */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex justify-center mb-12">
            <div className="bg-gray-100 p-1.5 rounded-2xl flex shadow-inner">
              <button onClick={() => setActiveTab('naver')}
                className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'naver' ? 'bg-white text-[#ff8533] shadow-sm' : 'text-gray-500'}`}
              >네이버 분석</button>
              <button onClick={() => setActiveTab('google')}
                className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'google' ? 'bg-white text-[#ff8533] shadow-sm' : 'text-gray-500'}`}
              >구글/유튜브 분석</button>
              <button onClick={() => setActiveTab('seller')}
                className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'seller' ? 'bg-white text-[#ff8533] shadow-sm' : 'text-gray-500'}`}
              >셀러 도구</button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {activeTab === 'naver' && (
              <>
                <div className={`bg-white p-8 rounded-[32px] border transition-all duration-500 ${searchResult ? 'border-[#ff8533] shadow-lg shadow-orange-50' : 'border-gray-100 opacity-60'}`}>
                  <span className={`text-[10px] font-black border px-2 py-0.5 rounded-full mb-4 inline-block font-title ${searchResult ? 'text-[#ff8533] border-[#ff8533]' : 'text-orange-400 border-orange-200'}`}>
                    {searchResult ? 'ACTIVE' : 'TODO'}
                  </span>
                  <h3 className="text-xl font-bold mb-3 font-title">키워드 탐색기</h3>
                  <p className="text-gray-400 text-sm font-body">검색량 및 포화도를 분석하여 키워드 등급을 산출합니다.</p>
                </div>
                <Link href="/blog-rank" target="_blank" className="bg-white p-8 rounded-[32px] border-2 border-orange-100 shadow-sm hover:shadow-orange-100 transition-all group">
                  <span className="text-[10px] font-black text-green-500 border border-green-200 px-2 py-0.5 rounded-full mb-4 inline-block font-title">DONE (A)</span>
                  <h3 className="text-xl font-bold mb-3 text-[#ff8533] font-title">통합 순위 분석</h3>
                  <p className="text-gray-500 text-sm font-body">네이버 통합 검색 결과 내 전체 순위를 분석합니다.</p>
                </Link>
                <Link href="/blog-rank-b" target="_blank" className="bg-white p-8 rounded-[32px] border-2 border-orange-100 shadow-sm hover:shadow-orange-100 transition-all group">
                  <span className="text-[10px] font-black text-green-500 border border-green-200 px-2 py-0.5 rounded-full mb-4 inline-block font-title">DONE (B)</span>
                  <h3 className="text-xl font-bold mb-3 text-[#ff8533] font-title">블로그 순위 추적</h3>
                  <p className="text-gray-500 text-sm font-body">블로그 섹션 내 실시간 노출 위치를 모니터링합니다.</p>
                </Link>
                <Link href="/kin-rank" target="_blank" className="bg-white p-8 rounded-[32px] border-2 border-orange-100 shadow-sm hover:shadow-orange-100 transition-all group">
                  <span className="text-[10px] font-black text-green-500 border border-green-200 px-2 py-0.5 rounded-full mb-4 inline-block font-title">DONE (C)</span>
                  <h3 className="text-xl font-bold mb-3 text-[#ff8533] font-title">지식인 순위 추적</h3>
                  <p className="text-gray-500 text-sm font-body">지식인 섹션 내 답변 노출 여부를 실시간 분석합니다.</p>
                </Link>
              </>
            )}
            {/* ... 구글/셀러 탭 생략 ... */}
          </div>
        </section>
      </div>

      {/* 로그인 팝업 */}
      {!user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-2xl px-4 font-body">
          <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-gray-100 w-full max-w-md">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black mb-2 text-[#ff8533] font-title">TMG AD</h2>
              <p className="text-gray-400 font-bold">서비스 이용을 위해 로그인이 필요합니다.</p>
            </div>
            <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
              <input type="email" placeholder="이메일" className="p-4 rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-100 text-gray-900" value={email} onChange={(e)=>setEmail(e.target.value)} />
              <input type="password" placeholder="비밀번호" className="p-4 rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-100 text-gray-900" value={password} onChange={(e)=>setPassword(e.target.value)} />
              <button type="submit" className="w-full bg-[#ff8533] text-white font-black py-4 rounded-2xl hover:bg-[#e6772e] transition-all font-title">
                {isSignUp ? "가입하기" : "로그인하기"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}