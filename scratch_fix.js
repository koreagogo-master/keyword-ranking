const fs = require('fs');
let content = fs.readFileSync('app/index-check/page.tsx', 'utf8');

const regex = /<span className="text-xl font-bold text-red-500">\{results\.filter\(r => r\.status === "missing"\)\.length\}<\/span>[\s\S]*?<\/div>[\s\S]*?<\/div>\s*\)\}\s*<\/div>/;

const newTarget = `<span className="text-xl font-bold text-red-500">{results.filter(r => r.status === "missing").length}</span>
                          <span className="text-xs font-medium text-slate-400 mb-1">건</span>
                        </div>
                      </div>
                  </div>
                )}
              </div>`;

content = content.replace(regex, newTarget);
fs.writeFileSync('app/index-check/page.tsx', content, 'utf8');
console.log('Fixed syntax!');
