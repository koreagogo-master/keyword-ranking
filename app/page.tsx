// app/page.tsx
'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MainFooter from "@/components/MainFooter";
import FadeInUp from "@/components/FadeInUp";
import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
});

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

      {/* 🌟 1. 메인 히어로 섹션 (여백 축소 및 마케팅 중심 카피라이팅 적용) */}
      <main className="bg-gray-50 flex flex-col items-center justify-center px-4 pt-16 pb-10 border-b border-gray-100">
        <FadeInUp>
          <div className="text-center mb-10">
            <span className="text-indigo-600 font-bold text-sm mb-5 inline-block bg-indigo-100/50 px-4 py-1.5 rounded-full">
              회원가입 시 매일 5회 무료 검색 제공!
            </span>
            <h1 className={`text-5xl md:text-6xl font-black text-gray-900 mb-6 tracking-tighter ${montserrat.className}`}>
              Ranking <span className="text-indigo-600">Pro</span>
            </h1>
            <p className="text-gray-500 text-lg font-medium leading-relaxed">
              효율적인 마케팅을 위한 키워드와 시장 분석부터 AI를 활용한 콘텐츠 작성.<br className="hidden md:block" /> 
              데이터 기반의 가장 확실한 비즈니스 솔루션
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
              * 비로그인 상태에서는 IP당 일 1회만 검색 가능 하며 회원 가입시 3,000 Point를 드립니다. *
            </p>
          </div>
        </FadeInUp>
      </main>

      {/* 🌟 2. 소개 섹션 (패딩 조절 및 text-justify 적용으로 자연스러운 정렬) */}
      <section className="bg-white py-20 px-6 border-b border-gray-100">
        <div className="max-w-[1000px] mx-auto">
          <FadeInUp>
            <div className="text-center px-4 mb-12">
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 font-title">
              랭킹 프로 핵심 솔루션
            </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto break-keep leading-relaxed">
                검색 로직 분석부터 전문가 수준의 AI 포스팅, 온라인 셀러 맞춤 진단까지.<br />파편화된 마케팅 업무를 하나로 연결하여 가장 확실하고 강력한 해답을 제시합니다.
              </p>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            {/* 💡 2x2 Grid Layout */}
            <div className="grid md:grid-cols-2 gap-5">
              
              {/* 1. 데이터 분석 */}
              <div className="bg-white p-6 md:p-7 rounded-[1.5rem] border border-gray-200 shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-300 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-indigo-600 shrink-0 transition-transform hover:scale-110">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <h3 className="text-[17px] font-bold text-gray-800">초정밀 통합 데이터 분석</h3>
                </div>
                {/* 강제 줄바꿈 제거 및 text-justify 적용 */}
                <p className="text-gray-500 text-[14.5px] leading-relaxed break-keep text-justify">
                  네이버, 구글, 유튜브의 최신 로직을 공식 API와 TMGad. 만의 노하우로 분석하여 실질적인 결과에 도움을 줍니다.
                </p>
              </div>

              {/* 2. AI 창작 */}
              <div className="bg-white p-6 md:p-7 rounded-[1.5rem] border border-gray-200 shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-300 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-indigo-600 shrink-0 transition-transform hover:scale-110">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <h3 className="text-[17px] font-bold text-gray-800">Dual AI 자동화 엔진</h3>
                </div>
                {/* 문구 수정 및 text-justify 적용 */}
                <p className="text-gray-500 text-[14.5px] leading-relaxed break-keep text-justify">
                  GPT-4와 Claude 3.5의 특성을 결합하여, 전문가 수준의 블로그 포스팅과 언론 기사를 생성하여 완성합니다.
                </p>
              </div>

              {/* 3. 커머스/셀러 */}
              <div className="bg-white p-6 md:p-7 rounded-[1.5rem] border border-gray-200 shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-300 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-indigo-600 shrink-0 transition-transform hover:scale-110">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                  </div>
                  <h3 className="text-[17px] font-bold text-gray-800">이커머스 맞춤형 솔루션</h3>
                </div>
                {/* 강제 줄바꿈 제거 및 text-justify 적용 */}
                <p className="text-gray-500 text-[14.5px] leading-relaxed break-keep text-justify">
                  상품명 SEO 진단부터 쇼핑 인사이트, 실시간 노출 순위 추적까지 온라인 셀러의 시장 경쟁력을 높이는 전용 툴을 지원합니다.
                </p>
              </div>

              {/* 4. 시스템/인프라 */}
              <div className="bg-white p-6 md:p-7 rounded-[1.5rem] border border-gray-200 shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-300 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-indigo-600 shrink-0 transition-transform hover:scale-110">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                  </div>
                  <h3 className="text-[17px] font-bold text-gray-800">안전한 IP 분산 네트워크</h3>
                </div>
                {/* 강제 줄바꿈 제거 및 text-justify 적용 */}
                <p className="text-gray-500 text-[14.5px] leading-relaxed break-keep text-justify">
                  독자적인 프록시 서버망을 구축하여 대량 키워드 스크래핑 시에도 포털 차단 위험 없이 가장 안정적인 작업 환경을 보장합니다.
                </p>
              </div>

            </div>
          </FadeInUp>
        </div>
      </section>

      {/* 🌟 3. 제공 솔루션 (PC 전용 Bento Box 레이아웃 + 명도 대비 강화) */}
      {/* 전체 배경을 bg-gray-50 에서 bg-gray-100 으로 한 단계 어둡게 변경했습니다 */}
      <section className="bg-gray-100 py-24 px-6 border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto">
          <FadeInUp>
            <div className="text-center px-4">
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 font-title">
                프리미엄 마케팅 툴킷
              </h2>
              <p className="text-lg text-gray-500 mb-16 max-w-3xl mx-auto break-keep leading-relaxed">
                콘텐츠 기획, 상위 노출 분석, 상품명 진단을 하나의 플랫폼에서.<br />전문 마케터와 온라인 셀러의 업무 시간을 단축하고 성과를 극대화하는 맞춤형 도구를 제공합니다.
              </p>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            {/* 💡 3x3 Grid Layout */}
            <div className="grid grid-cols-3 gap-6 auto-rows-[minmax(200px,auto)]">
              
              {/* --- [1] Naver TOOLS (2x2) --- */}
              <div className="col-span-2 row-span-2 bg-white rounded-[2rem] p-8 border-2 border-transparent shadow-sm transition-all duration-300 hover:border-[#03c75a] hover:shadow-xl flex flex-col">
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-[#03c75a] rounded-full"></span>
                  Naver TOOLS
                </h3>
                <div className="grid grid-cols-3 gap-4 flex-1">
                  {/* 내부 버튼들의 테두리를 border-gray-100 에서 border-gray-200 으로 한 단계 진하게 변경했습니다 */}
                  <Link href="/analysis" className="group bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center p-4 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md hover:border-[#03c75a]/30">
                    <div className="w-12 h-12 mb-3 rounded-full bg-[#03c75a]/10 flex items-center justify-center text-[#03c75a] transition-transform duration-300 group-hover:-translate-y-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-[#03c75a] transition-colors">키워드 정밀 분석</h3>
                  </Link>

                  <Link href="/related-fast" className="group bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center p-4 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md hover:border-[#03c75a]/30">
                    <div className="w-12 h-12 mb-3 rounded-full bg-[#03c75a]/10 flex items-center justify-center text-[#03c75a] transition-transform duration-300 group-hover:-translate-y-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </div>
                    <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-[#03c75a] transition-colors">연관 키워드 조회</h3>
                  </Link>

                  <Link href="/blog-rank-b" className="group bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center p-4 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md hover:border-[#03c75a]/30">
                    <div className="w-12 h-12 mb-3 rounded-full bg-[#03c75a]/10 flex items-center justify-center text-[#03c75a] transition-transform duration-300 group-hover:-translate-y-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-[#03c75a] transition-colors">블로그 순위 확인</h3>
                  </Link>

                  <Link href="/kin-rank" className="group bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center p-4 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md hover:border-[#03c75a]/30">
                    <div className="w-12 h-12 mb-3 rounded-full bg-[#03c75a]/10 flex items-center justify-center text-[#03c75a] transition-transform duration-300 group-hover:-translate-y-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </div>
                    <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-[#03c75a] transition-colors">지식인 순위 확인</h3>
                  </Link>

                  <Link href="/blog-rank" className="group bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center p-4 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md hover:border-[#03c75a]/30">
                    <div className="w-12 h-12 mb-3 rounded-full bg-[#03c75a]/10 flex items-center justify-center text-[#03c75a] transition-transform duration-300 group-hover:-translate-y-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </div>
                    <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-[#03c75a] transition-colors">통검 노출/순위 확인</h3>
                  </Link>

                  <Link href="/keyword-generator" className="group bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center p-4 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md hover:border-[#03c75a]/30">
                    <div className="w-12 h-12 mb-3 rounded-full bg-[#03c75a]/10 flex items-center justify-center text-[#03c75a] transition-transform duration-300 group-hover:-translate-y-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                    </div>
                    <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-[#03c75a] transition-colors">키워드 생성기</h3>
                  </Link>
                </div>
              </div>

              {/* --- [2] AI TOOLS (1x1) --- */}
              <div className="col-span-1 row-span-1 bg-white rounded-[2rem] p-8 border-2 border-transparent shadow-sm transition-all duration-300 hover:border-purple-400 hover:shadow-xl flex flex-col">
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-purple-500 rounded-full"></span>
                  AI TOOLS
                </h3>
                <div className="flex flex-col gap-3 flex-1">
                  <Link href="/ai-blog" className="group flex-1 bg-gray-50/50 rounded-2xl border border-gray-200 flex items-center p-5 transition-all duration-300 hover:scale-[1.03] hover:bg-white hover:shadow-md hover:border-purple-300">
                    <div className="w-10 h-10 mr-4 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-purple-600 transition-colors">+ Dual AI 포스팅</h3>
                  </Link>
                  <Link href="/ai-press" className="group flex-1 bg-gray-50/50 rounded-2xl border border-gray-200 flex items-center p-5 transition-all duration-300 hover:scale-[1.03] hover:bg-white hover:shadow-md hover:border-purple-300">
                    <div className="w-10 h-10 mr-4 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15" /></svg>
                    </div>
                    <h3 className="text-[15px] font-bold text-gray-700 group-hover:text-purple-600 transition-colors">+ AI 언론 보도자료</h3>
                  </Link>
                </div>
              </div>

              {/* --- [3] Google & YouTube (1x1) --- */}
              <div className="col-span-1 row-span-1 bg-white rounded-[2rem] p-8 border-2 border-transparent shadow-sm transition-all duration-300 hover:border-red-400 hover:shadow-xl flex flex-col">
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-red-500 rounded-full"></span>
                  Google & YouTube
                </h3>
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <Link href="/google-analysis" className="group bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center p-4 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md hover:border-red-300">
                    <div className="w-12 h-12 mb-3 rounded-full bg-red-50 flex items-center justify-center text-red-500 transition-transform duration-300 group-hover:-translate-y-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                    </div>
                    <h3 className="text-[14px] font-bold text-gray-700 group-hover:text-red-500 transition-colors">구글 키워드 분석</h3>
                  </Link>
                  <Link href="/youtube-trend" className="group bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center p-4 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md hover:border-red-300">
                    <div className="w-12 h-12 mb-3 rounded-full bg-red-50 flex items-center justify-center text-red-500 transition-transform duration-300 group-hover:-translate-y-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-[14px] font-bold text-gray-700 group-hover:text-red-500 transition-colors">유튜브 트렌드</h3>
                  </Link>
                </div>
              </div>

              {/* --- [4] Seller Tools (2x1) --- */}
              <div className="col-span-2 row-span-1 bg-white rounded-[2rem] p-8 border-2 border-transparent shadow-sm transition-all duration-300 hover:border-orange-400 hover:shadow-xl flex flex-col">
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-orange-400 rounded-full"></span>
                  Seller Tools
                </h3>
                <div className="grid grid-cols-4 gap-4 flex-1">
                  <Link href="/shopping-insight" className="group bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center p-4 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md hover:border-orange-300">
                    <div className="w-12 h-12 mb-3 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 transition-transform duration-300 group-hover:-translate-y-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <h3 className="text-[14px] font-bold text-gray-700 whitespace-nowrap group-hover:text-orange-500 transition-colors">키워드 인사이트</h3>
                  </Link>
                  <Link href="/seo-title" className="group bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center p-4 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md hover:border-orange-300">
                    <div className="w-12 h-12 mb-3 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 transition-transform duration-300 group-hover:-translate-y-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </div>
                    <h3 className="text-[14px] font-bold text-gray-700 whitespace-nowrap group-hover:text-orange-500 transition-colors">상품명 최적화</h3>
                  </Link>
                  <Link href="/seo-check" className="group bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center p-4 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md hover:border-orange-300">
                    <div className="w-12 h-12 mb-3 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 transition-transform duration-300 group-hover:-translate-y-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    </div>
                    <h3 className="text-[14px] font-bold text-gray-700 whitespace-nowrap group-hover:text-orange-500 transition-colors">내 상품명 진단</h3>
                  </Link>
                  <Link href="/shopping-rank" className="group bg-gray-50/50 rounded-2xl border border-gray-200 flex flex-col items-center justify-center p-4 transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-md hover:border-orange-300">
                    <div className="w-12 h-12 mb-3 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 transition-transform duration-300 group-hover:-translate-y-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    <h3 className="text-[14px] font-bold text-gray-700 whitespace-nowrap group-hover:text-orange-500 transition-colors">노출 순위 분석</h3>
                  </Link>
                </div>
              </div>

              {/* --- [5] System (1x1) --- */}
              <div className="col-span-1 row-span-1 bg-white rounded-[2rem] p-8 border-2 border-transparent shadow-sm transition-all duration-300 hover:border-gray-400 hover:shadow-xl flex flex-col">
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-gray-400 rounded-full"></span>
                  System
                </h3>
                <div className="flex flex-col gap-3 flex-1 justify-center">
                  <Link href="/history" className="group flex-1 bg-gray-50/50 rounded-xl border border-gray-200 flex items-center px-4 py-2 transition-all duration-300 hover:scale-[1.03] hover:bg-white hover:shadow-md hover:border-gray-300">
                    <div className="w-9 h-9 mr-3 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    </div>
                    <h3 className="text-[14px] font-bold text-gray-600 group-hover:text-gray-800 transition-colors">저장된 목록 보기</h3>
                  </Link>
                  <Link href="/contact" className="group flex-1 bg-gray-50/50 rounded-xl border border-gray-200 flex items-center px-4 py-2 transition-all duration-300 hover:scale-[1.03] hover:bg-white hover:shadow-md hover:border-gray-300">
                    <div className="w-9 h-9 mr-3 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-[14px] font-bold text-gray-600 group-hover:text-gray-800 transition-colors">고객센터 (FAQ)</h3>
                  </Link>
                  <Link href="/notice" className="group flex-1 bg-gray-50/50 rounded-xl border border-gray-200 flex items-center px-4 py-2 transition-all duration-300 hover:scale-[1.03] hover:bg-white hover:shadow-md hover:border-gray-300">
                    <div className="w-9 h-9 mr-3 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                    <h3 className="text-[14px] font-bold text-gray-600 group-hover:text-gray-800 transition-colors">공지사항</h3>
                  </Link>
                </div>
              </div>

            </div>
          </FadeInUp>
        </div>
      </section>

      {/* 🌟 4. 요금제 섹션 (군더더기 제거 및 톤다운된 청크 타일형 CTA 적용) */}
      <section className="bg-white py-16 px-6 border-b border-gray-100">
        <div className="max-w-[1000px] mx-auto">
          <FadeInUp>
            <div className="w-full flex flex-col md:flex-row items-center justify-between gap-8 py-4">
              
              {/* 좌측: 텍스트 영역 (불필요한 뱃지 제거, 제목에 집중) */}
              <div className="text-center md:text-left flex-1">
                <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 font-title">
                  약정 없이 자유로운 포인트 충전 시스템
                </h2>
                <p className="text-[15px] text-gray-500 break-keep leading-relaxed">
                  매월 결제되는 부담스러운 구독료는 그만. 필요한 순간에 필요한 만큼만 충전하여 사용하는 투명하고 합리적인 포인트 제도를 운영합니다.
                </p>
              </div>
              
              {/* 우측: 결제 버튼 영역 (톤다운된 다크 슬레이트 색상, 2줄 타일 형태) */}
              <div className="shrink-0 mt-4 md:mt-0">
                {/* 밝은 indigo에서 차분한 slate-800으로 톤 다운하고 padding을 늘려 정사각형 타일 느낌을 주었습니다 */}
                <Link href="/charge" className="group bg-slate-800 text-white px-8 py-6 rounded-[1.5rem] shadow-md hover:bg-slate-900 hover:shadow-lg transition-all duration-300 flex flex-col items-center justify-center gap-1.5 min-w-[160px]">
                  <span className="font-bold text-[17px]">포인트 충전소</span>
                  <span className="font-bold text-[14.5px] text-slate-400 flex items-center gap-1 group-hover:text-white transition-colors">
                    바로가기
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </span>
                </Link>
              </div>
              
            </div>
          </FadeInUp>
        </div>
      </section>

      <MainFooter />
    </div>
  );
}