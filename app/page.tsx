// app/page.tsx
'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MainFooter from "@/components/MainFooter";
import FadeInUp from "@/components/FadeInUp";

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [isFocused, setIsFocused] = useState(false); // 🌟 추가: 마우스 클릭을 감지하는 센서
  const router = useRouter();

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!keyword.trim()) return alert("키워드를 입력해주세요.");
    router.push(`/analysis?keyword=${encodeURIComponent(keyword)}`);
  };

  const services = [
    { title: "키워드 정밀 분석", href: "/analysis", icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> },
    { title: "블로그 순위 확인", href: "/blog-rank-b", icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
    { title: "N 통합 순위 분석", href: "/blog-rank", icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
    { title: "지식인 순위 확인", href: "/kin-rank", icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
    { title: "구글 분석", href: "/google-analysis", icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg> },
    { title: "셀러 도구", href: "/shopping-comp", icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    { title: "연관 검색어 추출", href: "/related", icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> },
    { title: "블로그 지수 확인", href: "/blog-index", icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-body flex flex-col">
      
      {/* 1. 메인 히어로 섹션 */}
      <main className="bg-white flex flex-col items-center justify-center px-4 pt-28 pb-32 border-b border-gray-100">
        <FadeInUp>
          <div className="text-center mb-12">
            
            <span className="text-indigo-600 font-bold text-sm md:text-base mb-6 inline-block bg-indigo-50 px-4 py-1.5 rounded-full">
              회원가입 시 매일 5회 무료 검색 제공!
            </span>
            
            {/* 🌟 2% 부족함 채우기: 폰트 두께를 가장 무겁게(font-black) 압도적으로 키우고, 'Pro'에만 브랜드 컬러(text-indigo-600) 적용 */}
            <h1 className="text-5xl md:text-7xl font-black font-sans text-gray-900 mb-8 tracking-tighter">
              Ranking <span className="text-indigo-600">Pro</span>
            </h1>
            
            <p className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed">
              Naver API와 Google API를 기반으로<br className="md:hidden" /> 성공적인 마케팅을 위한 정밀 데이터 분석 솔루션
            </p>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.2}>
          <div className="w-full flex justify-center px-4">
            <form onSubmit={handleSearch} className="flex justify-center w-full">
              
              <div 
                className="relative flex items-center bg-white rounded-2xl p-1.5 transition-all duration-500 ease-out"
                style={{ 
                  width: isFocused ? '600px' : '400px', 
                  maxWidth: '100%',
                  border: isFocused ? '1px solid #818cf8' : '1px solid #e5e7eb',
                  boxShadow: isFocused ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                <input 
                  type="text" 
                  placeholder="분석할 키워드를 입력하세요" 
                  className="flex-1 bg-transparent px-5 py-2.5 md:py-3 outline-none text-base text-gray-800 placeholder-gray-400 min-w-0" 
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
                <button 
                  type="submit"
                  className="bg-indigo-600 text-white px-8 py-2.5 md:py-3 rounded-xl font-bold text-base whitespace-nowrap hover:bg-indigo-700 transition-all"
                >
                  검색
                </button>
              </div>

            </form>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400 font-medium">
              * 비로그인 상태에서는 IP당 일 1회만 검색 가능 하며 회원 가입시 일 5회 무료 검색이 제공됩니다. *
            </p>
          </div>
        </FadeInUp>
      </main>

      {/* 2. 소개 섹션 */}
      <section className="bg-gray-50 py-24 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <FadeInUp>
            <h2 className="text-3xl font-black text-gray-900 mb-4 font-title">압도적인 데이터, 직관적인 분석</h2>
            <p className="text-gray-500 mb-16">마케터의 시간을 아껴주는 완벽한 도구, 왜 Ranking Pro를 선택해야 할까요?</p>
          </FadeInUp>
          
          <FadeInUp delay={0.2}>
            <div className="grid md:grid-cols-3 gap-10">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className="text-indigo-500 mb-5 bg-indigo-50 p-3 rounded-2xl">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">실시간 데이터 추적</h3>
                <p className="text-gray-500 text-sm leading-relaxed">과거 데이터가 아닌, 현재 1초 전의 가장 정확한 검색 포털의 순위와 노출 로직을 그대로 스크래핑하여 보여줍니다.</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className="text-indigo-500 mb-5 bg-indigo-50 p-3 rounded-2xl">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">정밀한 경쟁도 분석</h3>
                <p className="text-gray-500 text-sm leading-relaxed">단순 검색량을 넘어, 문서 발행량과 광고 단가(CPC)를 조합하여 실질적으로 돈이 되는 황금 키워드를 발굴해 냅니다.</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className="text-indigo-500 mb-5 bg-indigo-50 p-3 rounded-2xl">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">안전한 IP 우회 시스템</h3>
                <p className="text-gray-500 text-sm leading-relaxed">자체 프록시 서버망을 구축하여, 대량의 키워드를 조회하더라도 검색 엔진으로부터 어뷰징 차단을 받지 않습니다.</p>
              </div>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* 3. 제공 서비스 */}
      <section className="bg-white py-24 px-6 border-t border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <FadeInUp>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-gray-800 font-title mb-4">제공 서비스</h2>
              <p className="text-gray-500 text-sm font-medium">Ranking Pro가 제공하는 전문 마케팅 분석 도구입니다.</p>
            </div>
          </FadeInUp>
          
          <FadeInUp delay={0.2}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {services.map((service, idx) => (
                <Link 
                  key={idx} 
                  href={service.href} 
                  className="bg-white py-8 px-4 rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-indigo-600 transition-all duration-300 group flex flex-col items-center text-center"
                >
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                    {service.icon}
                  </div>
                  <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{service.title}</h3>
                </Link>
              ))}
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* 4. 요금제 */}
      <section className="bg-white py-32 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto text-center">
          <FadeInUp>
            <h2 className="text-3xl font-black text-gray-900 mb-4 font-title">합리적인 포인트 요금제</h2>
            <p className="text-gray-500 mb-10">필요한 만큼만 충전해서 사용하는 종량제 방식으로 비용 부담을 줄이세요.</p>
            
            <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 py-4 px-6 rounded-2xl max-w-2xl mx-auto mb-14 shadow-sm">
              <p className="font-bold text-sm md:text-base">
                * 신규 회원가입 혜택: 매일 <span className="text-indigo-900 font-black underline">무료 검색 5회</span> 제공! 
                <span className="font-medium text-indigo-500 ml-1 text-xs md:text-sm">(상세 데이터 일부 제한) *</span>
              </p>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto text-left">
              
              {/* 베이직 요금제 */}
              <div className="bg-[#f5f5f5] p-10 rounded-3xl border border-gray-200 flex flex-col">
                <div className="text-center mb-8 pb-8 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-500 mb-2">스타터 (Starter)</h3>
                  <div className="text-4xl font-black text-gray-900 mb-4">10,000<span className="text-lg text-gray-400 font-medium ml-1">원</span></div>
                  <p className="text-indigo-600 font-bold">10,000 포인트 충전</p>
                </div>
                <ul className="space-y-4 mb-10 text-gray-600 text-sm flex-1">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>모든 순위 검색 기능 이용</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>1회 검색 시 10P 차감</span>
                  </li>
                </ul>
                <button className="w-full py-4 rounded-xl font-bold bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm transition-all !text-[#575151]">결제하기</button>
              </div>

              {/* 프로 요금제 */}
              <div className="bg-white p-10 rounded-3xl shadow-xl border-2 border-indigo-600 relative flex flex-col transform md:-translate-y-4 z-10">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-black tracking-wider shadow-md">
                  가장 많이 선택하는
                </div>
                <div className="text-center mb-8 pb-8 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-indigo-600 mb-2">프로 (Pro)</h3>
                  <div className="text-4xl font-black text-gray-900 mb-4">30,000<span className="text-lg text-gray-400 font-medium ml-1">원</span></div>
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-indigo-600 font-bold">35,000 포인트 충전</p>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">+5,000P</span>
                  </div>
                </div>
                <ul className="space-y-4 mb-10 text-gray-600 text-sm flex-1">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>모든 순위 검색 기능 이용</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>가성비 보너스 포인트 지급</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>우선 고객 지원</span>
                  </li>
                </ul>
                <button className="w-full py-4 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">결제하기</button>
              </div>

              {/* 에이전시 요금제 */}
              <div className="bg-[#f5f5f5] p-10 rounded-3xl border border-gray-200 flex flex-col">
                <div className="text-center mb-8 pb-8 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-500 mb-2">에이전시 (Agency)</h3>
                  <div className="text-4xl font-black text-gray-900 mb-4">100,000<span className="text-lg text-gray-400 font-medium ml-1">원</span></div>
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-indigo-600 font-bold">130,000 포인트 충전</p>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">+30,000P</span>
                  </div>
                </div>
                <ul className="space-y-4 mb-10 text-gray-600 text-sm flex-1">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>대행사 및 헤비 유저용</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>최대 보너스 포인트 지급</span>
                  </li>
                </ul>
                <button className="w-full py-4 rounded-xl font-bold bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm transition-all !text-[#575151]">결제하기</button>
              </div>

            </div>
          </FadeInUp>
        </div>
      </section>
      
      <MainFooter />
    </div>
  );
}