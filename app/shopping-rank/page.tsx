'use client';

// 🌟 Suspense 추가
import { useState, useEffect, useRef, Suspense } from 'react';
// 🌟 URL 파라미터를 읽기 위해 추가
import { useSearchParams } from 'next/navigation';

import Link from 'next/link';

import { useAuth } from "@/app/contexts/AuthContext";
import { createClient } from "@/app/utils/supabase/client";
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";
import SellerTabs from '@/components/SellerTabs';

// 🌟 1. 마법의 포인트 스위치 가져오기
import { usePoint } from '@/app/hooks/usePoint'; 

// 🔥 에러 원인 차단: Next.js 서버 충돌을 방지하기 위해 안전한 정규식 방식으로 변경했습니다.
const stripHtml = (html: string) => {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, '');
};

interface KeywordGroup {
  keyword: string;
  items: { rank: number; item: any | null }[];
  minPrice?: number;
  maxPrice?: number;
}

// 🌟 메인 로직을 별도의 컴포넌트로 분리 (Suspense로 감싸기 위함)
function ShoppingRankContent() {
  const { user } = useAuth();
  // 🌟 2. 스위치 장착하기
  const { deductPoints } = usePoint(); 

  // 🌟 URL 쿼리 파라미터 읽기
  const searchParams = useSearchParams();
  const urlKeyword = searchParams.get('keyword');
  
  // 🌟 중복 실행 방지를 위한 Ref
  const isSearchExecuted = useRef(false);
  
  const [storeName, setStoreName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<KeywordGroup[]>([]);
  
  const [sortConfig, setSortConfig] = useState<Record<string, 'asc' | 'desc' | null>>({});

  // 🌟 검색 핵심 로직 (자동 검색을 위해 분리)
  const performSearch = async (targetStore: string, targetKeyword: string) => {
    if (!targetStore || !targetKeyword) {
      alert("스토어명과 검색 키워드를 모두 입력해주세요.");
      return;
    }
    
    // 키워드 개수 계산을 먼저 수행합니다.
    const keywordArray = targetKeyword.split(',').map(k => k.trim()).filter(k => k.length > 0);
    // 🌟 핵심 업그레이드: 여러 개의 키워드를 쉼표로 묶어줍니다!
    const keywordString = keywordArray.join(', ');

    // 🌟 3. 스위치 켜기: 입력한 키워드 개수 × 10P 차감 및 키워드 히스토리 기록!
    const isPaySuccess = await deductPoints(user?.id, 10 * keywordArray.length, keywordArray.length, keywordString);
    if (!isPaySuccess) return; // 포인트 부족 시 여기서 멈춤

    setIsSearching(true);
    setHasSearched(false);
    setResults([]);
    setSortConfig({});

    try {
      const fetchPromises = keywordArray.map(async (kw) => {
        try {
          const response = await fetch(`/api/naver-shopping-rank?keyword=${encodeURIComponent(kw)}&storeName=${encodeURIComponent(targetStore)}`);
          const data = await response.json();
          
          if (data.success) {
            return { 
              keyword: kw, 
              items: data.items && data.items.length > 0 ? data.items : [{ rank: 0, item: null }],
              minPrice: data.minPrice,
              maxPrice: data.maxPrice
            };
          } else {
            return { keyword: kw, items: [{ rank: 0, item: null }] };
          }
        } catch (error) {
          return { keyword: kw, items: [{ rank: 0, item: null }] };
        }
      });

      const groupedResults = await Promise.all(fetchPromises);
      setResults(groupedResults);
      
    } catch (error) {
      alert("서버 통신 중 오류가 발생했습니다.");
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  const handleSearch = () => {
    performSearch(storeName, keyword);
  };

  // 🌟 자동 검색 센서 로직 시작
  useEffect(() => {
    // URL 파라미터가 존재하고, 아직 검색이 실행되지 않았을 때만 작동
    if (urlKeyword && !isSearchExecuted.current) {
      isSearchExecuted.current = true; // 중복 실행 방지 락 걸기

      // '스토어명|키워드1,키워드2' 형태로 묶여있는 데이터를 분리합니다.
      let applyStore = "";
      let applyKeyword = urlKeyword;

      if (urlKeyword.includes('|')) {
        const parts = urlKeyword.split('|');
        applyStore = parts[0];
        applyKeyword = parts[1];
      }

      setStoreName(applyStore);
      setKeyword(applyKeyword);

      // 약간의 딜레이를 주어 상태 업데이트가 화면에 반영될 시간을 확보
      setTimeout(() => {
        performSearch(applyStore, applyKeyword);
      }, 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKeyword]);

  const handleSort = (kw: string) => {
    setSortConfig(prev => {
      const currentSort = prev[kw];
      let nextSort: 'asc' | 'desc' | null = 'asc';
      if (currentSort === 'asc') nextSort = 'desc';
      else if (currentSort === 'desc') nextSort = null;
      return { ...prev, [kw]: nextSort };
    });
  };

  const handleSaveCurrentSetting = async () => {
    if (!storeName || !keyword) return alert("스토어명과 키워드를 모두 입력해주세요.");
    if (!user) return alert("로그인이 필요한 기능입니다.");

    const supabase = createClient();
    const combinedKeyword = `${storeName}|${keyword}`;

    const { error } = await supabase.from('saved_searches').insert({
      user_id: user?.id,
      page_type: 'SHOPPING_RANK',
      keyword: combinedKeyword
    });

    if (!error) alert("현재 설정이 저장되었습니다.");
    else alert("저장 중 오류가 발생했습니다.");
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false);
    let applyStore = storeName;
    let applyKeyword = item.keyword;

    if (item.keyword && item.keyword.includes('|')) {
      const parts = item.keyword.split('|');
      applyStore = parts[0];
      applyKeyword = parts[1];
    }

    setStoreName(applyStore);
    setKeyword(applyKeyword);
    
    performSearch(applyStore, applyKeyword);
  };

  return (
    <>
      <SellerTabs />

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold !text-black mb-2">상품 노출 순위 분석</h1>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">여러 개의 키워드를 쉼표(,)로 구분하여 한 번에 순위를 검색할 수 있습니다.</p>
          <p className="text-sm font-bold text-blue-600 mt-1">※ 네이버 쇼핑 카테고리(가격비교 영역) 순수 검색 결과 기준 순위입니다.</p>
        </div>
        
        <div className="flex items-center gap-2 mt-1 shrink-0">
          <button onClick={handleSaveCurrentSetting} disabled={(!storeName || !keyword) || !user} className={`px-4 py-2 text-sm font-bold text-white rounded-md shadow-sm flex items-center gap-1.5 transition-colors ${((!storeName || !keyword) || !user) ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-800'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            현재 설정 저장
          </button>
          <button onClick={() => setIsDrawerOpen(true)} className="px-4 py-2 text-sm font-bold text-white bg-slate-700 rounded-md hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
            저장된 목록 보기
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
        <div className="flex gap-4 items-end">
          <div className="flex-1 max-w-xs">
            <label className="block text-[13px] font-bold text-gray-700 mb-2">스토어명 (예: 코만도몰)</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="코만도몰"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#5244e8] focus:bg-white transition-colors text-sm font-medium"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[13px] font-bold text-gray-700 mb-2">검색 키워드 (쉼표로 여러 개 입력)</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="예: LED손전등, 캠핑랜턴, 작업등"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#5244e8] focus:bg-white transition-colors text-sm font-medium"
            />
          </div>
          
          {/* 🌟 버튼 구조 변경: flex 아이템으로 유지하면서 상태에 따라 내용만 바꿈 */}
          <div className="w-32 shrink-0 h-[46px] flex items-center justify-center">
            {isSearching ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-[#5244e8] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-bold text-[#5244e8]">분석 중</span>
              </div>
            ) : (
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="w-full h-full px-8 bg-[#5244e8] hover:bg-blue-700 text-white font-bold rounded-md transition-colors shadow-sm disabled:bg-gray-400"
              >
                순위 분석
              </button>
            )}
          </div>

        </div>
      </div>

      {!hasSearched && !isSearching && (
        <div className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 text-center flex flex-col items-center justify-center min-h-[300px]">
           <h3 className="text-lg font-bold text-gray-700 mb-2">스토어명과 키워드를 입력하고 노출 순위를 분석해보세요!</h3>
           <p className="text-sm text-gray-500">200위까지 탐색하여 특정 스토어의 상품 노출 순위와 시장가를 분석해 드립니다.</p>
        </div>
      )}

      {hasSearched && (
        <div className="space-y-10 animate-in fade-in duration-500">
          {results.map((group, groupIdx) => {
            
            const sortDirection = sortConfig[group.keyword];
            const sortedItems = [...group.items].sort((a, b) => {
              if (!sortDirection) return 0;
              if (!a.item && !b.item) return 0;
              if (!a.item) return 1;
              if (!b.item) return -1;
              const priceA = Number(a.item.lprice);
              const priceB = Number(b.item.lprice);
              return sortDirection === 'asc' ? priceA - priceB : priceB - priceA;
            });

            return (
              <div key={groupIdx}>
                
                <div className="mb-2 pl-1 flex items-baseline gap-3">
                  <span className="text-lg font-extrabold text-gray-800 tracking-tight">
                    {groupIdx + 1}. [키워드 : <span className="text-[#5244e8]">{group.keyword}</span>]
                  </span>
                  {group.minPrice !== undefined && group.maxPrice !== undefined && group.minPrice > 0 && (
                    <div className="text-[15px] font-bold text-gray-600 tracking-tight">
                      (상위 200위 시장가) 최저 <span className="text-blue-600">{group.minPrice.toLocaleString()}원</span> ~ 최고 <span className="text-red-500">{group.maxPrice.toLocaleString()}원</span>
                    </div>
                  )}
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm text-left table-fixed">
                    <thead className="bg-[#f8f9fa] border-b border-gray-200 text-gray-700 font-bold">
                      <tr>
                        <th className="px-4 py-2.5 text-center w-[5%]">순번</th>
                        <th className="px-6 py-2.5 text-center w-[11%]">쇼핑몰명</th>
                        <th className="px-6 py-2.5 text-center w-[8%]">썸네일</th>
                        <th className="px-6 py-2.5 w-[53%]">상품명</th>
                        
                        <th className="px-6 py-2.5 text-center w-[11%]">
                          <button 
                            onClick={() => handleSort(group.keyword)}
                            className="inline-flex items-center justify-center gap-1.5 focus:outline-none w-full"
                            title="클릭하여 가격순으로 정렬"
                          >
                            <span className="font-bold text-gray-700 hover:text-gray-900 transition-colors">판매 금액</span>
                            
                            {sortDirection === 'asc' ? (
                              <span className="text-[#5244e8] text-[10px] mt-0.5">▲</span>
                            ) : sortDirection === 'desc' ? (
                              <span className="text-[#5244e8] text-[10px] mb-0.5">▼</span>
                            ) : (
                              <div className="flex flex-col text-[8px] leading-[8px] text-[#5244e8] opacity-80 gap-[1px]">
                                <span>▲</span>
                                <span>▼</span>
                              </div>
                            )}
                          </button>
                        </th>
                        
                        <th className="px-6 py-2.5 text-center w-[12%]">노출 순위(페이지)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedItems.map((res, idx) => (
                        <tr key={idx} className="border-b border-gray-200 last:border-0 hover:bg-[#5244e8]/5 transition-colors">
                          
                          <td className="px-4 py-2 text-center text-gray-500 font-medium text-[13px]">
                            {idx + 1}
                          </td>

                          <td className="px-6 py-2 text-center font-bold">
                            {res.item ? (
                              res.item.mallName === '네이버' ? (
                                <span className="text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md text-[13px] border border-blue-200 inline-block">
                                  가격비교
                                </span>
                              ) : (
                                <span className="text-gray-600 truncate block w-full" title={res.item.mallName}>{res.item.mallName}</span>
                              )
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>

                          <td className="px-6 py-2 text-center">
                            {res.item ? (
                              <img src={res.item.image} alt="썸네일" className="w-11 h-11 object-cover rounded-md mx-auto border border-gray-200" />
                            ) : (
                              <div className="w-11 h-11 bg-gray-100 rounded-md mx-auto flex items-center justify-center text-gray-300 text-[10px]">-</div>
                            )}
                          </td>
                          
                          <td className="px-6 py-2 text-gray-700 font-medium leading-relaxed pr-8">
                            {res.item ? (
                              <a href={res.item.link} target="_blank" rel="noreferrer" className="hover:text-[#5244e8] hover:underline line-clamp-2">
                                {stripHtml(res.item.title)}
                              </a>
                            ) : (
                              <span className="text-gray-400">200위 내에 상품을 찾을 수 없습니다.</span>
                            )}
                          </td>
                          
                          <td className="px-6 py-2 text-center font-bold text-gray-900">
                            {res.item ? `${Number(res.item.lprice).toLocaleString()}원` : <span className="text-gray-300">-</span>}
                          </td>
                          
                          <td className="px-6 py-2 text-center">
                            {res.rank > 0 ? (
                              <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                <span className="text-lg font-extrabold text-[#5244e8]">{res.rank}위</span>
                                <span className="text-[13px] text-gray-500 font-medium mt-0.5">({Math.ceil(res.rank / 40)}페이지)</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2.5 py-1 rounded-full inline-block">순위 밖</span>
                            )}
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <SavedSearchesDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        pageType="SHOPPING_RANK" 
        onSelect={handleApplySavedSetting} 
      />
    </>
  );
}

// 🌟 메인 페이지 컴포넌트: Suspense로 감싸서 배포 에러 방지
export default function ShoppingRankPage() {
  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <div className="flex min-h-screen bg-[#f8f9fa] !text-black antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        

        <main className="flex-1 ml-64 p-10 relative">
          <div className="max-w-7xl mx-auto">
            {/* 🌟 URL 파라미터를 읽는 컴포넌트를 Suspense로 감싸기 */}
            <Suspense fallback={<div className="p-10 text-center text-gray-500 font-bold">로딩 중...</div>}>
              <ShoppingRankContent />
            </Suspense>
          </div>
        </main>
      </div>
    </>
  );
}