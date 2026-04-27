// app/page.tsx
'use client';

import { useState, useEffect } from "react";
import { createClient } from "@/app/utils/supabase/client";
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

interface Notice {
  id: string;
  title: string;
  is_pinned: boolean;
  created_at: string;
}

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchLatestNotices = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('notices')
        .select('id, title, is_pinned, created_at')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(4);
      if (data) setNotices(data);
    };
    fetchLatestNotices();
  }, []);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!keyword.trim()) return alert("키워드를 입력해주세요.");
    router.push(`/analysis?keyword=${encodeURIComponent(keyword)}`);
  };

  // 💡 16개의 툴을 배열로 깔끔하게 정리 (에러 방지 및 4x4 완벽 정렬을 위함)
  const toolkits = [
    // --- AI TOOLS ---
    { category: "AI TOOLS", label: "+ AI 포스팅 생성/리뉴얼", href: "/ai-blog", iconBg: "bg-purple-50", iconColor: "text-purple-500", hoverBorder: "hover:border-purple-400", textHover: "group-hover:text-purple-600", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
    { category: "AI TOOLS", label: "+ AI 보도자료 작성/리뉴얼", href: "/ai-press", iconBg: "bg-purple-50", iconColor: "text-purple-500", hoverBorder: "hover:border-purple-400", textHover: "group-hover:text-purple-600", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15" /> },
    { category: "AI TOOLS", label: "+ 리뷰 답변 AI 자동 생성기", href: "/review-ai", iconBg: "bg-purple-50", iconColor: "text-purple-500", hoverBorder: "hover:border-purple-400", textHover: "group-hover:text-purple-600", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.8 7.5a1.84 1.84 0 0 0-2.6 0l-.2.3-.3-.3a1.84 1.84 0 1 0-2.4 2.8L12 13l2.7-2.7c.9-.9.8-2.1.1-2.8z" /></> },
    // --- NAVER TOOLS ---
    { category: "NAVER TOOLS", label: "키워드 정밀 분석", href: "/analysis", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> },
    { category: "NAVER TOOLS", label: "연관 키워드 조회", href: "/related-fast", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /> },
    { category: "NAVER TOOLS", label: "블로그 순위 확인", href: "/blog-rank-b", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
    { category: "NAVER TOOLS", label: "블로그 노출 진단", href: "/index-check", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { category: "NAVER TOOLS", label: "지식인 순위 확인", href: "/kin-rank", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> },
    { category: "NAVER TOOLS", label: "통검 노출/순위 확인", href: "/blog-rank", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /> },
    { category: "NAVER TOOLS", label: "키워드별 조회수", href: "/keyword-volume", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M10 3v18M14 3v18" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" /></> },
    { category: "NAVER TOOLS", label: "키워드 생성기", href: "/keyword-generator", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /> },
    // --- SELLER TOOLS ---
    { category: "SELLER TOOLS", label: "키워드 인사이트", href: "/shopping-insight", iconBg: "bg-orange-50", iconColor: "text-orange-500", hoverBorder: "hover:border-orange-400", textHover: "group-hover:text-orange-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /> },
    { category: "SELLER TOOLS", label: "상품명 최적화", href: "/seo-title", iconBg: "bg-orange-50", iconColor: "text-orange-500", hoverBorder: "hover:border-orange-400", textHover: "group-hover:text-orange-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /> },
    { category: "SELLER TOOLS", label: "내 상품명 진단", href: "/seo-check", iconBg: "bg-orange-50", iconColor: "text-orange-500", hoverBorder: "hover:border-orange-400", textHover: "group-hover:text-orange-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /> },
    { category: "SELLER TOOLS", label: "노출 순위 분석", href: "/shopping-rank", iconBg: "bg-orange-50", iconColor: "text-orange-500", hoverBorder: "hover:border-orange-400", textHover: "group-hover:text-orange-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
    // --- GOOGLE & YOUTUBE ---
    { category: "GOOGLE & YOUTUBE", label: "구글 키워드 분석", href: "/google-analysis", iconBg: "bg-red-50", iconColor: "text-red-500", hoverBorder: "hover:border-red-400", textHover: "group-hover:text-red-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /> },
    { category: "GOOGLE & YOUTUBE", label: "유튜브 트렌드", href: "/youtube-trend", iconBg: "bg-red-50", iconColor: "text-red-500", hoverBorder: "hover:border-red-400", textHover: "group-hover:text-red-500", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></> }
  ];

  return (
    <div className="min-h-screen bg-white font-body flex flex-col">

      {/* 🌟 1. 메인 히어로 섹션 */}
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

          <div className="mt-6 flex justify-center">
            <p className="inline-block bg-gray-100/80 px-4 py-1.5 rounded-full text-[13px] text-gray-500 font-medium">
              비로그인 상태에서는 IP당 일 1회만 검색 가능하며, 회원 가입 시 <span className="text-[#ff8533] font-bold">3,000 Point</span>를 드립니다.
            </p>
          </div>
        </FadeInUp>
      </main>

      {/* 🌟 2. 프리미엄 마케팅 툴킷 (4x4 Flat Grid - 혁신적인 카드 레이아웃) */}
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
            {/* 💡 4x4 완벽한 타일형 그리드 (모바일 2칸, 태블릿 3칸, PC 4칸 반응형) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {toolkits.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className={`group bg-white rounded-2xl border border-gray-200 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${item.hoverBorder} flex flex-col`}
                >
                  {/* 소속 라벨 (좌측 상단, 은은하게 표기) */}
                  <span className={`text-[11px] font-bold text-gray-400 mb-3 tracking-wide ${item.textHover} transition-colors`}>
                    {item.category}
                  </span>

                  {/* 메인 콘텐츠 (아이콘 + 텍스트) */}
                  <div className="flex items-center">
                    <div className={`w-10 h-10 mr-3 rounded-full ${item.iconBg} flex items-center justify-center ${item.iconColor} shrink-0 transition-transform duration-300 group-hover:scale-110`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {item.icon}
                      </svg>
                    </div>
                    <h3 className={`text-[14.5px] font-bold text-gray-700 ${item.textHover} transition-colors whitespace-nowrap`}>
                      {item.label}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* 🌟 3. 소개 섹션 */}
      <section className="bg-white py-20 px-6 border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto">
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
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* 1. 데이터 분석 */}
              <div className="bg-gray-50 p-5 xl:p-6 rounded-[1.5rem] border border-gray-200 flex flex-col">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="text-indigo-600 shrink-0 bg-indigo-100/50 p-2 rounded-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <h3 className="text-[15.5px] font-bold text-gray-800 tracking-tight leading-tight">초정밀 통합<br className="hidden lg:block xl:hidden" /> 데이터 분석</h3>
                </div>
                <p className="text-gray-500 text-[13.5px] leading-relaxed break-keep">
                  네이버, 구글, 유튜브의 최신 로직을 공식 API와 TMGad. 만의 노하우로 분석하여 실질적인 결과에 도움을 줍니다.
                </p>
              </div>

              {/* 2. AI 창작 */}
              <div className="bg-gray-50 p-5 xl:p-6 rounded-[1.5rem] border border-gray-200 flex flex-col">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="text-indigo-600 shrink-0 bg-indigo-100/50 p-2 rounded-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <h3 className="text-[15.5px] font-bold text-gray-800 tracking-tight leading-tight">Dual AI<br className="hidden lg:block xl:hidden" /> 자동화 엔진</h3>
                </div>
                <p className="text-gray-500 text-[13.5px] leading-relaxed break-keep">
                  GPT-4와 Claude 3.5의 특성을 결합하여, 전문가 수준의 블로그 포스팅과 언론 기사를 생성하여 완성합니다.
                </p>
              </div>

              {/* 3. 커머스/셀러 */}
              <div className="bg-gray-50 p-5 xl:p-6 rounded-[1.5rem] border border-gray-200 flex flex-col">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="text-indigo-600 shrink-0 bg-indigo-100/50 p-2 rounded-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                  </div>
                  <h3 className="text-[15.5px] font-bold text-gray-800 tracking-tight leading-tight">이커머스<br className="hidden lg:block xl:hidden" /> 맞춤형 솔루션</h3>
                </div>
                <p className="text-gray-500 text-[13.5px] leading-relaxed break-keep">
                  상품명 SEO 진단부터 쇼핑 인사이트, 실시간 노출 순위 추적까지 온라인 셀러의 시장 경쟁력을 높이는 전용 툴을 지원합니다.
                </p>
              </div>

              {/* 4. 시스템/인프라 */}
              <div className="bg-gray-50 p-5 xl:p-6 rounded-[1.5rem] border border-gray-200 flex flex-col">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="text-indigo-600 shrink-0 bg-indigo-100/50 p-2 rounded-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                  </div>
                  <h3 className="text-[15.5px] font-bold text-gray-800 tracking-tight leading-tight">안전한 IP<br className="hidden lg:block xl:hidden" /> 분산 네트워크</h3>
                </div>
                <p className="text-gray-500 text-[13.5px] leading-relaxed break-keep">
                  독자적인 프록시 서버망을 구축하여 대량 키워드 스크래핑 시에도 포털 차단 위험 없이 가장 안정적인 작업 환경을 보장합니다.
                </p>
              </div>

            </div>
          </FadeInUp>

          <FadeInUp delay={0.3}>
            <div className="mt-16 max-w-[1200px] mx-auto grid lg:grid-cols-5 gap-6">
              
              {/* 좌측 60%: 최근 공지사항 */}
              <div className="lg:col-span-3 flex flex-col">
                <div className="flex items-end justify-between mb-3 px-2">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                    최근 공지사항
                  </h3>
                  <Link href="/notice" className="text-[13px] font-bold text-gray-400 hover:text-indigo-600 transition-colors">
                    더보기 +
                  </Link>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex-1">
                  {notices.length > 0 ? (
                    <ul className="divide-y divide-gray-100">
                      {notices.map(notice => (
                        <li key={notice.id} className="group transition-colors hover:bg-slate-50">
                          <Link href={`/notice?id=${notice.id}`} className="flex items-center justify-between px-6 py-4">
                            <div className="flex items-center gap-3 overflow-hidden">
                              {notice.is_pinned ? (
                                <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100">중요</span>
                              ) : (
                                <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-black bg-gray-100 text-gray-500">공지</span>
                              )}
                              <span className={`text-[14.5px] font-medium truncate transition-colors group-hover:text-indigo-600 ${notice.is_pinned ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                                {notice.title}
                              </span>
                            </div>
                            <span className="shrink-0 ml-4 text-[13px] text-gray-400 font-medium">
                              {notice.created_at.substring(0, 10)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-6 py-8 text-center text-sm text-gray-400 font-medium">
                      등록된 공지사항이 없습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* 우측 40%: 고객센터 배너 */}
              <div className="lg:col-span-2 flex flex-col mt-8 lg:mt-0">
                <div className="flex items-end mb-3 px-2">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z" />
                      <path d="M21 16v2a4 4 0 0 1-4 4h-5" />
                    </svg>
                    고객센터
                  </h3>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex flex-col justify-center flex-1 relative overflow-hidden">
                  <div className="relative z-10 flex flex-col gap-3">
                    <p className="text-gray-500 text-[13.5px] font-medium mb-1.5 px-1 text-left break-keep">
                      궁금하신 점이나 불편한 점을 언제든 알려주세요.
                    </p>
                    <Link href="/contact" className="group bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 transition-all duration-300 rounded-xl px-5 py-4 flex items-center justify-between border border-gray-100 hover:border-indigo-100">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="font-bold text-[14.5px]">자주 묻는 질문 (FAQ)</span>
                      </div>
                      <svg className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                    
                    <Link href="/contact" className="group bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 transition-all duration-300 rounded-xl px-5 py-4 flex items-center justify-between border border-gray-100 hover:border-indigo-100">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                        <span className="font-bold text-[14.5px]">1:1 문의하기</span>
                      </div>
                      <svg className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          </FadeInUp>
        </div>
      </section>

      {/* 🌟 4. 요금제 섹션 */}
      <section className="bg-gray-100 py-16 px-6 border-b border-gray-100">
        <div className="max-w-[1000px] mx-auto">
          <FadeInUp>
            <div className="w-full flex flex-col md:flex-row items-center justify-between gap-8 py-4">

              {/* 좌측: 텍스트 영역 */}
              <div className="text-center md:text-left flex-1">
                <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 font-title">
                  약정 없이 자유로운 포인트 충전 시스템
                </h2>
                <p className="text-[15px] text-gray-500 break-keep leading-relaxed">
                  매월 결제되는 부담스러운 구독료는 그만. 필요한 순간에 필요한 만큼만 충전하여 사용하는 투명하고 합리적인 포인트 제도를 운영합니다.
                </p>
              </div>

              {/* 우측: 결제 버튼 영역 */}
              <div className="shrink-0 mt-4 md:mt-0">
                <Link href="/charge" className="group bg-indigo-950 text-white px-8 py-6 rounded-[1.5rem] shadow-md hover:bg-indigo-900 hover:shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 flex flex-col items-center justify-center gap-1.5 min-w-[160px]">
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