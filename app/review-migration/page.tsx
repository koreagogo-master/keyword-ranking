'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { REQUIRED_COLUMN_LABELS } from './types';
import type { ParseResponse, ParseSuccess, ReviewRow } from './types';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ROWS_PER_PAGE = 50;
const CONTENT_PREVIEW_CHARS = 60;

const STEPS = [
  { no: 1, title: '엑셀 선택', ready: true },
  { no: 2, title: '데이터 확인', ready: true },
  { no: 3, title: '상품 매칭', ready: false },
  { no: 4, title: '카페24 등록', ready: false },
];

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

  const currentStep = result ? 2 : 1;

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
        setErrorMessage(data.error);
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

          {/* 단계 표시 */}
          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-8">
            {STEPS.map((step) => {
              const isActive = step.ready && step.no === currentStep;
              const isDone = step.ready && step.no < currentStep;

              return (
                <li
                  key={step.no}
                  className={`rounded-lg border px-3 py-3 ${
                    !step.ready
                      ? 'bg-gray-50 border-gray-200'
                      : isActive
                        ? 'bg-[#5244e8]/5 border-[#5244e8]'
                        : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12px] font-bold ${
                        !step.ready
                          ? 'bg-gray-200 text-gray-400'
                          : isDone
                            ? 'bg-emerald-500 !text-white'
                            : isActive
                              ? 'bg-[#5244e8] !text-white'
                              : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isDone ? '✓' : step.no}
                    </span>
                    <span
                      className={`text-[13px] font-bold truncate ${
                        !step.ready ? 'text-gray-400' : isActive ? 'text-[#5244e8]' : 'text-gray-600'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {!step.ready && (
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-200 text-gray-500">
                      준비 중
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          {/* 카페24 연결 */}
          <section className="bg-white p-5 sm:p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-[12px] font-bold text-gray-500 mb-1">쇼핑몰 ID</p>
                    <p className="text-[14px] font-bold text-gray-800 break-all">{cafe24Status.mallId}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-[12px] font-bold text-gray-500 mb-1">연결 상태</p>
                    <p className="text-[14px] font-bold text-emerald-600">
                      연결됨 (상점 {cafe24Status.shopNo ?? 1}번)
                    </p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-[12px] font-bold text-gray-500 mb-1">접속 권한 만료 예정</p>
                    <p className="text-[14px] font-bold text-gray-800">
                      {formatDateTime(cafe24Status.accessTokenExpiresAt)}
                    </p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-[12px] font-bold text-gray-500 mb-1">재연결 없이 사용 가능</p>
                    <p className="text-[14px] font-bold text-gray-800">
                      {formatDateTime(cafe24Status.refreshTokenExpiresAt)}까지
                    </p>
                  </div>
                </div>

                {(cafe24Status.scopes?.length ?? 0) > 0 && (
                  <details className="mt-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <summary className="text-[13px] font-bold text-gray-600 cursor-pointer">
                      허용된 권한 보기
                    </summary>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {cafe24Status.scopes?.map((scope) => (
                        <li
                          key={scope}
                          className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[12px] text-gray-600 break-all"
                        >
                          {scope}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="w-full sm:w-auto px-5 h-[46px] !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-sm rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isDisconnecting && (
                      <span className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                    )}
                    {isDisconnecting ? '해제하는 중...' : '연결 해제'}
                  </button>
                  <p className="text-[12px] text-gray-400 leading-relaxed">
                    연결을 해제하면 카페24에 저장된 접근 권한도 함께 폐기됩니다.
                  </p>
                </div>
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

          {/* 1단계: 엑셀 선택 */}
          <section className="bg-white p-5 sm:p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
            <h2 className="text-[15px] font-bold text-gray-900 mb-1">1단계. 엑셀 선택</h2>
            <p className="text-[13px] text-gray-500 mb-4 leading-relaxed">
              .xlsx 파일만 올릴 수 있고, 최대 10MB까지 가능합니다. 파일의 <b>첫 번째 시트</b>만 사용합니다.
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

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!file || isUploading}
                className="w-full sm:w-auto px-6 h-[46px] bg-[#5244e8] hover:bg-blue-700 !text-white font-bold text-sm rounded-md transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {isUploading ? '검사 중...' : '엑셀 검사하기'}
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

              <p className="text-[12px] text-gray-400 leading-relaxed">
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
                  hint={`리뷰글번호 중복 ${result.summary.duplicateCount.toLocaleString()}건`}
                  tone="warn"
                />
              </div>

              {result.truncated && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="text-[13px] font-bold text-amber-700 leading-relaxed">
                    요약은 전체 {result.totalRowCount.toLocaleString()}건을 기준으로 계산했지만, 아래 표에는
                    앞에서부터 {result.rows.length.toLocaleString()}건만 표시됩니다.
                  </p>
                </div>
              )}

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

          {/* 3·4단계 안내 */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STEPS.filter((step) => !step.ready).map((step) => (
              <div key={step.no} className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-5">
                <p className="text-[13px] font-bold text-gray-500 mb-1">
                  {step.no}단계. {step.title}
                </p>
                <p className="text-[12px] text-gray-400 leading-relaxed">
                  {step.no === 3
                    ? '네이버 상품번호와 카페24 상품을 연결하는 기능입니다. 다음 단계에서 만듭니다.'
                    : '검사한 리뷰를 카페24에 등록하는 기능입니다. 다음 단계에서 만듭니다.'}
                </p>
              </div>
            ))}
          </section>
        </div>
      </main>
    </div>
    </>
  );
}
