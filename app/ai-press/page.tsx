"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/app/contexts/AuthContext";
import { usePoint } from "@/app/hooks/usePoint";
import { createClient } from "@/app/utils/supabase/client";
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";

export default function AiPressPage() {
  const { user } = useAuth();
  const { deductPoints } = usePoint();

  const [activeTab, setActiveTab] = useState<'new' | 'renewal'>('new');

  const [docType, setDocType] = useState("보도자료 (언론 배포용)");
  const [companyName, setCompanyName] = useState("");
  const [ceoName, setCeoName] = useState("");
  const [newsTopic, setNewsTopic] = useState("");
  const [details, setDetails] = useState("");

  const [originalText, setOriginalText] = useState("");
  const [renewalRequest, setRenewalRequest] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [isFormVisible, setIsFormVisible] = useState(true);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  
  const [progressMessage, setProgressMessage] = useState("");

  const totalPoints = 50;
  
  const isSaveDisabled = activeTab === 'new' 
    ? !user || !companyName.trim() || !newsTopic.trim() || !details.trim()
    : !user || !companyName.trim() || !originalText.trim() || !renewalRequest.trim();

  // 🌟 [추가됨] 탭 전환 시 데이터를 깔끔하게 초기화하는 함수
  const handleTabSwitch = (targetTab: 'new' | 'renewal') => {
    if (activeTab !== targetTab) {
      // 다른 탭으로 넘어갈 때 모든 입력값과 상태를 디폴트로 리셋합니다.
      setDocType("보도자료 (언론 배포용)");
      setCompanyName("");
      setCeoName("");
      setNewsTopic("");
      setDetails("");
      setOriginalText("");
      setRenewalRequest("");
      setResult(null);             // 띄워져 있던 결과 화면 닫기
      setHasGeneratedOnce(false);  // 하단 버튼 텍스트 초기화
    }
    setActiveTab(targetTab);
    setIsFormVisible(true);
  };

  const handleSaveCurrentSetting = async () => {
    if (!user) return alert('로그인 정보가 만료되었습니다. 다시 로그인해주세요.');
    const settingsToSave = { activeTab, docType, companyName, ceoName, newsTopic, details, originalText, renewalRequest };
    const displayTitle = activeTab === 'new' 
      ? `[${docType}/신규] ${companyName} - ${newsTopic.substring(0, 15)}`
      : `[${docType}/리뉴얼] ${companyName} - ${renewalRequest.substring(0, 15)}`;
      
    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user.id, page_type: 'AI_PRESS', nickname: '', keyword: displayTitle, settings: settingsToSave
    });
    if (!error) alert("현재 설정이 안전하게 저장되었습니다.");
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false);
    setIsFormVisible(true);
    const settings = typeof item.settings === 'string' ? JSON.parse(item.settings) : (item.settings || {});
    
    setActiveTab(settings.activeTab || 'new');
    if (settings.docType) setDocType(settings.docType);
    setCompanyName(settings.companyName || ""); 
    setCeoName(settings.ceoName || "");
    setNewsTopic(settings.newsTopic || ""); 
    setDetails(settings.details || "");
    setOriginalText(settings.originalText || "");
    setRenewalRequest(settings.renewalRequest || "");
  };

  const handleGenerate = async () => {
    if (activeTab === 'new') {
      if (!companyName.trim() || !newsTopic.trim() || !details.trim()) {
        return alert("기업명, 핵심 주제, 상세 내용을 모두 입력해 주세요.");
      }
    } else {
      if (!companyName.trim() || !originalText.trim() || !renewalRequest.trim()) {
        return alert("기업명, 참고/원본 기사, 리뉴얼 요청 사항을 모두 입력해 주세요.");
      }
    }

    if (!user) return alert("로그인이 필요한 서비스입니다.");

    if (deductPoints) {
      const isPaySuccess = await deductPoints(user.id, totalPoints, 1, `AI ${docType} 작성 (${activeTab === 'new' ? '신규' : '리뉴얼'})`);
      if (!isPaySuccess) return;
    }

    setIsGenerating(true);

    const stageMessages = [
      "1단계 : 기사 구조 및 방향 기획 중...",
      "2단계 : 핵심 내용 초안 작성 중...",
      "3단계 : 전문 톤앤매너 적용 중...",
      "4단계 : 문맥 및 오탈자 최종 검수 중..."
    ];
    
    let currentStage = 0;
    setProgressMessage(stageMessages[0]);

    const intervalId = setInterval(() => {
      currentStage++;
      if (currentStage < stageMessages.length) {
        setProgressMessage(stageMessages[currentStage]);
      }
    }, 4000); 

    try {
      const today = new Date();
      const currentDateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

      let payloadNewsTopic = newsTopic;
      let payloadDetails = `[참고: 현재 작성일자는 ${currentDateStr}입니다. 기사 서두에 배포일이 들어간다면 반드시 이 날짜를 기준으로 작성하세요.]\n\n${details}`;

      if (activeTab === 'renewal') {
        payloadNewsTopic = "[리뉴얼] 기존 기사/자료 기반 재작성";
        payloadDetails = `[참고: 현재 작성일자는 ${currentDateStr}입니다. 기사 서두에 배포일이 들어간다면 반드시 이 날짜를 기준으로 작성하세요.]\n\n[원본/참고 기사 내용]\n${originalText}\n\n[리뉴얼 변경/추가 요청사항]\n${renewalRequest}`;
      }

      const response = await fetch('/api/ai-press', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          docType, 
          companyName, 
          ceoName, 
          newsTopic: payloadNewsTopic, 
          details: payloadDetails 
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '글 생성에 실패했습니다.');

      setResult({ content: data.content });
      
      setHasGeneratedOnce(true);
      setIsFormVisible(false);

      try {
        const supabase = createClient();
        const historyKeyword = activeTab === 'new' 
          ? `[${docType}/신규] ${companyName} - ${newsTopic.substring(0, 15)}`
          : `[${docType}/리뉴얼] ${companyName} - ${renewalRequest.substring(0, 15)}`;
        await supabase.from('search_history').insert({
          user_id: user.id, menu_name: 'AI 언론 보도자료', keyword: historyKeyword
        });
      } catch (err) { console.error("히스토리 에러:", err); }
      
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
    } catch (error: any) {
      alert(error.message);
    } finally {
      clearInterval(intervalId);
      setIsGenerating(false);
    }
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        <Sidebar />
        <main className="flex-1 ml-64 relative">
          <div className="sticky top-0 z-40 bg-[#f8f9fa] border-b border-gray-300 shadow-sm px-10 pt-8 pb-6 transition-all duration-300">
            <div className="max-w-[1200px] mx-auto">
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">AI 언론 보도자료 / 기사 / 칼럼 작성</h1>
                  <div className="space-y-1">
                    <p className="text-sm text-slate-500">* 기업의 새로운 소식, 신제품 출시, 이벤트 등을 전문적인 기사 형식으로 완벽하게 작성합니다.</p>
                    <p className="text-sm text-indigo-600 font-bold">* 기자들이 선호하는 객관적이고 신뢰감 있는 톤앤매너가 자동 적용됩니다.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => !isSaveDisabled && handleSaveCurrentSetting()} disabled={isSaveDisabled} className={`px-4 py-2 text-sm font-bold !text-white rounded-md shadow-sm flex items-center gap-1.5 transition-colors ${isSaveDisabled ? 'bg-slate-400 cursor-not-allowed opacity-60' : 'bg-slate-700 hover:bg-slate-800'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg> 현재 설정 저장
                  </button>
                  <button onClick={() => setIsDrawerOpen(true)} className="px-4 py-2 text-sm font-bold !text-white bg-slate-700 rounded-md hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg> 저장된 목록 보기
                  </button>
                </div>
              </div>

              <div className="flex border-b border-gray-300 mb-6 mt-4">
                {/* 🌟 탭 클릭 시 handleTabSwitch 함수 호출 적용 */}
                <button
                  onClick={() => handleTabSwitch('new')}
                  className={`py-3 px-8 text-[15px] font-extrabold transition-colors border-b-[3px] -mb-[1.5px] ${activeTab === 'new' ? 'border-indigo-600 !text-indigo-700' : 'border-transparent !text-gray-500 hover:!text-gray-700'}`}
                >
                  [신규 보도자료 작성]
                </button>
                <button
                  onClick={() => handleTabSwitch('renewal')}
                  className={`py-3 px-8 text-[15px] font-extrabold transition-colors border-b-[3px] -mb-[1.5px] ${activeTab === 'renewal' ? 'border-teal-600 !text-teal-600' : 'border-transparent !text-gray-500 hover:!text-gray-700'}`}
                >
                  [기존 보도자료 리뉴얼]
                </button>
              </div>

              {isFormVisible ? (
                <>
                  <div className="bg-white border-[1px] border-slate-200 shadow-sm rounded-xl p-6 flex flex-col mb-6 animate-fadeIn">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex items-center gap-2 shrink-0">
                        <h2 className="text-[15px] font-extrabold text-slate-800">
                          {activeTab === 'new' ? '핵심 정보 입력 (신규)' : '원본 및 요청 사항 입력 (리뉴얼)'}
                        </h2>
                      </div>
                      <div className="w-px h-3 shrink-0 bg-slate-300"></div>
                      <p className="text-[13px] font-medium text-slate-500">
                        {activeTab === 'new' 
                          ? '작성할 글의 종류와 육하원칙이 될 정보들을 나열해 주세요.' 
                          : '벤치마킹할 타사 기사나 업데이트할 과거 기사를 넣고, 변경할 내용을 지시해 주세요.'}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      
                      <div className="flex items-center gap-3">
                        <label className="text-[13px] font-bold text-slate-700 w-[150px] shrink-0">작성 형태 선택</label>
                        <div className="flex gap-2">
                          {['보도자료 (언론 배포용)', '뉴스 기사 (객관적 보도)', '전문 칼럼 (오피니언)'].map(type => {
                            const activeColor = activeTab === 'new' ? 'bg-indigo-600 !text-white border-indigo-600' : 'bg-teal-700 !text-white border-teal-700';
                            return (
                              <button key={type} onClick={() => setDocType(type)} className={`px-5 py-2.5 text-[13px] font-bold rounded-md transition-all border shadow-sm ${docType === type ? activeColor : 'bg-white !text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
                                {type}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-[13px] font-bold text-slate-700 w-[150px] shrink-0">우리 기업 / 브랜드</label>
                        <div className="flex items-center gap-4 flex-1">
                          <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={`flex-1 py-2.5 px-3 border border-slate-200 rounded-md outline-none text-[13px] bg-white shadow-sm transition-colors ${activeTab === 'new' ? 'focus:border-indigo-500' : 'focus:border-teal-600'}`} placeholder="예: 주식회사 TMG" />
                          <label className="text-[13px] font-bold text-slate-700 shrink-0">우리 대표 / 기고자 (선택)</label>
                          <input type="text" value={ceoName} onChange={(e) => setCeoName(e.target.value)} className={`flex-1 py-2.5 px-3 border border-slate-200 rounded-md outline-none text-[13px] bg-white shadow-sm transition-colors ${activeTab === 'new' ? 'focus:border-indigo-500' : 'focus:border-teal-600'}`} placeholder="예: 홍길동" />
                        </div>
                      </div>

                      {activeTab === 'new' ? (
                        <>
                          <div className="flex items-center gap-3">
                            <label className="text-[13px] font-bold text-slate-700 w-[150px] shrink-0">핵심 주제 (헤드라인용)</label>
                            <input type="text" value={newsTopic} onChange={(e) => setNewsTopic(e.target.value)} className="flex-1 py-2.5 px-3 border border-slate-200 rounded-md outline-none text-[13px] focus:border-indigo-500 bg-white shadow-sm" placeholder="예: 혁신적인 주머니 속의 노트 'Note T' 정식 출시" />
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="w-[150px] shrink-0 mt-2 flex flex-col gap-0.5">
                              <label className="text-[13px] font-bold text-slate-700">특징 / 장점 (Point)</label>
                              <span className="text-[11px] text-slate-400 italic">* 쉼표(,), 엔터로 구분 가능</span>
                            </div>
                            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={6} className="flex-1 py-3 px-3 border border-slate-200 rounded-md outline-none text-[13px] resize-none focus:border-indigo-500 bg-white shadow-sm leading-relaxed" placeholder={"예:\n에버노트의 대체, 기존의 에버노트 데이터 업로드 기능\n구글 로그인, 구글 캘린더 완벽 연동, 구글 드라이브 완벽 연동\n노트 내 파일 저장 기능 (자신의 드라이브에 저장)\n구글 공식 승인된 안전한 API 방식 연동"} />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start gap-3">
                            <label className="text-[13px] font-bold text-slate-700 w-[150px] shrink-0 mt-2">참고 / 원본 원고</label>
                            <textarea value={originalText} onChange={(e) => setOriginalText(e.target.value)} rows={5} className="flex-1 py-3 px-3 border border-slate-200 rounded-md outline-none text-[13px] resize-none focus:border-teal-600 bg-white shadow-sm leading-relaxed" placeholder="벤치마킹할 타사의 기사나, 업데이트하고 싶은 자사의 과거 기사 전문을 그대로 복사해서 붙여넣어 주세요." />
                          </div>

                          <div className="flex items-start gap-3">
                            <label className="text-[13px] font-bold text-slate-700 w-[150px] shrink-0 mt-2">리뉴얼 요청 사항</label>
                            <textarea value={renewalRequest} onChange={(e) => setRenewalRequest(e.target.value)} rows={3} className="flex-1 py-3 px-3 border border-slate-200 rounded-md outline-none text-[13px] resize-none focus:border-teal-600 bg-white shadow-sm leading-relaxed" placeholder="예: '경쟁사 A의 이름을 우리 회사로 바꿔주세요', '기존 내용에 새로운 기능 2가지를 추가해서 더 풍성하게 써주세요' 등 원하는 변경 포인트를 적어주세요." />
                          </div>
                        </>
                      )}

                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button 
                      onClick={handleGenerate} 
                      disabled={isGenerating} 
                      className={`w-[350px] py-4 font-bold !text-white rounded-md shadow-md disabled:opacity-70 flex justify-center items-center gap-3 text-[15px] transition-all ${activeTab === 'new' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-teal-700 hover:bg-teal-800'}`}
                    >
                      {isGenerating ? (
                        <span className="flex items-center gap-3">
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {progressMessage}
                        </span>
                      ) : (
                        !hasGeneratedOnce 
                            ? `전문가용 ${docType} ${activeTab === 'new' ? '작성하기' : '리뉴얼'}` 
                            : `새로 다시 ${activeTab === 'new' ? '작성하기' : '리뉴얼하기'} (${totalPoints}P 소진)`
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex justify-center mt-2 mb-2 animate-fadeIn">
                   <button 
                     onClick={() => setIsFormVisible(true)} 
                     className={`px-8 py-3 bg-white border border-slate-200 font-extrabold rounded-full shadow-sm hover:bg-slate-50 hover:shadow-md transition-all flex items-center gap-2 text-[14px] ${activeTab === 'new' ? '!text-indigo-700' : '!text-teal-700'}`}
                   >
                     설정 수정 및 새로운 기사 {activeTab === 'new' ? '작성하기' : '리뉴얼하기'}
                   </button>
                </div>
              )}

            </div>
          </div>

          <div className="px-10 pt-8 max-w-[1200px] mx-auto pb-32">
            {result && (
              <div className="bg-white border-2 border-slate-200 shadow-lg rounded-xl overflow-hidden flex flex-col animate-fadeIn">
                 <div className="p-4 bg-slate-50 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-indigo-600 flex items-center gap-2">
                      ✅ {docType} {activeTab === 'new' ? '작성 완료' : '리뉴얼 완료'}
                      <span className="text-slate-500 font-medium text-[12px] bg-slate-200/50 px-2 py-0.5 rounded-md">
                        공백 포함 {result.content.length.toLocaleString()}자
                      </span>
                    </h2>
                    <button onClick={() => { navigator.clipboard.writeText(result.content); alert('복사되었습니다.'); }} className="px-4 py-1.5 bg-slate-800 hover:bg-black !text-white text-xs font-bold rounded-md transition-colors">
                      전체 복사
                    </button>
                 </div>
                 <div className="p-8 text-[15px] text-gray-800 leading-[1.8] whitespace-pre-wrap font-medium">
                    {result.content}
                 </div>
              </div>
            )}
          </div>
        </main>
      </div>
      <SavedSearchesDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} pageType="AI_PRESS" onSelect={handleApplySavedSetting} />
    </>
  );
}