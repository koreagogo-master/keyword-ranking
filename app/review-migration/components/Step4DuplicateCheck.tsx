'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyAdminDecisions,
  canAdminDecide,
  clearAdminDecision,
  countAdminDecisions,
  countDuplicateStatuses,
  pendingNeedsReviewIds,
  registrationCandidateIds,
  resolveAdminDecision,
  resolveDuplicateStatus,
} from '../adminDecision';
import type {
  AdminDecisionMap,
  AdminDuplicateDecision,
  DuplicateCheckFailure,
  DuplicateCheckRequestReview,
  DuplicateCheckResultItem,
  DuplicateCheckSuccess,
  DuplicateMatchedFields,
  DuplicateReason,
  DuplicateStatus,
  RegisterReviewInput,
} from '../types';
import Cafe24ReviewRegister, { type RegisterPhase } from './Cafe24ReviewRegister';

/**
 * 4단계. 등록 전 기존 카페24 리뷰 중복 검사 + 관리자 판정.
 *
 * 검사 기준(엑셀·상품 매칭·카페24 연결)이 바뀌면 이전 검사 결과와 관리자 판정을 바로 지웁니다.
 * 실제 카페24 등록은 아래 Cafe24ReviewRegister 영역이 담당하며,
 * 관리자가 최종 확인을 통과한 뒤 등록 버튼을 직접 누른 경우에만 실행됩니다.
 *
 * 관리자 판정은 서버 응답을 고쳐 쓰지 않고 adminDecisions(리뷰글번호 → duplicate·new)에만 담습니다.
 * 요약 카드·필터·등록 후보는 서버 판정과 이 값을 합쳐 매번 다시 계산합니다.
 */

const RESULTS_PER_PAGE = 50;

/**
 * 안내 문구에만 쓰는 본문 유사도 기준(%)입니다.
 * 실제 판정은 서버의 CONTENT_SIMILARITY_THRESHOLD(app/lib/cafe24/reviewNormalize.ts)가 합니다.
 * 그 파일은 node:crypto를 쓰는 서버 전용 모듈이라 화면에서 import 하지 않습니다.
 */
const CONTENT_SIMILARITY_THRESHOLD_PERCENT = 30;

/**
 * 'duplicate'는 서버가 리뷰글번호로 판정한 건과 관리자가 직접 확정한 건을 함께 담기 때문에
 * '확실한 중복'이 아니라 '중복 확정'으로 부릅니다.
 */
const STATUS_LABELS: Record<DuplicateStatus, string> = {
  duplicate: '중복 확정',
  needs_review: '확인 필요',
  new: '신규 등록 후보',
};

const ADMIN_DECISION_LABELS: Record<AdminDuplicateDecision, string> = {
  duplicate: '관리자 중복 확정',
  new: '관리자 신규 유지',
};

const REASON_LABELS: Record<DuplicateReason, string> = {
  naver_review_id: '네이버 리뷰글번호 일치',
  // 서버는 더 이상 이 이유를 내보내지 않습니다. (예전 응답 호환용 문구)
  legacy_strong_match: '기존 리뷰 정보 강한 일치',
  legacy_possible_match: '날짜·상품·작성자·평점·작성시각·본문 유사',
  no_match: '기존 리뷰에서 일치 항목 없음',
};

const ERROR_MESSAGES: Record<string, string> = {
  not_connected: '카페24 연결이 필요합니다. 먼저 카페24를 연결해 주세요.',
  reauth_required: '카페24 재연결이 필요합니다. 연결을 해제한 뒤 다시 연결해 주세요.',
  network_error: '카페24에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  rate_limited: '카페24 호출 제한에 걸렸습니다. 잠시 후 다시 시도해 주세요.',
  cafe24_unavailable: '카페24 서비스가 일시적으로 응답하지 않습니다.',
  forbidden_origin: '요청이 거절되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
};

const DEFAULT_ERROR_MESSAGE = '중복 검사를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';

type FilterKey = 'all' | DuplicateStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'duplicate', label: STATUS_LABELS.duplicate },
  { key: 'needs_review', label: STATUS_LABELS.needs_review },
  { key: 'new', label: STATUS_LABELS.new },
];

export interface Step4DuplicateCheckProps {
  /** 검사 대상 리뷰. confirmed 상품에 속하고 리뷰글번호가 고유한 행만 들어옵니다. */
  targetReviews: DuplicateCheckRequestReview[];
  /** 위 검사 대상과 같은 리뷰에 제목·첨부용 값을 더한 목록. 실제 등록에 씁니다. */
  registerTargets: RegisterReviewInput[];
  /** 건너뛰기로 정한 상품에 속해 검사에서 빼는 리뷰 수 */
  skippedReviewCount: number;
  /** 아직 확정도 건너뛰기도 하지 않은 상품에 속한 리뷰 수 */
  unresolvedReviewCount: number;
  /** 리뷰글번호가 없거나 파일 안에서 중복이라 검사에서 뺀 리뷰 수 */
  excludedReviewCount: number;
  /** 검사를 막는 이유. 비어 있으면 실행할 수 있습니다. */
  blockReasons: string[];
  /** 카페24 연결 여부. 연결이 끊기면 이전 결과를 지웁니다. */
  cafe24Connected: boolean;
  /** 연결된 토큰에 실제로 허용된 권한. mall.write_community가 없으면 등록 전에 재연결이 필요합니다. */
  cafe24Scopes: string[];
  /** 상단 진행 단계 배지에 쓸 4단계 상태를 부모에게 알려 줍니다. */
  onPhaseChange?: (phase: Step4Phase) => void;
}

/** 상단 진행 단계 배지에 쓰는 4단계 상태 */
export type Step4Phase =
  | 'blocked'
  | 'before_check'
  | 'needs_decision'
  | 'ready_to_register'
  | 'registering'
  | 'registered'
  | 'partial';

function StatusBadge({ status }: { status: DuplicateStatus }) {
  const toneClass =
    status === 'duplicate'
      ? 'bg-red-100 text-red-600'
      : status === 'needs_review'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700';

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${toneClass}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

/** 관리자가 직접 판정한 행에만 붙는 배지 (중복 확정은 주황, 신규 유지는 초록) */
function AdminDecisionBadge({ decision }: { decision: AdminDuplicateDecision }) {
  const toneClass =
    decision === 'duplicate' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700';

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${toneClass}`}>
      {ADMIN_DECISION_LABELS[decision]}
    </span>
  );
}

function SummaryTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'warn' | 'danger' | 'good';
}) {
  const valueClass =
    tone === 'danger'
      ? 'text-red-500'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'good'
          ? 'text-emerald-600'
          : 'text-[#5244e8]';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <p className="text-[12px] font-bold text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueClass}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

/** 유사도(0~1)를 백분율 문구로 바꿉니다. */
function similarityText(similarity: number): string {
  return `본문 유사도 ${Math.round(similarity * 100)}%`;
}

/**
 * 일치한 항목만 한국어로 나열합니다. 하나도 없으면 '-'
 * 본문은 완전일치가 아니라 유사도 기준이므로 실제 계산값을 함께 보여 줍니다.
 */
function matchedFieldLabels(item: DuplicateCheckResultItem): string {
  const fields: DuplicateMatchedFields = item.matchedFields;
  const labels: string[] = [];

  if (fields.date === true) labels.push('작성일');
  if (fields.product) labels.push('상품');
  if (fields.writer === true) labels.push('작성자');
  if (fields.rating === true) labels.push('평점');
  if (fields.time === true) labels.push('작성시각');
  if (fields.content) {
    labels.push(
      typeof item.contentSimilarity === 'number' ? similarityText(item.contentSimilarity) : '본문'
    );
  }

  return labels.length > 0 ? labels.join(' · ') : '-';
}

export default function Step4DuplicateCheck({
  targetReviews,
  registerTargets,
  skippedReviewCount,
  unresolvedReviewCount,
  excludedReviewCount,
  blockReasons,
  cafe24Connected,
  cafe24Scopes,
  onPhaseChange,
}: Step4DuplicateCheckProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<DuplicateCheckSuccess | null>(null);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [page, setPage] = useState(1);

  /**
   * 관리자 판정. 리뷰글번호 → 'duplicate' | 'new'
   * 서버 결과와 따로 두고, 검사 결과가 무효화될 때 함께 비웁니다. (저장하지 않습니다)
   */
  const [adminDecisions, setAdminDecisions] = useState<AdminDecisionMap>({});
  /** 일괄 처리용 선택 상태. 미판정 '확인 필요' 행만 담깁니다. */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  /**
   * 등록 영역의 진행 상태. 등록이 시작되면 이 결과로는 다시 등록할 수 없습니다.
   * 상단 진행 단계 배지를 만들 때도 씁니다.
   */
  const [registerPhase, setRegisterPhase] = useState<RegisterPhase>('idle');

  /**
   * 검사 기준이 바뀌면 이전 결과를 즉시 지웁니다.
   * targetReviews는 엑셀 재검사·새 엑셀 선택·상품 매칭 변경 때마다 새 배열로 만들어집니다.
   * 오래된 관리자 판정이 다른 엑셀·다른 상품 매칭에 적용되지 않도록 판정과 선택도 함께 비웁니다.
   */
  useEffect(() => {
    setResult(null);
    setErrorMessage('');
    setFilter('all');
    setPage(1);
    setAdminDecisions({});
    setSelectedIds(new Set());
    setRegisterPhase('idle');
  }, [targetReviews, cafe24Connected]);

  const canCheck = blockReasons.length === 0 && !isChecking;

  const runCheck = async () => {
    if (!canCheck) return;

    setRegisterPhase('idle');

    setIsChecking(true);
    // 실패든 성공이든 이전 결과는 기준이 달라졌을 수 있으므로 먼저 지웁니다.
    // 재검사·검사 실패 모두 이 지점을 지나므로 관리자 판정과 선택도 여기서 비워집니다.
    setResult(null);
    setErrorMessage('');
    setFilter('all');
    setPage(1);
    setAdminDecisions({});
    setSelectedIds(new Set());

    try {
      const res = await fetch('/api/review-migration/cafe24/reviews/duplicate-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviews: targetReviews }),
      });

      const data = (await res.json()) as DuplicateCheckSuccess | DuplicateCheckFailure;

      if (!res.ok || !('ok' in data)) {
        const failure = data as DuplicateCheckFailure;
        setErrorMessage(
          ERROR_MESSAGES[failure.code ?? ''] ?? failure.error ?? DEFAULT_ERROR_MESSAGE
        );
        return;
      }

      setResult(data);
    } catch {
      setErrorMessage(ERROR_MESSAGES.network_error);
    } finally {
      setIsChecking(false);
    }
  };

  const results = useMemo<DuplicateCheckResultItem[]>(() => result?.results ?? [], [result]);

  /** 서버 판정 + 관리자 판정을 합친 상태별 건수. 세 값의 합은 항상 결과 전체 건수입니다. */
  const statusCounts = useMemo(
    () => countDuplicateStatuses(results, adminDecisions),
    [results, adminDecisions]
  );

  /** 아직 판정하지 않은 '확인 필요' 리뷰글번호 (현재 페이지가 아니라 결과 전체) */
  const pendingIds = useMemo(
    () => pendingNeedsReviewIds(results, adminDecisions),
    [results, adminDecisions]
  );

  const adminDecisionCount = useMemo(
    () => countAdminDecisions(results, adminDecisions),
    [results, adminDecisions]
  );

  /** 서버가 '확인 필요'로 판정한 전체 건수. 판정을 끝내도 줄지 않아 일괄 처리 영역 표시 기준으로 씁니다. */
  const decidableCount = useMemo(() => results.filter((item) => canAdminDecide(item)).length, [
    results,
  ]);

  /** 실제로 등록할 최종 후보. 아래 등록 영역이 이 목록만 카페24로 보냅니다. */
  const registrationCandidates = useMemo(
    () => registrationCandidateIds(results, adminDecisions),
    [results, adminDecisions]
  );

  /**
   * 상단 진행 단계 배지용 상태.
   * 등록이 시작된 뒤에는 등록 영역이 알려 준 상태를 그대로 씁니다.
   */
  useEffect(() => {
    if (!onPhaseChange) return;

    if (registerPhase === 'registering') return onPhaseChange('registering');
    if (registerPhase === 'done') return onPhaseChange('registered');
    if (registerPhase === 'stopped') return onPhaseChange('partial');

    if (!result) {
      return onPhaseChange(blockReasons.length > 0 ? 'blocked' : 'before_check');
    }

    onPhaseChange(statusCounts.needsReview > 0 ? 'needs_decision' : 'ready_to_register');
  }, [onPhaseChange, registerPhase, result, blockReasons.length, statusCounts.needsReview]);

  /** 선택 상태에서 이미 판정된 행을 걷어 낸 실제 선택 건수 */
  const selectedPendingIds = useMemo(
    () => pendingIds.filter((id) => selectedIds.has(id)),
    [pendingIds, selectedIds]
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleSelected = useCallback((naverReviewId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(naverReviewId)) next.delete(naverReviewId);
      else next.add(naverReviewId);
      return next;
    });
  }, []);

  /** 개별 판정. 판정한 행은 선택에서 빼서 일괄 처리와 겹치지 않게 합니다. */
  const decideOne = useCallback(
    (naverReviewId: string, decision: AdminDuplicateDecision) => {
      setAdminDecisions((prev) =>
        applyAdminDecisions(results, prev, [naverReviewId], decision)
      );
      setSelectedIds((prev) => {
        if (!prev.has(naverReviewId)) return prev;
        const next = new Set(prev);
        next.delete(naverReviewId);
        return next;
      });
    },
    [results]
  );

  /** 판정 취소. 서버 판정은 그대로 두고 관리자 판정만 지워 '확인 필요'로 되돌립니다. */
  const undoDecision = useCallback((naverReviewId: string) => {
    setAdminDecisions((prev) => clearAdminDecision(prev, naverReviewId));
  }, []);

  /** 일괄 판정. 확인창에서 동의한 경우에만 적용하고, 끝나면 선택을 비웁니다. */
  const decideSelected = useCallback(
    (decision: AdminDuplicateDecision) => {
      const targetIds = selectedPendingIds;
      if (targetIds.length === 0) return;

      const message =
        decision === 'duplicate'
          ? `선택한 ${targetIds.length.toLocaleString()}건을 중복으로 확정하고 등록 대상에서 제외하시겠습니까?`
          : `선택한 ${targetIds.length.toLocaleString()}건을 신규 등록 후보로 유지하시겠습니까?`;

      if (!window.confirm(message)) return;

      setAdminDecisions((prev) => applyAdminDecisions(results, prev, targetIds, decision));
      setSelectedIds(new Set());
    },
    [results, selectedPendingIds]
  );

  /** 관리자 판정 전체 초기화. 서버 판정 결과는 손대지 않습니다. */
  const resetAdminDecisions = useCallback(() => {
    if (adminDecisionCount === 0) return;

    const message = `관리자 판정 ${adminDecisionCount.toLocaleString()}건을 모두 초기화하고 확인 필요 상태로 되돌리시겠습니까?`;
    if (!window.confirm(message)) return;

    setAdminDecisions({});
    setSelectedIds(new Set());
  }, [adminDecisionCount]);

  const filteredResults = useMemo<DuplicateCheckResultItem[]>(() => {
    if (filter === 'all') return results;
    return results.filter((item) => resolveDuplicateStatus(item, adminDecisions) === filter);
  }, [results, adminDecisions, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / RESULTS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pagedResults = filteredResults.slice(
    (safePage - 1) * RESULTS_PER_PAGE,
    safePage * RESULTS_PER_PAGE
  );

  return (
    <section className="mb-8">
      <h2 className="text-[15px] font-bold text-gray-900 mb-1">4단계. 등록 전 중복 검사</h2>
      <p className="text-[13px] text-gray-500 mb-4 leading-relaxed">
        확정한 카페24 상품의 리뷰를 기존 카페24 상품후기 게시글과 비교합니다. 읽기만 하며 카페24에는 아무것도
        등록하지 않습니다.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={!canCheck}
            className="w-full sm:w-auto px-5 h-[46px] bg-[#5244e8] hover:bg-blue-700 !text-white font-bold text-sm rounded-md transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isChecking && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isChecking ? '검사 중...' : '기존 리뷰 중복 검사'}
          </button>

          <p className="text-[12px] text-gray-400 leading-relaxed">
            마지막 검사:{' '}
            <b className="text-gray-600">
              {result
                ? new Date(result.fetchedAt).toLocaleString('ko-KR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : '-'}
            </b>
          </p>
        </div>

        {blockReasons.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-[13px] font-bold text-amber-700 leading-relaxed mb-1">
              아직 중복 검사를 실행할 수 없습니다.
            </p>
            <ul className="space-y-0.5">
              {blockReasons.map((reason) => (
                <li key={reason} className="text-[12px] font-bold text-amber-700 leading-tight">
                  · {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
        <SummaryTile label="검사 대상" value={targetReviews.length} />
        <SummaryTile
          label={STATUS_LABELS.duplicate}
          value={result ? statusCounts.duplicate : '-'}
          tone="danger"
        />
        <SummaryTile
          label={STATUS_LABELS.needs_review}
          value={result ? statusCounts.needsReview : '-'}
          tone="warn"
        />
        <SummaryTile
          label={STATUS_LABELS.new}
          value={result ? statusCounts.new : '-'}
          tone="good"
        />
        <SummaryTile label="상품 매칭 건너뜀" value={skippedReviewCount} />
      </div>

      {(excludedReviewCount > 0 || unresolvedReviewCount > 0) && (
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          {unresolvedReviewCount > 0 && (
            <p className="text-[12px] font-bold text-gray-600 leading-relaxed">
              아직 확정하지 않은 상품의 리뷰 {unresolvedReviewCount.toLocaleString()}건은 검사 대상에서
              빠져 있습니다.
            </p>
          )}
          {excludedReviewCount > 0 && (
            <p className="text-[12px] font-bold text-gray-600 leading-relaxed">
              리뷰글번호가 없거나 파일 안에서 중복된 리뷰 {excludedReviewCount.toLocaleString()}건은 검사할 수
              없어 제외했습니다. 2단계 표에서 확인해 주세요.
            </p>
          )}
        </div>
      )}

      {/* 오류 */}
      {errorMessage && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-[13px] font-bold text-red-600 leading-relaxed flex-1">{errorMessage}</p>
          <button
            type="button"
            onClick={() => void runCheck()}
            disabled={!canCheck}
            className="shrink-0 px-4 py-2 !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[13px] rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 결과 */}
      {result && (
        <>
          <div className="mb-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-[12px] font-bold text-gray-600 leading-relaxed">
              상품후기 게시판 {result.boardNo}번의 기존 게시글 {result.scannedArticleCount.toLocaleString()}건과
              비교해 리뷰 {result.checkedReviewCount.toLocaleString()}건을 검사했습니다.
            </p>
            <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">
              <b className="text-gray-600">중복 확정</b>은 카페24에 네이버 리뷰글번호가 저장되어 있고 그 값이
              일치해 서버가 판정한 건과, 아래에서 관리자가 직접 중복으로 확정한 건을 합한 수입니다. 리뷰글번호가
              없는 과거 리뷰는 자동 중복으로 처리하지 않습니다.
            </p>
            <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">
              <b className="text-gray-600">확인 필요</b>는 작성일 · 상품번호 · 작성자 · 평점 · 작성시각(분) 이
              모두 같고 본문 유사도가 {CONTENT_SIMILARITY_THRESHOLD_PERCENT}% 이상인 경우입니다. 자동으로
              제외하지 않으며 등록 전에 사람이 직접 확인할 대상으로만 표시합니다.
            </p>
          </div>

          {/*
            관리자 판정 일괄 처리.
            '확인 필요 전체 선택'은 현재 페이지가 아니라 아직 판정하지 않은 확인 필요 결과 전체를 고릅니다.
          */}
          {decidableCount > 0 && (
            <div className="mb-3 bg-white border-2 border-[#5244e8]/30 rounded-lg px-4 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-[13px] font-bold text-gray-700 whitespace-nowrap">
                  선택 {selectedPendingIds.length.toLocaleString()}건
                  <span className="ml-2 text-[12px] font-bold text-gray-400">
                    (판정 대기 {statusCounts.needsReview.toLocaleString()}건 · 관리자 판정{' '}
                    {adminDecisionCount.toLocaleString()}건)
                  </span>
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set(pendingIds))}
                    disabled={pendingIds.length === 0}
                    className="px-3 py-1.5 !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[12px] rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    확인 필요 전체 선택
                  </button>
                  <button
                    type="button"
                    onClick={() => decideSelected('duplicate')}
                    disabled={selectedPendingIds.length === 0}
                    className="px-3 py-1.5 !bg-orange-600 hover:!bg-orange-700 !text-white font-bold text-[12px] rounded-md transition-colors disabled:!bg-gray-400 disabled:cursor-not-allowed"
                  >
                    선택 중복 확정
                  </button>
                  <button
                    type="button"
                    onClick={() => decideSelected('new')}
                    disabled={selectedPendingIds.length === 0}
                    className="px-3 py-1.5 !bg-emerald-600 hover:!bg-emerald-700 !text-white font-bold text-[12px] rounded-md transition-colors disabled:!bg-gray-400 disabled:cursor-not-allowed"
                  >
                    선택 신규 유지
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={selectedIds.size === 0}
                    className="px-3 py-1.5 !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[12px] rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    선택 해제
                  </button>
                  {adminDecisionCount > 0 && (
                    <button
                      type="button"
                      onClick={resetAdminDecisions}
                      className="px-3 py-1.5 !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[12px] rounded-md transition-colors"
                    >
                      관리자 판정 전체 초기화
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-2 text-[12px] text-gray-400 leading-relaxed">
                확인 필요 리뷰는 자동으로 판정되지 않습니다. 관리자가 중복으로 확정하면 등록 대상에서 빠지고,
                신규로 유지하면 다음 단계의 등록 후보에 들어갑니다. 이미 판정한 행은 전체 선택 대상에서
                빠집니다.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => {
                const isActive = filter === item.key;
                const count =
                  item.key === 'all'
                    ? results.length
                    : item.key === 'duplicate'
                      ? statusCounts.duplicate
                      : item.key === 'needs_review'
                        ? statusCounts.needsReview
                        : statusCounts.new;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setFilter(item.key);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-bold border-2 transition-colors ${
                      isActive
                        ? 'bg-[#5244e8] border-[#5244e8] !text-white'
                        : '!bg-white border-gray-300 !text-gray-600 hover:!bg-gray-100'
                    }`}
                  >
                    {item.label} {count.toLocaleString()}
                  </button>
                );
              })}
            </div>

            <span className="text-[13px] font-bold text-gray-500 whitespace-nowrap">
              {filteredResults.length.toLocaleString()}건 표시 중 ({safePage} / {totalPages} 쪽)
            </span>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm text-left">
              <thead className="bg-[#f8f9fa] border-b border-gray-200 text-gray-700 font-bold">
                <tr>
                  <th className="px-3 py-2.5 w-10 text-center whitespace-nowrap">
                    <span className="sr-only">선택</span>
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap">네이버 리뷰글번호</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">상태</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">판정 이유</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">일치한 항목</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">일치한 게시글번호</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">후보 수</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">관리자 판정</th>
                </tr>
              </thead>
              <tbody>
                {pagedResults.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-gray-400 text-[13px]">
                      표시할 결과가 없습니다.
                    </td>
                  </tr>
                )}

                {pagedResults.map((item) => {
                  // 서버 판정은 그대로 두고, 화면에 보여 줄 상태만 관리자 판정과 합쳐 계산합니다.
                  const effectiveStatus = resolveDuplicateStatus(item, adminDecisions);
                  const decision = resolveAdminDecision(item, adminDecisions);
                  const isDecidable = canAdminDecide(item);
                  const isPending = isDecidable && decision === null;

                  return (
                    <tr
                      key={item.naverReviewId}
                      className={`border-b border-gray-200 last:border-0 align-top ${
                        effectiveStatus === 'duplicate'
                          ? 'bg-red-50/60'
                          : effectiveStatus === 'needs_review'
                            ? 'bg-amber-50/60'
                            : ''
                      }`}
                    >
                      <td className="px-3 py-3 text-center">
                        {isPending ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.naverReviewId)}
                            onChange={() => toggleSelected(item.naverReviewId)}
                            aria-label={`리뷰글번호 ${item.naverReviewId} 선택`}
                            className="w-4 h-4 accent-[#5244e8] cursor-pointer"
                          />
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-bold text-gray-700 whitespace-nowrap">
                        {item.naverReviewId}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <StatusBadge status={effectiveStatus} />
                        {decision && (
                          <div className="mt-1">
                            <AdminDecisionBadge decision={decision} />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-600">
                        {REASON_LABELS[item.reason]}
                        {typeof item.contentSimilarity === 'number' && (
                          <p className="mt-1 text-[12px] font-bold text-gray-500 leading-tight">
                            · {similarityText(item.contentSimilarity)}
                          </p>
                        )}
                        {item.warning && (
                          <p className="mt-1 text-[12px] font-bold text-amber-600 leading-tight">
                            · {item.warning}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                        {matchedFieldLabels(item)}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap">
                        {item.matchedCafe24ArticleNo ?? '-'}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap">
                        {item.candidateCount.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {/* naverpay_review_id 일치로 서버가 판정한 행에는 판정 버튼을 두지 않습니다. */}
                        {!isDecidable ? (
                          <span className="text-[12px] font-bold text-gray-400">-</span>
                        ) : isPending ? (
                          <div className="flex flex-col items-stretch gap-1.5">
                            <button
                              type="button"
                              onClick={() => decideOne(item.naverReviewId, 'duplicate')}
                              className="px-3 py-1.5 !bg-orange-600 hover:!bg-orange-700 !text-white font-bold text-[12px] rounded-md transition-colors whitespace-nowrap"
                            >
                              중복으로 확정
                            </button>
                            <button
                              type="button"
                              onClick={() => decideOne(item.naverReviewId, 'new')}
                              className="px-3 py-1.5 !bg-emerald-600 hover:!bg-emerald-700 !text-white font-bold text-[12px] rounded-md transition-colors whitespace-nowrap"
                            >
                              신규 후보로 유지
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => undoDecision(item.naverReviewId)}
                            className="px-3 py-1.5 !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[12px] rounded-md transition-colors whitespace-nowrap"
                          >
                            판정 취소
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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

          {/* 아래 등록 영역으로 넘어갈 수 있는지 안내합니다. */}
          {statusCounts.needsReview > 0 ? (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-[13px] font-bold text-amber-700 leading-relaxed">
                확인 필요 리뷰의 판정을 모두 완료해야 Cafe24에 등록할 수 있습니다.
              </p>
              <p className="mt-1 text-[12px] font-bold text-amber-600 leading-relaxed">
                남은 확인 필요 {statusCounts.needsReview.toLocaleString()}건
              </p>
            </div>
          ) : (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              <p className="text-[13px] font-bold text-emerald-700 leading-relaxed">
                중복 판정이 완료되었습니다. 신규 등록 후보 {registrationCandidates.length.toLocaleString()}건을
                아래 [Cafe24 신규 리뷰 등록]에서 등록할 수 있습니다.
              </p>
            </div>
          )}
        </>
      )}

      {/*
        Cafe24 신규 리뷰 등록.
        검사 결과가 있을 때만 보여 주고, 실제 POST는 관리자가 최종 확인을 통과한 뒤
        등록 버튼을 직접 누른 경우에만 이 컴포넌트 안에서 실행됩니다.
      */}
      {result && (
        <Cafe24ReviewRegister
          registerTargets={registerTargets}
          registrationCandidateIds={registrationCandidates}
          duplicateConfirmedCount={statusCounts.duplicate}
          needsReviewCount={statusCounts.needsReview}
          skippedReviewCount={skippedReviewCount}
          duplicateCheckResults={results}
          adminDecisions={adminDecisions}
          cafe24Connected={cafe24Connected}
          cafe24Scopes={cafe24Scopes}
          onPhaseChange={setRegisterPhase}
        />
      )}
    </section>
  );
}
