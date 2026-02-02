'use client';

interface RelatedVisualProps {
  data: any;
  onKeywordClick?: (keyword: string) => void;
}

export default function RelatedVisual({ data, onKeywordClick }: RelatedVisualProps) {
  // page.tsx에서 병합한 구조에 따라 데이터를 가져옵니다.
  const visualData = data?.sectionOrder?.relatedKeywords || [];
  const detectedInfo = data?.sectionOrder?.detectedInfo;

  // 데이터가 없을 경우 컴포넌트를 렌더링하지 않습니다.
  if (!visualData || visualData.length === 0) return null;

  return (
    <div className="bg-white border border-gray-300 p-8 shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-amber-500"></span>
            <h3 className="text-lg font-bold text-gray-900">모바일 실시간 연관검색어</h3>
          </div>
          <p className="text-sm text-gray-500">
            네이버 모바일 결과 상단에서 <strong>시각적으로 강조된(Bold)</strong> 데이터를 추출했습니다.
          </p>
        </div>
        {detectedInfo && (
          <div className="text-[11px] text-amber-600 bg-amber-50 px-2 py-1 border border-amber-100">
            두께: {detectedInfo.fontWeight} | 위치: {Math.round(detectedInfo.y)}px
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {visualData.map((word: string, idx: number) => (
          <button
            key={idx}
            onClick={() => onKeywordClick?.(word)}
            className="group flex items-center bg-gray-50 hover:bg-amber-50 border border-gray-200 hover:border-amber-200 px-4 py-2 transition-all"
          >
            <span className="text-amber-500 font-bold mr-2 group-hover:scale-110 transition-transform">#</span>
            <span className="text-gray-700 font-medium group-hover:text-amber-700">{word}</span>
          </button>
        ))}
      </div>
    </div>
  );
}