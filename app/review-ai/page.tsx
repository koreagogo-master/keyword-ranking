'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from "@/app/contexts/AuthContext";
import { createClient } from "@/app/utils/supabase/client";
import SavedSearchesDrawer from "@/components/SavedSearchesDrawer";
import AiTabs from "@/components/AiTabs";
import HelpButton from "@/components/HelpButton";

// ─── 인라인 SVG 아이콘 (lucide-react 미설치 → 직접 구현) ─────
// width/height를 16px로 통일 — 버튼 내 아이콘이 확실히 보이도록
const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);
const IconX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─── 제품 컬러 팔레트 (파스텔톤, 인덱스 순서) ────────────────
const PRESET_COLORS = [
  { dot: 'bg-blue-400', selectBg: 'bg-blue-50', border: 'border-blue-300', text: '!text-blue-700' },
  { dot: 'bg-green-400', selectBg: 'bg-green-50', border: 'border-green-300', text: '!text-green-700' },
  { dot: 'bg-yellow-400', selectBg: 'bg-yellow-50', border: 'border-yellow-300', text: '!text-yellow-700' },
  { dot: 'bg-purple-400', selectBg: 'bg-purple-50', border: 'border-purple-300', text: '!text-purple-700' },
  { dot: 'bg-orange-400', selectBg: 'bg-orange-50', border: 'border-orange-300', text: '!text-orange-700' },
] as const;

// ─── 타입 정의 ────────────────────────────────────────────────
interface ProductPreset {
  id: number;
  name: string;
  url: string;
  desc: string;       // 제품 핵심 장점
  isUrlAnalysisOn: boolean; // URL 심층 분석 토글 (프리셋별)
  colorIdx: number;   // PRESET_COLORS 인덱스
}

interface ReviewCard {
  id: number;
  text: string;
  presetId: number | null;
  isPhoto: boolean;
  isNegative: boolean;
}

interface AiResult {
  id: number;
  text: string;
}

const TONE_OPTIONS = [
  { id: 'friendly-repurchase', label: '친절 + 재구매' },
  { id: 'friendly', label: '친절/공감' },
  { id: 'repurchase', label: '재구매 유도' },
  { id: 'expert', label: '전문/신뢰' },
  { id: 'apologize', label: '정중한 사과' },
] as const;

type ToneId = typeof TONE_OPTIONS[number]['id'];

// ── 초기값 생성 헬퍼
let nextPresetId = 2;
let nextCardId = 6;

const createPreset = (id: number, colorIdx: number): ProductPreset =>
  ({ id, name: '', url: '', desc: '', isUrlAnalysisOn: false, colorIdx });

const createCard = (id: number): ReviewCard =>
  ({ id, text: '', presetId: null, isPhoto: false, isNegative: false });

const INITIAL_PRESETS: ProductPreset[] = [createPreset(1, 0)];
const INITIAL_CARDS: ReviewCard[] = [1, 2].map(createCard);

// ─── 메인 컴포넌트 ─────────────────────────────────────────────
function ReviewAiContent() {

  // ── 제품 프리셋 상태
  const [presets, setPresets] = useState<ProductPreset[]>(INITIAL_PRESETS);
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const { user } = useAuth();

  const searchParams = useSearchParams();
  const historyId = searchParams.get('id');

  useEffect(() => {
    if (historyId) {
      const fetchHistoryData = async () => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('saved_searches')
          .select('settings')
          .eq('id', historyId)
          .single();

        if (data && data.settings) {
          const settings = typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings;
          if (settings.presets && Array.isArray(settings.presets)) {
            setPresets(settings.presets);
          }
        }
      };
      fetchHistoryData();
    }
  }, [historyId]);

  const handleSaveCurrentSetting = async () => {
    if (!user) {
      alert('로그인 정보가 만료되었거나 확인할 수 없습니다. 다시 로그인해주세요.');
      return;
    }

    const title = prompt("저장할 프리셋 목록의 이름을 입력하세요:", "나의 제품 프리셋");
    if (!title) return; // 사용자가 취소한 경우

    const settingsToSave = { presets }; // 현재 프리셋 배열 저장

    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').insert({
      user_id: user.id, 
      page_type: 'REVIEW_AI', 
      nickname: '', 
      keyword: title, // title을 keyword 필드에 저장하여 리스트에 노출
      settings: settingsToSave
    });

    if (!error) alert("현재 설정이 나만의 템플릿으로 안전하게 저장되었습니다.");
    else alert(`저장 실패: ${error.message}`);
  };

  const handleApplySavedSetting = (item: any) => {
    setIsDrawerOpen(false);
    const settings = typeof item.settings === 'string' ? JSON.parse(item.settings) : (item.settings || {});
    
    if (settings.presets && Array.isArray(settings.presets)) {
      setPresets(settings.presets);
    }
  };

  const addPreset = () => {
    if (presets.length >= 10) return;
    const colorIdx = presets.length % 5; // 0~4 반복
    setPresets(prev => [...prev, createPreset(Date.now(), colorIdx)]);
  };

  const removePreset = (id: number) => {
    if (presets.length <= 1) return;
    setPresets(prev => prev.filter(p => p.id !== id));
    setCards(prev => prev.map(c => c.presetId === id ? { ...c, presetId: null } : c));
  };

  const updatePreset = (id: number, patch: Partial<Omit<ProductPreset, 'id' | 'colorIdx'>>) => {
    setPresets(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  };

  // ── 톤앤매너 / 공통 설정
  const [selectedTone, setSelectedTone] = useState<ToneId>('friendly-repurchase');
  const [isEmojiOff, setIsEmojiOff] = useState(false);

  // ── 리뷰 카드 상태
  const [cards, setCards] = useState<ReviewCard[]>(INITIAL_CARDS);
  const [results, setResults] = useState<AiResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [allCopied, setAllCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);

  const addCard = () => {
    setCards(prev => [...prev, createCard(Date.now())]);
    setIsGenerated(false);
  };
  const removeLastCard = () => {
    if (cards.length <= 1) return;
    setCards(prev => prev.slice(0, -1));
    setIsGenerated(false);
  };
  const removeCard = (id: number) => {
    if (cards.length <= 1) return;
    setCards(prev => prev.filter(c => c.id !== id));
    setIsGenerated(false);
  };
  const updateCard = (id: number, patch: Partial<Omit<ReviewCard, 'id'>>) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    setIsGenerated(false);
  };

  // ── 생성 핸들러 — Claude API 호출
  const handleGenerate = async () => {
    // 텐스트가 비어있는 카드만 필터링
    const validCards = cards.filter(c => c.text.trim() !== '');
    if (validCards.length === 0) {
      alert('답글을 생성할 리뷰를 입력해주세요.');
      return;
    }

    // 유효성 검사: 리뷰에 해당하는 제품명 미선택 확인
    const isPresetMissing = validCards.some(c => {
      if (c.presetId === null) return true;
      const preset = presets.find(p => p.id === c.presetId);
      return !preset || preset.name.trim() === '';
    });

    if (isPresetMissing) {
      alert("리뷰에 해당하는 제품명을 선택해 주세요.");
      return;
    }

    setIsLoading(true);
    setResults([]);

    try {
      // 제품명/핵심 장점: 프리셋에서 선택된 값 포함
      const presetMap = new Map(presets.map(p => [p.id, { name: p.name.trim() || `제품 ${p.id}`, desc: p.desc.trim() }]));

      const validReviews = validCards.map(c => ({
        id: c.id,
        text: c.text,
        isPhoto: c.isPhoto,
        isNegative: c.isNegative,
        presetName: c.presetId !== null ? (presetMap.get(c.presetId)?.name ?? undefined) : undefined,
        presetDesc: c.presetId !== null ? (presetMap.get(c.presetId)?.desc ?? undefined) : undefined,
      }));

      const res = await fetch('/api/review-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tone: selectedTone,
          isEmojiOff,
          reviews: validReviews,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        if (error === '포인트가 부족합니다.') {
          alert('포인트가 부족합니다.');
          return;
        }
        throw new Error(error || `HTTP 오류 ${res.status}`);
      }

      const { results: apiResults } = await res.json();
      setResults(prev => {
        const next = [...prev];
        apiResults.forEach((apiRes: AiResult) => {
          const existingIdx = next.findIndex(r => r.id === apiRes.id);
          if (existingIdx >= 0) next[existingIdx] = apiRes;
          else next.push(apiRes);
        });
        return next;
      });
      setIsGenerated(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      alert(`답글 생성 중 오류가 발생했습니다:\n${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── 복사
  const copyAll = () => {
    const all = results.map((r, i) => `[답글 ${i + 1}]\n${r.text}`).join('\n\n');
    navigator.clipboard.writeText(all).then(() => {
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2500);
    }).catch(() => { });
  };
  const copyOne = (text: string, id: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => { });
  };

  // ── 헬퍼: presetId → colorIdx
  const getColor = (presetId: number | null) => {
    if (presetId === null) return null;
    const p = presets.find(x => x.id === presetId);
    return p ? PRESET_COLORS[p.colorIdx] : null;
  };

  const presetLabel = (p: ProductPreset) =>
    p.name.trim() ? p.name.trim() : `제품 ${p.id}`;

  const resultMap = new Map(results.map(r => [r.id, r.text]));
  const validCardsCount = cards.filter(c => c.text.trim() !== '').length;

  return (
    <>
      {saveToast && (
        <div className="fixed top-24 right-12 z-[9999] flex items-center gap-3 bg-[#5244e8]/80 text-white text-[15px] font-bold px-7 py-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(82,68,232,0.6)] border border-indigo-400/30 animate-fade-in-down backdrop-blur-sm">
          <svg className="w-6 h-6 text-indigo-100 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          현재 설정이 성공적으로 저장되었습니다.
        </div>
      )}
      <link
        href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css"
        rel="stylesheet"
        type="text/css"
      />

      <div
        className="flex min-h-screen bg-[#f8f9fa] !text-[#3c4043] antialiased tracking-tight"
        style={{ fontFamily: "'NanumSquare', sans-serif" }}
      >
        <main className="flex-1 ml-64 px-10 pt-10 pb-32 relative">
          <div className="max-w-7xl mx-auto">
            <AiTabs />

            {/* ── 페이지 헤더 */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="!text-2xl font-bold !text-gray-900">리뷰 답글 AI 어시스턴트</h1>
                  <HelpButton href="https://blog.naver.com/lboll/224254481124" tooltip="도움말" />
                </div>
                <p className="!text-sm !text-slate-500 leading-relaxed">
                  제품 프리셋을 등록하고 고객 리뷰를 붙여넣으면 AI가 브랜드 톤앤매너에 맞는 답글을 자동으로 작성합니다.<br />
                  포토 리뷰나 악플 대응 옵션을 활용해 상황에 꼭 맞는 맞춤형 답변을 생성해 보세요!
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1 shrink-0">
                <button onClick={handleSaveCurrentSetting} className="px-4 py-2 text-sm font-bold text-white bg-slate-400 rounded-md shadow-sm hover:bg-slate-500 transition-colors flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg> 현재 설정 저장
                </button>
                <button onClick={() => setIsDrawerOpen(true)} className="px-4 py-2 text-sm font-bold text-white bg-slate-700 rounded-md hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg> 저장된 목록 보기
                </button>
              </div>
            </div>

            {/* ══════════════════════════════════════════
                상단 옵션 바 (프리셋 + 톤앤매너 + 토글)
            ══════════════════════════════════════════ */}
            <h2 className="!text-sm font-bold !text-gray-700 mb-2">
              AI 기본 설정
            </h2>
            <div className="bg-white border border-gray-200 shadow-sm rounded-sm p-5 mb-6">



              {/* 프리셋 목록 */}
              {/* 프리셋 목록 */}
              <div className="mb-5">
                <label className="block !text-sm font-bold !text-gray-600 mb-1.5">제품 프리셋 (최대 10개)</label>
                <div className="flex flex-wrap items-center gap-3">
                  {presets.map((p) => {
                    const color = PRESET_COLORS[p.colorIdx];
                    return (
                      <div key={p.id} className="relative w-48 shrink-0">
                        <input
                          id={`preset-name-${p.id}`}
                          type="text"
                          value={p.name}
                          onChange={e => updatePreset(p.id, { name: e.target.value })}
                          placeholder="제품명 입력"
                          className={`w-full p-2.5 pr-8 h-[38px] rounded-sm border !text-sm !text-gray-900
                                     focus:outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8]
                                     transition-all shadow-sm ${color.selectBg} ${color.border}`}
                        />
                        {presets.length > 1 && (
                          <button
                            id={`remove-preset-${p.id}`}
                            onClick={() => removePreset(p.id)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-sm
                                       !text-gray-400 hover:text-red-500 transition-colors bg-transparent"
                            title="삭제"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* 제품 추가 버튼 (인라인 배치) */}
                  {presets.length < 10 && (
                    <button
                      id="add-preset-btn"
                      onClick={addPreset}
                      className="flex items-center justify-center gap-1.5 px-3 h-[38px] !text-xs font-bold border border-dashed
                                 rounded-sm transition-all shadow-sm shrink-0 border-gray-300 !text-gray-600 
                                 hover:border-[#5244e8] hover:!text-[#5244e8] hover:bg-blue-50 !bg-white"
                    >
                      <IconPlus />
                      제품 추가 ({presets.length}/10)
                    </button>
                  )}
                </div>
              </div>



              {/* 구분선 — 답변 톤앤매너 + 이모지 유무 */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-end gap-4">
                  {/* 톤앤매너 버튼 그룹 */}
                  <div className="flex-1">
                    <label className="block !text-sm font-bold !text-gray-600 mb-1.5">답변 톤앤매너</label>
                    <div className="flex w-full gap-2">
                      {TONE_OPTIONS.map(t => (
                        <button
                          key={t.id}
                          id={`tone-${t.id}`}
                          onClick={() => setSelectedTone(t.id)}
                          className={`flex-1 !text-center py-2 h-[38px] rounded-sm !text-sm font-bold transition-all border
                            ${selectedTone === t.id
                              ? 'bg-[#5244e8] border-[#5244e8] !text-white shadow-sm'
                              : 'bg-white border-gray-300 !text-gray-500 hover:border-[#5244e8] hover:!text-[#5244e8]'
                            }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 구분 세로선 */}
                  <div className="w-px bg-gray-200" style={{ height: '55px' }} />

                  {/* 이모지 유/무 토글 */}
                  <div className="shrink-0">
                    <label className="block !text-sm font-bold !text-gray-600 mb-1.5">이모지 (유/무)</label>
                    <button
                      id="toggle-emoji-off"
                      onClick={() => setIsEmojiOff(prev => !prev)}
                      className={`w-[120px] !text-center h-[38px] rounded-sm !text-sm font-bold transition-all border
                        ${isEmojiOff
                          ? 'bg-red-50 border-red-400 !text-red-600 shadow-sm'
                          : 'bg-white border-gray-300 !text-gray-500 hover:border-red-400 hover:!text-red-500'
                        }`}
                    >
                      {isEmojiOff ? '🚫 이모지 없음' : '😊 이모지 허용'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════
                헤더 행 (입력 / AI 답글 라벨 + 버튼)
            ══════════════════════════════════════════ */}
            <div className="grid grid-cols-2 gap-6 mb-2 items-center">
              <div className="flex items-center justify-between">
                <h2 className="!text-sm font-bold !text-gray-700">
                  고객 리뷰 입력
                  <span className="ml-2 !text-xs font-normal !text-slate-400">{cards.length}개</span>
                </h2>
              </div>
              <div className="flex items-center justify-between">
                <h2 className="!text-sm font-bold !text-gray-700">AI 생성 답글</h2>
              </div>
            </div>

            {/* ══════════════════════════════════════════
                행(Row) 단위 카드 쌍 — 높이 1:1 동기화
            ══════════════════════════════════════════ */}
            <div className="flex flex-col gap-3">
              {cards.map((card, idx) => {
                const color = getColor(card.presetId);
                const resultText = resultMap.get(card.id) ?? '';
                const isCopied = copiedId === card.id;

                // select 배경 클래스 동적 결정
                const selectBgClass = color
                  ? `${color.selectBg} ${color.border}`
                  : 'bg-gray-50 border-gray-200';

                return (
                  // 각 행: 좌(입력)+중(컨트롤버튼)+우(결과)
                  <div
                    key={card.id}
                    className="grid items-stretch"
                    style={{ gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}
                  >
                    {/* ── 좌측: 입력 카드 */}
                    <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-3 flex flex-col">
                      {/* 카드 상단 */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="!text-xs font-bold !text-[#5244e8] shrink-0">
                          #{idx + 1}
                        </span>

                        {/* 제품 선택 드롭다운 */}
                        <select
                          id={`card-preset-${card.id}`}
                          value={card.presetId ?? ''}
                          onChange={e =>
                            updateCard(card.id, {
                              presetId: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className={`flex-1 h-[30px] px-2 rounded-sm border !text-xs !text-gray-700
                                     focus:outline-none focus:border-[#5244e8] transition-all ${selectBgClass}`}
                        >
                          <option value="">제품 선택</option>
                          {presets.map(p => (
                            <option key={p.id} value={p.id}>
                              {presetLabel(p)}
                            </option>
                          ))}
                        </select>

                        {/* 옵션 버튼 */}
                        <button
                          id={`photo-btn-${card.id}`}
                          onClick={() => updateCard(card.id, { isPhoto: !card.isPhoto })}
                          className={`px-2 py-1 h-[30px] rounded-sm border !text-xs transition-all shrink-0
                            ${card.isPhoto
                              ? 'border-[#5244e8] !text-[#5244e8] font-bold bg-blue-50'
                              : 'border-gray-200 !text-gray-400 font-normal bg-white hover:border-gray-400'
                            }`}
                        >
                          포토 리뷰
                        </button>
                        <button
                          id={`negative-btn-${card.id}`}
                          onClick={() => updateCard(card.id, { isNegative: !card.isNegative })}
                          className={`px-2 py-1 h-[30px] rounded-sm border !text-xs transition-all shrink-0
                            ${card.isNegative
                              ? 'border-red-400 !text-red-500 font-bold bg-red-50'
                              : 'border-gray-200 !text-gray-400 font-normal bg-white hover:border-gray-400'
                            }`}
                        >
                          악플 대응
                        </button>
                        </div>
                      </div>

                      {/* 리뷰 원문 Textarea */}
                      <textarea
                        id={`review-text-${card.id}`}
                        value={card.text}
                        onChange={e => updateCard(card.id, { text: e.target.value })}
                        placeholder="고객 리뷰 원문을 붙여넣어 주세요..."
                        rows={2}
                        className="w-full flex-1 p-2.5 rounded-sm border border-gray-300
                                   focus:outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8]
                                   !text-sm !text-gray-900 resize-none overflow-y-auto transition-all"
                        style={{ maxHeight: '80px' }}
                      />
                    </div>



                    {/* ── 우측: 결과 카드 */}
                    <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex flex-col">
                      <div className="flex items-center justify-between mb-2.5 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="!text-xs font-bold !text-[#5244e8]">
                            답글 #{idx + 1}
                          </span>
                          {card.isPhoto && (
                            <span className="!text-[11px] px-2 py-0.5 rounded-full bg-blue-50 !text-blue-600
                                             font-bold border border-blue-100">포토 리뷰</span>
                          )}
                          {card.isNegative && (
                            <span className="!text-[11px] px-2 py-0.5 rounded-full bg-red-50 !text-red-500
                                             font-bold border border-red-100">악플 대응</span>
                          )}
                        </div>
                        <button
                          id={`copy-one-${card.id}`}
                          onClick={() => copyOne(resultText, card.id)}
                          disabled={!resultText}
                          className={`px-3 py-1.5 !text-xs font-bold rounded-sm border transition-all
                            ${isCopied
                              ? 'bg-green-600 border-green-600 !text-white'
                              : resultText
                                ? 'bg-[#5244e8] border-[#5244e8] !text-white hover:bg-[#4336c9]'
                                : 'bg-gray-100 border-gray-200 !text-gray-400 cursor-not-allowed'
                            }`}
                        >
                          {isCopied ? '복사됨!' : '복사'}
                        </button>
                      </div>
                      <p className="!text-sm !text-gray-700 leading-relaxed whitespace-pre-wrap flex-1 min-h-[40px]">
                        {resultText ? resultText : (
                          <span className="!text-gray-300 italic">생성 버튼을 눌러 답글을 생성해 주세요.</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── 하단 컨트롤 영역 (2단 그리드) */}
            <div className="grid items-start mb-6 !mt-6" style={{ gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              {/* 좌측 하단: 리뷰 추가 / 삭제 버튼 */}
              <div className="flex gap-2">
                <button
                  id="add-card-btn"
                  onClick={addCard}
                  className="flex-1 py-3 rounded-sm border border-dashed border-gray-300 !text-gray-700 !text-sm font-bold flex items-center justify-center gap-2 hover:border-[#5244e8] hover:!text-[#5244e8] hover:!bg-gray-200 transition-all !bg-gray-100"
                >
                  <IconPlus />
                  리뷰 추가
                </button>
                {cards.length > 1 && (
                  <button
                    id="remove-last-card-btn"
                    onClick={removeLastCard}
                    className="flex-1 py-3 rounded-sm border border-dashed border-gray-300 !text-gray-700 !text-sm font-bold flex items-center justify-center gap-2 hover:border-red-400 hover:!text-red-500 hover:!bg-gray-200 transition-all !bg-gray-100"
                  >
                    <IconTrash />
                    리뷰 삭제
                  </button>
                )}
              </div>

              {/* 우측 하단: 전체 결과 복사 버튼 */}
              <div className="flex justify-end gap-2">
                {results.length > 0 ? (
                  <button
                    id="copy-all-btn"
                    onClick={copyAll}
                    className={`w-[calc(50%-4px)] py-3 !text-sm font-bold rounded-sm border border-dashed transition-all flex items-center justify-center
                      ${allCopied
                        ? 'bg-green-600 border-green-600 !text-white'
                        : '!bg-gray-100 border-gray-300 !text-gray-700 hover:border-[#5244e8] hover:!text-[#5244e8] hover:!bg-gray-200'
                      }`}
                  >
                    {allCopied ? '전체 복사 완료!' : '전체 결과 복사'}
                  </button>
                ) : (
                  <div className="w-[calc(50%-4px)]"></div>
                )}
              </div>
            </div>

            {/* ── AI 생성 버튼 */}
            <div className="flex justify-center mb-8">
              <button
                id="generate-replies-btn"
                onClick={handleGenerate}
                disabled={isLoading}
                className={`w-2/3 max-w-md py-4 rounded-sm font-bold !text-white !text-base transition-all shadow-md
                            flex items-center justify-center gap-2
                  ${isLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : isGenerated
                      ? '!bg-green-600 hover:!bg-green-700'
                      : 'bg-[#5244e8] hover:bg-[#4336c9]'
                  }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 !text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    AI 답글 생성 중...
                  </>
                ) : isGenerated ? (
                  '답글 생성 완료'
                ) : (
                  `AI 답글 생성하기 (${validCardsCount}개)`
                )}
              </button>
            </div>

          </div>
        </main>
      </div>
      <SavedSearchesDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} pageType={"REVIEW_AI" as any} onSelect={handleApplySavedSetting} />
    </>
  );
}

export default function ReviewAiPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold text-slate-500">데이터를 불러오는 중입니다...</div>}>
      <ReviewAiContent />
    </Suspense>
  );
}
