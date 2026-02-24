'use client';

const formatNum = (num: number) => new Intl.NumberFormat().format(num || 0);

export default function GeneratedTable({ 
  combinedList, sortedList, selectedKeywords, pickedKeywords, 
  isFetching, progress, fetchSearchVolumes, toggleAll, toggleKeyword, togglePick, 
  handleSort, renderSortIcon, copyGeneratedToClipboard 
}: any) {

  const TableColGroup = () => (
    <colgroup>
      <col className="w-10" />
      <col className="w-12" />
      <col />
      <col className="w-28" />
      <col className="w-28" />
      <col className="w-[130px]" />
      <col className="w-[130px]" />
      <col className="w-14" />
    </colgroup>
  );

  return (
    <div className="flex-1 w-full bg-white border border-gray-300 shadow-sm rounded-sm p-6 overflow-hidden flex flex-col h-[750px]">
      
      {/* 🌟 수정 1: items-start 를 items-end 로 변경하여 우측 박스와 버튼 높이를 동일하게 맞췄습니다. */}
      <div className="flex justify-between items-end mb-4 min-h-[52px] flex-shrink-0">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-slate-800">
            생성된 키워드 ({combinedList.length}개)
          </h3>
            <span className="text-sm text-slate-500 font-medium">
              * <strong className="font-bold text-blue-700">[생성된 키워드]</strong>를 선택 후 <strong className="font-bold text-blue-700">[생성된 키워드 세부 조회]</strong> 버튼을 눌러 주세요.
            </span>
        </div>
        
        {/* 🌟 수정 2: 돋보기 아이콘 추가 (조회 중이 아닐 때만 돋보기가 보이도록 처리) */}
        <button 
          onClick={fetchSearchVolumes}
          disabled={isFetching}
          className={`py-2.5 w-[190px] flex justify-center items-center font-bold text-white transition-all duration-200 text-[13px] rounded-sm shadow-sm whitespace-nowrap ${isFetching ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#ff8c29] hover:bg-[#ff9d47] hover:scale-[1.02] hover:shadow-lg'}`}
        >
          {isFetching ? (
            `조회 중... (${progress}%)`
          ) : (
            <>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              생성된 키워드 세부 조회
            </>
          )}
        </button>
      </div>

      <div className="bg-slate-50 border border-b-0 border-gray-200 rounded-t-sm pr-[14px] flex-shrink-0">
        <table className="w-full text-left table-fixed min-w-[700px]">
          <TableColGroup />
          <thead>
            <tr className="text-[13px] border-b border-gray-200">
              <th className="px-2 py-3 text-center font-bold text-slate-500">
                <input type="checkbox" checked={selectedKeywords.length === combinedList.length && combinedList.length > 0} onChange={toggleAll} className="w-4 h-4 cursor-pointer accent-slate-300" />
              </th>
              <th className="px-3 py-3 font-bold text-slate-500 text-center">순서</th>
              <th className="px-3 py-3 font-bold text-slate-500">생성된 키워드</th>
              <th className="px-3 py-3 text-right cursor-pointer hover:bg-orange-50 font-bold text-orange-600" onClick={() => handleSort('cpc')}>
                <div className="flex items-center justify-end">예상 CPC{renderSortIcon('cpc')}</div>
              </th>
              <th className="px-3 py-3 text-right cursor-pointer hover:bg-blue-50 font-bold text-blue-600" onClick={() => handleSort('total')}>
                <div className="flex items-center justify-end">총 검색량{renderSortIcon('total')}</div>
              </th>
              <th className="px-3 py-3 text-right cursor-pointer hover:bg-slate-100 font-semibold text-slate-500" onClick={() => handleSort('pc')}>
                <div className="flex items-center justify-end">PC{renderSortIcon('pc')}</div>
              </th>
              <th className="px-3 py-3 text-right cursor-pointer hover:bg-slate-100 font-semibold text-slate-500" onClick={() => handleSort('mobile')}>
                <div className="flex items-center justify-end">모바일{renderSortIcon('mobile')}</div>
              </th>
              <th className="px-2 py-3 text-center font-extrabold text-blue-600 bg-blue-50/50">담기</th>
            </tr>
          </thead>
        </table>
      </div>

      <div className="flex-1 overflow-y-scroll border border-gray-200 border-t-0 rounded-b-sm bg-white">
        <table className="w-full text-left table-fixed min-w-[700px]">
          <TableColGroup />
          <tbody className="divide-y divide-gray-100">
            {sortedList.map((item: any, idx: number) => (
              <tr key={idx} className={`hover:bg-gray-50 transition-colors ${item.isLoading ? 'bg-blue-50/30 opacity-70' : ''}`}>
                <td className="px-2 py-2.5 text-center">
                  <input type="checkbox" checked={selectedKeywords.includes(item.keyword)} onChange={() => toggleKeyword(item.keyword)} className="w-4 h-4 cursor-pointer accent-slate-300" />
                </td>
                <td className="px-3 py-2.5 text-center text-slate-400 font-medium text-[13px]">
                  {combinedList.findIndex((x: any) => x.keyword === item.keyword) + 1}
                </td>
                <td className="px-3 py-2.5 font-bold !text-black text-[13px] truncate">{item.keyword}</td>
                <td className="px-3 py-2.5 text-right font-bold text-[13px] text-orange-600">
                  {item.isLoading ? <span className="animate-pulse">...</span> : (item.isDone ? `${formatNum(item.cpc)}원` : '-')}
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-[13px] text-blue-600">
                  {item.isDone ? formatNum(item.total) : '-'}
                </td>
                <td className="px-3 py-2.5 text-right font-medium text-[13px] text-slate-700">
                  {item.isDone ? <>{formatNum(item.pc)} {item.total > 0 && <span className="text-slate-400 text-[10px] font-normal italic ml-0.5">({Math.round(item.pc/item.total*100)}%)</span>}</> : '-'}
                </td>
                <td className="px-3 py-2.5 text-right font-medium text-[13px] text-slate-700">
                  {item.isDone ? <>{formatNum(item.mobile)} {item.total > 0 && <span className="text-slate-400 text-[10px] font-normal italic ml-0.5">({Math.round(item.mobile/item.total*100)}%)</span>}</> : '-'}
                </td>
                <td className="px-2 py-2.5 text-center bg-blue-50/20">
                  <input type="checkbox" checked={pickedKeywords.includes(item.keyword)} onChange={() => togglePick(item.keyword)} className="w-4 h-4 cursor-pointer accent-slate-300" title="우측 보관함에 담기"/>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end flex-shrink-0">
        <button 
          onClick={copyGeneratedToClipboard}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-sm transition-colors shadow-sm flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
          생성된 키워드 복사
        </button>
      </div>

    </div>
  );
}