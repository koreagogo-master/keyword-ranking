// keyword-ranking\app\analysis\components\7_SectionOrder.tsx
'use client';

import { useEffect, useMemo, useState, useRef } from 'react';

// subName, isAd 등 상세 정보 표시를 위해 인터페이스를 확장했습니다.
interface SectionItem {
  name: string;
  count: number;
  isSide?: boolean;
  subItems?: string[];
  subName?: string; 
  isAd?: boolean;
}

export default function SectionOrder({ 
  keyword, 
  onKeywordsFound 
}: { 
  keyword: string; 
  onKeywordsFound?: (keywords: string[]) => void; 
}) {
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<{ pc: SectionItem[]; mobile: SectionItem[] } | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  
  // ✅ 중복 호출을 방지하여 네이버 차단을 피하기 위한 안전 장치입니다.
  const lastKeyword = useRef("");

  useEffect(() => {
    // 키워드가 없거나 이미 검색 결과가 있는 키워드라면 실행하지 않습니다.
    if (!keyword || keyword === lastKeyword.current) return;

    const fetchOrder = async () => {
      setLoading(true);
      setOrderData(null); 

      try {
        // 1. 먼저 PC 데이터를 요청합니다.
        const pcRes = await fetch(`/api/section-order?keyword=${encodeURIComponent(keyword)}`, { cache: 'no-store' });
        const pcData = pcRes.ok ? await pcRes.json() : { pc: [] };

        // 2. 네이버 보안을 피하기 위해 0.8초(800ms)의 대기 시간을 가집니다.
        await new Promise(resolve => setTimeout(resolve, 800));

        // 3. 그다음 모바일 데이터를 요청합니다.
        const mobileRes = await fetch(`/api/debug-mobile?keyword=${encodeURIComponent(keyword)}`, { cache: 'no-store' });
        const mobileData = mobileRes.ok ? await mobileRes.json() : { mobile: [] };

        const pcList = pcData.pc || [];
        const mobileList = mobileData.mobile || [];

        setOrderData({
          pc: pcList,
          mobile: mobileList
        });
        
        lastKeyword.current = keyword; 

        // ✅ 연관 검색어를 부모(page.tsx)에게 전달하여 상단에 띄웁니다.
        const related = mobileList.find((item: any) => item.name === '연관 검색어');
        if (related && related.subItems && onKeywordsFound) {
          onKeywordsFound(related.subItems);
        } else if (onKeywordsFound) {
          onKeywordsFound([]);
        }

      } catch (error) {
        console.error('데이터 호출 오류:', error);
        setOrderData({ pc: [], mobile: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [keyword, onKeywordsFound]);

  const pcList = useMemo(() => orderData?.pc ?? [], [orderData]);
  const mobileList = useMemo(() => orderData?.mobile ?? [], [orderData]);

  if (!keyword) return null;

  return (
    <div className="mt-0 grid grid-cols-2 gap-6 items-start">
      {/* 1. [pc 섹션] */}
      <div className="bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 h-[64px] border-b border-gray-200">
          <h2 className="text-base font-extrabold text-gray-500">[pc 섹션]</h2>
          <button
            type="button"
            onClick={() => setIsOpen(v => !v)}
            className="inline-flex items-center text-gray-500 hover:text-gray-900"
          >
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            </span>
          </button>
        </div>

        {isOpen && (
          <div className="px-6 py-4">
            {loading && <div className="mb-3 text-xs text-gray-500 animate-pulse">PC 데이터를 불러오는 중…</div>}
            {!loading && pcList.length === 0 && (
              <div className="text-sm text-gray-500 py-4 text-center">데이터가 없습니다.</div>
            )}
            <div className="divide-y divide-gray-100">
              {pcList.map((item, idx) => (
                <SectionRow key={`pc-${idx}`} item={item} idx={idx} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. [MOBILE 섹션] */}
      <div className="bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center px-6 h-[64px] border-b border-gray-200">
          <h3 className="text-base font-extrabold text-gray-500">[MOBILE 섹션]</h3>
        </div>
        
        {isOpen && (
          <div className="px-6 py-4">
            {loading && <div className="mb-3 text-xs text-gray-500 animate-pulse">모바일 데이터를 불러오는 중…</div>}
            {!loading && mobileList.length === 0 && (
              <div className="text-sm text-gray-500 py-4 text-center">데이터가 없습니다.</div>
            )}
            <div className="divide-y divide-gray-100">
              {mobileList.map((item, idx) => (
                <SectionRow key={`mobile-${idx}`} item={item} idx={idx} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 공통 행 렌더링 컴포넌트
function SectionRow({ item, idx }: { item: SectionItem; idx: number }) {
  const showCount = item.name === '파워링크' || item.name === '플레이스';
  
  return (
    <div className={`flex flex-col py-3 px-4 transition-colors hover:bg-gray-50 ${item.isSide ? 'bg-gray-50' : ''}`}>
      <div className="flex items-center">
        <div className="w-7 text-sm font-extrabold text-gray-400">{idx + 1}</div>
        <div className="flex-1">
          <div className="text-sm font-bold text-gray-900 flex items-center gap-1">
            <span>{item.name}</span>
            {item.subName && (
              <span className="font-bold">
                {item.subName}
              </span>
            )}
            {item.isSide && <span className="ml-2 text-[10px] font-normal text-gray-400 border px-1 rounded">Side</span>}
          </div>
        </div>
        {showCount && item.count > 0 && (
          <div className="text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
            {item.count}개 노출
          </div>
        )}
      </div>
      
      {/* ✅ [수정] item.name이 '연관 검색어'인 경우에는 하단에 키워드를 나열하지 않습니다. */}
      {item.subItems && item.subItems.length > 0 && item.name !== '연관 검색어' && (
        <div className="mt-2 ml-7 flex flex-wrap gap-1">
          {item.subItems.map((sub, sIdx) => (
            <span key={sIdx} className="text-[11px] px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded border border-gray-100">
              "{sub}"
            </span>
          ))}
        </div>
      )}
    </div>
  );
}