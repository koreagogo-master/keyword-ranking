// keyword-ranking\app\analysis\components\7_SectionTest.tsx

'use client';

export default function SectionTest({ data }: { data: any }) {
  // ✅ page.tsx의 구조(sectionOrder 하위)를 정확히 참조합니다.
  if (!data || !data.sectionOrder) return null;

  const pcOrder = data.sectionOrder.pc || [];
  const mobileOrder = data.sectionOrder.mobile || [];
  
  // ✅ page.tsx가 /api/keyword에서 가져온 연관 키워드 데이터를 활용합니다.
  const relatedKeywords = data.relatedKeywords || [];
  
  const hasRelatedMobile = mobileOrder.includes('[연관검색어]');

  const SectionList = ({ title, list, color }: { title: string, list: string[], color: string }) => (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-6">
        <span className={`text-sm font-bold text-${color}-600 bg-${color}-50 px-3 py-1 rounded-full uppercase`}>{title}</span>
        <h3 className="text-lg font-bold text-gray-800">네이버 섹션 순서</h3>
      </div>
      <div className="space-y-3">
        {list.length > 0 ? list.map((item, idx) => (
          <div key={idx} className="flex flex-col gap-2">
            <div className={`flex items-center p-4 border transition-all group ${item === '[연관검색어]' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
              <span className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-full text-sm font-bold text-gray-500 mr-4 shadow-sm">
                {idx + 1}
              </span>
              <span className={`text-[15px] font-medium ${item === '[연관검색어]' ? 'text-amber-700 font-bold' : 'text-gray-700'}`}>
                {item}
              </span>
              {idx === 0 && <span className="ml-auto text-[11px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100">TOP</span>}
            </div>
            
            {/* ✅ [연관검색어] 섹션 바로 아래에 추출된 단어 리스트 표시 */}
            {item === '[연관검색어]' && relatedKeywords.length > 0 && (
              <div className="ml-12 flex flex-wrap gap-1.5 pb-2">
                {relatedKeywords.map((wordObj: any, wIdx: number) => {
                  const word = typeof wordObj === 'string' ? wordObj : wordObj.keyword;
                  return (
                    <span key={wIdx} className="text-[12px] px-2 py-1 bg-white border border-amber-100 text-amber-600 rounded-md shadow-sm">
                      # {word}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )) : <p className="text-gray-400 italic p-4 text-center border border-dashed rounded-lg">데이터 없음</p>}
      </div>
    </div>
  );

  return (
    <div className="mt-12 p-8 bg-white border-4 border-dashed border-gray-200 rounded-none shadow-inner">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-red-500 animate-pulse rounded-full"></div>
          <h2 className="text-xl font-black text-gray-900">🔍 [TEST] 모바일 결과 분석</h2>
        </div>
        
        {/* 탐지 여부 표시 */}
        <div className={`px-4 py-2 rounded-md border ${hasRelatedMobile ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-gray-100 border-gray-300 text-gray-400'} text-xs font-bold`}>
          {hasRelatedMobile ? '✅ 모바일 연관검색어 탐지됨' : '❌ 모바일 연관검색어 미탐지'}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-10">
        {/* PC 결과는 주석 처리 상태 유지 */}
        {/* <SectionList title="PC 결과" list={pcOrder} color="blue" /> */}
        <SectionList title="MOBILE 결과" list={mobileOrder} color="green" />
      </div>
    </div>
  );
}