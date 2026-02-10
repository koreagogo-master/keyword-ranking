// keyword-ranking\app\analysis\components\7_SectionOrder.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

// subName, isAd 등 상세 정보 표시를 위해 인터페이스를 확장했습니다.
interface SectionItem {
  name: string;
  count: number;
  isSide?: boolean;
  subItems?: string[];
  subName?: string; 
  isAd?: boolean;
}

export default function SectionOrder({ keyword }: { keyword: string }) {
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<{ pc: SectionItem[]; mobile: SectionItem[] } | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (!keyword) return;

    // ✅ 새로운 검색 시작 시 이전 데이터와 에러 상태를 깨끗이 초기화합니다.
    setOrderData(null);

    const fetchOrder = async () => {
      setLoading(true);
      try {
        // [수정] 두 개의 API를 병렬로 호출하여 각각의 데이터를 가져옵니다.
        const [pcRes, mobileRes] = await Promise.all([
          fetch(`/api/section-order?keyword=${encodeURIComponent(keyword)}`, { cache: 'no-store' }),
          fetch(`/api/debug-mobile?keyword=${encodeURIComponent(keyword)}`, { cache: 'no-store' })
        ]);

        // 응답이 성공적인지 확인합니다.
        if (!pcRes.ok || !mobileRes.ok) {
           throw new Error('API 응답 오류');
        }

        const pcData = await pcRes.json();
        const mobileData = await mobileRes.json();

        // PC는 기존 API의 pc 필드, 모바일은 새 API의 mobile 필드를 사용합니다.
        setOrderData({
          pc: pcData.pc || [],
          mobile: mobileData.mobile || []
        });
      } catch (error) {
        console.error('데이터 호출 오류:', error);
        // 에러 발생 시 빈 값을 넣어 "데이터가 없습니다" 메시지가 나오도록 합니다.
        setOrderData({ pc: [], mobile: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [keyword]);

  const pcList = useMemo(() => orderData?.pc ?? [], [orderData]);
  const mobileList = useMemo(() => orderData?.mobile ?? [], [orderData]);

  if (!keyword) return null;

  return (
    /* ✅ mt-12를 mt-0으로 수정하여 상단 여백을 맞췄습니다. */
    <div className="mt-0 grid grid-cols-2 gap-6 items-start">
      {/* 1. [pc 섹션] - 원본 로직 유지 */}
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

      {/* 2. [MOBILE 섹션] - 95% 완성된 정밀 로직 적용 */}
      <div className="bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center px-6 h-[64px] border-b border-gray-200">
          <h3 className="text-base font-extrabold text-gray-900">[MOBILE 섹션]</h3>
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
            {/* [추가] 모바일 관련 광고 등의 상세 정보를 이름 옆에 표시합니다. */}
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
      {item.subItems && item.subItems.length > 0 && (
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