// keyword-ranking\app\analysis\components\7_SectionOrder.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

interface SectionItem {
  name: string;
  count: number;
  isSide?: boolean;
  subItems?: string[];
}

export default function SectionOrder({ keyword }: { keyword: string }) {
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<{ pc: SectionItem[]; mobile: SectionItem[] } | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (!keyword) return;

    const fetchOrder = async () => {
      setLoading(true);
      try {
        // API에서 PC와 Mobile 데이터를 모두 가져옵니다.
        const res = await fetch(`/api/section-order?keyword=${encodeURIComponent(keyword)}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        setOrderData(data);
      } catch (error) {
        console.error(error);
        setOrderData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [keyword]);

  // 로직 분리: PC와 Mobile 리스트를 각각 별도로 관리합니다.
  const pcList = useMemo(() => orderData?.pc ?? [], [orderData]);
  const mobileList = useMemo(() => orderData?.mobile ?? [], [orderData]);

  if (!keyword) return null;

  return (
    <div className="mt-12 grid grid-cols-2 gap-6 items-start">
      {/* 1. [pc 섹션] 분석 박스 */}
      <div className="bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 h-[64px] border-b border-gray-200">
          <h2 className="text-base font-extrabold text-gray-900">[pc 섹션]</h2>
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
            {loading && <div className="mb-3 text-xs text-gray-500">불러오는 중…</div>}
            {!loading && pcList.length === 0 && (
              <div className="text-sm text-gray-500">데이터가 없습니다.</div>
            )}
            <div className="divide-y divide-gray-100">
              {pcList.map((item, idx) => (
                <SectionRow key={`pc-${idx}`} item={item} idx={idx} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. [MOBILE 섹션] 분석 박스 (PC와 동일한 로직 적용) */}
      <div className="bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center px-6 h-[64px] border-b border-gray-200">
          <h3 className="text-base font-extrabold text-gray-900">[MOBILE 섹션]</h3>
        </div>
        
        {isOpen && (
          <div className="px-6 py-4">
            {loading && <div className="mb-3 text-xs text-gray-500">불러오는 중…</div>}
            {!loading && mobileList.length === 0 && (
              <div className="text-sm text-gray-500">데이터가 없습니다.</div>
            )}
            <div className="divide-y divide-gray-100">
              {/* 모바일 리스트 렌더링 (수정 예정인 로직이 들어갈 곳) */}
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

// 공통 행 렌더링 컴포넌트 (로직 동일성 유지)
function SectionRow({ item, idx }: { item: SectionItem; idx: number }) {
  const showCount = item.name === '파워링크' || item.name === '플레이스';
  
  return (
    <div className={`flex flex-col py-3 px-4 ${item.isSide ? 'bg-gray-50' : ''}`}>
      <div className="flex items-center">
        <div className="w-7 text-sm font-extrabold text-gray-700">{idx + 1}</div>
        <div className="flex-1">
          <div className="text-sm font-bold text-gray-900">
            {item.name}
            {item.isSide && <span className="ml-2 text-[10px] font-normal text-gray-400 border px-1 rounded">Side</span>}
          </div>
        </div>
        {showCount && item.count > 0 && (
          <div className="text-xs text-gray-400">{item.count}개 노출</div>
        )}
      </div>
      {item.subItems && item.subItems.length > 0 && (
        <div className="mt-1 ml-7 flex flex-wrap gap-1">
          {item.subItems.map((sub, sIdx) => (
            <span key={sIdx} className="text-[11px] text-gray-400">"{sub}"</span>
          ))}
        </div>
      )}
    </div>
  );
}