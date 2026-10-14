"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FadeInUp from "@/components/FadeInUp";
import MainFooter from "@/components/MainFooter";
import { useAuth } from "@/app/contexts/AuthContext";
import { createClient } from "@/app/utils/supabase/client";

interface Notice {
  id: string;
  title: string;
  is_pinned: boolean;
  created_at: string;
}

const categoryFilters = [
  {
    key: "ALL",
    label: "All",
    category: null,
    description: "전체 도구를 한눈에 확인하고, 분야별 탭으로 필요한 도구를 빠르게 찾아보세요.",
    inactiveClass: "bg-[#F1F5F9] border-[#CBD5E1] !text-gray-700 hover:bg-slate-200",
    activeClass: "bg-gray-800 border-gray-800 !text-white shadow-sm",
    categoryTextClass: "",
  },
  {
    key: "AI TOOLS",
    label: "AI 콘텐츠 도구",
    category: "AI TOOLS",
    description: "포스팅·보도자료·리뷰 답변을 작성하고, 기존 콘텐츠를 분석해 기획과 리뉴얼 방향을 잡습니다.",
    inactiveClass: "bg-purple-50 border-purple-200 !text-purple-700 hover:bg-purple-100",
    activeClass: "bg-purple-100 border-purple-400 !text-purple-700 shadow-sm",
    categoryTextClass: "text-purple-500",
  },
  {
    key: "NAVER TOOLS",
    label: "네이버 노출 분석",
    category: "NAVER TOOLS",
    description: "키워드·검색결과 구성·노출 순위를 분석해 내 콘텐츠와 업체의 검색 노출 상태를 점검합니다.",
    inactiveClass: "bg-emerald-50 border-emerald-200 !text-emerald-700 hover:bg-emerald-100",
    activeClass: "bg-emerald-100 border-emerald-400 !text-emerald-700 shadow-sm",
    categoryTextClass: "text-[#03c75a]",
  },
  {
    key: "SELLER TOOLS",
    label: "셀러 최적화",
    category: "SELLER TOOLS",
    description: "상품명·키워드·쇼핑 노출 순위를 점검해 상품 등록과 노출 개선에 활용합니다.",
    inactiveClass: "bg-orange-50 border-orange-200 !text-orange-700 hover:bg-orange-100",
    activeClass: "bg-orange-100 border-orange-400 !text-orange-700 shadow-sm",
    categoryTextClass: "text-orange-500",
  },
  {
    key: "GOOGLE & YOUTUBE",
    label: "구글·유튜브 트렌드",
    category: "GOOGLE & YOUTUBE",
    description: "구글 키워드와 유튜브 트렌드를 확인해 콘텐츠 주제를 선정하고 시장 흐름을 파악합니다.",
    inactiveClass: "bg-red-50 border-red-200 !text-red-700 hover:bg-red-100",
    activeClass: "bg-red-100 border-red-400 !text-red-700 shadow-sm",
    categoryTextClass: "text-red-500",
  },
] as const;

type CategoryFilterKey = (typeof categoryFilters)[number]["key"];

const toolkits = [
  {
    category: "AI TOOLS",
    label: "AI 포스팅 생성/리뉴얼",
    href: "/ai-blog",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-500",
    hoverBorder: "hover:border-purple-400",
    textHover: "group-hover:text-purple-600",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  },
  {
    category: "AI TOOLS",
    label: "AI 보도자료 작성/리뉴얼",
    href: "/ai-press",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-500",
    hoverBorder: "hover:border-purple-400",
    textHover: "group-hover:text-purple-600",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15" />,
  },
  {
    category: "AI TOOLS",
    label: "리뷰 답변 AI 자동 생성기",
    href: "/review-ai",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-500",
    hoverBorder: "hover:border-purple-400",
    textHover: "group-hover:text-purple-600",
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.8 7.5a1.84 1.84 0 0 0-2.6 0l-.2.3-.3-.3a1.84 1.84 0 1 0-2.4 2.8L12 13l2.7-2.7c.9-.9.8-2.1.1-2.8z" />
      </>
    ),
  },
  {
    category: "AI TOOLS",
    label: "네이버 포스팅 X-Ray",
    href: "/post-xray",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-500",
    hoverBorder: "hover:border-purple-400",
    textHover: "group-hover:text-purple-600",
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </>
    ),
  },
  {
    category: "AI TOOLS",
    label: "AI 포스팅 인사이트",
    href: "/ai-insight",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-500",
    hoverBorder: "hover:border-purple-400",
    textHover: "group-hover:text-purple-600",
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </>
    ),
  },
  {
    category: "NAVER TOOLS",
    label: "키워드 정밀 분석",
    href: "/analysis",
    iconBg: "bg-[#03c75a]/10",
    iconColor: "text-[#03c75a]",
    hoverBorder: "hover:border-[#03c75a]/50",
    textHover: "group-hover:text-[#03c75a]",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
  },
  {
    category: "NAVER TOOLS",
    label: "검색결과 구성 분석",
    href: "/search-structure",
    iconBg: "bg-[#03c75a]/10",
    iconColor: "text-[#03c75a]",
    hoverBorder: "hover:border-[#03c75a]/50",
    textHover: "group-hover:text-[#03c75a]",
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h10M4 18h7" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 14l3 3m0 0l-3 3m3-3h-7" />
      </>
    ),
  },
  {
    category: "NAVER TOOLS",
    label: "연관 키워드 조회",
    href: "/related-fast",
    iconBg: "bg-[#03c75a]/10",
    iconColor: "text-[#03c75a]",
    hoverBorder: "hover:border-[#03c75a]/50",
    textHover: "group-hover:text-[#03c75a]",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,
  },
  {
    category: "NAVER TOOLS",
    label: "블로그 순위 확인",
    href: "/blog-rank-b",
    iconBg: "bg-[#03c75a]/10",
    iconColor: "text-[#03c75a]",
    hoverBorder: "hover:border-[#03c75a]/50",
    textHover: "group-hover:text-[#03c75a]",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  },
  {
    category: "NAVER TOOLS",
    label: "블로그 노출 진단",
    href: "/index-check",
    iconBg: "bg-[#03c75a]/10",
    iconColor: "text-[#03c75a]",
    hoverBorder: "hover:border-[#03c75a]/50",
    textHover: "group-hover:text-[#03c75a]",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
  {
    category: "NAVER TOOLS",
    label: "지식인 순위 확인",
    href: "/kin-rank",
    iconBg: "bg-[#03c75a]/10",
    iconColor: "text-[#03c75a]",
    hoverBorder: "hover:border-[#03c75a]/50",
    textHover: "group-hover:text-[#03c75a]",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
  },
  {
    category: "NAVER TOOLS",
    label: "통합검색 노출/순위 확인",
    href: "/blog-rank",
    iconBg: "bg-[#03c75a]/10",
    iconColor: "text-[#03c75a]",
    hoverBorder: "hover:border-[#03c75a]/50",
    textHover: "group-hover:text-[#03c75a]",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />,
  },
  {
    category: "NAVER TOOLS",
    label: "키워드 조회수 확인",
    href: "/keyword-volume",
    iconBg: "bg-[#03c75a]/10",
    iconColor: "text-[#03c75a]",
    hoverBorder: "hover:border-[#03c75a]/50",
    textHover: "group-hover:text-[#03c75a]",
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M10 3v18M14 3v18" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
      </>
    ),
  },
  {
    category: "NAVER TOOLS",
    label: "키워드 생성기",
    href: "/keyword-generator",
    iconBg: "bg-[#03c75a]/10",
    iconColor: "text-[#03c75a]",
    hoverBorder: "hover:border-[#03c75a]/50",
    textHover: "group-hover:text-[#03c75a]",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />,
  },
  {
    category: "NAVER TOOLS",
    label: "플레이스 순위 조회",
    href: "/place-rank",
    iconBg: "bg-[#03c75a]/10",
    iconColor: "text-[#03c75a]",
    hoverBorder: "hover:border-[#03c75a]/50",
    textHover: "group-hover:text-[#03c75a]",
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </>
    ),
  },
  {
    category: "SELLER TOOLS",
    label: "키워드 인사이트",
    href: "/shopping-insight",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    hoverBorder: "hover:border-orange-400",
    textHover: "group-hover:text-orange-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />,
  },
  {
    category: "SELLER TOOLS",
    label: "상품명 최적화",
    href: "/seo-title",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    hoverBorder: "hover:border-orange-400",
    textHover: "group-hover:text-orange-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
  },
  {
    category: "SELLER TOOLS",
    label: "내 상품명 진단",
    href: "/seo-check",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    hoverBorder: "hover:border-orange-400",
    textHover: "group-hover:text-orange-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  },
  {
    category: "SELLER TOOLS",
    label: "쇼핑 노출 순위 분석",
    href: "/shopping-rank",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    hoverBorder: "hover:border-orange-400",
    textHover: "group-hover:text-orange-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />,
  },
  {
    category: "SELLER TOOLS",
    label: "우편번호 대량 변환기",
    href: "/postcode-bulk",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    hoverBorder: "hover:border-orange-400",
    textHover: "group-hover:text-orange-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  },
  {
    category: "GOOGLE & YOUTUBE",
    label: "구글 키워드 분석",
    href: "/google-analysis",
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    hoverBorder: "hover:border-red-400",
    textHover: "group-hover:text-red-500",
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />,
  },
  {
    category: "GOOGLE & YOUTUBE",
    label: "유튜브 트렌드",
    href: "/youtube-trend",
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    hoverBorder: "hover:border-red-400",
    textHover: "group-hover:text-red-500",
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </>
    ),
  },
];

export default function Index01Page() {
  const [keyword, setKeyword] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [activeFilter, setActiveFilter] = useState<CategoryFilterKey>("ALL");
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    const fetchLatestNotices = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("notices")
        .select("id, title, is_pinned, created_at")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(4);

      if (data) setNotices(data);
    };

    fetchLatestNotices();
  }, []);

  const handleSearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!keyword.trim()) {
      alert("키워드를 입력해주세요.");
      return;
    }

    router.push(`/analysis?keyword=${encodeURIComponent(keyword)}`);
  };

  const selectedFilter =
    categoryFilters.find((filter) => filter.key === activeFilter) ?? categoryFilters[0];
  const filteredToolkits =
    selectedFilter.category === null
      ? toolkits
      : toolkits.filter((item) => item.category === selectedFilter.category);

  return (
    <div className="min-h-screen bg-white font-body flex flex-col">
      <main className="bg-[#F5F3FF] border-b border-gray-100 px-6 pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto">
          <FadeInUp>
            <div className="text-center">
              <h1 className="text-[44px] font-black text-gray-900 mb-3 leading-tight tracking-tight">
                <span className="whitespace-nowrap">콘텐츠 제작부터 노출 분석까지,</span>
                <br />
                <span className="text-[#4F46E5]">한곳에서 빠르게</span>
              </h1>
              <p className="text-gray-500 text-[18px] font-medium leading-relaxed break-keep max-w-[760px] mx-auto">
                AI 콘텐츠 작성, 키워드 분석, 순위 확인, 상품 최적화, 트렌드 점검까지
                마케팅과 콘텐츠 기획에 필요한 도구를 한곳에 모았습니다.
              </p>
            </div>
          </FadeInUp>
        </div>
      </main>

      <section id="toolkit" className="bg-gray-100 pt-20 pb-14 px-6 border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto">
          <FadeInUp delay={0.05}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-8">
              {categoryFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  aria-pressed={activeFilter === filter.key}
                  className={`h-16 border rounded-xl px-3 text-[13.5px] font-extrabold text-center leading-snug transition-colors flex flex-col items-center justify-center ${
                    activeFilter === filter.key
                      ? filter.activeClass
                      : filter.inactiveClass
                  }`}
                >
                  <span className="text-[16px] font-medium">
                    {filter.key === "ALL" ? "전체 도구" : filter.label}
                  </span>
                  {filter.key === "ALL" ? (
                    <span className="mt-0.5 text-[12px] font-normal">All</span>
                  ) : filter.category ? (
                    <span className="mt-0.5 text-[12px] font-normal !text-[#64748B]">
                      {filter.category}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </FadeInUp>

          {selectedFilter.description && (
            <p className="mb-6 text-center whitespace-nowrap text-[16px] font-normal leading-6 text-gray-500">
              {selectedFilter.description}
            </p>
          )}

          <FadeInUp delay={0.2}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filteredToolkits.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group h-[72px] bg-white rounded-2xl border border-gray-200 px-5 py-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${item.hoverBorder} flex flex-col justify-center`}
                >
                  <div className="flex items-center">
                    <div className={`w-10 h-10 mr-3 rounded-full ${item.iconBg} flex items-center justify-center ${item.iconColor} shrink-0 transition-transform duration-300 group-hover:scale-110`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {item.icon}
                      </svg>
                    </div>
                    <h3 className={`text-[16px] !font-medium !text-[#475569] ${item.textHover} transition-colors leading-snug break-keep`}>
                      {item.label}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
            <p className="mt-12 text-center text-[14px] font-normal text-[#64748B]">
              랭킹프로의 도구와 기능은 지속적으로 업데이트됩니다.
            </p>
          </FadeInUp>
        </div>
      </section>

      <section className="bg-indigo-50/60 py-12 px-6 border-b border-indigo-100">
        <div className="max-w-[720px] mx-auto text-center">
          <FadeInUp>
            <h2 className="text-2xl font-black text-gray-900 mb-5 font-title">
              궁금한 키워드, 바로 분석해 보세요.
            </h2>

            <form
              onSubmit={handleSearch}
              className="w-full max-w-[400px] focus-within:max-w-[560px] mx-auto transition-[max-width] duration-200 ease-out"
            >
              <div
                className="w-full h-14 flex items-center bg-white rounded-2xl p-1.5 transition-all duration-500 ease-out"
                style={{
                  border: isFocused ? "1px solid #818cf8" : "1px solid #c7d2fe",
                  boxShadow: isFocused
                    ? "0 10px 24px -4px rgba(79,70,229,0.14)"
                    : "0 1px 3px 0 rgba(79,70,229,0.06)",
                }}
              >
                <input
                  type="text"
                  placeholder="분석할 키워드를 입력하세요"
                  className="h-full flex-1 bg-transparent px-5 outline-none text-base text-gray-800 placeholder-gray-400 min-w-0 text-left"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
                <button
                  type="submit"
                  className="h-full bg-indigo-600 text-white px-8 rounded-xl font-bold text-base whitespace-nowrap hover:bg-indigo-700 transition-all"
                >
                  검색
                </button>
              </div>
            </form>

            {!authLoading && !user && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <p className="text-[14px] text-gray-500 font-medium flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 inline-block" />
                  회원가입 후 무료 이용 혜택을 받을 수 있습니다.
                </p>
                <p className="text-[14px] text-gray-500 font-medium flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 inline-block" />
                  네이버·구글 계정으로 간편하게 시작할 수 있습니다.
                </p>
              </div>
            )}
          </FadeInUp>
        </div>
      </section>

      <section className="bg-white py-12 px-6">
        <div className="max-w-[1200px] mx-auto">
          <FadeInUp>
            <div className="grid lg:grid-cols-5 gap-10 xl:gap-12 items-center">
              <div className="lg:col-span-2 text-left">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[12px] font-bold mb-4 border border-indigo-100">
                  실제 사용 흐름
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-4 font-title leading-tight break-keep whitespace-nowrap">
                  키워드 분석과 AI 포스팅 작성
                </h2>
                <p className="text-[15px] text-gray-500 break-keep leading-relaxed mb-6">
                  키워드 분석 결과를 확인하고, 상품 정보와 작성 조건을 입력해 AI로 블로그 원고를 만드는 실제 사용 과정을 살펴보세요.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 text-[14px] font-semibold text-gray-700">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    검색량·연관 키워드·검색결과 구성 확인
                  </div>
                  <div className="flex items-center gap-2.5 text-[14px] font-semibold text-gray-700">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    상품 정보와 타깃에 맞춰 작성 조건 설정
                  </div>
                  <div className="flex items-center gap-2.5 text-[14px] font-semibold text-gray-700">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    AI가 생성한 블로그 원고 확인
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3">
                <div className="rounded-xl overflow-hidden border border-gray-200 shadow-lg bg-black">
                  <div className="relative w-full pt-[56.25%]">
                    <iframe
                      src="https://player.vimeo.com/video/1193109070?background=1&autoplay=1&muted=1&loop=1&autopause=0"
                      className="absolute top-0 left-0 w-full h-full"
                      frameBorder="0"
                      allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      title="랭킹프로 사용 설명서"
                    />
                  </div>
                </div>
              </div>
            </div>
          </FadeInUp>
        </div>
      </section>

      <section className="bg-white py-20 px-6 border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto">
          <FadeInUp>
            <div className="text-center px-4 mb-12">
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 font-title">
                랭킹프로가 업무를 줄이는 방식
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto break-keep leading-relaxed">
                정보 확인, 초안 작성, 상품 점검과 주제 탐색 등 반복되는 작업을 더 간편하게
                <br />
                진행할 수 있도록 돕습니다.
              </p>
            </div>
          </FadeInUp>

          <FadeInUp delay={0.2}>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-gray-50 p-5 xl:p-6 rounded-[1.5rem] border border-gray-200 flex flex-col text-center">
                <div className="mb-3.5">
                  <h3 className="text-[16px] !font-medium !text-[#4F46E5] tracking-tight leading-tight">
                    키워드 판단
                    <br className="hidden lg:block xl:hidden" /> 기준 마련
                  </h3>
                </div>
                <p className="text-gray-500 text-[13.5px] leading-relaxed break-keep">
                  검색량·연관 키워드·검색결과 구성을 확인해 콘텐츠에 활용할 키워드를 고르는 데 참고합니다.
                </p>
              </div>

              <div className="bg-gray-50 p-5 xl:p-6 rounded-[1.5rem] border border-gray-200 flex flex-col text-center">
                <div className="mb-3.5">
                  <h3 className="text-[16px] !font-medium !text-[#4F46E5] tracking-tight leading-tight">
                    AI 초안으로
                    <br className="hidden lg:block xl:hidden" /> 작성 시작
                  </h3>
                </div>
                <p className="text-gray-500 text-[13.5px] leading-relaxed break-keep">
                블로그 글·보도자료·리뷰 답변의 AI 초안으로 작성 부담을 덜 수 있습니다.
                </p>
              </div>

              <div className="bg-gray-50 p-5 xl:p-6 rounded-[1.5rem] border border-gray-200 flex flex-col text-center">
                <div className="mb-3.5">
                  <h3 className="text-[16px] !font-medium !text-[#4F46E5] tracking-tight leading-tight">
                    상품 개선점
                    <br className="hidden lg:block xl:hidden" /> 확인
                  </h3>
                </div>
                <p className="text-gray-500 text-[13.5px] leading-relaxed break-keep">
                  상품명·키워드·쇼핑 노출 순위를 점검해 상품 등록과 개선 과정에서 확인할 부분을 찾습니다.
                </p>
              </div>

              <div className="bg-gray-50 p-5 xl:p-6 rounded-[1.5rem] border border-gray-200 flex flex-col text-center">
                <div className="mb-3.5">
                  <h3 className="text-[16px] !font-medium !text-[#4F46E5] tracking-tight leading-tight">
                    콘텐츠 주제
                    <br className="hidden lg:block xl:hidden" /> 탐색 지원
                  </h3>
                </div>
                <p className="text-gray-500 text-[13.5px] leading-relaxed break-keep">
                  구글 키워드와 유튜브 트렌드를 참고해 콘텐츠 주제와 기획 방향을 정하는 데 활용합니다.
                </p>
              </div>
            </div>
          </FadeInUp>
        </div>
      </section>

      {!authLoading && !user && (
        <section className="bg-indigo-50 py-16 px-6 border-b border-indigo-100">
          <div className="max-w-[700px] mx-auto text-center">
            <FadeInUp>
              <h2 className="text-xl md:text-[28px] font-black text-gray-900 mb-3 font-title">
                회원가입하고 무료 혜택으로 시작하세요.
              </h2>
              <p className="text-[15px] text-gray-500 break-keep leading-relaxed mb-6">
                가입 시 <span className="text-[#ff8533] font-bold">3,000포인트</span>를 받고, 무료 검색은 매일{" "}
                <span className="text-indigo-600 font-bold">5회</span> 이용할 수 있습니다.
                <br />
                가입 없이도 하루 1회 검색할 수 있습니다.
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

      <section className="bg-gray-100 py-16 px-6 border-b border-gray-100">
        <div className="max-w-[720px] mx-auto text-center">
          <FadeInUp>
            <h2 className="text-xl md:text-[28px] font-black text-gray-900 mb-3 font-title">
              필요한 만큼만 충전해서 사용하세요.
            </h2>
            <p className="text-[15px] text-gray-500 break-keep leading-relaxed mb-6">
              도구별 이용 포인트를 확인하고, 필요한 유료 도구를 선택해 사용하세요.
              <br />
              포인트가 부족하면 충전 후 계속 이용할 수 있습니다.
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

      <section className="bg-white py-16 px-6 border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto">
          <FadeInUp>
            <div className="grid lg:grid-cols-5 gap-6 items-stretch">
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
                      {notices.map((notice) => (
                        <li key={notice.id} className="group transition-colors hover:bg-slate-50">
                          <Link href={`/notice?id=${notice.id}`} className="flex items-center justify-between px-6 py-4">
                            <div className="flex items-center gap-3 overflow-hidden">
                              {notice.is_pinned ? (
                                <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100">
                                  중요
                                </span>
                              ) : (
                                <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-black bg-gray-100 text-gray-500">
                                  공지
                                </span>
                              )}
                              <span className={`text-[14.5px] font-medium truncate transition-colors group-hover:text-indigo-600 ${notice.is_pinned ? "text-gray-900 font-bold" : "text-gray-700"}`}>
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
                      궁금한 점은 자주 묻는 질문에서 확인하고,
                      <br />
                      도움이 필요하면 1:1 문의로 남겨주세요.
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
