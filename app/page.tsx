// app/page.tsx
'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const router = useRouter();

  // 검색 시 분석 페이지로 이동하는 함수
  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!keyword.trim()) return alert("키워드를 입력해주세요.");
    
    // 주소창에 키워드를 담아서 이동합니다.
    router.push(`/analysis?keyword=${encodeURIComponent(keyword)}`);
  };

  const services = [
    { title: "키워드 정밀 분석", desc:"키워드 정보를 정밀하게 실시간 분석 합니다.", href: "/analysis" },
    { title: "블로그 순위 확인", desc: "블로그 섹션 내 실시간 노출 순위를 모니터링합니다.", icon: "📈", href: "/blog-rank-b" },
    { title: "N 통합 순위 분석", desc: "네이버 통합검색 내 내 콘텐츠의 위치를 추적합니다.", icon: "📊", href: "/blog-rank" },
    { title: "지식인 순위 확인", desc: "지식인 답변의 노출 여부와 순위를 분석합니다.", icon: "🙋", href: "/kin-rank" },
    { title: "구글 분석", desc: "구글 키워드 트렌드와 검색 최적화 데이터를 제공합니다.", icon: "🌐", href: "/google-analysis" },
    { title: "셀러 도구", desc: "쇼핑몰 운영을 위한 경쟁강도 및 수익률을 계산합니다.", icon: "🛒", href: "/shopping-comp" },
  ];

  return (
    <div className="min-h-screen bg-white font-body flex flex-col">
      
      {/* 1~3. 메인 히어로 섹션 (화이트 테마 + 검색창) */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-20 pb-32">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-gray-900 mb-4 font-title tracking-tight">
            TMG ad. <span className="text-[#ff8533]">Ranking Pro</span>
          </h1>
          <p className="text-gray-400 font-medium">Naver API와 Google API를 기반으로 성공적인 마케팅을 위한 정밀 데이터 분석 솔루션</p>
        </div>

        {/* 검색창 영역 */}
        <form onSubmit={handleSearch} className="w-full max-w-2xl relative group">
          <div className="relative flex items-center bg-white rounded-3xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 transition-all focus-within:shadow-[0_20px_50px_rgba(255,133,51,0.1)] focus-within:border-[#ff8533]/20">
            <input 
              type="text" 
              placeholder="분석할 키워드를 입력하세요" 
              className="flex-1 bg-transparent px-6 py-4 outline-none text-lg font-bold text-gray-800" 
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <button 
              type="submit"
              className="bg-[#ff8533] text-white px-10 py-4 rounded-2xl font-black whitespace-nowrap hover:bg-[#e6772e] transition-all active:scale-95 font-title"
            >
              분 석
            </button>
          </div>
        </form>
      </main>

      {/* 4. 서비스 메뉴 박스 나열 섹션 */}
      <section className="bg-gray-50 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-black text-gray-800 font-title mb-2">제공 서비스</h2>
            <p className="text-gray-400 text-sm font-medium">TMG AD가 제공하는 전문 마케팅 분석 도구입니다.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {services.map((service, idx) => (
              <Link key={idx} href={service.href} className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-100 transition-all group text-left">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:bg-orange-50 transition-colors">
                  {service.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3 font-title group-hover:text-[#ff8533] transition-colors">{service.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed font-medium">
                  {service.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>


    </div>
  );
}