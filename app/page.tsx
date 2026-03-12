// app/page.tsx
'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MainFooter from "@/components/MainFooter";
import FadeInUp from "@/components/FadeInUp";

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!keyword.trim()) return alert("키워드를 입력해주세요.");
    router.push(`/analysis?keyword=${encodeURIComponent(keyword)}`);
  };

  return (
    <div className="min-h-screen bg-white font-body flex flex-col">
      
      {/* 🌟 1. 메인 히어로 섹션 (배경색 추가: bg-gray-50) */}
      <main className="bg-gray-50 flex flex-col items-center justify-center px-4 pt-28 pb-32 border-b border-gray-100">
        <FadeInUp>
          <div className="text-center mb-12">
            <span className="text-indigo-600 font-bold text-sm md:text-base mb-6 inline-block bg-indigo-100/50 px-4 py-1.5 rounded-full">
              회원가입 시 매일 5회 무료 검색 제공!
            </span>
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

      {/* 🌟 2. 소개 섹션 (배경색 제거: bg-white) */}
      <section className="bg-white py-24 px-6 border-b border-gray-100">
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

      {/* 🌟 3. 제공 솔루션 (배경색 추가: bg-gray-50, 내부 박스는 bg-white로 대비) */}
      <section className="bg-gray-50 py-24 px-6 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <FadeInUp>
            <div className="text-center mb-16">
              <h2 className="text-3xl font-black text-gray-800 font-title">제공 솔루션</h2>
            </div>
          </FadeInUp>
          
          <FadeInUp delay={0.2}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              
              <Link href="/analysis" className="bg-white h-40 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.2)] hover:border-indigo-300 cursor-pointer">
                <div className="text-gray-400 group-hover:text-indigo-600 transition-colors duration-300 mb-4">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors duration-300">키워드 정밀 분석</h3>
              </Link>

              <Link href="/related-fast" className="bg-white h-40 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.2)] hover:border-indigo-300 cursor-pointer">
                <div className="text-gray-400 group-hover:text-indigo-600 transition-colors duration-300 mb-4">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors duration-300">연관 키워드 조회</h3>
              </Link>

              <Link href="/keyword-generator" className="bg-white h-40 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.2)] hover:border-indigo-300 cursor-pointer">
                <div className="text-gray-400 group-hover:text-indigo-600 transition-colors duration-300 mb-4">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors duration-300">키워드 생성기</h3>
              </Link>

              <Link href="/blog-rank-b" className="bg-white h-40 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.2)] hover:border-indigo-300 cursor-pointer">
                <div className="text-gray-400 group-hover:text-indigo-600 transition-colors duration-300 mb-4">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors duration-300">블로그 순위 확인</h3>
              </Link>

              <Link href="/kin-rank" className="bg-white h-40 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.2)] hover:border-indigo-300 cursor-pointer">
                <div className="text-gray-400 group-hover:text-indigo-600 transition-colors duration-300 mb-4">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors duration-300">지식인 순위 확인</h3>
              </Link>

              <Link href="/blog-rank" className="bg-white h-40 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.2)] hover:border-indigo-300 cursor-pointer">
                <div className="text-gray-400 group-hover:text-indigo-600 transition-colors duration-300 mb-4">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors duration-300">통검 노출/순위 확인</h3>
              </Link>

              <Link href="/google-analysis" className="bg-white h-40 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.2)] hover:border-indigo-300 cursor-pointer">
                <div className="text-gray-400 group-hover:text-indigo-600 transition-colors duration-300 mb-4">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors duration-300">구글 키워드 분석</h3>
              </Link>

              <Link href="/youtube-trend" className="bg-white h-40 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.2)] hover:border-indigo-300 cursor-pointer">
                <div className="text-gray-400 group-hover:text-indigo-600 transition-colors duration-300 mb-4">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors duration-300">유튜브 트렌드</h3>
              </Link>

              <Link href="/shopping-insight" className="bg-white h-40 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.2)] hover:border-indigo-300 cursor-pointer">
                <div className="text-gray-400 group-hover:text-indigo-600 transition-colors duration-300 mb-4">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors duration-300">쇼핑 경쟁강도</h3>
              </Link>

              <Link href="/calculator" className="bg-white h-40 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.2)] hover:border-indigo-300 cursor-pointer">
                <div className="text-gray-400 group-hover:text-indigo-600 transition-colors duration-300 mb-4">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors duration-300">수익률 계산기</h3>
              </Link>

              <Link href="/history" className="bg-white h-40 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.2)] hover:border-indigo-300 cursor-pointer">
                <div className="text-gray-400 group-hover:text-indigo-600 transition-colors duration-300 mb-4">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors duration-300">분석 히스토리</h3>
              </Link>

              <Link href="/settings" className="bg-white h-40 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center transition-all duration-300 group hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.2)] hover:border-indigo-300 cursor-pointer">
                <div className="text-gray-400 group-hover:text-indigo-600 transition-colors duration-300 mb-4">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors duration-300">사용자 설정</h3>
              </Link>

            </div>
          </FadeInUp>
        </div>
      </section>

      {/* 4. 합리적인 포인트 요금제 (타이틀 고유 컬러 적용 + 묵직한 블랙 버튼) */}
      <section className="bg-white py-24 px-6 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <FadeInUp>
            <div className="text-center mb-16">
              <h2 className="text-3xl font-black text-gray-800 font-title mb-4">합리적인 포인트 요금제</h2>
              <p className="text-gray-500 text-sm font-medium">필요한 만큼만 충전하고, 모든 분석 도구를 자유롭게 사용하세요.</p>
            </div>
          </FadeInUp>
          
          <FadeInUp delay={0.2}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* 🌟 1. 스타터 */}
              <div className="group bg-gray-50 rounded-2xl p-8 border border-gray-200 flex flex-col transition-all duration-300 hover:-translate-y-2 hover:bg-white hover:shadow-[0_10px_30px_-10px_rgba(16,185,129,0.3)] hover:border-emerald-500">
                <div className="text-center mb-8 pb-8 border-b border-gray-200">
                  <span className="text-[11px] font-black tracking-widest text-gray-400 block mb-1">STARTER</span>
                  {/* 🚀 변경: 기본 상태부터 에메랄드 색상 적용 */}
                  <h3 className="text-2xl font-black text-emerald-500 mb-2">스타터</h3>
                  <p className="text-sm text-gray-400 mb-6">개인 및 1인 셀러를 위한 플랜</p>
                  
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-gray-700 font-bold text-lg">30,000 포인트 충전</p>
                    <div className="flex items-center gap-1 text-gray-400 mt-1">
                      <span className="text-lg font-semibold">30,000</span>
                      <span className="text-sm">원</span>
                    </div>
                  </div>
                </div>
                
                <ul className="space-y-4 mb-10 text-gray-500 text-sm flex-1 max-w-[200px] mx-auto w-full">
                  <li className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>모든 분석 기능 사용 가능</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>기본 고객 지원</span>
                  </li>
                </ul>
                
                <button className="w-full py-3.5 rounded-xl font-bold bg-gray-900 text-white shadow-sm hover:bg-black hover:shadow-md transition-all">
                  선택하기
                </button>
              </div>

              {/* 🌟 2. 프로 */}
              <div className="group bg-gray-50 rounded-2xl p-8 border border-gray-200 flex flex-col transition-all duration-300 hover:-translate-y-2 hover:bg-white hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.3)] hover:border-indigo-500">
                <div className="text-center mb-8 pb-8 border-b border-gray-200">
                  <span className="text-[11px] font-black tracking-widest text-gray-400 block mb-1">PRO</span>
                  {/* 🚀 변경: 기본 상태부터 브랜드 메인 컬러(인디고 보라) 적용 */}
                  <h3 className="text-2xl font-black text-indigo-600 mb-2">프로</h3>
                  <p className="text-sm text-gray-400 mb-6">전문 마케터를 위한 베스트 플랜</p>
                  
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                      <p className="text-gray-700 font-bold text-lg">70,000 포인트 충전</p>
                      <span className="text-[11px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded font-bold">+10,000P</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 mt-1">
                      <span className="text-lg font-semibold">70,000</span>
                      <span className="text-sm">원</span>
                    </div>
                  </div>
                </div>
                
                <ul className="space-y-4 mb-10 text-gray-500 text-sm flex-1 max-w-[200px] mx-auto w-full">
                  <li className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>보너스 포인트 추가 제공</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>우선 고객 지원</span>
                  </li>
                </ul>
                
                <button className="w-full py-3.5 rounded-xl font-bold bg-gray-900 text-white shadow-sm hover:bg-black hover:shadow-md transition-all">
                  선택하기
                </button>
              </div>

              {/* 🌟 3. 에이전시 */}
              <div className="group bg-gray-50 rounded-2xl p-8 border border-gray-200 flex flex-col transition-all duration-300 hover:-translate-y-2 hover:bg-white hover:shadow-[0_10px_30px_-10px_rgba(17,24,39,0.3)] hover:border-gray-900">
                <div className="text-center mb-8 pb-8 border-b border-gray-200">
                  <span className="text-[11px] font-black tracking-widest text-gray-400 block mb-1">AGENCY</span>
                  {/* 🚀 변경: 기본 상태부터 가장 묵직한 다크 그레이 색상 적용 */}
                  <h3 className="text-2xl font-black text-gray-900 mb-2">에이전시</h3>
                  <p className="text-sm text-gray-400 mb-6">대행사 및 대용량 분석용 플랜</p>
                  
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                      <p className="text-gray-700 font-bold text-lg">130,000 포인트 충전</p>
                      <span className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-bold">+30,000P</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 mt-1">
                      <span className="text-lg font-semibold">130,000</span>
                      <span className="text-sm">원</span>
                    </div>
                  </div>
                </div>
                
                <ul className="space-y-4 mb-10 text-gray-500 text-sm flex-1 max-w-[200px] mx-auto w-full">
                  <li className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>최대 보너스 포인트 지급</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span>전담 매니저 및 맞춤 지원</span>
                  </li>
                </ul>
                
                <button className="w-full py-3.5 rounded-xl font-bold bg-gray-900 text-white shadow-sm hover:bg-black hover:shadow-md transition-all">
                  선택하기
                </button>
              </div>

            </div>
          </FadeInUp>
        </div>
      </section>
      
      <MainFooter />
    </div>
  );
}