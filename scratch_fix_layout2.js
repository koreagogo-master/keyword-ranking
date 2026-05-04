const fs = require('fs');
let content = fs.readFileSync('app/index-check/page.tsx', 'utf8');

const regex = /<div className=\{`w-full grid grid-cols-1 gap-4 \$\{results && results\.length > 0 \? 'md:grid-cols-4' : ''\}`\}>[\s\S]*?<\/div>\s*<\/div>\s*<\/>\s*\)\}\s*<\/div>/;

const newSection = `<div className="flex flex-col lg:flex-row gap-6 items-start w-full relative">
                
                {/* 1. 원래 크기의 입력창 영역 (고정 420px) */}
                <div className="w-full lg:w-[420px] shrink-0 sticky top-[64px] z-30 space-y-3 bg-[#f8f9fa]">
                  <div className="bg-white border border-gray-200 rounded-sm flex items-center shadow-md focus-within:border-[#5244e8]/50 overflow-hidden transition-colors">
                    <input
                      type="text"
                      value={blogId}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                          if (e.nativeEvent.isComposing) return;
                          if (e.key === "Enter" && !loading) fetchItems(0);
                      }}
                      className="flex-1 py-3 px-4 text-base outline-none !text-black bg-white"
                      placeholder="네이버 아이디 입력"
                      style={{ fontFamily: "sans-serif" }} 
                    />
                    <button
                      onClick={() => fetchItems(0)}
                      disabled={loading}
                      className="px-10 py-3.5 font-bold bg-[#5244e8] hover:bg-[#4336c9] text-white transition-colors text-base whitespace-nowrap border-l border-gray-200 disabled:opacity-70"
                    >
                      {loading ? "조회중" : "조회"}
                    </button>
                  </div>
                </div>

                {/* 2. 결과 대시보드 카드 영역 (나머지 공간 채움) */}
                {results && results.length > 0 && (
                  <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-500">
                    <div className="bg-white p-5 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center relative overflow-hidden min-h-[96px]">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[#5244e8]"></div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-slate-400">TARGET BLOG</span>
                        <button onClick={() => window.open(\`https://blog.naver.com/\${blogId}\`, '_blank')} className="text-[11px] font-bold px-3 py-1 bg-slate-50 hover:bg-slate-100 !text-slate-600 rounded-full transition-colors flex items-center gap-1 shadow-sm border border-slate-200">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          바로가기
                        </button>
                      </div>
                      <span className="text-[15px] font-extrabold text-slate-800 break-keep leading-snug mb-1">{blogMeta.title}</span>
                      <span className="text-[12px] font-medium text-slate-500 truncate">{blogMeta.description}</span>
                    </div>

                    <div className="bg-white p-5 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center relative overflow-hidden min-h-[96px]">
                      <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                      <span className="text-xs font-bold text-slate-400 mb-1">정상 노출</span>
                      <div className="flex items-end gap-1">
                        <span className="text-2xl font-bold text-green-600">{results.filter(r => r.status === "indexed").length}</span>
                        <span className="text-xs font-medium text-slate-400 mb-1">건</span>
                      </div>
                    </div>

                    <div className="bg-white p-5 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-center relative overflow-hidden min-h-[96px]">
                      <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                      <span className="text-xs font-bold text-slate-400 mb-1">누락 의심</span>
                      <div className="flex items-end gap-1">
                        <span className="text-2xl font-bold text-red-500">{results.filter(r => r.status === "missing").length}</span>
                        <span className="text-xs font-medium text-slate-400 mb-1">건</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>`;

if (regex.test(content)) {
  content = content.replace(regex, newSection);
  fs.writeFileSync('app/index-check/page.tsx', content, 'utf8');
  console.log('Success');
} else {
  console.log('Regex failed');
}
