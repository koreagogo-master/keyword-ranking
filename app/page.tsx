// app/page.tsx
'use client';

import { useState, useEffect } from "react";
import { createClient } from "@/app/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MainFooter from "@/components/MainFooter";
import FadeInUp from "@/components/FadeInUp";
import { useAuth } from "@/app/contexts/AuthContext";

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
  const { user, isLoading: authLoading } = useAuth();

  // 오른쪽 카테고리 탭 상태
  const [activeTab, setActiveTab] = useState(0);
  const [tabResetKey, setTabResetKey] = useState(0);

  const handleTabClick = (idx: number) => {
    setActiveTab(idx);
    setTabResetKey(k => k + 1);
  };

  // 4.5초마다 자동 전환 (사용자가 탭 클릭 시 타이머 리셋)
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTab(prev => (prev + 1) % 4);
    }, 4500);
    return () => clearInterval(timer);
  }, [tabResetKey]);

  const categoryTabs = [
    {
      label: 'AI 콘텐츠 도구',
      color: 'purple' as const,
      title: 'AI 콘텐츠 도구',
      desc: ['블로그 포스팅, 보도자료, 리뷰 답변을 빠르게 작성합니다.', '아이디어가 부족할 때 초안 작성과 리뉴얼 방향을 잡을 수 있습니다.'],
      features: ['AI 포스팅 생성/리뉴얼', 'AI 보도자료 작성/리뉴얼', '리뷰 답변 AI 자동 생성기', '네이버 포스팅 X-Ray', 'AI 포스팅 인사이트'],
    },
    {
      label: '네이버 노출 분석',
      color: 'green' as const,
      title: '네이버 노출 분석',
      desc: ['키워드, 블로그, 플레이스, 지식인 노출 상태를 확인합니다.', '검색 결과에서 내 콘텐츠와 업체가 어떻게 보이는지 점검할 수 있습니다.'],
      features: ['키워드 정밀 분석', '연관 키워드 조회', '블로그 순위 확인', '블로그 노출 진단', '지식인 순위 확인', '통합검색 노출/순위 확인', '키워드 조회수 확인', '키워드 생성기', '플레이스 순위 조회'],
    },
    {
      label: '셀러 최적화',
      color: 'orange' as const,
      title: '셀러 최적화',
      desc: ['상품명, 키워드, 쇼핑 노출 순위를 점검합니다.', '온라인 셀러의 상품 등록과 노출 개선에 활용할 수 있습니다.'],
      features: ['키워드 인사이트', '상품명 최적화', '내 상품명 진단', '쇼핑 노출 순위 분석'],
    },
    {
      label: '구글·유튜브 트렌드',
      color: 'red' as const,
      title: '구글·유튜브 트렌드',
      desc: ['구글 키워드와 유튜브 트렌드 흐름을 확인합니다.', '콘텐츠 주제와 시장 흐름을 빠르게 파악할 수 있습니다.'],
      features: ['구글 키워드 분석', '유튜브 트렌드'],
    },
  ] as const;

  // 카테고리별 색상 토큰
  // 텍스트 색상은 Tailwind 클래스 대신 color 값으로 분리 — JIT 누락 방지
  const tabStyles = {
    purple: {
      inactiveCls: 'bg-white border border-purple-200 hover:bg-purple-50 !text-purple-700',
      activeCls: 'bg-purple-50 border border-purple-400 shadow-sm !text-purple-700',
      cardBg: 'bg-purple-50',
      card: 'border-purple-200',
      accent: 'text-purple-600',
      dot: 'bg-purple-500',
      chip: 'bg-white border border-gray-200 !text-gray-700',
    },
    green: {
      inactiveCls: 'bg-white border border-emerald-200 hover:bg-emerald-50 !text-emerald-700',
      activeCls: 'bg-emerald-50 border border-emerald-400 shadow-sm !text-emerald-700',
      cardBg: 'bg-green-50',
      card: 'border-green-200',
      accent: 'text-[#03c75a]',
      dot: 'bg-[#03c75a]',
      chip: 'bg-white border border-gray-200 !text-gray-700',
    },
    orange: {
      inactiveCls: 'bg-white border border-orange-200 hover:bg-orange-50 !text-orange-700',
      activeCls: 'bg-orange-50 border border-orange-400 shadow-sm !text-orange-700',
      cardBg: 'bg-orange-50',
      card: 'border-orange-200',
      accent: 'text-orange-500',
      dot: 'bg-orange-400',
      chip: 'bg-white border border-gray-200 !text-gray-700',
    },
    red: {
      inactiveCls: 'bg-white border border-red-200 hover:bg-red-50 !text-red-700',
      activeCls: 'bg-red-50 border border-red-400 shadow-sm !text-red-700',
      cardBg: 'bg-red-50',
      card: 'border-red-200',
      accent: 'text-red-500',
      dot: 'bg-red-400',
      chip: 'bg-white border border-gray-200 !text-gray-700',
    },
  } as const;

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

  const toolkits = [
    // --- AI TOOLS ---
    { category: "AI TOOLS", label: "AI 포스팅 생성/리뉴얼", href: "/ai-blog", iconBg: "bg-purple-50", iconColor: "text-purple-500", hoverBorder: "hover:border-purple-400", textHover: "group-hover:text-purple-600", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
    { category: "AI TOOLS", label: "AI 보도자료 작성/리뉴얼", href: "/ai-press", iconBg: "bg-purple-50", iconColor: "text-purple-500", hoverBorder: "hover:border-purple-400", textHover: "group-hover:text-purple-600", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15" /> },
    { category: "AI TOOLS", label: "리뷰 답변 AI 자동 생성기", href: "/review-ai", iconBg: "bg-purple-50", iconColor: "text-purple-500", hoverBorder: "hover:border-purple-400", textHover: "group-hover:text-purple-600", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.8 7.5a1.84 1.84 0 0 0-2.6 0l-.2.3-.3-.3a1.84 1.84 0 1 0-2.4 2.8L12 13l2.7-2.7c.9-.9.8-2.1.1-2.8z" /></> },
    { category: "AI TOOLS", label: "네이버 포스팅 X-Ray", href: "/post-xray", iconBg: "bg-purple-50", iconColor: "text-purple-500", hoverBorder: "hover:border-purple-400", textHover: "group-hover:text-purple-600", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></> },
    { category: "AI TOOLS", label: "AI 포스팅 인사이트", href: "/ai-insight", iconBg: "bg-purple-50", iconColor: "text-purple-500", hoverBorder: "hover:border-purple-400", textHover: "group-hover:text-purple-600", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></> },
    // --- NAVER TOOLS ---
    { category: "NAVER TOOLS", label: "키워드 정밀 분석", href: "/analysis", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> },
    { category: "NAVER TOOLS", label: "연관 키워드 조회", href: "/related-fast", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /> },
    { category: "NAVER TOOLS", label: "블로그 순위 확인", href: "/blog-rank-b", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
    { category: "NAVER TOOLS", label: "블로그 노출 진단", href: "/index-check", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { category: "NAVER TOOLS", label: "지식인 순위 확인", href: "/kin-rank", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /> },
    { category: "NAVER TOOLS", label: "통합검색 노출/순위 확인", href: "/blog-rank", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /> },
    { category: "NAVER TOOLS", label: "키워드 조회수 확인", href: "/keyword-volume", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M10 3v18M14 3v18" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" /></> },
    { category: "NAVER TOOLS", label: "키워드 생성기", href: "/keyword-generator", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /> },
    { category: "NAVER TOOLS", label: "플레이스 순위 조회", href: "/place-rank", iconBg: "bg-[#03c75a]/10", iconColor: "text-[#03c75a]", hoverBorder: "hover:border-[#03c75a]/50", textHover: "group-hover:text-[#03c75a]", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></> },
    // --- SELLER TOOLS ---
    { category: "SELLER TOOLS", label: "키워드 인사이트", href: "/shopping-insight", iconBg: "bg-orange-50", iconColor: "text-orange-500", hoverBorder: "hover:border-orange-400", textHover: "group-hover:text-orange-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /> },
    { category: "SELLER TOOLS", label: "상품명 최적화", href: "/seo-title", iconBg: "bg-orange-50", iconColor: "text-orange-500", hoverBorder: "hover:border-orange-400", textHover: "group-hover:text-orange-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /> },
    { category: "SELLER TOOLS", label: "내 상품명 진단", href: "/seo-check", iconBg: "bg-orange-50", iconColor: "text-orange-500", hoverBorder: "hover:border-orange-400", textHover: "group-hover:text-orange-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /> },
    { category: "SELLER TOOLS", label: "쇼핑 노출 순위 분석", href: "/shopping-rank", iconBg: "bg-orange-50", iconColor: "text-orange-500", hoverBorder: "hover:border-orange-400", textHover: "group-hover:text-orange-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
    // --- GOOGLE & YOUTUBE ---
    { category: "GOOGLE & YOUTUBE", label: "구글 키워드 분석", href: "/google-analysis", iconBg: "bg-red-50", iconColor: "text-red-500", hoverBorder: "hover:border-red-400", textHover: "group-hover:text-red-500", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /> },
    { category: "GOOGLE & YOUTUBE", label: "유튜브 트렌드", href: "/youtube-trend", iconBg: "bg-red-50", iconColor: "text-red-500", hoverBorder: "hover:border-red-400", textHover: "group-hover:text-red-500", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></> },
  ];


  return (
    <div className="min-h-screen bg-white font-body flex flex-col">

      {/* ─────────────────────────────────────────────────────
          1. 히어로 섹션 (좌우 2단)
      ───────────────────────────────────────────────────── */}
      <main className="bg-gray-50 border-b border-gray-100 px-6 pt-24 pb-14">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-16">

            {/* ── 왼쪽: 카피 · 혜택 · 검색창 ── */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <FadeInUp>
                <h1 className="text-4xl xl:text-5xl font-black text-gray-900 mb-5 leading-tight tracking-tight">
                  <span className="whitespace-nowrap">콘텐츠 제작부터 노출 분석까지,</span><br />
                  한곳에서 빠르게
                </h1>
                <p className="text-gray-500 text-base xl:text-[17px] font-medium leading-relaxed break-keep max-w-lg">
                  AI 콘텐츠 작성, 키워드 분석, 순위 확인, 상품 최적화, 트렌드 점검까지
                  마케팅과 콘텐츠 기획에 필요한 도구를 한곳에 모았습니다.
                </p>
                {/* 검색창 */}
                <FadeInUp delay={0.15}>
                  <form onSubmit={handleSearch} className="mt-12">
                    <div
                      className="flex items-center bg-white rounded-2xl p-1.5 transition-all duration-500 ease-out"
                      style={{
                        width: isFocused ? '520px' : '400px',
                        maxWidth: '100%',
                        border: isFocused ? '1px solid #818cf8' : '1px solid #c7d2fe',
                        boxShadow: isFocused ? '0 10px 24px -4px rgba(79,70,229,0.14)' : '0 1px 3px 0 rgba(79,70,229,0.06)'
                      }}
                    >
                      <input
                        type="text"
                        placeholder="분석할 키워드를 입력하세요"
                        className="flex-1 bg-transparent px-5 py-3 outline-none text-base text-gray-800 placeholder-gray-400 min-w-0"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                      />
                      <button
                        type="submit"
                        className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-base whitespace-nowrap hover:bg-indigo-700 transition-all"
                      >
                        검색
                      </button>
                    </div>
                  </form>
                </FadeInUp>
                {/* 비로그인 혜택 안내 */}
                {!authLoading && !user && (
                  <div className="mt-5 flex flex-col gap-1">
                    <p className="text-[13.5px] text-gray-400 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 inline-block"></span>
                      가입 후 매일 무료 검색 <span className="text-indigo-500 font-bold">5회</span>와{" "}
                      <span className="text-[#ff8533] font-bold">3,000 Point</span>를 받을 수 있습니다.
                    </p>
                    <p className="text-[13.5px] text-gray-400 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 inline-block"></span>
                      네이버·구글 아이디로 간편하게 시작할 수 있습니다.
                    </p>
                  </div>
                )}
              </FadeInUp>


            </div>

            {/* ── 오른쪽: 카테고리 탭 + 설명 카드 ── */}
            <div className="w-full lg:w-[45%] shrink-0 lg:mt-[70px] xl:mt-[85px]">
              <FadeInUp delay={0.1}>

                {/* 4개 탭 */}
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {categoryTabs.map((tab, idx) => {
                    const s = tabStyles[tab.color];
                    const isActive = activeTab === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleTabClick(idx)}
                        className={`text-[13.5px] font-extrabold px-2 py-2.5 rounded-xl transition-all duration-200 cursor-pointer text-center leading-snug ${isActive ? s.activeCls : s.inactiveCls}`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* 설명 카드 — activeTab에 따라 내용 변경 */}
                {(() => {
                  const tab = categoryTabs[activeTab];
                  const s = tabStyles[tab.color];
                  return (
                    <div
                      key={activeTab}
                      className={`${s.cardBg} rounded-2xl border ${s.card} shadow-sm px-7 py-8 transition-all duration-300 min-h-[260px] flex flex-col gap-4`}
                    >
                      {/* 설명 2줄 — 첫 줄 강조 */}
                      <div className="space-y-2">
                        {tab.desc.map((line, i) => (
                          <p
                            key={i}
                            className={
                              i === 0
                                ? "text-[14px] font-semibold text-gray-800 leading-snug break-keep"
                                : "text-[13px] text-gray-500 leading-snug break-keep"
                            }
                          >
                            {line}
                          </p>
                        ))}
                      </div>

                      {/* 기능 칩 목록 */}
                      <div className="flex flex-wrap gap-2">
                        {tab.features.map((f, i) => (
                          <span
                            key={i}
                            className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-lg border ${s.chip}`}
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}


              </FadeInUp>
            </div>

          </div>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────
          2. 전체 도구 목록
      ───────────────────────────────────────────────────── */}
      <section id="toolkit" className="bg-gray-100 py-20 px-6 border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto">
          <FadeInUp>
            <div className="text-center px-4 mb-10">
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 font-title">
                랭킹프로로 할 수 있는 일
              </h2>
              <p className="text-base text-gray-500 max-w-2xl mx-auto break-keep leading-relaxed">
                콘텐츠 작성, 키워드 분석, 순위 확인, 상품 최적화까지
                <br />
                마케터와 온라인 셀러가 자주 쓰는 작업을 빠르게 확인할 수 있습니다.
              </p>
            </div>
          </FadeInUp>


          {/* 전체 기능 4×5 그리드 */}
          <FadeInUp delay={0.2}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {toolkits.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className={`group bg-white rounded-2xl border border-gray-200 px-5 py-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${item.hoverBorder} flex flex-col`}
                >
                  <span className={`text-[11px] font-bold mb-2 tracking-wide ${item.iconColor} transition-colors`}>
                    {item.category}
                  </span>
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

      {/* ─────────────────────────────────────────────────────
    4. 핵심 솔루션 소개
───────────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-6 border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto">
          <FadeInUp>
            <div className="text-center px-4 mb-12">
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 font-title">
                랭킹프로가 업무를 줄이는 방식
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto break-keep leading-relaxed">
                콘텐츠 작성, 검색 노출 분석, 상품 최적화까지
                <br />
                반복되는 마케팅 업무를 더 빠르고 체계적으로 처리할 수 있도록 돕습니다.
              </p>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* 1. 데이터 기반 노출 분석 */}
              <div className="bg-gray-50 p-5 xl:p-6 rounded-[1.5rem] border border-gray-200 flex flex-col">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="text-indigo-600 shrink-0 bg-indigo-100/50 p-2 rounded-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-[15.5px] font-bold text-gray-800 tracking-tight leading-tight">
                    데이터 기반<br className="hidden lg:block xl:hidden" /> 노출 분석
                  </h3>
                </div>
                <p className="text-gray-500 text-[13.5px] leading-relaxed break-keep">
                  키워드, 블로그, 플레이스, 지식인, 쇼핑 노출 상태를 한곳에서 확인하고 마케팅 방향을 점검할 수 있습니다.
                </p>
              </div>

              {/* 2. AI 콘텐츠 작성 지원 */}
              <div className="bg-gray-50 p-5 xl:p-6 rounded-[1.5rem] border border-gray-200 flex flex-col">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="text-indigo-600 shrink-0 bg-indigo-100/50 p-2 rounded-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-[15.5px] font-bold text-gray-800 tracking-tight leading-tight">
                    AI 콘텐츠<br className="hidden lg:block xl:hidden" /> 작성 지원
                  </h3>
                </div>
                <p className="text-gray-500 text-[13.5px] leading-relaxed break-keep">
                  블로그 글, 보도자료, 리뷰 답변 등 반복적인 콘텐츠 작성 업무를 AI로 빠르게 준비할 수 있습니다.
                </p>
              </div>

              {/* 3. 셀러·상품 최적화 */}
              <div className="bg-gray-50 p-5 xl:p-6 rounded-[1.5rem] border border-gray-200 flex flex-col">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="text-indigo-600 shrink-0 bg-indigo-100/50 p-2 rounded-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <h3 className="text-[15.5px] font-bold text-gray-800 tracking-tight leading-tight">
                    셀러·상품<br className="hidden lg:block xl:hidden" /> 최적화
                  </h3>
                </div>
                <p className="text-gray-500 text-[13.5px] leading-relaxed break-keep">
                  상품명, 키워드, 쇼핑 노출 순위를 점검해 온라인 판매자가 상품 등록과 개선 방향을 잡을 수 있습니다.
                </p>
              </div>

              {/* 4. 트렌드와 확장 분석 */}
              <div className="bg-gray-50 p-5 xl:p-6 rounded-[1.5rem] border border-gray-200 flex flex-col">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="text-indigo-600 shrink-0 bg-indigo-100/50 p-2 rounded-xl">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                  <h3 className="text-[15.5px] font-bold text-gray-800 tracking-tight leading-tight">
                    트렌드와<br className="hidden lg:block xl:hidden" /> 확장 분석
                  </h3>
                </div>
                <p className="text-gray-500 text-[13.5px] leading-relaxed break-keep">
                  네이버뿐 아니라 구글 키워드와 유튜브 트렌드까지 함께 확인해 콘텐츠 주제와 시장 흐름을 함께 점검할 수 있습니다.
                </p>
              </div>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────
    5. 무료 사용 안내 — 비로그인 상태에서만 표시
───────────────────────────────────────────────────── */}
      {!authLoading && !user && (
        <section className="bg-indigo-50 py-16 px-6 border-b border-indigo-100">
          <div className="max-w-[700px] mx-auto text-center">
            <FadeInUp>
              <h2 className="text-xl md:text-[28px] font-black text-gray-900 mb-3 font-title">
                처음이라면 무료로 먼저 사용해 보세요.
              </h2>
              <p className="text-[15px] text-gray-500 break-keep leading-relaxed mb-6">
                비로그인은 1일 1회, 회원가입 후에는 매일 무료 검색{" "}
                <span className="text-indigo-600 font-bold">5회</span>와{" "}
                <span className="text-[#ff8533] font-bold">3,000 Point</span>를 받을 수 있습니다.
              </p>
              <Link
                href="/signup"
                className="inline-block bg-indigo-600 hover:bg-indigo-700 !text-white px-8 py-3 rounded-xl font-bold text-[15px] transition-all shadow-sm hover:shadow-md"
              >
                무료 시작
              </Link>
            </FadeInUp>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────
    6. 포인트 충전 안내
───────────────────────────────────────────────────── */}
      <section className="bg-gray-100 py-16 px-6 border-b border-gray-100">
        <div className="max-w-[720px] mx-auto text-center">
          <FadeInUp>
            <h2 className="text-xl md:text-[28px] font-black text-gray-900 mb-3 font-title">
              필요한 만큼만 충전해서 사용하세요.
            </h2>
            <p className="text-[15px] text-gray-500 break-keep leading-relaxed mb-6">
              무료 사용 후 필요한 기능만 포인트로 이용할 수 있습니다.
              <br />
              사용량에 맞춰 필요한 만큼만 충전해 계속 사용할 수 있습니다.
            </p>
            <Link
              href="/charge"
              className="inline-block bg-indigo-900 hover:bg-indigo-800 !text-white px-8 py-3 rounded-xl font-bold text-[15px] transition-all shadow-sm hover:shadow-md"
            >
              포인트 충전하기
            </Link>
          </FadeInUp>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────
    7. 공지사항 + 고객센터
───────────────────────────────────────────────────── */}
      <section className="bg-white py-16 px-6 border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto">
          <FadeInUp>
            <div className="grid lg:grid-cols-5 gap-6">

              {/* 좌측 60%: 최근 공지사항 */}
              <div className="lg:col-span-3 flex flex-col">
                <div className="flex items-center justify-between mb-3 px-2 min-h-[28px]">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                    최근 공지사항
                  </h3>
                  <Link href="/notice" className="text-[13px] font-bold text-gray-500 hover:text-indigo-600 transition-colors">
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

              {/* 우측 40%: 고객센터 */}
              <div className="lg:col-span-2 flex flex-col mt-8 lg:mt-0">
                <div className="flex items-center mb-3 px-2 min-h-[28px]">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z" />
                      <path d="M21 16v2a4 4 0 0 1-4 4h-5" />
                    </svg>
                    고객센터
                  </h3>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 flex flex-col justify-center flex-1 relative overflow-hidden">
                  <div className="relative z-10 flex flex-col gap-3">
                    <p className="text-gray-500 text-[13.5px] font-medium mb-1.5 px-1 text-left break-keep">
                      이용 중 궁금한 점이나 불편한 점이 있다면 언제든 알려주세요.
                    </p>

                    <Link href="/contact" className="group bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 transition-all duration-300 rounded-xl px-5 py-4 flex items-center justify-between border border-gray-100 hover:border-indigo-100">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-bold text-[14.5px]">자주 묻는 질문 (FAQ)</span>
                      </div>
                      <svg className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>

                    <Link href="/contact" className="group bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 transition-all duration-300 rounded-xl px-5 py-4 flex items-center justify-between border border-gray-100 hover:border-indigo-100">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                        </svg>
                        <span className="font-bold text-[14.5px]">1:1 문의하기</span>
                      </div>
                      <svg className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          </FadeInUp>
        </div>
      </section>

      <MainFooter />
    </div>
  );
}
