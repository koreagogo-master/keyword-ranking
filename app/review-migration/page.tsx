'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { REQUIRED_COLUMN_LABELS } from './types';
import type {
  DuplicateCheckRequestReview,
  NaverProductGroup,
  ParseFailure,
  ParseResponse,
  ParseSuccess,
  ProductMatchEntry,
  RegisterReviewInput,
  ReviewRow,
} from './types';
import Step3ProductMatch, { type ProductMatchSummary } from './components/Step3ProductMatch';
import Step4DuplicateCheck, { type Step4Phase } from './components/Step4DuplicateCheck';
import SmartstoreAddress from './components/SmartstoreAddress';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
/** 서버(parse-excel)와 같은 값. 안내 문구에만 사용하고 실제 검증은 서버가 합니다. */
const MAX_REVIEW_ROWS = 500;
const ROWS_PER_PAGE = 50;
const CONTENT_PREVIEW_CHARS = 60;

const STEPS = [
  { no: 1, title: '엑셀 선택' },
  { no: 2, title: '데이터 확인' },
  { no: 3, title: '상품 매칭' },
  { no: 4, title: '카페24 등록' },
];

/**
 * 4단계 배지 문구. 실제 등록 기능이 붙었으므로 '준비 중' 대신 현재 진행 상태를 보여 줍니다.
 * 상태는 4단계 컴포넌트가 onPhaseChange로 올려 줍니다.
 */
const STEP4_PHASE_BADGES: Record<Step4Phase, { label: string; toneClass: string }> = {
  blocked: { label: '이전 단계 필요', toneClass: 'bg-gray-200 text-gray-500' },
  before_check: { label: '중복 검사 전', toneClass: 'bg-amber-100 text-amber-700' },
  needs_decision: { label: '판정 필요', toneClass: 'bg-amber-100 text-amber-700' },
  ready_to_register: { label: '등록 준비', toneClass: 'bg-[#5244e8]/10 text-[#5244e8]' },
  registering: { label: '등록 중', toneClass: 'bg-[#5244e8]/10 text-[#5244e8]' },
  registered: { label: '등록 완료', toneClass: 'bg-emerald-100 text-emerald-700' },
  partial: { label: '일부 완료/중단', toneClass: 'bg-red-100 text-red-600' },
};

/** 카페24 연결 상태 API(/api/review-migration/cafe24/status) 응답 */
interface Cafe24Status {
  connected: boolean;
  mallId?: string;
  shopNo?: number;
  scopes?: string[];
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
}

/** 콜백이 붙여 주는 짧은 오류 코드를 사용자용 한국어 문장으로 바꿉니다. */
const CAFE24_ERROR_MESSAGES: Record<string, string> = {
  forbidden: '관리자만 카페24를 연결할 수 있습니다. 다시 로그인한 뒤 시도해 주세요.',
  config: '카페24 연동 설정이 올바르지 않습니다. 관리자에게 문의해 주세요.',
  state: '연결 요청이 만료되었거나 올바르지 않습니다. 처음부터 다시 연결해 주세요.',
  code: '카페24에서 인증 정보를 받지 못했습니다. 다시 연결해 주세요.',
  denied: '카페24 화면에서 연결이 취소되었습니다.',
  token: '카페24 토큰 발급에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  shop_no: '카페24 상점 정보를 확인하지 못했습니다. 다시 연결해 주세요.',
  save: '연결 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 화면 접근 권한 상태.
 *
 * 판정 기준은 이미 requireAdmin() 가드가 걸려 있는 status API의 HTTP 상태 하나뿐입니다.
 * 클라이언트에서 세션·role을 따로 추측하지 않습니다.
 *  - 'checking' : status 요청 중 (이 동안에는 어떤 판정도 내리지 않습니다)
 *  - 'granted'  : 200. 서버가 관리자로 확인해 준 상태
 *  - 'denied'   : 401 또는 403
 *  - 'error'    : 네트워크 오류 또는 5xx. 권한 없음으로 처리하지 않고 재시도를 안내합니다.
 */
type AccessState = 'checking' | 'granted' | 'denied' | 'error';

/** 만료 시각을 한국어로 표시합니다. 값이 없거나 해석할 수 없으면 '-' */
function formatDateTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * 행 수 제한 초과를 한국어 안내 문구로 바꿉니다.
 * 서버가 code·rowCount·maxRowCount를 함께 내려주므로 실제 건수까지 알려 줄 수 있습니다.
 * 해당 오류가 아니면 null을 돌려주고 서버 메시지를 그대로 씁니다.
 */
function rowLimitMessage(failure: ParseFailure): string | null {
  if (failure.code !== 'row_limit_exceeded') return null;

  const max = failure.maxRowCount ?? MAX_REVIEW_ROWS;
  const actual = failure.rowCount;

  return (
    `한 파일에서 처리할 수 있는 리뷰는 최대 ${max.toLocaleString()}건입니다.` +
    (typeof actual === 'number' ? ` (이 파일 ${actual.toLocaleString()}건)` : '') +
    ' 기간을 나누어 여러 파일로 올려 주세요.'
  );
}

/** 표 안에서는 줄바꿈을 공백으로 바꿔 한 줄로 보여줍니다. */
function toOneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function StatusBadge({ status }: { status: ReviewRow['status'] }) {
  if (status === 'error') {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-600 whitespace-nowrap">
        오류
      </span>
    );
  }
  if (status === 'duplicate') {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap">
        중복
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 whitespace-nowrap">
      정상
    </span>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <div
      className={`bg-white rounded-lg border p-4 shadow-sm ${
        tone === 'warn' && value > 0 ? 'border-red-200' : 'border-gray-200'
      }`}
    >
      <p className="text-[12px] font-bold text-gray-500 mb-1">{label}</p>
      <p
        className={`text-2xl font-bold ${
          tone === 'warn' && value > 0 ? 'text-red-500' : 'text-[#5244e8]'
        }`}
      >
        {value.toLocaleString()}
      </p>
      {hint && <p className="text-[11px] text-gray-400 mt-1 leading-tight">{hint}</p>}
    </div>
  );
}

export default function ReviewMigrationPage() {
  const router = useRouter();
  const alertShown = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [result, setResult] = useState<ParseSuccess | null>(null);

  const [showProblemOnly, setShowProblemOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  // 접근 권한 + 카페24 연결 상태 (둘 다 status API 응답 하나로 결정됩니다)
  const [accessState, setAccessState] = useState<AccessState>('checking');
  const [deniedStatus, setDeniedStatus] = useState<401 | 403 | null>(null);
  const [cafe24Status, setCafe24Status] = useState<Cafe24Status | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [cafe24Error, setCafe24Error] = useState('');
  const [cafe24Notice, setCafe24Notice] = useState('');
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);

  // 3단계에서 올려 주는 매칭 진행 상황
  const [matchSummary, setMatchSummary] = useState<ProductMatchSummary | null>(null);
  /** 3단계에서 확정·건너뛰기가 끝난 상품만 올라옵니다. (4단계 중복 검사 대상 계산용) */
  const [matchEntries, setMatchEntries] = useState<ProductMatchEntry[]>([]);

  /** 확정된 스마트스토어 기본 주소. 미확정이면 빈 문자열 (3단계 상품번호 링크에 사용) */
  const [smartstoreUrl, setSmartstoreUrl] = useState('');

  /** 4단계가 올려 주는 진행 상태. 상단 단계 배지 문구에만 사용합니다. */
  const [step4Phase, setStep4Phase] = useState<Step4Phase>('blocked');

  const isMatchCompleted = matchSummary?.completed ?? false;

  // 데이터 확인이 끝나면 3단계를 활성화하고, 매칭까지 끝나면 3단계도 완료로 표시합니다.
  const currentStep = !result ? 1 : isMatchCompleted ? 4 : 3;

  /**
   * 엑셀 행을 네이버 상품번호로 묶습니다.
   * 대표 상품명은 같은 상품번호에서 가장 많이 나온 이름을 씁니다.
   */
  const naverProductGroups = useMemo<NaverProductGroup[]>(() => {
    if (!result) return [];

    const grouped = new Map<string, { reviewCount: number; nameCounts: Map<string, number> }>();

    for (const row of result.rows) {
      const productNo = row.productNo.trim();
      if (!productNo) continue;

      let entry = grouped.get(productNo);
      if (!entry) {
        entry = { reviewCount: 0, nameCounts: new Map() };
        grouped.set(productNo, entry);
      }

      entry.reviewCount += 1;

      const name = row.productName.trim();
      if (name) {
        entry.nameCounts.set(name, (entry.nameCounts.get(name) ?? 0) + 1);
      }
    }

    return [...grouped.entries()]
      .map(([naverProductNo, entry]) => {
        let productName = '';
        let topCount = 0;

        // Map은 삽입 순서를 지키므로 같은 횟수면 먼저 나온 이름이 뽑힙니다.
        for (const [name, count] of entry.nameCounts) {
          if (count > topCount) {
            topCount = count;
            productName = name;
          }
        }

        return { naverProductNo, productName, reviewCount: entry.reviewCount };
      })
      .sort(
        (a, b) => b.reviewCount - a.reviewCount || a.naverProductNo.localeCompare(b.naverProductNo)
      );
  }, [result]);

  const handleMatchSummaryChange = useCallback((summary: ProductMatchSummary) => {
    setMatchSummary(summary);
  }, []);

  const handleMatchEntriesChange = useCallback((entries: ProductMatchEntry[]) => {
    setMatchEntries(entries);
  }, []);

  const matchEntryByNaverProductNo = useMemo(
    () => new Map(matchEntries.map((entry) => [entry.naverProductNo, entry])),
    [matchEntries]
  );

  /**
   * 4단계 중복 검사에 보낼 리뷰와, 보내지 않는 리뷰의 수를 계산합니다.
   *
   * - 확정된 상품의 리뷰만 보냅니다. 건너뛴 상품의 리뷰는 수량만 따로 보여 줍니다.
   * - 리뷰글번호가 없거나 파일 안에서 중복인 행은 서버가 거절하므로 미리 빼 둡니다.
   * - 이 값이 새로 계산되면 4단계가 이전 검사 결과를 지웁니다.
   */
  const duplicateCheckInput = useMemo(() => {
    const targets: DuplicateCheckRequestReview[] = [];
    /** 같은 리뷰에 게시글 제목·첨부용 값을 더한 목록. 실제 등록에만 씁니다. */
    const registerTargets: RegisterReviewInput[] = [];
    const seenReviewNo = new Set<string>();

    let skippedReviewCount = 0;
    let unresolvedReviewCount = 0;
    let excludedReviewCount = 0;

    for (const row of result?.rows ?? []) {
      const entry = matchEntryByNaverProductNo.get(row.productNo.trim());

      if (!entry) {
        unresolvedReviewCount += 1;
        continue;
      }

      if (entry.status === 'skipped' || entry.cafe24ProductNo === null) {
        skippedReviewCount += 1;
        continue;
      }

      const naverReviewId = row.reviewNo.trim();
      if (!naverReviewId || seenReviewNo.has(naverReviewId)) {
        excludedReviewCount += 1;
        continue;
      }
      seenReviewNo.add(naverReviewId);

      const target: DuplicateCheckRequestReview = {
        naverReviewId,
        cafe24ProductNo: entry.cafe24ProductNo,
        content: row.content,
        rating: row.ratingValue,
        writer: row.writer,
        registeredAt: row.writtenAt,
      };

      targets.push(target);
      registerTargets.push({
        ...target,
        productName: row.productName,
        imageRaw: row.imageRaw,
      });
    }

    return {
      targets,
      registerTargets,
      skippedReviewCount,
      unresolvedReviewCount,
      excludedReviewCount,
    };
  }, [result, matchEntryByNaverProductNo]);

  /** 중복 검사를 막는 이유. 비어 있으면 실행할 수 있습니다. */
  const duplicateCheckBlockReasons = useMemo(() => {
    const reasons: string[] = [];

    if (!result) {
      reasons.push('먼저 1~2단계에서 엑셀 파일을 검사해 주세요.');
    }

    if (!cafe24Status?.connected) {
      reasons.push('카페24 연결이 필요합니다. 위 카페24 연결 영역에서 먼저 연결해 주세요.');
    }

    if (result && !isMatchCompleted) {
      reasons.push('3단계에서 모든 네이버 상품을 확정하거나 건너뛰기로 정해 주세요.');
    }

    if (result && isMatchCompleted && (matchSummary?.confirmed ?? 0) === 0) {
      reasons.push('확정한 카페24 상품이 없습니다. 상품을 최소 한 개 확정해 주세요.');
    }

    if (reasons.length === 0 && duplicateCheckInput.targets.length === 0) {
      reasons.push('검사할 수 있는 리뷰가 없습니다. 상품 매칭과 리뷰글번호를 확인해 주세요.');
    }

    if (duplicateCheckInput.targets.length > MAX_REVIEW_ROWS) {
      reasons.push(
        `한 번에 검사할 수 있는 리뷰는 최대 ${MAX_REVIEW_ROWS.toLocaleString()}건입니다.`
      );
    }

    return reasons;
  }, [result, cafe24Status?.connected, isMatchCompleted, matchSummary, duplicateCheckInput]);

  /**
   * status API 한 번으로 접근 권한과 연결 상태를 동시에 처리합니다.
   * 최초 로드, `?cafe24=connected` 복귀, 연결 해제 후 갱신, 다시 시도 모두 이 함수를 재사용합니다.
   */
  const loadCafe24Status = useCallback(async () => {
    setIsStatusLoading(true);
    setStatusError('');

    try {
      const res = await fetch('/api/review-migration/cafe24/status', { cache: 'no-store' });

      // 서버 가드가 명확히 거부한 경우에만 접근을 차단합니다.
      if (res.status === 401 || res.status === 403) {
        setDeniedStatus(res.status);
        setAccessState('denied');
        return;
      }

      if (!res.ok) {
        // 5xx 등 서버 오류는 로그아웃·권한 없음으로 처리하지 않습니다.
        setAccessState((prev) => (prev === 'granted' ? prev : 'error'));
        setStatusError('권한 확인 중 오류가 발생했습니다. 다시 시도해 주세요.');
        return;
      }

      // 200이면 서버 requireAdmin()을 통과한 관리자입니다.
      const data = (await res.json()) as Cafe24Status;
      setCafe24Status(data);
      setAccessState('granted');
    } catch {
      // 네트워크 오류도 권한 없음으로 처리하지 않습니다.
      setAccessState((prev) => (prev === 'granted' ? prev : 'error'));
      setStatusError('권한 확인 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsStatusLoading(false);
    }
  }, []);

  // 최초 로드: OAuth 콜백 결과(?cafe24=...)를 안내로 바꾸고 주소에서 지운 뒤 status를 한 번만 호출합니다.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('cafe24');

    if (outcome === 'connected') {
      setCafe24Notice('카페24 연결이 완료되었습니다.');
    } else if (outcome === 'error') {
      const code = params.get('code') ?? '';
      setCafe24Error(CAFE24_ERROR_MESSAGES[code] ?? '카페24 연결에 실패했습니다. 다시 시도해 주세요.');
    }

    if (outcome) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    void loadCafe24Status();
  }, [loadCafe24Status]);

  // 이동은 status API가 401/403을 돌려준 뒤에만 실행됩니다. (200 이전에는 실행될 수 없습니다)
  useEffect(() => {
    if (accessState !== 'denied') return;
    if (alertShown.current) return;

    alertShown.current = true;
    alert(deniedStatus === 401 ? '로그인이 필요합니다.' : '접근 권한이 없습니다.');
    router.replace('/');
  }, [accessState, deniedStatus, router]);

  // 허용 권한 모달은 ESC로도 닫힙니다. (열려 있는 동안만 키 입력을 듣습니다)
  useEffect(() => {
    if (!isScopeModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsScopeModalOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isScopeModalOpen]);

  const handleConnect = () => {
    // state 쿠키를 서버에서 심어야 하므로 authorize 라우트로 직접 이동합니다.
    window.location.href = '/api/review-migration/cafe24/authorize';
  };

  const handleDisconnect = async () => {
    if (isDisconnecting) return;
    if (!window.confirm('카페24 연결을 해제할까요?')) return;

    setIsDisconnecting(true);
    setCafe24Error('');
    setCafe24Notice('');

    try {
      const res = await fetch('/api/review-migration/cafe24/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (!res.ok) {
        setCafe24Error(typeof data?.error === 'string' ? data.error : '연결 해제에 실패했습니다.');
        return;
      }

      setCafe24Notice('카페24 연결을 해제했습니다.');
      setCafe24Status({ connected: false, mallId: cafe24Status?.mallId });
    } catch {
      setCafe24Error('연결 해제 요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsDisconnecting(false);
      void loadCafe24Status();
    }
  };

  const resetResult = () => {
    setResult(null);
    setShowProblemOnly(false);
    setPage(1);
    setExpandedRows({});
    // 새 파일을 검사하면 상품 그룹이 바뀌므로 진행 상황도 초기화합니다.
    // 매칭 결과가 비면 4단계 검사 대상도 새로 계산되어 이전 중복 검사 결과가 지워집니다.
    setMatchSummary(null);
    setMatchEntries([]);
  };

  const selectFile = (selected: File | null) => {
    setErrorMessage('');
    setMissingColumns([]);
    resetResult();

    if (!selected) {
      setFile(null);
      return;
    }

    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      setFile(null);
      setErrorMessage('.xlsx 파일만 업로드할 수 있습니다. 엑셀에서 "Excel 통합 문서(.xlsx)"로 저장해 주세요.');
      return;
    }

    if (selected.size > MAX_FILE_BYTES) {
      setFile(null);
      setErrorMessage(`파일 크기가 10MB를 넘습니다. (현재 ${formatFileSize(selected.size)})`);
      return;
    }

    setFile(selected);
  };

  const handleAnalyze = async () => {
    if (!file || isUploading) return;

    setIsUploading(true);
    setErrorMessage('');
    setMissingColumns([]);
    resetResult();

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/review-migration/parse-excel', {
        method: 'POST',
        body: formData,
      });

      const data: ParseResponse = await res.json();

      if (!data.ok) {
        setErrorMessage(rowLimitMessage(data) ?? data.error);
        setMissingColumns(data.missingColumns ?? []);
        return;
      }

      setResult(data);
    } catch {
      setErrorMessage('파일을 분석하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsUploading(false);
    }
  };

  const visibleRows = useMemo(() => {
    if (!result) return [];
    return showProblemOnly ? result.rows.filter((row) => row.status !== 'ok') : result.rows;
  }, [result, showProblemOnly]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = visibleRows.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  const toggleRow = (excelRow: number) => {
    setExpandedRows((prev) => ({ ...prev, [excelRow]: !prev[excelRow] }));
  };

  // status 응답이 오기 전에는 어떤 판정도 내리지 않고 대기 화면을 유지합니다.
  if (accessState === 'checking') {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center font-bold text-slate-500">
        권한 확인 중...
      </div>
    );
  }

  // 네트워크 오류·5xx: 메인으로 보내지 않고 재시도를 안내합니다.
  if (accessState === 'error') {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8 text-center max-w-md w-full">
          <p className="text-sm font-bold text-gray-800 leading-relaxed">
            {statusError || '권한 확인 중 오류가 발생했습니다. 다시 시도해 주세요.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setAccessState('checking');
              void loadCafe24Status();
            }}
            className="mt-5 px-6 h-[46px] bg-[#5244e8] hover:bg-blue-700 !text-white font-bold text-sm rounded-md transition-colors shadow-sm"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 401/403: 위 useEffect가 안내 후 메인으로 이동시키는 동안 아무것도 그리지 않습니다.
  if (accessState !== 'granted') {
    return null;
  }

  return (
    <>
    <link
      href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css"
      rel="stylesheet"
      type="text/css"
    />
    <div
      className="flex min-h-screen bg-[#f8f9fa] !text-black antialiased tracking-tight"
      style={{ fontFamily: "'NanumSquare', sans-serif" }}
    >
      <main className="flex-1 min-w-0 lg:ml-64 p-4 sm:p-6 lg:p-10">
        <div className="max-w-7xl mx-auto">
          {/* 제목 */}
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold !text-gray-900 mb-2">코만도몰 리뷰 이전</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              네이버 스마트스토어에서 내려받은 리뷰 엑셀을 올리면 내용을 검사해서 미리 보여 드립니다.
            </p>
            <p className="text-sm font-bold text-blue-600 mt-1">
              ※ 이번 단계는 확인까지만 합니다. 카페24에는 아직 아무것도 등록되지 않습니다.
            </p>
          </div>

          {/*
            상단 고정 설정 영역 (PC 전용).
            왼쪽 6(카페24 연결) : 오른쪽 4(스마트스토어 주소) 비율이고,
            격자 기본값인 items-stretch로 두 카드의 상단선·하단선을 맞춥니다.
            진행 단계는 이 격자 밖에서 전체 너비를 씁니다.
          */}
          <div className="grid grid-cols-[6fr_4fr] gap-6 mb-6">
            {/* 왼쪽 60%: 카페24 연결 */}
            <section className="min-w-0 bg-[#F6F7FF] p-5 sm:p-6 rounded-lg shadow-sm border border-[#E3E5FF]">
              <h2 className="text-[15px] font-bold text-gray-900 mb-1">카페24 연결</h2>
              <p className="text-[13px] text-gray-500 mb-4 leading-relaxed">
                리뷰를 등록하려면 먼저 카페24 쇼핑몰과 연결해야 합니다. 연결 정보는 서버에 암호화해서 보관합니다.
              </p>

              {cafe24Notice && (
                <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                  <p className="text-[13px] font-bold text-emerald-700 leading-relaxed">{cafe24Notice}</p>
                </div>
              )}

              {cafe24Error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-[13px] font-bold text-red-600 leading-relaxed">{cafe24Error}</p>
                </div>
              )}

              {/* 화면을 이미 보고 있는 상태에서 상태 갱신만 실패한 경우 */}
              {statusError && (
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="text-[13px] font-bold text-amber-700 leading-relaxed flex-1">{statusError}</p>
                  <button
                    type="button"
                    onClick={() => void loadCafe24Status()}
                    className="shrink-0 px-4 py-2 !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[13px] rounded-md transition-colors shadow-sm"
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {isStatusLoading ? (
                <p className="text-[13px] font-bold text-gray-400">연결 상태를 확인하는 중...</p>
              ) : cafe24Status?.connected ? (
                <>
                  {/*
                    상태 카드 2열 2행.
                    카드 안에서는 제목(회색)과 값을 한 줄에 놓고, 긴 날짜가 줄바꿈되지
                    않도록 whitespace-nowrap을 주고 폭이 부족하면 값만 잘라 냅니다.
                  */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
                      <p className="shrink-0 text-[12px] font-bold text-gray-500 whitespace-nowrap">쇼핑몰 ID</p>
                      <p className="min-w-0 text-[13px] font-bold text-gray-800 whitespace-nowrap truncate">
                        {cafe24Status.mallId}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
                      <p className="shrink-0 text-[12px] font-bold text-gray-500 whitespace-nowrap">연결 상태</p>
                      <p className="min-w-0 text-[13px] font-bold text-emerald-600 whitespace-nowrap truncate">
                        연결됨 (상점 {cafe24Status.shopNo ?? 1}번)
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
                      <p className="shrink-0 text-[12px] font-bold text-gray-500 whitespace-nowrap">
                        접속 권한 만료 예정
                      </p>
                      <p className="min-w-0 text-[13px] font-bold text-gray-800 whitespace-nowrap truncate">
                        {formatDateTime(cafe24Status.accessTokenExpiresAt)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
                      <p className="shrink-0 text-[12px] font-bold text-gray-500 whitespace-nowrap">
                        재연결 없이 사용 가능
                      </p>
                      <p className="min-w-0 text-[13px] font-bold text-gray-800 whitespace-nowrap truncate">
                        {formatDateTime(cafe24Status.refreshTokenExpiresAt)}까지
                      </p>
                    </div>
                  </div>

                  {/* 상태 카드 바로 아래 버튼 영역. 두 버튼의 높이·좌우 여백을 같게 맞춥니다. */}
                  <div className="mt-5 flex items-center justify-center gap-3">
                    {(cafe24Status.scopes?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsScopeModalOpen(true)}
                        className="px-5 h-[46px] !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-sm rounded-md transition-colors shadow-sm"
                      >
                        허용된 권한 보기
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                      className="px-5 h-[46px] !bg-red-100 hover:!bg-red-200 border-2 border-red-200 !text-red-700 font-bold text-sm rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isDisconnecting && (
                        <span className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      )}
                      {isDisconnecting ? '해제하는 중...' : '연결 해제'}
                    </button>
                  </div>

                  <p className="mt-2 text-[12px] text-gray-400 text-center leading-relaxed">
                    연결을 해제하면 카페24에 저장된 접근 권한도 함께 폐기됩니다.
                  </p>
                </>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="w-full sm:w-auto px-6 h-[46px] bg-[#5244e8] hover:bg-blue-700 !text-white font-bold text-sm rounded-md transition-colors shadow-sm"
                  >
                    카페24 연결하기
                  </button>
                  <p className="text-[12px] text-gray-400 leading-relaxed">
                    카페24 로그인 화면으로 이동한 뒤, 앱 권한에 동의하면 연결이 끝납니다.
                  </p>
                </div>
              )}
            </section>

            {/*
              오른쪽 40%: 네이버 스마트스토어 주소.
              확정 URL은 이 페이지에서 들고 있다가 3단계의 상품번호 링크에 넘깁니다.
              mallId가 바뀌면 저장 값을 새로 읽어야 하므로 key로 다시 마운트합니다.
            */}
            <SmartstoreAddress
              key={cafe24Status?.mallId ?? ''}
              mallId={cafe24Status?.mallId ?? ''}
              onConfirmedChange={setSmartstoreUrl}
            />
          </div>

          {/* 진행 단계 — 가로 4칸, 같은 너비·높이. 판정 로직은 기존과 같습니다. */}
          <ol className="grid grid-cols-4 gap-3 mb-8">
            {STEPS.map((step) => {
              const isActive = step.no === currentStep;
              const isDone = step.no < currentStep;

              return (
                <li
                  key={step.no}
                  className={`flex items-center gap-3 h-[64px] px-4 rounded-lg border ${
                    isActive ? 'bg-[#5244e8]/5 border-[#5244e8]' : 'bg-white border-gray-200'
                  }`}
                >
                  <span
                    className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[12px] font-bold ${
                      isDone
                        ? 'bg-emerald-500 !text-white'
                        : isActive
                          ? 'bg-[#5244e8] !text-white'
                          : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isDone ? '✓' : step.no}
                  </span>

                  <span
                    className={`flex-1 min-w-0 text-[13px] font-bold truncate ${
                      isActive ? 'text-[#5244e8]' : 'text-gray-600'
                    }`}
                  >
                    {step.no}단계. {step.title}
                  </span>

                  {/*
                    4단계는 중복 검사 → 판정 → 등록으로 이어지므로 지금 어디까지 왔는지를 배지로 알려 줍니다.
                    문구와 색은 4단계 컴포넌트가 올려 준 상태 하나로만 정해집니다.
                  */}
                  {step.no === 4 && (
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${STEP4_PHASE_BADGES[step4Phase].toneClass}`}
                    >
                      {STEP4_PHASE_BADGES[step4Phase].label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          {/* 1단계: 엑셀 선택 */}
          <section className="bg-white p-5 sm:p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
            <h2 className="text-[15px] font-bold text-gray-900 mb-1">1단계. 엑셀 선택</h2>
            <p className="text-[13px] text-[#4F46E5] mb-1 leading-relaxed">
              <span className="font-semibold">다운로드 경로:</span> 스마트스토어센터 → 문의/리뷰 관리 →
              리뷰관리 → 검색 → 리뷰목록 우측 [엑셀 다운] 클릭
            </p>
            <p className="text-[13px] text-gray-500 mb-1 leading-relaxed">
              .xlsx 파일당 최대 {MAX_REVIEW_ROWS.toLocaleString()}건까지 처리합니다. 기간을 나누어 업로드할 수
              있으며, 리뷰글번호를 기준으로 파일 내부 및 기존 등록 리뷰의 중복 여부를 확인합니다. 파일의 첫 번째
              시트만 사용합니다.
            </p>
            <p className="text-[12px] text-gray-400 mb-4 leading-relaxed">
              이번 단계에서는 같은 파일 안의 중복 리뷰글번호를 확인합니다. 기존 카페24 리뷰와의 중복 확인은 등록
              단계에서 진행됩니다. 파일 크기는 최대 10MB까지 올릴 수 있습니다.
            </p>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                selectFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
              />

              <p className="text-[13px] text-gray-500 mb-3">
                파일을 이 영역으로 끌어다 놓거나, 아래 버튼을 눌러 선택하세요.
              </p>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-sm rounded-md transition-colors shadow-sm"
              >
                엑셀 파일 선택
              </button>

              {file && (
                <p className="mt-3 text-[13px] font-bold text-gray-700 break-all">
                  {file.name}{' '}
                  <span className="font-medium text-gray-400">({formatFileSize(file.size)})</span>
                </p>
              )}
            </div>

            {/*
              버튼 두 개는 가운데 정렬하고 안내 문구는 그 아래 줄에 따로 둡니다.
              검사에 성공하면(result가 생기면) 같은 파일을 다시 검사할 이유가 없으므로
              문구를 '검사 완료'로 바꾸고 버튼을 잠급니다.
              새 파일을 고르거나 '다시 선택'을 누르면 resetResult()가 result를 비워
              자동으로 '엑셀 검사하기'로 돌아옵니다.
            */}
            <div className="mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!file || isUploading || result !== null}
                  className="w-full sm:w-auto px-6 h-[46px] bg-[#5244e8] hover:bg-blue-700 !text-white font-bold text-sm rounded-md transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUploading && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {isUploading ? '검사 중...' : result ? '검사 완료' : '엑셀 검사하기'}
                </button>

                {(file || result) && !isUploading && (
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) fileInputRef.current.value = '';
                      selectFile(null);
                    }}
                    className="w-full sm:w-auto px-5 h-[46px] !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-sm rounded-md transition-colors shadow-sm"
                  >
                    다시 선택
                  </button>
                )}
              </div>

              <p className="mt-3 text-[12px] text-gray-400 leading-relaxed text-center">
                업로드한 파일은 검사할 때만 잠시 사용하고 저장하지 않습니다.
              </p>
            </div>

            {errorMessage && (
              <div className="mt-4 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-red-600 leading-relaxed">{errorMessage}</p>
                  {missingColumns.length > 0 && (
                    <p className="text-[12px] text-red-500 mt-1 leading-relaxed">
                      엑셀 첫 행에 다음 열 이름이 그대로 있어야 합니다: {REQUIRED_COLUMN_LABELS.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            <details className="mt-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <summary className="text-[13px] font-bold text-gray-600 cursor-pointer">
                필수 열 목록 보기
              </summary>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {REQUIRED_COLUMN_LABELS.map((label) => (
                  <li
                    key={label}
                    className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[12px] text-gray-600"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </details>
          </section>

          {/* 2단계: 데이터 확인 */}
          {result && (
            <section className="mb-8">
              <h2 className="text-[15px] font-bold text-gray-900 mb-1">2단계. 데이터 확인</h2>
              <p className="text-[13px] text-gray-500 mb-4 break-all">
                파일: <b className="text-gray-700">{result.fileName}</b> / 시트:{' '}
                <b className="text-gray-700">{result.sheetName}</b>
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
                <SummaryCard label="전체 리뷰 수" value={result.summary.totalCount} />
                <SummaryCard label="상품 수" value={result.summary.productCount} hint="상품번호 기준" />
                <SummaryCard
                  label="포토/영상 리뷰"
                  value={result.summary.photoCount}
                  hint="일반·한달사용과 중복 집계"
                />
                <SummaryCard label="일반 리뷰" value={result.summary.generalCount} hint="리뷰구분 기준" />
                <SummaryCard label="한달사용 리뷰" value={result.summary.monthUseCount} hint="리뷰구분 기준" />
                <SummaryCard
                  label="누락·잘못된 데이터"
                  value={result.summary.invalidCount}
                  hint={`파일 안 리뷰글번호 중복 ${result.summary.duplicateCount.toLocaleString()}건`}
                  tone="warn"
                />
              </div>

              {/*
                중복 안내는 지금 실제로 하는 검사만 이야기합니다.
                기존 카페24 리뷰와의 비교는 아직 연결되지 않았습니다.
              */}
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-[13px] font-bold text-gray-600 leading-relaxed">
                  같은 파일 안의 중복 리뷰글번호를 확인합니다. 기존 카페24 리뷰와의 중복 확인은 등록 단계에서
                  진행됩니다.
                </p>
                <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">
                  전체 {result.totalRowCount.toLocaleString()}건을 모두 검사하고 아래 표에 그대로 표시합니다.
                  (한 파일당 최대 {result.maxRowCount.toLocaleString()}건)
                </p>
              </div>

              {/* 표 도구 */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <label className="flex items-center gap-2 text-[13px] font-bold text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showProblemOnly}
                    onChange={(e) => {
                      setShowProblemOnly(e.target.checked);
                      setPage(1);
                    }}
                    className="w-4 h-4 accent-[#5244e8]"
                  />
                  문제 있는 행만 보기
                </label>
                <span className="text-[13px] font-bold text-gray-500">
                  {visibleRows.length.toLocaleString()}건 표시 중 ({safePage} / {totalPages} 쪽)
                </span>
              </div>

              {/* 미리보기 표 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
                <table className="w-full min-w-[1180px] text-sm text-left">
                  <thead className="bg-[#f8f9fa] border-b border-gray-200 text-gray-700 font-bold">
                    <tr>
                      <th className="px-3 py-2.5 whitespace-nowrap">리뷰글번호</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">상품번호</th>
                      <th className="px-3 py-2.5 min-w-[160px]">상품명</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">리뷰구분</th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap">구매자평점</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">등록자</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">리뷰등록일</th>
                      <th className="px-3 py-2.5 min-w-[280px]">리뷰상세내용</th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap">이미지</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">상품주문번호</th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap">검증상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-3 py-10 text-center text-gray-400 text-[13px]">
                          표시할 행이 없습니다.
                        </td>
                      </tr>
                    )}

                    {pagedRows.map((row) => {
                      const isExpanded = expandedRows[row.excelRow] ?? false;
                      const oneLine = toOneLine(row.content);
                      const needsToggle = oneLine.length > CONTENT_PREVIEW_CHARS || row.contentTruncated;

                      return (
                        <tr
                          key={row.excelRow}
                          className={`border-b border-gray-200 last:border-0 align-top ${
                            row.status === 'error'
                              ? 'bg-red-50/60'
                              : row.status === 'duplicate'
                                ? 'bg-amber-50/60'
                                : ''
                          }`}
                        >
                          <td className="px-3 py-3 font-bold text-gray-700 whitespace-nowrap">
                            {row.reviewNo || <span className="text-red-500">없음</span>}
                          </td>
                          <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                            {row.productNo || <span className="text-red-500">없음</span>}
                          </td>
                          <td className="px-3 py-3 text-gray-600">{row.productName}</td>
                          <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{row.reviewType}</td>
                          <td className="px-3 py-3 text-center font-bold text-gray-700 whitespace-nowrap">
                            {row.ratingValue ?? row.rating ?? ''}
                          </td>
                          <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{row.writer}</td>
                          <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{row.writtenAt}</td>

                          <td className="px-3 py-3 text-gray-700">
                            {/*
                              리뷰 내용은 HTML로 해석하지 않고 문자열 그대로 출력합니다.
                              (dangerouslySetInnerHTML 사용 금지)
                            */}
                            {isExpanded ? (
                              <p className="whitespace-pre-wrap break-words leading-relaxed">
                                {row.content}
                                {row.contentTruncated && (
                                  <span className="text-gray-400"> … (내용이 길어 일부만 표시)</span>
                                )}
                              </p>
                            ) : (
                              <p className="break-words leading-relaxed">
                                {oneLine.slice(0, CONTENT_PREVIEW_CHARS)}
                                {needsToggle && '…'}
                              </p>
                            )}

                            {needsToggle && (
                              <button
                                type="button"
                                onClick={() => toggleRow(row.excelRow)}
                                className="mt-1 text-[12px] font-bold !text-[#5244e8] hover:underline"
                              >
                                {isExpanded ? '접기' : '전체 보기'}
                              </button>
                            )}

                            {row.issues.length > 0 && (
                              <ul className="mt-2 space-y-0.5">
                                {row.issues.map((issue, idx) => (
                                  <li key={idx} className="text-[12px] font-bold text-red-500 leading-tight">
                                    · {issue}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>

                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            {row.hasImage ? (
                              <span className="text-[12px] font-bold text-[#5244e8]">있음</span>
                            ) : (
                              <span className="text-[12px] text-gray-400">없음</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{row.orderNo}</td>
                          <td className="px-3 py-3 text-center">
                            <StatusBadge status={row.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 쪽 이동 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={safePage <= 1}
                    className="px-4 py-2 !bg-white hover:!bg-gray-100 border-2 border-gray-400 rounded-md text-[13px] font-bold !text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <span className="text-[13px] font-bold text-gray-600">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={safePage >= totalPages}
                    className="px-4 py-2 !bg-white hover:!bg-gray-100 border-2 border-gray-400 rounded-md text-[13px] font-bold !text-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              )}
            </section>
          )}

          {/* 3단계: 상품 매칭 */}
          {result && (
            <Step3ProductMatch
              groups={naverProductGroups}
              mallId={cafe24Status?.mallId ?? ''}
              smartstoreUrl={smartstoreUrl}
              onSummaryChange={handleMatchSummaryChange}
              onMatchesChange={handleMatchEntriesChange}
            />
          )}

          {/* 4단계: 등록 전 중복 검사 (실제 카페24 등록은 아직 없습니다) */}
          <Step4DuplicateCheck
            targetReviews={duplicateCheckInput.targets}
            registerTargets={duplicateCheckInput.registerTargets}
            skippedReviewCount={duplicateCheckInput.skippedReviewCount}
            unresolvedReviewCount={duplicateCheckInput.unresolvedReviewCount}
            excludedReviewCount={duplicateCheckInput.excludedReviewCount}
            blockReasons={duplicateCheckBlockReasons}
            cafe24Connected={Boolean(cafe24Status?.connected)}
            cafe24Scopes={cafe24Status?.scopes ?? []}
            onPhaseChange={setStep4Phase}
          />

          {/*
            허용 권한 모달.
            어두운 배경을 누르면 닫히고, 모달 안쪽 클릭은 전파를 멈춰 닫히지 않습니다.
            scope 값은 status API가 내려준 것을 그대로 보여 줍니다.
          */}
          {isScopeModalOpen && (
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              onClick={() => setIsScopeModalOpen(false)}
            >
              <div className="absolute inset-0 bg-black/50" />

              <div
                className="relative z-10 w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden bg-white rounded-lg border border-gray-200 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-4 px-5 py-4 bg-gray-50 border-b border-gray-200 shrink-0">
                  <h3 className="text-[15px] font-bold text-gray-900">카페24 허용 권한</h3>
                  <button
                    type="button"
                    onClick={() => setIsScopeModalOpen(false)}
                    aria-label="닫기"
                    className="shrink-0 p-1 rounded-full !bg-transparent hover:!bg-gray-200 !text-gray-400 hover:!text-gray-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="px-5 py-4 overflow-y-auto">
                  <ul className="flex flex-wrap gap-1.5">
                    {cafe24Status?.scopes?.map((scope) => (
                      <li
                        key={scope}
                        className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[12px] text-gray-600 break-all"
                      >
                        {scope}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-center px-5 py-4 bg-gray-50 border-t border-gray-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsScopeModalOpen(false)}
                    className="px-5 h-[42px] !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-sm rounded-md transition-colors shadow-sm"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
    </>
  );
}
