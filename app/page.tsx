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

      {/* 🌟 1. 메인 히어로 섹션 (검색창 테두리를 보라색 톤으로 통일) */}
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
                  // 🚀 변경: 기본 테두리를 제공 솔루션과 같은 연보라(#c7d2fe), 포커스 시 진보라(#818cf8)로 변경
                  border: isFocused ? '1px solid #818cf8' : '1px solid #c7d2fe',
                  boxShadow: isFocused ? '0 10px 15px -3px rgba(79, 70, 229, 0.1)' : '0 1px 2px 0 rgba(79, 70, 229, 0.05)'
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

      {/* 🌟 2. 소개 섹션 (호버 모션 제거, 보라색 테두리로 단단하고 정적인 느낌 유지) */}
      <section className="bg-white py-24 px-6 border-b border-gray-100">
        <div className="max-w-6xl mx-auto text-center">
          <FadeInUp>
            <div className="text-center px-4">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 font-title tracking-tight">
                완벽한 데이터 분석의 새로운 기준
              </h2>
              <p className="text-lg text-gray-500 mb-16 max-w-2xl mx-auto break-keep leading-relaxed">
                흩어진 데이터를 모아 마케팅의 명확한 해답을 제시합니다.<br className="hidden md:block" />
                성공적인 비즈니스를 위한 가장 강력하고 직관적인 파트너를 경험해 보세요.
              </p>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <div className="grid md:grid-cols-3 gap-10">
              {/* 🚀 변경: hover 관련 애니메이션 클래스를 모두 제거하여 클릭 불가능한 정보성 박스임을 명확히 함 */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-indigo-200 flex flex-col items-center text-center">
                <div className="text-indigo-500 mb-5 bg-indigo-50 p-3 rounded-2xl">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">초정밀 실시간 데이터 추적</h3>
                <p className="text-gray-500 text-sm leading-relaxed break-keep">
                  과거의 지표가 아닌, 포털 엔진의 최신 노출 로직과 순위를 실시간으로 스크래핑하여 가장 빠르고 정확한 인사이트를 제공합니다.
                </p>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-indigo-200 flex flex-col items-center text-center">
                <div className="text-indigo-500 mb-5 bg-indigo-50 p-3 rounded-2xl">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">입체적인 경쟁도 분석</h3>
                <p className="text-gray-500 text-sm leading-relaxed break-keep">
                  단순한 검색량 조회를 넘어, 문서 발행량과 CPC 단가를 다각도로 분석하여 실질적인 매출로 이어지는 고효율 황금 키워드를 발굴합니다.
                </p>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-indigo-200 flex flex-col items-center text-center">
                <div className="text-indigo-500 mb-5 bg-indigo-50 p-3 rounded-2xl">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">엔터프라이즈급 우회 시스템</h3>
                <p className="text-gray-500 text-sm leading-relaxed break-keep">
                  독자적인 프록시 네트워크 서버망을 구축하여, 대규모 키워드 분석 시에도 차단 위험 없이 가장 안전하고 안정적인 환경을 보장합니다.
                </p>
              </div>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* 🌟 3. 제공 솔루션 (신규 기능 2종 추가, 총 14개 박스) */}
      <section className="bg-gray-50 py-24 px-6 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <FadeInUp>
            <div className="text-center px-4">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 font-title tracking-tight">
                프리미엄 마케팅 솔루션
              </h2>
              <p className="text-lg text-gray-500 mb-16 max-w-2xl mx-auto break-keep leading-relaxed">
                블로그 지수부터 상위 노출 분석까지,<br className="hidden md:block" />
                전문가의 시선으로 설계된 빈틈없는 맞춤형 분석 도구를 제공합니다.
              </p>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">

              {/* 박스 1 */}
              <Link href="/analysis" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">키워드 정밀 분석</h3>
              </Link>

              {/* 박스 2 */}
              <Link href="/related-fast" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">연관 키워드 조회</h3>
              </Link>

              {/* 박스 3 */}
              <Link href="/keyword-generator" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">키워드 생성기</h3>
              </Link>

              {/* 박스 4 */}
              <Link href="/blog-rank-b" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">블로그 순위 확인</h3>
              </Link>

              {/* 박스 5 */}
              <Link href="/kin-rank" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">지식인 순위 확인</h3>
              </Link>

              {/* 박스 6 */}
              <Link href="/blog-rank" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">통검 노출/순위 확인</h3>
              </Link>

              {/* 박스 7 */}
              <Link href="/google-analysis" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">구글 키워드 분석</h3>
              </Link>

              {/* 박스 8 */}
              <Link href="/youtube-trend" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">유튜브 트렌드</h3>
              </Link>

              {/* 박스 9 */}
              <Link href="/shopping-insight" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">쇼핑 인사이트</h3>
              </Link>

              {/* 박스 10 */}
              <Link href="/shopping-rank" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">상품 노출 순위 분석</h3>
              </Link>

              {/* 박스 11: 저장된 목록 보기 (기존 분석 히스토리) */}
              <Link href="/saved-list" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">저장된 목록 보기</h3>
              </Link>

              {/* 🚀 신규 박스 12: 검색 키워드 저장 */}
              <Link href="#" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">검색 키워드 저장</h3>
              </Link>

              {/* 🚀 신규 박스 13: 전용 웹 메모장 */}
              <Link href="#" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">전용 웹 메모장</h3>
              </Link>

              {/* 🚀 신규 박스 14: 고객센터 (FAQ) */}
              <Link href="/contact" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">고객센터 (FAQ)</h3>
              </Link>

              {/* 🚀 신규 박스 15: 공지사항 */}
              <Link href="/notice" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">공지사항</h3>
              </Link>

              {/* 🚀 신규 박스 16: 대규모 분산 처리 (기존: IP 자동 우회) */}
              <Link href="#" className="group bg-white h-40 rounded-2xl border border-indigo-200 shadow-sm flex flex-col items-center justify-center transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_10px_30px_-10px_rgba(79,70,229,0.25)] hover:border-indigo-400 cursor-pointer">
                <div className="text-indigo-500 mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                </div>
                <h3 className="text-[15px] font-bold text-gray-800 group-hover:text-indigo-700 transition-colors duration-300">IP 분산 처리 시스템</h3>
              </Link>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* 🌟 4. 합리적인 포인트 요금제 (포인트 숫자 font-light, 전체적인 무게감 완화) */}
      <section className="bg-white py-24 px-6 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <FadeInUp>
            <div className="text-center px-4">
              <h2 className="text-3xl font-black text-gray-900 mb-4 font-title tracking-tight">
                합리적인 맞춤형 요금제
              </h2>
              <p className="text-lg text-gray-500 mb-16 mx-auto leading-relaxed">
                비즈니스 규모에 맞게 필요한 만큼만 충전하세요.<br />
                매월 빠져나가는 정기 결제의 부담 없이, 모든 프리미엄 분석 기능을 자유롭게 활용할 수 있습니다.
              </p>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* 1. 스타터 */}
              <div className="group bg-gray-50 rounded-2xl p-10 border border-gray-200 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-2 hover:bg-white hover:shadow-[0_15px_40px_-15px_rgba(16,185,129,0.2)] hover:border-emerald-500 h-full">
                <span className="text-sm font-medium tracking-widest text-gray-400 group-hover:text-emerald-500 transition-colors mb-2">STARTER</span>
                <h3 className="text-4xl font-bold text-gray-800 group-hover:text-emerald-500 transition-colors mb-4">스타터</h3>

                <p className="text-[15px] text-gray-500 mb-6">개인 및 1인 셀러를 위한 플랜</p>

                <div className="mb-8 w-full">
                  {/* 숫자 굵기를 font-light로 변경하여 얇고 세련되게 처리 */}
                  <p className="flex items-baseline justify-center gap-1.5 text-5xl font-light text-gray-700 group-hover:text-emerald-500 transition-colors mb-3 tracking-tight">
                    10,000 <span className="text-lg font-medium tracking-wide">Point</span>
                  </p>
                  <p className="text-base text-gray-600 font-medium">
                    ₩ 10,000 <span className="text-emerald-500 ml-1 font-medium">(+0 P)</span>
                  </p>
                </div>

                <div className="mb-8">
                  <p className="text-lg text-gray-600 font-semibold group-hover:text-gray-800 transition-colors">IP 1개 접속 가능</p>
                </div>

                {/* 버튼 텍스트 굵기를 font-medium으로 조절하여 부담감 완화 */}
                <button className="w-full mt-auto py-4 rounded-xl font-medium bg-gray-800 text-white shadow-sm hover:bg-gray-900 transition-all">
                  선택하기
                </button>
              </div>

              {/* 2. 프로 */}
              <div className="group bg-gray-50 rounded-2xl p-10 border border-gray-200 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-2 hover:bg-white hover:shadow-[0_15px_40px_-15px_rgba(79,70,229,0.2)] hover:border-indigo-500 h-full">
                <span className="text-sm font-medium tracking-widest text-gray-400 group-hover:text-indigo-500 transition-colors mb-2">PRO</span>
                <h3 className="text-4xl font-bold text-gray-800 group-hover:text-indigo-500 transition-colors mb-4">프로</h3>

                <p className="text-[15px] text-gray-500 mb-6">전문 마케터를 위한 베스트 플랜</p>

                <div className="mb-8 w-full">
                  <p className="flex items-baseline justify-center gap-1.5 text-5xl font-light text-gray-700 group-hover:text-indigo-500 transition-colors mb-3 tracking-tight">
                    36,000 <span className="text-lg font-medium tracking-wide">Point</span>
                  </p>
                  <p className="text-base text-gray-600 font-medium">
                    ₩ 30,000 <span className="text-indigo-500 ml-1 font-medium">(+6,000 P)</span>
                  </p>
                </div>

                <div className="mb-8">
                  <p className="text-lg text-gray-600 font-semibold group-hover:text-gray-800 transition-colors">IP 1개 접속 가능</p>
                </div>

                <button className="w-full mt-auto py-4 rounded-xl font-medium bg-gray-800 text-white shadow-sm hover:bg-gray-900 transition-all">
                  선택하기
                </button>
              </div>

              {/* 3. 에이전시 */}
              <div className="group bg-gray-50 rounded-2xl p-10 border border-gray-200 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-2 hover:bg-white hover:shadow-[0_15px_40px_-15px_rgba(249,115,22,0.2)] hover:border-orange-500 h-full">
                <span className="text-sm font-medium tracking-widest text-gray-400 group-hover:text-orange-500 transition-colors mb-2">AGENCY</span>
                <h3 className="text-4xl font-bold text-gray-800 group-hover:text-orange-500 transition-colors mb-4">에이전시</h3>

                <p className="text-[15px] text-gray-500 mb-6">대행사 및 대용량 분석용 플랜</p>

                <div className="mb-8 w-full">
                  <p className="flex items-baseline justify-center gap-1.5 text-5xl font-light text-gray-700 group-hover:text-orange-500 transition-colors mb-3 tracking-tight">
                    60,000 <span className="text-lg font-medium tracking-wide">Point</span>
                  </p>
                  <p className="text-base text-gray-600 font-medium">
                    ₩ 50,000<span className="text-orange-500 ml-1 font-medium">(+10,000 P)</span>
                  </p>
                </div>

                <div className="mb-8">
                  <p className="text-lg text-gray-600 font-semibold group-hover:text-gray-800 transition-colors">IP 다중 접속 가능</p>
                </div>

                <button className="w-full mt-auto py-4 rounded-xl font-medium bg-gray-800 text-white shadow-sm hover:bg-gray-900 transition-all">
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