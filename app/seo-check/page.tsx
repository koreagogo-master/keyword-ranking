"use client";

import { useState } from "react";
 
import SellerTabs from "@/components/SellerTabs";
import { useAuth } from "@/app/contexts/AuthContext";
import { usePoint } from "@/app/hooks/usePoint";
import HelpButton from "@/components/HelpButton";

export default function SeoCheckPage() {
  const { user } = useAuth();
  const { deductPoints } = usePoint();

  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [mainKeyword, setMainKeyword] = useState("");
  const [productName, setProductName] = useState("");
  const [storeName, setStoreName] = useState("");
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [multipleProducts, setMultipleProducts] = useState<any[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // 🌟 targetLink 파라미터가 추가되었습니다.
  const runAnalysis = (targetName: string, targetImage: string, targetKeyword: string, targetLink: string) => {
    const originalProductName = targetName;
    let score = 100;
    const details = [];
    let cleanName = targetName; 

    if (!targetName.includes(targetKeyword)) {
      score -= 30;
      details.push({
        type: 'danger', title: '🚨 메인 키워드 누락 (-30점)',
        desc: (
          <div className="space-y-1 text-sm text-slate-600">
            <p>상품명에 핵심 타겟인 메인 키워드가 없습니다.</p>
            <div className="bg-white p-2.5 border border-red-200 rounded-md mt-2">
              누락된 키워드: <strong className="text-red-600 bg-red-50 px-1 py-0.5 rounded">'{targetKeyword}'</strong>
            </div>
          </div>
        )
      });
      cleanName = `${targetKeyword} ` + cleanName;
    } else {
      details.push({
        type: 'success', title: '✅ 메인 키워드 포함',
        desc: <p className="text-sm text-slate-600">핵심 타겟인 <strong className="text-green-700">'{targetKeyword}'</strong>(이)가 잘 포함되어 있습니다.</p>
      });
    }

    const badCharsRegex = /[★♥~!?:"*@#$%^_{}<>;|]/g;
    const foundBadChars = targetName.match(badCharsRegex);
    if (foundBadChars) {
      score -= 15;
      const highlightedName = targetName.split('').map((char, i) => {
        if (char.match(badCharsRegex)) return <span key={i} className="text-red-600 font-extrabold text-base bg-red-100 px-0.5 mx-px rounded">{char}</span>;
        return char;
      });
      details.push({
        type: 'warning', title: '⚠️ 불필요한 특수문자 발견 (-15점)',
        desc: (
          <div className="space-y-1 text-sm text-slate-600">
            <div className="bg-white p-2.5 border border-orange-200 rounded-md mt-2 break-all">
              진단된 상품명: <span className="text-slate-500">{highlightedName}</span>
            </div>
          </div>
        )
      });
      cleanName = cleanName.replace(badCharsRegex, '');
    }

    const promoWords = ['무료배송', '당일발송', '특가', '할인', '이벤트', '1+1', '사은품', '주문폭주', '한정수량', '최저가'];
    const foundPromo = promoWords.filter(word => targetName.includes(word));
    if (foundPromo.length > 0) {
      score -= 15;
      details.push({
        type: 'danger', title: `🚨 홍보성 단어 포함 (-15점)`,
        desc: (
          <div className="space-y-1 text-sm text-slate-600">
            <div className="bg-white p-2.5 border border-red-200 rounded-md mt-2">
              발견된 금지어: <strong className="text-red-600 bg-red-50 px-1 py-0.5 rounded">{foundPromo.join(', ')}</strong>
            </div>
          </div>
        )
      });
      foundPromo.forEach(word => { cleanName = cleanName.replace(new RegExp(word, 'g'), ''); });
    }

    const words = targetName.split(/\s+/);
    const wordCounts: Record<string, number> = {};
    const overusedWords: string[] = [];
    words.forEach(word => {
      if (word.length > 1) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
        if (wordCounts[word] === 3) overusedWords.push(word);
      }
    });
    if (overusedWords.length > 0) {
      score -= 20;
      details.push({
        type: 'danger', title: '🚨 동일 단어 3회 이상 반복 (-20점)',
        desc: (
          <div className="space-y-1 text-sm text-slate-600">
            <div className="bg-white p-2.5 border border-red-200 rounded-md mt-2">
              반복된 단어: <strong className="text-red-600 bg-red-50 px-1 py-0.5 rounded">{overusedWords.join(', ')}</strong>
            </div>
          </div>
        )
      });
      cleanName = Array.from(new Set(cleanName.split(/\s+/))).join(' ');
    }

    const len = targetName.length;
    if (len < 10) {
      score -= 10;
      details.push({ type: 'warning', title: `⚠️ 너무 짧은 상품명 (현재 ${len}자)`, desc: <p className="text-sm text-slate-600">최소 15자 이상을 권장합니다.</p> });
    } else if (len > 30 && len <= 50) {
      details.push({ type: 'warning', title: `⚠️ 모바일 잘림 주의 (현재 ${len}자)`, desc: <p className="text-sm text-slate-600">모바일에서는 30자가 넘어가면 말줄임표(...)로 잘릴 위험이 높습니다.</p> });
    } else if (len > 50) {
      score -= 10;
      details.push({ type: 'danger', title: `🚨 네이버 권장 글자수 초과 (현재 ${len}자)`, desc: <p className="text-sm text-slate-600">반드시 50자 이내로 줄이세요.</p> });
    } else {
      details.push({ type: 'success', title: `✅ 완벽한 글자 수 (현재 ${len}자)`, desc: <p className="text-sm text-slate-600">모바일과 PC 모두에서 훌륭한 길이입니다.</p> });
    }

    cleanName = cleanName.replace(/\s+/g, ' ').trim();

    setResult({
      totalScore: Math.max(0, score),
      summary: score >= 90 ? "완벽합니다! 네이버 알고리즘이 아주 좋아하는 상품명입니다." 
             : score >= 70 ? "무난하지만, 몇 가지 수정이 필요합니다." 
             : "검색 노출에 불이익을 받을 확률이 높습니다.",
      originalName: originalProductName, 
      suggestedName: cleanName,
      details: details,
      productImage: targetImage,
      productLink: targetLink // 🌟 링크 데이터 결과 객체에 추가
    });
    
    setIsAnalyzing(false);
  };

  const handleAnalyze = async () => {
    if (mode === 'new' && (!mainKeyword.trim() || !productName.trim())) {
      alert("키워드와 상품명을 모두 입력해 주세요.");
      return;
    }
    if (mode === 'existing' && (!mainKeyword.trim() || !storeName.trim())) {
      alert("키워드와 스토어명을 모두 입력해 주세요.");
      return;
    }
    if (!user) { alert("로그인이 필요합니다."); return; }

    setIsAnalyzing(true);
    setResult(null);
    setMultipleProducts(null);
    setSelectedIndex(null);

    const isPaySuccess = await deductPoints(user.id, 10, 1, mainKeyword);
    if (!isPaySuccess) { setIsAnalyzing(false); return; }

    try {
      if (mode === 'existing') {
        const response = await fetch(`/api/scrape-product?keyword=${encodeURIComponent(mainKeyword.trim())}&storeName=${encodeURIComponent(storeName.trim())}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        if (data.products && data.products.length > 0) {
           setMultipleProducts(data.products);
           setSelectedIndex(0);
           // 🌟 API에서 받아온 링크(link) 인자 추가 전달
           runAnalysis(data.products[0].title, data.products[0].image, mainKeyword.trim(), data.products[0].link);
        } 
      } else {
        runAnalysis(productName, "", mainKeyword.trim(), "");
      }
    } catch (error: any) {
      alert(error.message);
      setIsAnalyzing(false);
    } 
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  const copyToClipboard = () => {
    if (!result?.suggestedName) return;
    navigator.clipboard.writeText(result.suggestedName).then(() => { alert("정제된 상품명이 복사되었습니다!"); });
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />

      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        

        <main className="flex-1 ml-64 p-10">
          <div className="max-w-7xl mx-auto">
            <SellerTabs />
          
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">내 상품명 진단 (SEO 최적화)</h1>
                  <HelpButton href="https://blog.naver.com/lboll/224254481124" tooltip="도움말" />
                </div>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">네이버 쇼핑 검색 알고리즘 기반 상품명 정밀 건강검진</p>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start relative">
              
              {/* 왼쪽: 입력 섹션 */}
              <div className="w-full lg:w-[420px] sticky top-[64px] z-30 space-y-4">
                <div className="flex p-1 bg-gray-200 rounded-lg">
                  <button onClick={() => { setMode('new'); setResult(null); setMultipleProducts(null); }} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mode === 'new' ? 'bg-white !text-[#5244e8] shadow-sm' : '!text-gray-500 hover:!text-gray-700'}`}>신규 상품 기획</button>
                  <button onClick={() => { setMode('existing'); setResult(null); setMultipleProducts(null); }} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mode === 'existing' ? 'bg-white !text-[#5244e8] shadow-sm' : '!text-gray-500 hover:!text-gray-700'}`}>기존 상품 진단</button>
                </div>

                <div className="bg-white border border-gray-200 shadow-md rounded-lg p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#5244e8]/10 text-[#5244e8] flex items-center justify-center text-xs">1</span>
                    메인 타겟 키워드
                  </h3>
                  <input type="text" value={mainKeyword} onKeyDown={handleKeyDown} onChange={(e) => setMainKeyword(e.target.value)} className="w-full py-2.5 px-3 border border-gray-300 rounded-md outline-none text-sm focus:border-[#5244e8] transition-colors" placeholder="예: 라이터" />
                </div>

                <div className="bg-white border border-gray-200 shadow-md rounded-lg p-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#5244e8]/10 text-[#5244e8] flex items-center justify-center text-xs">2</span>
                    {mode === 'new' ? '구상 중인 상품명' : '내 스토어명'}
                  </h3>
                  {mode === 'new' ? (
                    <>
                      <textarea value={productName} onChange={(e) => setProductName(e.target.value)} rows={3} className="w-full py-2.5 px-3 border border-gray-300 rounded-md outline-none text-sm resize-none focus:border-[#5244e8] transition-colors leading-relaxed" placeholder="등록 예정인 전체 상품명을 입력하세요." />
                      <div className="flex justify-between items-center mt-2 px-1 text-xs font-bold"><p className="text-slate-500 font-medium">PC 50자 / 모바일 30자 이내 권장</p><span className={productName.length > 50 ? 'text-red-500' : productName.length > 30 ? 'text-orange-500' : 'text-green-600'}>{productName.length}자</span></div>
                    </>
                  ) : (
                    <input type="text" value={storeName} onKeyDown={handleKeyDown} onChange={(e) => setStoreName(e.target.value)} className="w-full py-2.5 px-3 border border-gray-300 rounded-md outline-none text-sm focus:border-[#5244e8] transition-colors" placeholder="예: 코만도몰" />
                  )}
                </div>

                <button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full py-3.5 font-bold bg-[#5244e8] hover:bg-[#4336c9] text-white rounded-lg transition-colors shadow-md disabled:opacity-70 flex justify-center items-center gap-2">
                  {isAnalyzing ? "분석 중..." : "SEO 패널티 진단하기"}
                </button>
              </div>

              {/* 오른쪽: 결과 및 상품 선택 섹션 */}
              <div className="flex-1 w-full min-h-[400px] space-y-6">
                
                {multipleProducts && (
                  <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 animate-fadeIn">
                    <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                       <span className="text-[#5244e8]">💡</span> 해당 스토어에서 검색된 상품 ({multipleProducts.length})
                    </h2>
                    {/* 🌟 수정 1: pt-1 px-1 pb-3 여백 추가로 테두리 잘림 현상 방지 */}
                    <div className="flex gap-3 overflow-x-auto pt-1 px-1 pb-3 custom-scrollbar">
                      {multipleProducts.map((prod, idx) => (
                         <div 
                           key={idx} 
                           onClick={() => {
                             setSelectedIndex(idx);
                             setIsAnalyzing(true);
                             setTimeout(() => runAnalysis(prod.title, prod.image, mainKeyword.trim(), prod.link), 100);
                           }} 
                           className={`flex-shrink-0 w-64 p-3 border rounded-lg cursor-pointer transition-all flex gap-3 items-center ${selectedIndex === idx ? 'border-[#5244e8] bg-blue-50 ring-1 ring-[#5244e8] shadow-sm' : 'border-gray-200 bg-white hover:border-gray-400'}`}
                         >
                            <img src={prod.image} alt="썸네일" className="w-12 h-12 object-cover rounded-md border border-gray-200 bg-white" />
                            <div className="flex-1 overflow-hidden">
                              <div className="text-[11px] font-bold text-gray-800 line-clamp-2 leading-tight">{prod.title}</div>
                              <div className="text-[10px] text-gray-500 mt-1 font-medium">{Number(prod.lprice).toLocaleString()}원</div>
                            </div>
                         </div>
                      ))}
                    </div>
                  </div>
                )}

                {!result ? (
                  !multipleProducts && (
                    <div className="h-[400px] border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-slate-400 bg-white/50 p-10 text-center">
                      <p className="font-medium text-slate-500 mb-1">입력된 정보가 없습니다.</p>
                      <p className="text-sm">좌측에 정보를 입력하고 진단 버튼을 눌러주세요.</p>
                    </div>
                  )
                ) : (
                  <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden flex flex-col animate-fadeIn">
                    <div className="p-8 bg-slate-50 border-b border-gray-200 flex flex-col items-center text-center">
                       <h2 className="text-sm font-bold text-[#5244e8] mb-2">종합 SEO 안전 점수</h2>
                       <div className={`text-5xl font-extrabold mb-3 ${result.totalScore >= 90 ? 'text-green-600' : result.totalScore >= 70 ? 'text-orange-500' : 'text-red-500'}`}>
                         {result.totalScore}<span className="text-2xl text-slate-400 font-medium ml-1">점</span>
                       </div>
                       <p className="text-slate-600 font-medium">{result.summary}</p>
                    </div>

                    {/* 🌟 수정 2 & 3: 여백(Padding) 밸런스 조정 및 URL 새창 띄우기 링크 적용 */}
                    {mode === 'existing' && result.originalName && (
                      <div className="px-6 pt-6">
                        <div className="p-5 bg-gray-50 border border-gray-200 rounded-lg">
                          <h3 className="text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-wider">🔍 현재 등록된 원본 상품명</h3>
                          <div className="flex gap-4 items-center">
                             {result.productImage && (
                               <img src={result.productImage} alt="원본" className="w-16 h-16 object-cover rounded-md border border-gray-300 shrink-0" />
                             )}
                             <div className="flex-1 flex flex-col justify-center">
                               <a 
                                 href={result.productLink} 
                                 target="_blank" 
                                 rel="noreferrer" 
                                 className="text-[14px] font-bold text-slate-800 break-all leading-relaxed hover:text-[#5244e8] hover:underline transition-colors flex items-start gap-1 w-fit mb-2 group cursor-pointer"
                                 title="클릭하여 네이버 쇼핑 상품 페이지로 이동"
                               >
                                 {result.originalName}
                                 <svg className="w-4 h-4 text-gray-400 group-hover:text-[#5244e8] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                               </a>
                               <div>
                                 <span className="text-[11px] font-bold px-2 py-1 rounded bg-white border text-gray-500 border-gray-300 shadow-sm">
                                   총 {result.originalName.length}자
                                 </span>
                               </div>
                             </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-6 border-b border-gray-200 bg-[#5244e8]/5 flex flex-col lg:flex-row gap-6">
                      <div className="flex-1">
                        <div className="flex justify-between items-end mb-3">
                          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <svg className="w-4 h-4 text-[#5244e8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            정제된 상품명 (Clean Version)
                          </h3>
                          <span className={`text-xs font-bold px-2 py-1 rounded bg-white border ${result.suggestedName.length > 30 ? 'text-orange-600 border-orange-200' : 'text-green-600 border-green-200'}`}>총 {result.suggestedName.length}자</span>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="flex-1 bg-white border border-[#5244e8]/30 p-3 rounded-md text-sm font-bold text-[#5244e8] break-all leading-relaxed">{result.suggestedName}</div>
                          <button onClick={copyToClipboard} className="shrink-0 px-4 py-3 bg-[#5244e8] text-white text-sm font-bold rounded-md hover:bg-[#4336c9] transition-colors">복사</button>
                        </div>
                      </div>

                      <div className="w-[180px] shrink-0 bg-white border border-gray-200 rounded-lg p-3 shadow-sm relative overflow-hidden h-fit">
                        <div className="absolute top-0 left-0 right-0 bg-slate-800 text-white text-[9px] text-center py-0.5 font-bold tracking-wider opacity-90">MOBILE PREVIEW</div>
                        <div className="text-[12px] text-slate-800 font-bold leading-[1.4] line-clamp-2 break-all mt-4" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{result.suggestedName}</div>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      {result.details.map((item: any, idx: number) => (
                        <div key={idx} className={`p-4 rounded-lg border ${item.type === 'success' ? 'bg-green-50 border-green-200' : item.type === 'warning' ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
                           <h4 className={`font-bold mb-1 text-sm ${item.type === 'success' ? 'text-green-700' : item.type === 'warning' ? 'text-orange-700' : 'text-red-700'}`}>{item.title}</h4>
                           <div className="text-sm text-slate-600">{item.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}