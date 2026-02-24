'use client';

const formatNum = (num: number) => new Intl.NumberFormat().format(num || 0);

export default function SelectedCart({ pickedKeywords, combinedList, totalPickedVolume, togglePick, copyPickedToClipboard, clearPickedKeywords }: any) {
  return (
    <div className="w-full lg:w-[380px] xl:w-[450px] sticky top-[64px] z-30 flex flex-col h-[750px]">
      <div className="bg-slate-50 border border-gray-300 shadow-sm rounded-sm p-6 overflow-hidden flex flex-col h-full">
        
        {/* 🌟 수정: items-start 를 items-end 로 변경하여 버튼 묶음이 하단 텍스트 라인에 맞춰지도록 내렸습니다. */}
        <div className="flex justify-between items-end mb-4 min-h-[52px] flex-shrink-0">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-slate-800">담은 키워드 ({pickedKeywords.length}개)</h3>
            <span className="text-sm text-slate-500 font-medium">
              * 총 검색량 합산: <span className="text-slate-800 font-bold">{formatNum(totalPickedVolume)}</span>
            </span>
          </div>

          {/* 위치가 하단으로 정렬되었으므로 불필요한 위쪽 여백(mt-0.5)은 제거했습니다. */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-slate-500">전체 비우기</span>
            <button 
              onClick={clearPickedKeywords}
              disabled={pickedKeywords.length === 0}
              className="w-7 h-7 flex items-center justify-center text-white bg-red-400 rounded-sm hover:bg-red-500 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="담은 키워드 모두 비우기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
        
        <div className="bg-slate-100 border border-b-0 border-gray-200 rounded-t-sm pl-6 pr-[28px] py-3 flex justify-between items-center text-[13px] font-bold text-slate-500 flex-shrink-0">
          <span>담은 키워드</span>
          <div className="flex items-center gap-6">
            <div className="w-[70px] text-right">예상 CPC</div>
            <div className="w-[75px] text-right">총 검색량</div>
            <div className="w-[36px] text-center">빼기</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-scroll border border-gray-200 border-t-0 rounded-b-sm bg-white">
          <ul className="divide-y divide-gray-100">
            {pickedKeywords.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm mt-10">
                좌측 표에서 [담기]를 체크해주세요.
              </div>
            ) : (
              pickedKeywords.map((k: string, i: number) => {
                const found = combinedList.find((x: any) => x.keyword === k);
                return (
                  <li key={i} className="flex justify-between items-center pl-6 pr-4 py-2.5 hover:bg-gray-50 transition-colors group">
                    <span className="text-[13px] font-bold !text-black truncate flex-1 pr-4">{k}</span>
                    
                    <div className="flex items-center gap-6">
                      <span className="w-[70px] text-right text-[12px] text-orange-600 font-bold whitespace-nowrap">
                        {found && found.isDone && found.cpc > 0 ? `${formatNum(found.cpc)}원` : "-"}
                      </span>
                      <span className="w-[75px] text-right text-[12px] text-blue-600 font-bold whitespace-nowrap">
                        {found && found.isDone && found.total > 0 ? formatNum(found.total) : "-"}
                      </span>
                      
                      <div className="w-[36px] flex justify-center">
                        <button 
                          onClick={() => togglePick(k)} 
                          className="w-[22px] h-[22px] flex items-center justify-center text-white bg-red-400 hover:bg-red-500 transition-colors rounded shadow-sm flex-shrink-0" 
                          title="담은 키워드 빼기"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
        
        <div className="mt-4 flex justify-end flex-shrink-0">
          <button 
            onClick={copyPickedToClipboard} 
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-sm transition-colors shadow-sm flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
            담은 키워드 복사
          </button>
        </div>

      </div>
    </div>
  );
}