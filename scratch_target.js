const fs = require('fs');
let content = fs.readFileSync('app/index-check/page.tsx', 'utf8');

const regex = /<span className="text-xs font-bold text-slate-400 mb-1">TARGET BLOG<\/span>[\s\S]*?<span className="text-\[12px\] font-medium text-slate-500 truncate">\{blogMeta.description\}<\/span>/;
const newTarget = `<div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-slate-400">TARGET BLOG</span>
                        <button onClick={() => window.open(\`https://blog.naver.com/\${blogId}\`, '_blank')} className="text-[11px] font-bold px-3 py-1 bg-slate-50 hover:bg-slate-100 !text-slate-600 rounded-full transition-colors flex items-center gap-1 shadow-sm border border-slate-200">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          블로그 바로가기
                        </button>
                      </div>
                      <span className="text-[15px] font-extrabold text-slate-800 break-keep leading-snug mb-1">{blogMeta.title}</span>
                      <span className="text-[12px] font-medium text-slate-500 truncate">{blogMeta.description}</span>`;

content = content.replace(regex, newTarget);
fs.writeFileSync('app/index-check/page.tsx', content, 'utf8');
