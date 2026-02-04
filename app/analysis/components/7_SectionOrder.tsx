// keyword-ranking\app\analysis\components\7_SectionOrder.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

interface SectionItem {
  name: string;
  count: number;
  isSide?: boolean;
  subItems?: string[]; // subItems 타입 추가
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

  const pcList = useMemo(() => orderData?.pc ?? [], [orderData]);

  if (!keyword) return null;

  return (
    <div className="mt-12">
      <div className="bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-extrabold text-gray-900">PC 섹션 배치 순서</h2>

          <button
            type="button"
            onClick={() => setIsOpen(v => !v)}
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900"
            aria-label="섹션 순서 영역 열기/닫기"
          >
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100">
              {/* eye icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>

        {isOpen && (
          <div className="px-6 py-4">
            {loading && <div className="mb-3 text-xs text-gray-500">불러오는 중…</div>}

            {!loading && pcList.length === 0 && (
              <div className="text-sm text-gray-500">섹션 데이터를 불러오지 못했습니다.</div>
            )}

            <div className="divide-y divide-gray-100">
              {pcList.map((item, idx) => {
                const showCount = item.name === '파워링크' || item.name === '플레이스';

                return (
                  // 하위 아이템 노출을 위해 flex-col로 변경하고 기존 items-center는 내부 div로 이동
                  <div 
                    key={`${item.name}-${idx}`} 
                    className={`flex flex-col py-3 px-4 ${item.isSide ? 'bg-gray-50' : ''}`}
                  >
                    <div className="flex items-center">
                      <div className="w-7 text-sm font-extrabold text-gray-700">{idx + 1}</div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-900">
                          {item.name}
                          {item.isSide && <span className="ml-2 text-[10px] font-normal text-gray-400 border px-1 rounded">Side</span>}
                        </div>
                      </div>

                      {showCount && item.count > 0 && (
                        <div className="text-xs text-gray-400">{item.count}개의 콘텐츠 노출 중</div>
                      )}
                    </div>

                    {/* [추가] 연관 검색어 등의 하위 단축 텍스트 나열 */}
                    {item.subItems && item.subItems.length > 0 && (
                      <div className="mt-1 ml-7 flex flex-wrap gap-1">
                        {item.subItems.map((sub, sIdx) => (
                          <span key={sIdx} className="text-[11px] text-gray-400">
                            "{sub}"
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 모바일은 PC 정확도 완료 후 진행 */}
      <div className="mt-6 opacity-40">
        <div className="bg-white border border-dashed border-gray-200 p-6 text-center text-gray-400">
          MOBILE (PC 완료 후 진행)
        </div>
      </div>
    </div>
  );
}