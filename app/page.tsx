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
    <main className="min-h-screen bg-white text-gray-900 pt-16">
      
      {/* 로그인 여부에 따른 블러 처리 */}
      <div className={`transition-all duration-700 ${!user ? 'blur-xl opacity-20 pointer-events-none' : 'blur-0 opacity-100'}`}>
        
        {/* 히어로 섹션 */}
        <header className="py-24 bg-white text-center px-4">
          <h1 className="text-5xl font-black mb-6 tracking-tight leading-tight">
            성공적인 마케팅을 위한 <br/>
            <span className="text-[#ff8533]">정밀 데이터 분석 인텔리전스</span>
          </h1>
          <p className="text-gray-400 text-lg mb-12 max-w-2xl mx-auto font-medium">
            TMGst.의 기술력으로 완성된 통합 키워드 분석 로드맵입니다.
          </p>
          
          <div className="max-w-2xl mx-auto relative group">
            <div className="relative flex items-center bg-white rounded-3xl p-2 shadow-[0_20px_50px_rgba(255,133,51,0.15)] border border-gray-100">
              <input type="text" placeholder="분석할 키워드를 입력하세요" className="w-full bg-transparent px-6 py-4 outline-none text-lg font-medium" />
              <button className="bg-[#ff8533] text-white px-10 py-4 rounded-2xl font-bold hover:bg-[#e6772e] transition-all active:scale-95">
                분석하기
              </button>
            </div>
          </div>
        </header>

        {/* 메뉴 탭 및 로드맵 카드 */}
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
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 opacity-60">
                  <span className="text-[10px] font-black text-orange-400 border border-orange-200 px-2 py-0.5 rounded-full mb-4 inline-block">TODO</span>
                  <h3 className="text-xl font-bold mb-3">키워드 탐색기</h3>
                  <p className="text-gray-400 text-sm">검색량 및 포화도를 분석하여 키워드 등급을 산출합니다.</p>
                </div>
                <Link href="/blog-rank" target="_blank" className="bg-white p-8 rounded-[32px] border-2 border-orange-100 shadow-sm hover:shadow-orange-50 group">
                  <span className="text-[10px] font-black text-green-500 border border-green-200 px-2 py-0.5 rounded-full mb-4 inline-block">DONE (A)</span>
                  <h3 className="text-xl font-bold mb-3 text-[#ff8533]">통합 순위 분석</h3>
                  <p className="text-gray-500 text-sm">네이버 통합 검색 결과 내 전체 순위를 분석합니다.</p>
                </Link>
                <Link href="/blog-rank-b" target="_blank" className="bg-white p-8 rounded-[32px] border-2 border-orange-100 shadow-sm hover:shadow-orange-50 group">
                  <span className="text-[10px] font-black text-green-500 border border-green-200 px-2 py-0.5 rounded-full mb-4 inline-block">DONE (B)</span>
                  <h3 className="text-xl font-bold mb-3 text-[#ff8533]">블로그 순위 추적</h3>
                  <p className="text-gray-500 text-sm">블로그 섹션 내 실시간 노출 위치를 모니터링합니다.</p>
                </Link>
                <Link href="/kin-rank" target="_blank" className="bg-white p-8 rounded-[32px] border-2 border-orange-100 shadow-sm hover:shadow-orange-50 group">
                  <span className="text-[10px] font-black text-green-500 border border-green-200 px-2 py-0.5 rounded-full mb-4 inline-block">DONE (C)</span>
                  <h3 className="text-xl font-bold mb-3 text-[#ff8533]">지식인 순위 추적</h3>
                  <p className="text-gray-500 text-sm">지식인 섹션 내 답변 노출 여부를 실시간 분석합니다.</p>
                </Link>
              </>
            )}

            {activeTab === 'google' && (
              <>
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 opacity-60">
                  <span className="text-[10px] font-black text-blue-400 border border-blue-200 px-2 py-0.5 rounded-full mb-4 inline-block">TODO: Google Ads</span>
                  <h3 className="text-xl font-bold mb-3">구글 키워드 플래너</h3>
                  <p className="text-gray-400 text-sm">구글 광고 경쟁도 및 예상 CPC 데이터를 추출합니다.</p>
                </div>
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 opacity-60">
                  <span className="text-[10px] font-black text-red-400 border border-red-200 px-2 py-0.5 rounded-full mb-4 inline-block">TODO: YouTube</span>
                  <h3 className="text-xl font-bold mb-3">유튜브 트렌드</h3>
                  <p className="text-gray-400 text-sm">키워드별 영상 조회수 및 인기 태그를 분석합니다.</p>
                </div>
              </>
            )}

            {activeTab === 'seller' && (
              <>
                <div className="bg-white p-8 rounded-[32px] border border-gray-100 opacity-60">
                  <span className="text-[10px] font-black text-orange-400 border border-orange-200 px-2 py-0.5 rounded-full mb-4 inline-block">TODO: Shopping</span>
                  <h3 className="text-xl font-bold mb-3">쇼핑몰 상품 분석</h3>
                  <p className="text-gray-400 text-sm">네이버 쇼핑 API 기반 블루오션 상품군을 발굴합니다.</p>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* 로그인 팝업 */}
      {!user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-2xl px-4">
          <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-gray-100 w-full max-w-md">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black mb-2 text-[#ff8533]">TMG AD</h2>
              <p className="text-gray-400 font-bold">서비스 이용을 위해 로그인이 필요합니다.</p>
            </div>
            <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
              <input type="email" placeholder="이메일" className="p-4 rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-100" value={email} onChange={(e)=>setEmail(e.target.value)} />
              <input type="password" placeholder="비밀번호" className="p-4 rounded-2xl bg-gray-50 outline-none focus:ring-2 focus:ring-orange-100" value={password} onChange={(e)=>setPassword(e.target.value)} />
              <button type="submit" className="w-full bg-[#ff8533] text-white font-black py-4 rounded-2xl hover:bg-[#e6772e] transition-all shadow-lg shadow-orange-100 mt-4">
                {isSignUp ? "가입하기" : "로그인하기"}
              </button>
            </form>
            <button onClick={()=>setIsSignUp(!isSignUp)} className="w-full mt-8 text-sm text-gray-400 font-bold underline">
              {isSignUp ? "이미 계정이 있으신가요? 로그인" : "신규 사용자인가요? 회원가입"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}