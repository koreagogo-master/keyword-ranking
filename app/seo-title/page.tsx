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
    const [productName, setProductName] = useState('');
    const [keyword, setKeyword] = useState('');
    const [excludeKeyword, setExcludeKeyword] = useState('');

    // 로딩 및 서랍장 상태
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isCombining, setIsCombining] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // [STEP 1] 분석 결과 데이터
    const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
    const [top40Titles, setTop40Titles] = useState<string[]>([]);
    const [visibleTitleCount, setVisibleTitleCount] = useState(10);
    const [initialTags, setInitialTags] = useState<TagType[]>([]);

    // [STEP 2] 조합 결과 데이터
    const [recommendedTags, setRecommendedTags] = useState<TagType[]>([]);
    const [results, setResults] = useState<GeneratedTitle[]>([]);

    // 버튼 상태 리셋을 위한 검색 기록 감시
    const [analyzedKeyword, setAnalyzedKeyword] = useState('');
    const [analyzedProductName, setAnalyzedProductName] = useState('');
    const [combinedExcludeKeyword, setCombinedExcludeKeyword] = useState('');

    // [기능 1] 1단계: 검색 및 분석 (포인트 차감 발생)
    const handleAnalyze = async (overrideKeyword?: string) => {
        const kwToSearch = overrideKeyword !== undefined ? overrideKeyword : keyword;

        if (!kwToSearch.trim()) {
            alert("핵심 품목명을 입력해주세요.");
            return;
        }

        const isPaySuccess = await deductPoints(user?.id, 10, 1, kwToSearch);
        if (!isPaySuccess) return;

        setIsAnalyzing(true);
        // 결과 초기화 (버튼을 누를 때만 초기화됩니다)
        setCategoryStats([]);
        setTop40Titles([]);
        setVisibleTitleCount(10);
        setInitialTags([]);
        setResults([]);
        setRecommendedTags([]);
        setExcludeKeyword('');

        try {
            const res = await fetch('/api/seo-title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    keyword: kwToSearch.trim(),
                    productName: productName.trim(),
                    excludeKeyword: '' // 분석 단계에서는 제외 키워드 없이 전체를 가져옵니다.
                })
            });

            const data = await res.json();

            if (data.success) {
                setCategoryStats(data.categoryStats);
                setTop40Titles(data.top40Titles || []);
                setInitialTags(data.tags); 
                
                setAnalyzedKeyword(kwToSearch.trim());
                setAnalyzedProductName(productName.trim());
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

    // [기능 2] 2단계: 필터링 적용 및 조합 (포인트 차감 없음)
    const handleCombine = async () => {
        setIsCombining(true);
        setResults([]);
        setRecommendedTags([]);

        try {
            const res = await fetch('/api/seo-title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    keyword: analyzedKeyword, 
                    productName: analyzedProductName,
                    excludeKeyword: excludeKeyword.trim()
                })
            });

            const data = await res.json();

            if (data.success) {
                setRecommendedTags(data.tags);
                setResults(data.titles);
                setCombinedExcludeKeyword(excludeKeyword.trim());
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

    // [기능 3] 파란색 키워드 클릭 시 제외 키워드에 자동 추가
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

    // 하이라이트 함수 (클릭 이벤트 포함)
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
                    <span 
                        key={i} 
                        onClick={() => handleAddExcludeKeyword(part)}
                        className="text-[#5244e8] font-extrabold cursor-pointer hover:underline hover:text-red-500 transition-colors"
                        title="클릭 시 제외 키워드에 자동 추가됩니다"
                    >
                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    const handleSaveCurrentSetting = async () => {
        if (!keyword.trim()) {
            alert("저장할 핵심 품목명을 입력해주세요.");
            return;
        }
        const supabase = createClient();
        const { error } = await supabase.from('saved_searches').insert({
            user_id: user?.id,
            page_type: 'SEO_TITLE',
            keyword: keyword.trim(),
            nickname: ''
        });

        if (!error) alert("현재 설정이 안전하게 저장되었습니다.");
        else alert("저장 중 오류가 발생했습니다.");
    };

    const handleApplySavedSetting = (item: any) => {
        setIsDrawerOpen(false);
        setKeyword(item.keyword);
        handleAnalyze(item.keyword);
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('복사되었습니다!\n스마트스토어에 바로 붙여넣기 하세요.');
    };

    const handleCopyAllTags = () => {
        const allTagsText = recommendedTags.map(tag => tag.word).join(',');
        navigator.clipboard.writeText(allTagsText);
        alert('모든 태그가 쉼표로 구분되어 복사되었습니다!\n스마트스토어 상품 등록 페이지 태그 입력창에 붙여넣기 하세요.');
    };

    // 버튼 상태 제어 로직 (화면 삭제와 완전히 분리됨)
    const isStep1Completed = top40Titles.length > 0 && 
                             keyword.trim() === analyzedKeyword && 
                             productName.trim() === analyzedProductName;

    const isStep2Completed = results.length > 0 && 
                             excludeKeyword.trim() === combinedExcludeKeyword;

    if (isLoading) return <div className="min-h-[50vh] flex items-center justify-center font-bold text-slate-500">권한 확인 중...</div>;
    if (!user) return null;

    return (
        <>
            <SellerTabs />

            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-2xl font-bold !text-black mb-2">쇼핑 카테고리 & 상품명 최적화</h1>
                    <p className="text-sm text-slate-500 mt-1">* 네이버 쇼핑 로직에 최적화된, 검색량 높고 경쟁도 낮은 상품명을 조립합니다.</p>
                </div>

                <div className="flex items-center gap-2 mt-1 shrink-0">
                    <button
                        onClick={handleSaveCurrentSetting}
                        disabled={!keyword.trim()}
                        className={`px-4 py-2 text-sm font-bold text-white rounded-md shadow-sm flex items-center gap-1.5 transition-colors
              ${!keyword.trim() ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-800'}`}
                    >
                        현재 설정 저장
                    </button>
                    <button
                        onClick={() => setIsDrawerOpen(true)}
                        className="px-4 py-2 text-sm font-bold text-white bg-slate-700 rounded-md hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5"
                    >
                        저장된 목록 보기
                    </button>
                </div>
            </div>

            {/* [STEP 1] 상단: 입력 및 분석 파트 */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8 max-w-4xl">
                <div className="flex gap-4 items-end">
                    <div className="flex-1 max-w-xs">
                        <label className="block text-[13px] font-bold text-gray-700 mb-2">브랜드/상품명 <span className="text-slate-400 font-normal">(선택)</span></label>
                        <input
                            type="text"
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            placeholder="예: 코만도빔"
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#5244e8] focus:bg-white transition-colors text-sm font-medium"
                        />
                    </div>

                    <div className="flex-1">
                        <label className="block text-[13px] font-bold text-gray-700 mb-2">핵심 품목명 <span className="text-red-500 font-normal">(1개만 입력)</span></label>
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="예: 캠핑랜턴 (쉼표 없이 하나만)"
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#5244e8] focus:bg-white transition-colors text-sm font-medium"
                        />
                    </div>

                    <div className="w-32 shrink-0 h-[46px] flex items-center justify-center">
                        {isAnalyzing ? (
                            <button disabled className="w-full h-full px-4 bg-gray-400 text-white font-bold rounded-md flex items-center justify-center gap-2 shadow-sm cursor-wait">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                분석 중
                            </button>
                        ) : (
                            <button
                                onClick={() => handleAnalyze()}
                                disabled={isAnalyzing}
                                className={`w-full h-full px-4 text-white font-bold rounded-md transition-colors shadow-sm ${
                                    isStep1Completed ? 'bg-slate-700 hover:bg-slate-800' : 'bg-[#5244e8] hover:bg-blue-700'
                                }`}
                            >
                                {isStep1Completed ? '분석 완료' : '검색 및 분석'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-[13px] text-slate-500 font-bold ml-1">
                    <span className="text-emerald-500 font-extrabold">[안내]</span>
                    <span>상위 노출된 40개 상품의 실제 데이터를 기반으로 틈새 키워드를 추출합니다.</span>
                </div>
            </div>

            {!isAnalyzing && top40Titles.length === 0 && (
                <div className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 text-center flex flex-col items-center justify-center min-h-[300px] max-w-4xl">
                    <h3 className="text-lg font-bold text-gray-700 mb-2">핵심 품목명을 입력하고 [검색 및 분석] 버튼을 눌러주세요.</h3>
                    <p className="text-sm text-gray-500">실제 상위 노출 판매자들의 데이터 분석이 먼저 진행됩니다.</p>
                </div>
            )}

            {/* [STEP 1 결과] 카테고리 및 상위 노출 상품명 리스트 */}
            {isStep1Completed && (
                <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 mt-8 max-w-4xl border-t-4 border-t-[#5244e8]">
                    
                    {categoryStats.length > 0 && (
                        <div className="mb-8 bg-emerald-50 border border-emerald-200 p-5 rounded-md flex flex-col gap-3">
                            <div className="font-extrabold text-emerald-800 text-[15px]">상위 40개 상품 카테고리 점유율 분석</div>
                            <div className="flex flex-col gap-2">
                                {categoryStats.map((cat, idx) => (
                                    <div key={idx} className="flex items-center gap-3 text-[14px] text-gray-800">
                                        <span className="bg-white px-3 py-1.5 rounded border border-emerald-100 shadow-sm font-medium flex-1 sm:flex-none">
                                            {cat.path}
                                        </span>
                                        <span className={`font-bold ${idx === 0 ? 'text-red-500 text-[15px]' : 'text-emerald-600'}`}>
                                            {cat.percentage}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {top40Titles.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-5">
                                실제 상위 노출 상품명 리스트 (키워드 분석)
                            </h3>
                            <div className="space-y-2.5">
                                {top40Titles.slice(0, visibleTitleCount).map((title, i) => (
                                    <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-md text-[14px] text-gray-700 leading-relaxed flex items-center">
                                        <span className="font-bold text-gray-400 mr-3 min-w-[30px]">{i + 1}위</span>
                                        <div className="flex-1 font-bold text-gray-800 text-[14px]">
                                            {highlightKeywords(title, initialTags)}
                                            <span className="ml-2 text-[12px] text-red-500 font-bold">({title.length}자)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {visibleTitleCount < top40Titles.length && (
                                <button
                                    onClick={() => setVisibleTitleCount(prev => Math.min(prev + 10, top40Titles.length))}
                                    className="w-full mt-3 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 !text-gray-600 font-bold text-[13px] rounded-md transition-colors"
                                >
                                    + 10개 더보기 ({visibleTitleCount} / {top40Titles.length})
                                </button>
                            )}

                            <p className="text-xs text-gray-500 mt-3.5 font-bold">
                                [안내] 파란색으로 강조된 키워드를 클릭하시면 아래의 제외 키워드 항목에 자동으로 추가됩니다.
                            </p>
                        </div>
                    )}

                    {/* [STEP 2] 중간: 제외 키워드 필터링 및 조합 버튼 */}
                    <div className="pt-6 border-t border-gray-200 mt-6">
                        <div className="flex flex-col gap-4 bg-gray-50 p-6 rounded-md border border-gray-200">
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-[13px] font-bold text-gray-700 mb-2">제외 키워드 <span className="text-red-500 font-normal">(타사 브랜드명 필터링)</span></label>
                                    <input
                                        type="text"
                                        value={excludeKeyword}
                                        onChange={(e) => setExcludeKeyword(e.target.value)}
                                        placeholder="예: 크레모아, 프리즘 (위 리스트에서 단어를 클릭하세요)"
                                        onKeyDown={(e) => e.key === 'Enter' && handleCombine()}
                                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#5244e8] transition-colors text-sm font-medium shadow-sm"
                                    />
                                </div>
                                <div className="w-40 shrink-0 h-[46px] flex items-center justify-center">
                                    {isCombining ? (
                                        <button disabled className="w-full h-full px-4 bg-gray-400 text-white font-bold rounded-md flex items-center justify-center gap-2 shadow-sm cursor-wait">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            조합 중
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleCombine()}
                                            disabled={isCombining}
                                            className={`w-full h-full px-4 text-white font-bold rounded-md transition-colors shadow-sm ${
                                                isStep2Completed ? 'bg-slate-700 hover:bg-slate-800' : 'bg-[#5244e8] hover:bg-blue-700'
                                            }`}
                                        >
                                            {isStep2Completed ? '조합 완료' : '적용 & 조합'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* [STEP 2 결과] 조합 완료 후 나타나는 최종 태그 및 테이블 */}
                    {results.length > 0 && (
                        <>
                            {recommendedTags.length > 0 && (
                                <div className="mb-10 pt-8 mt-2 border-t border-gray-100 animate-in fade-in duration-500">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-[15px] font-bold !text-gray-800">
                                            스마트스토어 입력용 추천 태그 (쉼표 구분)
                                        </h3>
                                        <button 
                                            onClick={handleCopyAllTags}
                                            className="px-3 py-1.5 text-xs font-bold text-white bg-slate-600 rounded-md hover:bg-slate-700 transition-colors shadow-sm"
                                        >
                                            태그 전체 복사
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2.5">
                                        {recommendedTags.map((tag, i) => (
                                            <span 
                                                key={i}
                                                className={`px-3 py-1.5 rounded-full text-[13px] font-bold shadow-sm border
                                                    ${tag.isBanned 
                                                        ? 'bg-red-50 text-red-600 border-red-200 cursor-help' 
                                                        : 'bg-white text-gray-700 border-gray-200'}`
                                                }
                                                title={tag.isBanned ? '네이버 정책 위반 소지가 있는 단어입니다.' : ''}
                                            >
                                                {tag.isBanned ? `[주의] ${tag.word} (금지어)` : `#${tag.word}`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-6 border-t border-gray-200 animate-in fade-in duration-500">
                                <h3 className="text-lg font-bold text-gray-900 mb-5">
                                    최적화 상품명 추천 리스트
                                </h3>

                                <div className="overflow-x-auto border border-gray-200 rounded-md shadow-sm">
                                    <table className="w-full text-sm text-left table-fixed">
                                        <thead className="bg-gray-100 border-b border-gray-200 text-gray-700 font-bold text-[13px]">
                                            <tr>
                                                <th className="px-5 py-3 w-[25%] text-center whitespace-nowrap">조합 패턴</th>
                                                <th className="px-5 py-3 w-[55%] text-center whitespace-nowrap">추천 제목</th>
                                                <th className="px-5 py-3 w-[10%] text-center whitespace-nowrap">글자수</th>
                                                <th className="px-5 py-3 w-[10%] text-center whitespace-nowrap">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {results.map((item, i) => (
                                                <tr key={i} className="hover:bg-[#5244e8]/5 transition-colors group bg-white">
                                                    <td className="px-5 py-4 text-center text-[13px] font-bold text-slate-600 whitespace-nowrap">
                                                        {item.pattern}
                                                    </td>
                                                    <td className="px-5 py-4 font-bold text-gray-800 text-[14.5px] leading-relaxed break-all">
                                                        {item.title}
                                                    </td>
                                                    <td className="px-5 py-4 text-center text-[13px] text-red-500 font-bold whitespace-nowrap">
                                                        {item.title.length}자
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <button
                                                            onClick={() => handleCopy(item.title)}
                                                            className="px-3 py-1.5 bg-gray-100 border border-gray-200 !text-gray-600 group-hover:bg-[#5244e8] group-hover:!text-white text-[12px] font-bold rounded transition-colors shadow-sm whitespace-nowrap"
                                                        >
                                                            복사
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            <SavedSearchesDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                pageType="SEO_TITLE"
                onSelect={handleApplySavedSetting}
            />
        </>
    );
}

export default function SeoTitlePage() {
    return (
        <>
            <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
            <div className="flex min-h-screen bg-[#f8f9fa] !text-black antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
                <Sidebar />

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