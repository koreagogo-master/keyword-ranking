'use client';

import { createClient } from "@/app/utils/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'naver' | 'google'>('naver');
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

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
    // Header가 fixed이므로 본문이 가려지지 않게 pt-16을 추가했습니다.
    <main className="min-h-screen bg-white text-gray-900 pt-16">
      
      {/* 1. 내비게이션 바는 Header.tsx에서 담당하므로 여기서는 삭제했습니다. */}

      <div className={`transition-all duration-700 ${!user ? 'blur-xl opacity-20 pointer-events-none' : 'blur-0 opacity-100'}`}>
        
        {/* 2. 히어로 섹션 - 헤더에 서비스명이 있으므로 본문은 가치 중심으로 구성 */}
        <header className="py-24 bg-white text-center px-4">
          <h1 className="text-5xl font-black mb-6 tracking-tight leading-tight">
            성공적인 마케팅을 위한 <br/>
            <span className="text-[#ff8533]">정밀 데이터 분석 인텔리전스</span>
          </h1>
          <p className="text-gray-400 text-lg mb-12 max-w-2xl mx-auto font-medium">
            TMGst.의 기술력으로 완성된 통합 키워드 분석 시스템을 경험해 보세요.
          </p>
          
          {/* 통합 검색창 */}
          <div className="max-w-2xl mx-auto relative group">
            <div className="relative flex items-center bg-white rounded-3xl p-2 shadow-[0_20px_50px_rgba(255,133,51,0.15)] border border-gray-100">
              <input 
                type="text" 
                placeholder="분석할 키워드를 입력하세요" 
                className="w-full bg-transparent px-6 py-4 outline-none text-lg font-medium" 
              />
              <button className="bg-[#ff8533] text-white px-10 py-4 rounded-2xl font-bold hover:bg-[#e6772e] transition-all shadow-lg shadow-orange-100 active:scale-95">
                분석하기
              </button>
            </div>
          </div>
        </header>

        {/* 3. 메인 분석 대시보드 - 카테고리별 공간 확보 */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex justify-center mb-12">
            <div className="bg-gray-100 p-1.5 rounded-2xl flex shadow-inner">
              <button 
                onClick={() => setActiveTab('naver')}
                className={`px-10 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'naver' ? 'bg-white text-[#ff8533] shadow-sm' : 'text-gray-500'}`}
              >네이버 데이터</button>
              <button 
                onClick={() => setActiveTab('google')}
                className={`px-10 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'google' ? 'bg-white text-[#ff8533] shadow-sm' : 'text-gray-500'}`}
              >구글/유튜브 인사이트</button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-left">
            {activeTab === 'naver' ? (
              <>
                {/* 신규: 키워드 탐색기 (공간 확보용 예시) */}
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 hover:border-orange-200 transition-all cursor-not-allowed group">
                  <div className="w-14 h-14 bg-orange-50 text-[#ff8533] rounded-2xl flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform">🔍</div>
                  <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                    키워드 탐색기 
                    <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded uppercase">Coming</span>
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">검색량과 문서수를 기반으로 키워드 효율을 한눈에 파악합니다.</p>
                </div>

                {/* 기존 B: 블로그 순위 추적 */}
                <Link href="/blog-rank-b" target="_blank" className="bg-white p-8 rounded-[32px] border border-gray-100 hover:border-orange-200 transition-all shadow-sm hover:shadow-orange-50 group">
                  <div className="w-14 h-14 bg-orange-50 text-[#ff8533] rounded-2xl flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform">📈</div>
                  <h3 className="text-xl font-bold mb-3">블로그 순위 추적</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">내 포스팅의 실시간 노출 위치를 정밀하게 추적합니다.</p>
                </Link>

                {/* 기존 C: 지식인 순위 추적 */}
                <Link href="/kin-rank" target="_blank" className="bg-white p-8 rounded-[32px] border border-gray-100 hover:border-orange-200 transition-all shadow-sm hover:shadow-orange-50 group">
                  <div className="w-14 h-14 bg-orange-50 text-[#ff8533] rounded-2xl flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform">💡</div>
                  <h3 className="text-xl font-bold mb-3">지식인 순위 추적</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">지식인 섹션 내의 답변 노출 현황을 모니터링합니다.</p>
                </Link>
              </>
            ) : (
              <>
                {/* 신규: 구글 수익 시뮬레이션 */}
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 opacity-80 cursor-not-allowed">
                  <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-6 text-2xl">💰</div>
                  <h3 className="text-xl font-bold mb-3 text-gray-400 flex items-center gap-2">
                    수익 시뮬레이션
                    <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded uppercase">Dev</span>
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">Google Ads 데이터를 기반으로 예상 광고 수익을 계산합니다.</p>
                </div>

                {/* 신규: 유튜브 인사이트 */}
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 opacity-80 cursor-not-allowed">
                  <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6 text-2xl">▶️</div>
                  <h3 className="text-xl font-bold mb-3 text-gray-400 flex items-center gap-2">
                    유튜브 트렌드
                    <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded uppercase">Dev</span>
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">조회수와 급상승 동영상을 분석하여 트렌드를 포착합니다.</p>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* 4. 로그인 팝업 - 주황색 포인트 디자인 */}
      {!user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-2xl">
          <div className="bg-white p-12 rounded-[48px] shadow-[0_32px_64px_rgba(255,133,51,0.1)] border border-gray-100 w-full max-w-md">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black mb-2 text-[#ff8533]">TMG AD</h2>
              <p className="text-gray-400 font-bold tracking-tight">서비스 이용을 위해 로그인이 필요합니다.</p>
            </div>
            <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
              <input 
                type="email" 
                placeholder="이메일" 
                className="p-4 rounded-2xl bg-gray-50 border-none outline-none focus:ring-2 focus:ring-orange-200 transition-all font-medium" 
                value={email} 
                onChange={(e)=>setEmail(e.target.value)} 
              />
              <input 
                type="password" 
                placeholder="비밀번호" 
                className="p-4 rounded-2xl bg-gray-50 border-none outline-none focus:ring-2 focus:ring-orange-200 transition-all font-medium" 
                value={password} 
                onChange={(e)=>setPassword(e.target.value)} 
              />
              <button type="submit" className="w-full bg-[#ff8533] text-white font-black py-4 rounded-2xl hover:bg-[#e6772e] transition-all shadow-lg shadow-orange-100 mt-4 active:scale-95">
                {isSignUp ? "가입하기" : "로그인하기"}
              </button>
            </form>
            <button onClick={()=>setIsSignUp(!isSignUp)} className="w-full mt-8 text-sm text-gray-400 font-bold underline decoration-gray-200 hover:text-[#ff8533]">
              {isSignUp ? "이미 계정이 있으신가요? 로그인" : "신규 사용자인가요? 회원가입"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}