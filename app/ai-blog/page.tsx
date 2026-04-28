"use client";

import { useState, useEffect } from "react"; // 🌟 수정: useEffect 추가 완료

import { useAuth } from "@/app/contexts/AuthContext";
import { usePoint } from "@/app/hooks/usePoint";

import { createClient } from "@/app/utils/supabase/client";
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";
import AiTabs from "@/components/AiTabs";
import HelpButton from "@/components/HelpButton";

export default function AiBlogPage() {
  const { user } = useAuth();
  const { deductPoints } = usePoint();

  const [activeTab, setActiveTab] = useState<"auto" | "renewal">("auto");

  // [필수] 입력 폼 상태
  const [keyword, setKeyword] = useState("");
  const [productName, setProductName] = useState("");
  const [features, setFeatures] = useState("");
  const [originalContent, setOriginalContent] = useState("");

  // [선택] 세부 설정 상태
  const [subKeywords, setSubKeywords] = useState("");
  const [postPurpose, setPostPurpose] = useState("정보성(전문/객관)");
  const [wordCount, setWordCount] = useState("1500");
  const [targetAudience, setTargetAudience] = useState("");
  const [extraPrompt, setExtraPrompt] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 🌟 폼 접기/펼치기를 관리하는 상태
  const [isFormVisible, setIsFormVisible] = useState(true);

  // 🌟 무료 이미지 상태
  const [visibleImageCount, setVisibleImageCount] = useState(10);
  const [freeImageSearchKeyword, setFreeImageSearchKeyword] = useState("");
  const [isSearchingFreeImage, setIsSearchingFreeImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  // 🌟 [신규 추가] DB에서 기본 포인트를 실시간으로 불러오기
  const [basePoint, setBasePoint] = useState(300); // 초기 기본값

  useEffect(() => {
    const fetchBasePoint = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('point_policies')
        .select('point_cost')
        .eq('page_type', 'AI_BLOG')
        .single();

      if (data && !error) {
        setBasePoint(data.point_cost);
      }
    };
    fetchBasePoint();
  }, []);

  const isSaveDisabled = !user ||
    (activeTab === "auto" && (!keyword.trim() || !productName.trim() || !features.trim())) ||
    (activeTab === "renewal" && (!keyword.trim() || !productName.trim() || !originalContent.trim()));

  // 🌟 수정: DB에서 불러온 basePoint에 추가 포인트를 더하는 공식
  const getBasePoints = () => {
    if (wordCount === "2000") return basePoint + 20;
    if (wordCount === "3000") return basePoint + 40;
    return basePoint;
  };

  const totalPoints = getBasePoints();

  const extractUniqueId = (url: string) => {
    try {
      if (url.includes('pixabay')) {
        const match = url.match(/-(\d+)_[0-9]+\./);
        if (match) return 'pix_' + match[1];
      } else if (url.includes('pexels')) {
        const match = url.match(/\/photos\/(\d+)\//);
        if (match) return 'pex_' + match[1];
      }
    } catch (e) { }
    return url.split('?')[0];
  };

  const handleGenerate = async () => {
    if (activeTab === "auto") {
      if (!keyword.trim() || !productName.trim() || !features.trim()) {
        alert("좌측의 필수 항목(키워드, 상품명, 장점)을 모두 입력해 주세요.");
        return;
      }
    } else {
      if (!keyword.trim() || !productName.trim() || !originalContent.trim()) {
        alert("타겟 메인 키워드, 내 상품명, 벤치마킹할 원본 텍스트를 모두 입력해 주세요.");
        return;
      }
    }

    if (!user) {
      alert("로그인이 필요한 서비스입니다.");
      return;
    }

    if (deductPoints) {
      const title = activeTab === "auto" ? `Dual AI 포스팅(${wordCount}자)` : `Dual AI 리뉴얼(${wordCount}자)`;
      const isPaySuccess = await deductPoints(user.id, totalPoints, 1, title);
      if (!isPaySuccess) return;
    }

    setIsGenerating(true);
    setResult(null);
    setLoadingStep(1);
    setVisibleImageCount(10);

    const loadingTimer = setInterval(() => {
      setLoadingStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 15000);

    try {
      const response = await fetch('/api/ai-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: activeTab, keyword, productName, features, subKeywords,
          originalContent, postPurpose, wordCount, targetAudience, extraPrompt
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || '원고 처리 중 오류가 발생했습니다.');

      let fetchedFreeImages = [];
      const mainKw = keyword.trim() || productName.trim();
      const subKw = subKeywords.trim();

      try {
        if (mainKw) {
          const freeImgRes = await fetch('/api/free-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mainKeyword: mainKw, subKeyword: subKw }),
          });
          if (freeImgRes.ok) {
            const freeImgData = await freeImgRes.json();
            const uniqueImages = (freeImgData.images || []).filter((url: string, index: number, self: string[]) =>
              index === self.findIndex((t) => extractUniqueId(t) === extractUniqueId(url))
            );
            fetchedFreeImages = uniqueImages;
          }
        }
      } catch (err) {
        console.error("무료 이미지 로딩 실패:", err);
      }

      setResult({ content: data.content, freeImages: fetchedFreeImages });
      setFreeImageSearchKeyword("");
      setIsFormVisible(false);
      setHasGeneratedOnce(true);

      try {
        const supabase = createClient();
        const historyKeyword = activeTab === "auto" ? `[자동생성] ${keyword}` : `[리뉴얼] ${productName}`;
        await supabase.from('search_history').insert({
          user_id: user.id,
          menu_name: 'Dual AI 포스팅',
          keyword: historyKeyword
        });
      } catch (err) {
        console.error("히스토리 저장 실패:", err);
      }
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);

    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      clearInterval(loadingTimer);
      setIsGenerating(false);
      setLoadingStep(0);
    }
  };

  const copyToClipboard = () => {
    if (!result?.content) return;
    navigator.clipboard.writeText(result.content).then(() => {
      alert("원고가 복사되었습니다! 블로그에 붙여넣기 하세요.");
    });
  };

  const handleSaveCurrentSetting = async () => {
    if (!user) {
      alert('로그인 정보가 만료되었거나 확인할 수 없습니다. 다시 로그인해주세요.');
      return;
    }
    const settingsToSave = { activeTab, keyword, subKeywords, productName, features, originalContent, postPurpose, wordCount, targetAudience, extraPrompt };
    const displayTitle = activeTab === "auto" ? `[자동생성] ${keyword}` : `[리뉴얼] ${originalContent.substring(0, 10)}...`;

    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user.id, page_type: 'AIBLOG', nickname: '', keyword: displayTitle, settings: settingsToSave
    });

    if (!error) alert("현재 설정이 나만의 템플릿으로 안전하게 저장되었습니다.");
    else alert(`저장 실패: ${error.message}`);
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false);
    const settings = typeof item.settings === 'string' ? JSON.parse(item.settings) : (item.settings || {});

    if (settings.activeTab) setActiveTab(settings.activeTab);
    setKeyword(settings.keyword || ""); setSubKeywords(settings.subKeywords || "");
    setProductName(settings.productName || ""); setFeatures(settings.features || "");
    setOriginalContent(settings.originalContent || ""); setPostPurpose(settings.postPurpose || "설득형(리뷰/공감)");
    setWordCount(settings.wordCount || "1500"); setTargetAudience(settings.targetAudience || "");
    setExtraPrompt(settings.extraPrompt || "");
    setIsFormVisible(true);
  };

  const handleSearchFreeImage = async () => {
    if (!freeImageSearchKeyword.trim()) {
      alert("검색어를 입력해주세요.");
      return;
    }

    setIsSearchingFreeImage(true);
    setVisibleImageCount(10);

    try {
      const freeImgRes = await fetch('/api/free-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: freeImageSearchKeyword }),
      });
      if (freeImgRes.ok) {
        const freeImgData = await freeImgRes.json();
        const uniqueImages = (freeImgData.images || []).filter((url: string, index: number, self: string[]) =>
          index === self.findIndex((t) => extractUniqueId(t) === extractUniqueId(url))
        );
        setResult((prev: any) => ({ ...prev, freeImages: uniqueImages }));
      } else {
        alert("이미지 검색 중 오류가 발생했습니다.");
      }
    } catch (err) {
      console.error("무료 이미지 검색 실패:", err);
      alert("이미지 검색 중 오류가 발생했습니다.");
    } finally {
      setIsSearchingFreeImage(false);
    }
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />

      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        

        <main className="flex-1 ml-64 relative">

          <div className="sticky top-0 z-40 bg-[#f8f9fa] border-b border-gray-300 shadow-sm px-10 pt-8 pb-6 transition-all duration-300 relative">
            <div className="max-w-[1200px] mx-auto">
              <AiTabs />

              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold text-gray-900">AI 블로그 포스팅 생성 & 리뉴얼</h1>
                    <HelpButton
                      href="https://blog.naver.com/lboll/224267680747"
                      tooltip="도움말"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-slate-500">* 타겟 키워드와 상품의 장점만 입력하면, 상위 노출에 최적화된 고품질 정보성 블로그 원고를 AI가 즉시 작성합니다.</p>
                    <p className="text-sm text-indigo-600 font-bold">* GPT-4o(구조 기획)와 Claude 3.5(자연스러운 문장) 듀얼 엔진이 가동됩니다.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => !isSaveDisabled && handleSaveCurrentSetting()} disabled={isSaveDisabled} className={`px-4 py-2 text-sm font-bold text-white rounded-md shadow-sm flex items-center gap-1.5 transition-colors ${isSaveDisabled ? 'bg-slate-400 cursor-not-allowed opacity-60' : 'bg-slate-700 hover:bg-slate-800'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg> 현재 설정 저장
                  </button>
                  <button onClick={() => setIsDrawerOpen(true)} className="px-4 py-2 text-sm font-bold text-white bg-slate-700 rounded-md hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg> 저장된 목록 보기
                  </button>
                </div>
              </div>

              <div className="flex border-b border-gray-300 mb-6">
                <button onClick={() => { setActiveTab("auto"); setIsFormVisible(true); }} className={`px-8 py-3 font-bold text-[15px] transition-colors ${activeTab === "auto" ? "border-b-2 border-indigo-600 !text-indigo-600 bg-white" : "!text-gray-500 hover:text-gray-700 bg-gray-50/50"}`}>[원고 자동 생성]</button>
                {/* 🌟 수정: 리뉴얼 탭 활성화 시 청록색(teal-700) 계열로 변경 */}
                <button onClick={() => { setActiveTab("renewal"); setIsFormVisible(true); }} className={`px-8 py-3 font-bold text-[15px] transition-colors ${activeTab === "renewal" ? "border-b-2 border-teal-700 !text-teal-700 bg-white" : "!text-gray-500 hover:text-gray-700 bg-gray-50/50"}`}>[기존 원고 리뉴얼]</button>
              </div>

              {isFormVisible ? (
                <div className="animate-fadeIn">
                  <div className={`border-[2px] shadow-md rounded-xl p-5 flex flex-col mb-4 ${activeTab === "auto" ? "bg-indigo-50/40 border-indigo-500" : "bg-teal-50/40 border-teal-600"}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-2 shrink-0"><h2 className={`text-[15px] font-extrabold ${activeTab === "auto" ? "text-indigo-900" : "text-teal-900"}`}>{activeTab === "auto" ? "기본 정보 입력" : "리뉴얼 타겟 설정"}</h2></div>
                      <div className={`w-px h-3 shrink-0 ${activeTab === "auto" ? "bg-indigo-300" : "bg-teal-300"}`}></div>
                      <p className={`text-[13px] font-medium ${activeTab === "auto" ? "text-indigo-900/80" : "text-teal-900/80"}`}>{activeTab === "auto" ? "블로그 글의 뼈대가 되는 가장 중요한 정보입니다. '장점/소구점'을 구체적으로 많이 적을수록 글의 퀄리티와 분량이 안정적으로 늘어납니다." : "경쟁사의 좋은 글을 흡수하여, 내 상품을 홍보하는 글로 180도 리뉴얼합니다. 타겟 키워드와 내 상품명을 반드시 적어주세요."}</p>
                    </div>

                    {activeTab === "auto" ? (
                      <div className="flex items-center gap-5">
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="text-[13px] font-bold text-indigo-900 whitespace-nowrap">메인 키워드</label>
                          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="w-40 py-1.5 px-2 border border-indigo-200 rounded outline-none text-[13px] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 bg-white shadow-sm" placeholder="예: 캠핑 의자" />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="text-[13px] font-bold text-indigo-900 whitespace-nowrap">상품명 또는 브랜드</label>
                          <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} className="w-48 py-1.5 px-2 border border-indigo-200 rounded outline-none text-[13px] focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 bg-white shadow-sm" placeholder="예: 코만도몰 릴렉스 체어" />
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <label className="text-[13px] font-bold text-indigo-900 whitespace-nowrap">장점 / 소구점</label>
                          <textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={1} className="w-full py-1.5 px-2 border border-indigo-200 rounded outline-none text-[13px] resize-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 overflow-y-auto max-h-[34px] bg-white shadow-sm" placeholder="예: 1초 폴딩, 150kg 통과" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-5">
                          <div className="flex items-center gap-2 w-1/2">
                            <label className="text-[13px] font-bold text-teal-900 whitespace-nowrap">타겟 메인 키워드</label>
                            <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="w-full py-1.5 px-2 border border-teal-200 rounded outline-none text-[13px] focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white shadow-sm" placeholder="상위노출 목표 키워드 (예: 가족용 텐트 추천)" />
                          </div>
                          <div className="flex items-center gap-2 w-1/2">
                            <label className="text-[13px] font-bold text-teal-900 whitespace-nowrap">내 상품명/브랜드</label>
                            <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full py-1.5 px-2 border border-teal-200 rounded outline-none text-[13px] focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white shadow-sm" placeholder="홍보할 우리 제품명 (예: 코만도몰 텐트)" />
                          </div>
                        </div>
                        <textarea value={originalContent} onChange={(e) => setOriginalContent(e.target.value)} rows={5} className="w-full py-2 px-3 border border-teal-200 rounded-md outline-none text-[13px] resize-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 bg-white shadow-sm overflow-y-auto" placeholder="이곳에 벤치마킹할 타사의 블로그 글이나 뉴스 기사 본문을 통째로 복사하여 붙여넣어 주세요.&#13;&#10;* AI가 원본 글의 뼈대와 정보만 흡수하고, 주인공을 대표님의 상품으로 완벽하게 교체하여 완전히 새로운 글을 작성합니다." />
                      </div>
                    )}
                  </div>

                  <div className="bg-white border-[2px] border-slate-200 shadow-sm rounded-xl p-5 flex flex-col mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <h2 className="text-[15px] font-extrabold text-slate-800 shrink-0">추가 세부 설정</h2>
                      <div className="w-px h-3 bg-gray-300 shrink-0"></div>
                      <p className="text-[13px] text-slate-500 font-medium truncate">
                        상위노출과 전환율을 높이기 위한 디테일 설정입니다. <span className={`font-bold ml-1 ${activeTab === "auto" ? "text-indigo-600" : "text-teal-700"}`}>* 서브 키워드 (3~5개) : SEO 상위노출 퀄리티에 지대한 영향을 줍니다.</span>
                      </p>
                    </div>

                    <div className="flex gap-5 items-stretch">
                      <div className="w-[28%] flex flex-col gap-3 justify-center">
                        <div className="flex items-center gap-2">
                          <label className="text-[13px] font-bold text-slate-700 whitespace-nowrap shrink-0 w-[85px]">서브 키워드</label>
                          <input type="text" value={subKeywords} onChange={(e) => setSubKeywords(e.target.value)} className="w-full py-1.5 px-2 border border-slate-300 rounded outline-none text-[13px] focus:border-slate-500 shadow-sm" placeholder="예: 감성캠핑, 경량의자" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[13px] font-bold text-slate-700 whitespace-nowrap shrink-0 w-[85px]">타겟 고객층</label>
                          <input type="text" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="w-full py-1.5 px-2 border border-slate-300 rounded outline-none text-[13px] focus:border-slate-500 shadow-sm" placeholder="예: 30대 남성" />
                        </div>
                      </div>

                      <div className="w-px bg-slate-200 shrink-0 my-1"></div>

                      <div className="w-[38%] flex flex-col gap-3 justify-center">
                        <div className="flex gap-1 w-full">
                          {['정보성(전문/객관)', '설득형(리뷰/공감)'].map(type => (
                            <button
                              key={type} onClick={() => { setPostPurpose(type); if (type.includes('정보성') && wordCount === '3000') setWordCount('2000'); }}
                              className={`flex-1 h-[32px] flex items-center justify-center text-[12px] font-bold rounded transition-all border tracking-tight px-1
                                  ${postPurpose === type 
                                    ? (activeTab === "auto" ? 'bg-indigo-600 !text-white border-indigo-600 shadow-sm' : 'bg-teal-700 !text-white border-teal-700 shadow-sm') 
                                    : 'bg-white !text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-1 w-full">
                          {[
                            { label: postPurpose.includes('정보성') ? '1,000자 내외' : '1,500자 내외', val: '1500', disabled: false },
                            { label: postPurpose.includes('정보성') ? '1,500자 이상(+20P)' : '2,000자 이상(+20P)', val: '2000', disabled: false },
                            { label: postPurpose.includes('정보성') ? '정보성 분량 제한' : '3,000자 이상(+40P)', val: '3000', disabled: postPurpose.includes('정보성') }
                          ].map(item => (
                            <button
                              key={item.val} onClick={() => !item.disabled && setWordCount(item.val)} disabled={item.disabled}
                              className={`flex-1 h-[32px] flex items-center justify-center text-[11px] font-bold rounded transition-all border tracking-tighter px-1
                                  ${item.disabled ? 'bg-slate-100 !text-slate-400 border-slate-200 cursor-not-allowed opacity-60' :
                                  wordCount === item.val ? 'bg-slate-500 !text-white border-slate-500 shadow-sm' : 'bg-white !text-slate-500 border-slate-300 hover:bg-slate-50'}`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="w-px bg-slate-200 shrink-0 my-1"></div>

                      <div className="flex-1 flex flex-col justify-center">
                        <div className="flex justify-between items-end mb-1.5">
                          <label className="text-[13px] font-bold text-slate-700 leading-none">추가 요청 사항</label>
                          <span className="text-[11px] text-slate-400 leading-none">커스텀 프롬프트</span>
                        </div>
                        <textarea value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} className="w-full h-[65px] py-1.5 px-2 border border-slate-300 rounded outline-none text-[12px] resize-none focus:border-slate-500 shadow-sm overflow-y-auto" placeholder="* 주의 : '딱 한줄로만' 처럼 설정과 충돌되는 요청은 저품질의 원인이 됩니다. 문체를 바꾸거나 피하고 싶은 단어 추가" />
                      </div>
                    </div>
                  </div>

                  {/* 🌟 3단: 순차적 버튼 액션 (크기 및 색상 수정 완료) */}
                  <div className="flex justify-center relative">
                    {result ? (
                      <button onClick={handleGenerate} disabled={isGenerating} className={`px-16 py-3.5 font-bold text-white rounded-md shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-[15px] tracking-wide transition-all mx-auto ${activeTab === 'auto' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-teal-700 hover:bg-teal-800'}`}>
                        {isGenerating ? <><svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 처리 중...</> : <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> 수정된 내용 재생성 (총 {totalPoints}P 소진) </>}
                      </button>
                    ) : (
                      <button onClick={handleGenerate} disabled={isGenerating} className={`px-20 py-3.5 font-bold text-white rounded-md shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-3 text-[15px] tracking-wide mx-auto transition-colors ${activeTab === 'auto' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-teal-700 hover:bg-teal-800'}`}>
                        {isGenerating ? <><svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 처리 중...</> : <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> {activeTab === "auto" ? (!hasGeneratedOnce ? "원고 생성하기" : `새로 다시 작성하기 (${totalPoints}P 소진)`) : (!hasGeneratedOnce ? "원고 리뉴얼하기" : `새로 다시 리뉴얼하기 (${totalPoints}P 소진)`)}</>}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* 🌟 폼이 접힌 상태 (크기 및 색상 수정 완료) */
                <div className="flex justify-center animate-fadeIn mb-6 relative z-10">
                  <button onClick={handleGenerate} disabled={isGenerating} className={`px-10 py-3.5 text-white text-[15px] font-bold rounded-full shadow-md transition-colors flex items-center gap-2 ${activeTab === 'auto' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-teal-700 hover:bg-teal-800'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    수정된 내용 재생성 ({totalPoints}P 소진)
                  </button>
                </div>
              )}

              {/* 중앙 토글 탭(Handle) 영역 */}
              {result && (
                <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-[98%] z-30">
                  <button
                    onClick={() => setIsFormVisible(!isFormVisible)}
                    className="bg-slate-500 hover:bg-slate-600 text-white text-[12px] font-bold px-10 py-1.5 rounded-b-xl shadow-md transition-colors flex items-center gap-1.5 tracking-wide border-t border-slate-600/50"
                  >
                    {isFormVisible ? '입력창 닫기 ▴' : '입력 설정 다시 보기 ▾'}
                  </button>
                </div>
              )}

            </div>
          </div>
          {/* ========================================================= */}

          {/* 하단 스크롤 영역: 결과 출력 */}
          <div className="px-10 pt-12 max-w-[1200px] mx-auto pb-32">
            <div className="w-full min-h-[400px]">
              {isGenerating ? (
                <div className="h-[400px] border-2 border-indigo-100 rounded-xl flex flex-col items-center justify-center bg-white p-10 text-center shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gray-100"><div className={`h-full animate-pulse ${activeTab === 'auto' ? 'bg-indigo-600' : 'bg-teal-600'}`}></div></div>
                  <div className={`w-16 h-16 border-4 border-gray-100 rounded-full animate-spin mb-6 ${activeTab === 'auto' ? 'border-t-indigo-600' : 'border-t-teal-600'}`}></div>
                  {loadingStep === 1 && <h2 className={`text-xl font-bold mb-2 animate-pulse ${activeTab === 'auto' ? 'text-indigo-600' : 'text-teal-600'}`}>1단계: 최적화된 블로그 포스팅 구조 기획 중...</h2>}
                  {loadingStep === 2 && <h2 className="text-xl font-bold text-emerald-600 mb-2 animate-pulse">2단계: 기획안을 바탕으로 본문 원고 작성 중...</h2>}
                  {loadingStep >= 3 && <h2 className="text-xl font-bold text-purple-600 mb-2 animate-pulse">3단계: 문맥 다듬기 및 유사문서 검수 중...</h2>}
                  <p className="text-sm text-gray-500 mt-4 mb-8">선택하신 목표 글자수와 엔진에 따라 최대 1분 정도 소요될 수 있습니다.</p>
                </div>
              ) : !result ? (
                <div className="h-[200px] border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-slate-400 bg-white/50 p-10 text-center">
                  <p className="font-bold text-slate-500 mb-1">상위 노출을 위한 최적의 원고를 만들어 드립니다.</p>
                  <p className="text-sm">위 정보를 입력하고 생성 버튼을 눌러주세요.</p>
                </div>
              ) : (
                <div className="bg-white border-2 border-slate-200 shadow-lg rounded-xl overflow-hidden flex flex-col animate-fadeIn">

                  <div className="p-4 bg-slate-50 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <h2 className="text-sm font-bold text-indigo-600 flex items-center gap-2">✅ 생성 완료</h2>
                      <div className="w-px h-3 bg-gray-300"></div>
                      <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        작성된 블로그 포스팅
                        <span className="text-xs font-normal text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                          공백 포함 {result.content.length}자
                        </span>
                      </h3>
                    </div>
                    <button onClick={copyToClipboard} className="px-5 py-2 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded-md shadow-sm transition-colors flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                      원고 전체 복사
                    </button>
                  </div>

                  <div className="p-8">
                    <div className="p-8 bg-gray-50 border border-gray-200 rounded-xl text-[15px] text-gray-800 leading-[1.8] whitespace-pre-wrap font-medium mb-6">
                      {result.content}
                    </div>

                    <div className="mt-8 mb-8 animate-fadeIn bg-slate-50 rounded-xl p-6 border border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[16px] font-bold text-slate-800 flex items-center gap-2">
                          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          추천 본문 삽화 (무료 제공)
                        </h3>
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <p className="text-[13px] text-slate-500">* 원고 내용에 맞는 이미지를 검색하여 본문에 추가해 보세요. 이미지를 클릭하면 크게 볼 수 있습니다.</p>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={freeImageSearchKeyword}
                            onChange={(e) => setFreeImageSearchKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchFreeImage()}
                            placeholder="검색어 직접 입력..."
                            className="py-1.5 px-3 border border-slate-300 rounded-md outline-none text-[13px] focus:border-indigo-500 w-48 shadow-sm"
                          />
                          <button
                            onClick={handleSearchFreeImage}
                            disabled={isSearchingFreeImage}
                            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-[13px] font-bold rounded-md shadow-sm transition-colors disabled:opacity-50"
                          >
                            {isSearchingFreeImage ? '검색 중...' : '검색'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {result.freeImages && result.freeImages.length > 0 ? (
                          result.freeImages.slice(0, visibleImageCount).map((imgUrl: string, idx: number) => (
                            <div
                              onClick={() => setSelectedImage(imgUrl)}
                              key={`img-${idx}`}
                              className="relative group rounded-lg overflow-hidden border border-gray-200 bg-white aspect-square animate-fadeIn block shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                              title="클릭하여 크게 보기"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imgUrl}
                                alt={`추천 본문 삽화 ${idx + 1}`}
                                className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-110"
                                onError={(e) => { if (e.currentTarget.parentElement) e.currentTarget.parentElement.style.display = 'none'; }}
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-2 backdrop-blur-[1px]">
                                <svg className="w-8 h-8 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                                <span className="text-white text-[12px] font-bold drop-shadow-md">크게 보기</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-full py-10 text-center text-[14px] text-slate-500 border-2 border-dashed border-slate-300 rounded-lg bg-white">
                            검색어와 일치하는 무료 이미지를 찾지 못했습니다. 다른 검색어로 다시 시도해 보세요.
                          </div>
                        )}
                      </div>

                      {result.freeImages && result.freeImages.length > visibleImageCount && (
                        <div className="mt-8 flex justify-center">
                          <button
                            onClick={() => setVisibleImageCount((prev) => prev + 10)}
                            className="!text-slate-800 text-[14px] font-bold hover:!text-indigo-600 flex items-center gap-2 transition-colors px-8 py-2.5 rounded-full bg-white border-2 border-slate-300 hover:border-indigo-400 shadow-sm"
                          >
                            <svg className="w-4 h-4 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            이미지 더 보기
                          </button>
                        </div>
                      )}

                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>
          {/* 🌟🌟🌟 [신규 추가] 이미지 상세보기 모달 🌟🌟🌟 */}
          {selectedImage && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedImage(null)}>
              <div className="bg-white rounded-xl shadow-2xl p-5 max-w-4xl w-[90%] md:w-auto relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>

                {/* 닫기 버튼 (우측 상단 X) */}
                <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 w-10 h-10 bg-black/40 hover:bg-black text-white rounded-full flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                {/* 큰 이미지 */}
                <img src={selectedImage} alt="확대된 이미지" className="max-h-[65vh] object-contain rounded-lg mb-5" />

                <div className="flex flex-col items-center gap-3 w-full">
                  <p className="text-[13.5px] text-slate-600 font-medium bg-slate-100 px-4 py-2.5 rounded-lg w-full text-center">
                    💡 이미지를 블로그에 직접 넣으려면 <strong>마우스 우클릭 → [이미지 복사]</strong>를 선택하세요.
                  </p>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(selectedImage).then(() => {
                          setShowToast(true);
                          setTimeout(() => setShowToast(false), 2500); // 2.5초 뒤에 자동으로 사라짐
                        });
                      }} 
                      className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[14px] font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      이미지 주소 복사
                    </button>
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="flex-1 sm:flex-none px-8 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-[14px] font-bold rounded-lg shadow-sm transition-colors"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* 🌟🌟🌟 모달 끝 🌟🌟🌟 */}

          {/* 🌟🌟🌟 [신규 추가] 세련된 토스트 알림 🌟🌟🌟 */}
          {showToast && (
            <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[200] bg-slate-800/95 backdrop-blur-md text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 animate-fadeIn transition-all">
              <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <span className="text-[14.5px] font-bold tracking-wide">이미지 주소가 복사되었습니다!</span>
            </div>
          )}
          
        </main>
      </div>

      <SavedSearchesDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} pageType="AIBLOG" onSelect={handleApplySavedSetting} />
    </>
  );
}