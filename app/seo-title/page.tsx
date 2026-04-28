'use client';

import { useState, Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import SellerTabs from '@/components/SellerTabs';
import { useAuth } from '@/app/contexts/AuthContext';
import { usePoint } from '@/app/hooks/usePoint';
import { createClient } from '@/app/utils/supabase/client';
import SavedSearchesDrawer from '@/components/SavedSearchesDrawer';

interface TagType {
    word: string;
    isBanned: boolean;
}

interface CategoryStat {
    path: string;
    percentage: number;
}

interface GeneratedTitle {
    title: string;
    pattern: string;
}

function SeoTitleContent() {
    const { user, isLoading } = useAuth();
    const { deductPoints } = usePoint();

    // 입력 상태
    const [keyword, setKeyword] = useState(''); // Step 1
    const [productName, setProductName] = useState(''); // Step 2
    const [attribute, setAttribute] = useState(''); // Step 2
    const [excludeKeyword, setExcludeKeyword] = useState(''); // Step 2

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isCombining, setIsCombining] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const [isAiProcessing, setIsAiProcessing] = useState(false);
    // 🌟 어뷰징 방지를 위한 쿨타임 상태 추가
    const [isCooldown, setIsCooldown] = useState(false); 

    const [aiTags, setAiTags] = useState<string[]>([]);
    const [aiRefinedTitles, setAiRefinedTitles] = useState<string[]>([]);

    const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
    const [top40Titles, setTop40Titles] = useState<string[]>([]);
    const [visibleTitleCount, setVisibleTitleCount] = useState(10);
    const [initialTags, setInitialTags] = useState<TagType[]>([]);

    const [recommendedTags, setRecommendedTags] = useState<TagType[]>([]);
    const [results, setResults] = useState<GeneratedTitle[]>([]);

    const [analyzedKeyword, setAnalyzedKeyword] = useState('');
    const [analyzedProductName, setAnalyzedProductName] = useState('');
    const [analyzedAttribute, setAnalyzedAttribute] = useState('');
    const [combinedExcludeKeyword, setCombinedExcludeKeyword] = useState('');

    // [기능 1] Step 1: 핵심 품목명으로 시장 데이터 분석
    const handleAnalyze = async (overrideKeyword?: string) => {
        const kwToSearch = overrideKeyword !== undefined ? overrideKeyword : keyword;
        if (!kwToSearch.trim()) return alert("핵심 품목명을 입력해주세요.");

        const isPaySuccess = await deductPoints(user?.id, 10, 1, kwToSearch);
        if (!isPaySuccess) return;

        setIsAnalyzing(true);
        setCategoryStats([]);
        setTop40Titles([]);
        setVisibleTitleCount(10);
        setInitialTags([]);
        setResults([]);
        setRecommendedTags([]);
        setExcludeKeyword('');
        setAiTags([]);
        setAiRefinedTitles([]);

        try {
            const res = await fetch('/api/seo-title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword: kwToSearch.trim(),
                    productName: '', 
                    excludeKeyword: ''
                })
            });
            const data = await res.json();
            if (data.success) {
                setCategoryStats(data.categoryStats);
                setTop40Titles(data.top40Titles || []);
                setInitialTags(data.tags);
                setAnalyzedKeyword(kwToSearch.trim());
            } else {
                alert(data.message || '데이터 분석 중 오류가 발생했습니다.');
            }
        } catch (err) {
            console.error(err);
            alert('서버 통신 중 오류가 발생했습니다.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // [기능 2] Step 2: 내 정보(브랜드, 사양, 제외키워드) 섞어서 조합
    const handleCombine = async () => {
        setIsCombining(true);
        setResults([]);
        setRecommendedTags([]);
        setAiTags([]);
        setAiRefinedTitles([]);

        try {
            const res = await fetch('/api/seo-title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword: analyzedKeyword,
                    productName: productName.trim(),
                    attribute: attribute.trim(),    
                    excludeKeyword: excludeKeyword.trim()
                })
            });
            const data = await res.json();
            if (data.success) {
                setRecommendedTags(data.tags);
                setResults(data.titles);
                setCombinedExcludeKeyword(excludeKeyword.trim());
                setAnalyzedProductName(productName.trim()); 
                setAnalyzedAttribute(attribute.trim());     
            } else {
                alert(data.message || '데이터 조합 중 오류가 발생했습니다.');
            }
        } catch (err) {
            console.error(err);
            alert('서버 통신 중 오류가 발생했습니다.');
        } finally {
            setIsCombining(false);
        }
    };

    const handleAiRefine = async () => {
        if (results.length === 0 || isCooldown) return;
        
        // 🌟 1P 차감 로직 완벽히 제거
        // const isPaySuccess = await deductPoints(user?.id, 1, 1, 'AI_REFINE_' + analyzedKeyword);
        // if (!isPaySuccess) return;

        setIsAiProcessing(true);
        setIsCooldown(true); // 🌟 무한 클릭 방지 (쿨타임 시작)

        try {
            const titlesToSend = results.slice(0, 10).map(r => r.title);
            const res = await fetch('/api/refine-title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword: analyzedKeyword,
                    productName: analyzedProductName, 
                    attribute: analyzedAttribute,     
                    titles: titlesToSend
                })
            });
            const data = await res.json();
            if (data.success) {
                setAiTags(data.aiResult.tags);
                setAiRefinedTitles(data.aiResult.refinedTitles);
            } else {
                alert(data.message || 'AI 처리에 실패했습니다.');
            }
        } catch (error) {
            console.error(error);
            alert('서버 통신 오류가 발생했습니다.');
        } finally {
            setIsAiProcessing(false);
            // 🌟 5초 후 다시 누를 수 있도록 쿨타임 해제
            setTimeout(() => {
                setIsCooldown(false);
            }, 5000); 
        }
    };

    const handleAddExcludeKeyword = (word: string) => {
        setExcludeKeyword(prev => {
            const currentList = prev.split(',').map(k => k.trim()).filter(k => k !== '');
            if (!currentList.includes(word)) {
                currentList.push(word);
                return currentList.join(', ');
            }
            return prev;
        });
    };

    const highlightKeywords = (text: string, tags: TagType[]) => {
        if (!tags || tags.length === 0) return text;
        const keywords = tags.map(t => t.word).sort((a, b) => b.length - a.length);
        const safeKeywords = keywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(${safeKeywords.join('|')})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) => {
            const isMatch = keywords.some(kw => kw.toLowerCase() === part.toLowerCase());
            if (isMatch) {
                return (
                    <span key={i} onClick={() => handleAddExcludeKeyword(part)} className="!text-[#5244e8] font-extrabold cursor-pointer hover:underline hover:!text-red-500 transition-colors" title="클릭 시 제외 키워드에 추가됩니다">
                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    const handleSaveCurrentSetting = async () => {
        if (!keyword.trim()) return alert("저장할 핵심 품목명을 입력해주세요.");
        const supabase = createClient();
        const { error } = await supabase.from('saved_searches').insert({
            user_id: user?.id, page_type: 'SEO_TITLE', keyword: keyword.trim(), nickname: ''
        });
        if (!error) alert("현재 설정이 저장되었습니다.");
        else alert("저장 중 오류가 발생했습니다.");
    };

    const handleApplySavedSetting = (item: any) => {
        setIsDrawerOpen(false);
        setKeyword(item.keyword);
        handleAnalyze(item.keyword);
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('복사되었습니다!\n스마트스토어에 붙여넣기 하세요.');
    };

    const isStep1Completed = top40Titles.length > 0 && keyword.trim() === analyzedKeyword;
    const isStep2Completed = results.length > 0 && excludeKeyword.trim() === combinedExcludeKeyword;

    if (isLoading) return <div className="min-h-[50vh] flex items-center justify-center font-bold !text-slate-500">권한 확인 중...</div>;
    if (!user) return null;

    return (
        <>
            <SellerTabs />
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-2xl font-bold !text-black mb-2">쇼핑 상품명 최적화</h1>
                    <p className="text-sm !text-slate-500 mt-1 leading-relaxed">네이버 쇼핑 로직에 최적화된 상품명을 조립하고 AI로 완벽하게 다듬어줍니다.</p>
                </div>
                <div className="flex items-center gap-2 mt-1 shrink-0">
                    <button onClick={handleSaveCurrentSetting} disabled={!keyword.trim()} className={`px-4 py-2 text-sm font-bold !text-white rounded-md shadow-sm transition-colors ${!keyword.trim() ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-800'}`}>현재 설정 저장</button>
                    <button onClick={() => setIsDrawerOpen(true)} className="px-4 py-2 text-sm font-bold !text-white bg-slate-700 rounded-md hover:bg-slate-800 transition-colors shadow-sm">저장된 목록 보기</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                <div className="flex flex-col gap-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm w-full">
                        <label className="block text-[14px] font-black !text-gray-800 mb-4">Step 1. 시장 데이터 분석</label>
                        <div className="flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="block text-[13px] font-bold !text-gray-700 mb-2">핵심 품목명 <span className="!text-red-500 font-bold">(1개만 입력)</span></label>
                                <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="예: 캠핑랜턴" onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#5244e8] transition-colors text-sm font-medium !text-black" />
                            </div>
                            <div className="w-32 shrink-0 h-[46px]">
                                {isAnalyzing ? (
                                    <button disabled className="w-full h-full px-4 bg-gray-400 !text-white font-bold rounded-md flex items-center justify-center gap-2 cursor-wait">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>분석 중
                                    </button>
                                ) : (
                                    <button onClick={() => handleAnalyze()} disabled={isAnalyzing} className={`w-full h-full px-4 !text-white font-bold rounded-md transition-colors shadow-sm ${isStep1Completed ? 'bg-slate-700 hover:bg-slate-800' : 'bg-[#5244e8] hover:bg-blue-700'}`}>
                                        {isStep1Completed ? '분석 완료' : '검색 및 분석'}
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="text-[11px] !text-gray-500 mt-3 font-bold">* 상위 40개 상품 데이터를 수집합니다. (10P)</p>
                    </div>

                    {!isAnalyzing && top40Titles.length === 0 && (
                        <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200 text-center w-full min-h-[300px] flex flex-col items-center justify-center">
                            <h3 className="text-lg font-bold !text-gray-700 mb-2">핵심 품목명을 입력하고 [검색 및 분석] 버튼을 눌러주세요.</h3>
                            <p className="text-sm !text-gray-500">실제 상위 노출 판매자들의 데이터 분석이 먼저 진행됩니다.</p>
                        </div>
                    )}
                    {top40Titles.length > 0 && (
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-[#5244e8] flex flex-col gap-6 w-full animate-in fade-in">
                            {categoryStats.length > 0 && (
                                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-md">
                                    <div className="font-extrabold !text-emerald-800 text-[15px] mb-3">상위 40개 상품 카테고리 점유율 분석</div>
                                    <div className="flex flex-col gap-2">
                                        {categoryStats.map((cat, idx) => (
                                            <div key={idx} className="flex items-center gap-3 text-[14px] !text-gray-800">
                                                <span className="bg-white px-3 py-1.5 rounded border border-emerald-100 shadow-sm font-medium">{cat.path}</span>
                                                <span className={`font-bold ${idx === 0 ? '!text-red-500 text-[15px]' : '!text-emerald-600'}`}>{cat.percentage}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <h3 className="text-[16px] font-bold !text-gray-900 mb-4">실제 상위 노출 상품명 리스트 (키워드 분석)</h3>
                                <div className="space-y-2.5">
                                    {top40Titles.slice(0, visibleTitleCount).map((title, i) => (
                                        <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-md text-[14px] flex items-center">
                                            <span className="font-bold !text-gray-400 mr-3 min-w-[30px]">{i + 1}위</span>
                                            <div className="flex-1 font-bold !text-gray-800">{highlightKeywords(title, initialTags)}<span className="ml-2 text-[12px] !text-red-500 font-bold">({title.length}자)</span></div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 mt-3">
                                    {visibleTitleCount < top40Titles.length && (
                                        <button onClick={() => setVisibleTitleCount(prev => Math.min(prev + 10, top40Titles.length))} className="flex-1 py-2.5 bg-gray-50 border border-gray-200 font-bold !text-gray-600 text-[13px] rounded-md hover:bg-gray-100 transition-colors">
                                            + 10개 더보기
                                        </button>
                                    )}
                                    {visibleTitleCount > 10 && (
                                        <button onClick={() => setVisibleTitleCount(10)} className="flex-1 py-2.5 bg-white border border-gray-200 font-bold !text-gray-500 text-[13px] rounded-md hover:bg-gray-50 transition-colors">
                                            - 접기 (최초 10개)
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-6">
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm w-full">
                        <label className="block text-[14px] font-black !text-gray-800 mb-4">Step 2. 내 상품 정보 조합 및 필터링</label>
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-[13px] font-bold !text-gray-700 mb-2">브랜드/상품명 <span className="!text-blue-500 font-bold">(필수 권장)</span></label>
                                    <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="예: 코만도빔" onKeyDown={(e) => e.key === 'Enter' && handleCombine()} className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-[#5244e8] transition-colors text-sm font-medium !text-black shadow-sm" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[13px] font-bold !text-gray-700 mb-2">속성/사양 <span className="!text-slate-400 font-normal">(선택)</span></label>
                                    <input type="text" value={attribute} onChange={(e) => setAttribute(e.target.value)} placeholder="예: 10000mAh, 블랙, C타입" onKeyDown={(e) => e.key === 'Enter' && handleCombine()} className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-[#5244e8] transition-colors text-sm font-medium !text-black shadow-sm" />
                                </div>
                            </div>
                            <div className="flex gap-3 items-end">
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-[13px] font-bold !text-gray-700">제외 키워드 <span className="!text-red-500 font-bold">(타사 브랜드)</span></label>
                                        <span className="text-[12px] font-bold !text-slate-500">※ 좌측 리스트에서 단어 클릭</span>
                                    </div>
                                    <input type="text" value={excludeKeyword} onChange={(e) => setExcludeKeyword(e.target.value)} placeholder="제외할 단어를 입력하거나 좌측에서 클릭하세요" onKeyDown={(e) => e.key === 'Enter' && handleCombine()} className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-[#5244e8] text-sm font-medium shadow-sm !text-black" />
                                </div>
                                <button onClick={() => handleCombine()} disabled={isCombining || top40Titles.length === 0} className={`w-32 h-[46px] !text-white font-bold rounded-md shadow-sm transition-colors ${top40Titles.length === 0 ? 'bg-slate-300 cursor-not-allowed' : isStep2Completed ? 'bg-slate-700 hover:bg-slate-800' : 'bg-[#5244e8] hover:bg-blue-700'}`}>
                                    {isCombining ? '조합 중...' : isStep2Completed ? '조합 완료' : '적용&조합'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {results.length > 0 && (
                        <>
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in fade-in">
                                <h3 className="text-[15px] font-black !text-gray-800 mb-4">기본 추천 리스트 (기계적 조합)</h3>
                                <div className="space-y-2">
                                    {results.map((item, i) => (
                                        <div key={i} className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[14px] flex items-center group hover:border-[#5244e8] transition-colors">
                                            <span className="font-bold !text-slate-500 whitespace-nowrap">{item.pattern}</span>
                                            <span className="mx-2 !text-gray-300">|</span>
                                            <span className="font-bold !text-gray-800 flex-1 truncate">{item.title}</span>
                                            <span className="ml-2 text-[13px] font-bold !text-red-500 whitespace-nowrap">({item.title.length}자)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 🌟 텍스트 변경 및 쿨타임 시 스타일 변경 */}
                            <button 
                                onClick={handleAiRefine} 
                                disabled={isAiProcessing || isCooldown} 
                                className={`w-full !text-white font-extrabold py-4 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform ${isCooldown ? 'bg-slate-400 cursor-not-allowed scale-100' : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 hover:-translate-y-0.5'}`}
                            >
                                {isAiProcessing ? '마케팅 AI가 분석 중...' : isCooldown ? 'AI 결과를 확인하세요 (재요청 대기)' : 'AI 프리미엄 문맥 다듬기 & 핵심 태그 추출 (무료)'}
                            </button>

                            {(aiTags.length > 0 || aiRefinedTitles.length > 0) && (
                                <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-200 shadow-inner relative overflow-hidden animate-in fade-in">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-indigo-600"></div>

                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-[15px] font-black !text-indigo-900">OpenAI 추천 태그</span>
                                        <button onClick={() => handleCopy(aiTags.join(','))} className="px-3 py-1.5 text-xs font-extrabold !text-white bg-indigo-600 rounded shadow-sm hover:bg-indigo-700 transition-all">
                                            태그 복사
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {aiTags.map((tag, i) => (
                                            <span key={i} className="px-3 py-1.5 rounded-full text-[13px] font-bold bg-white !text-indigo-700 border border-indigo-200 shadow-sm">#{tag}</span>
                                        ))}
                                    </div>

                                    <span className="text-[15px] font-black !text-indigo-900 mb-4 block">OpenAI 추천 상품명</span>
                                    <div className="space-y-3">
                                        {aiRefinedTitles.map((title, i) => (
                                            <div key={i} className="flex flex-col bg-white p-3 rounded-lg border border-indigo-100 shadow-sm hover:border-indigo-400 transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[12px] font-bold !text-indigo-400">AI 추천 {i + 1}</span>
                                                    <button onClick={() => handleCopy(title)} className="text-[11px] px-2.5 py-1 font-extrabold !text-indigo-700 bg-indigo-50 border border-indigo-200 rounded shadow-sm hover:bg-indigo-600 hover:!text-white hover:border-indigo-600 transition-all">
                                                        복사
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <span className="font-bold !text-gray-800 text-[14.5px] pr-2 leading-tight">{title}</span>
                                                    <span className="text-[12px] font-bold !text-red-500 shrink-0">{title.length}자</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <SavedSearchesDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} pageType="SEO_TITLE" onSelect={handleApplySavedSetting} />
        </>
    );
}

export default function SeoTitlePage() {
    return (
        <>
            <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
            <div className="flex min-h-screen bg-[#f8f9fa] !text-black antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
                
                <main className="flex-1 ml-64 p-10 relative">
                    <div className="max-w-7xl mx-auto">
                        <Suspense fallback={<div className="p-10 text-center text-gray-500 font-bold">로딩 중...</div>}>
                            <SeoTitleContent />
                        </Suspense>
                    </div>
                </main>
            </div>
        </>
    );
}