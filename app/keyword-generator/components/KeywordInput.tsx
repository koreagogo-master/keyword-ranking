'use client';

export default function KeywordInput({ 
  input1, setInput1, input2, setInput2, input3, setInput3, 
  options, setOptions, handleCombine 
}: any) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 shadow-sm rounded-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-2">단어장 (A)</h3>
          {/* 🌟 수정: 포커스 시 브랜드 컬러(#5244e8) 테두리 적용 */}
          <textarea 
            className="w-full h-40 p-3 border border-gray-200 rounded-sm outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8] resize-none text-sm transition-colors"
            placeholder={"예:\n강남\n홍대"} 
            value={input1} 
            onChange={(e) => setInput1(e.target.value)}
          />
        </div>
        <div className="bg-white border border-gray-200 shadow-sm rounded-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-2">단어장 (B)</h3>
          <textarea 
            className="w-full h-40 p-3 border border-gray-200 rounded-sm outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8] resize-none text-sm transition-colors"
            placeholder={"예:\n맛집\n카페"} 
            value={input2} 
            onChange={(e) => setInput2(e.target.value)}
          />
        </div>
        <div className="bg-white border border-gray-200 shadow-sm rounded-sm p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-2">단어장 (C)</h3>
          <textarea 
            className="w-full h-40 p-3 border border-gray-200 rounded-sm outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8] resize-none text-sm transition-colors"
            placeholder={"예:\n추천\n데이트"} 
            value={input3} 
            onChange={(e) => setInput3(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 bg-white p-5 border border-gray-200 shadow-sm rounded-sm">
        <div className="flex gap-6 text-[14px] font-bold text-slate-700">
          {/* 🌟 수정: 체크박스 색상을 브랜드 컬러로 변경 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-[#5244e8]" checked={options.ab} onChange={(e) => setOptions({...options, ab: e.target.checked})} /> A + B 조합
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-[#5244e8]" checked={options.ac} onChange={(e) => setOptions({...options, ac: e.target.checked})} /> A + C 조합
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-[#5244e8]" checked={options.bc} onChange={(e) => setOptions({...options, bc: e.target.checked})} /> B + C 조합
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-[#5244e8]" checked={options.abc} onChange={(e) => setOptions({...options, abc: e.target.checked})} /> A + B + C 조합
          </label>
        </div>
        
        {/* 🌟 수정: 버튼 색상을 주황색에서 메인 브랜드 컬러(#5244e8)로 변경 */}
        <button 
          onClick={handleCombine}
          className="px-16 py-3 font-bold bg-[#5244e8] hover:bg-[#4336c9] text-white transition-all duration-200 text-base rounded-sm shadow-md hover:scale-[1.02] hover:shadow-lg"
        >
          위 설정대로 키워드 생성하기
        </button>
      </div>
    </div>
  );
}