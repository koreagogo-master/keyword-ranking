'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveAdminDecision } from '../adminDecision';
import { CAFE24_NO_FIELD_DETAIL_MESSAGE } from '@/app/lib/cafe24/errorDetail';
import { CAFE24_NO_MULTI_STATUS_REASON } from '@/app/lib/cafe24/multiStatus';
import { runCafe24RegisterBatches } from '@/app/lib/cafe24/registerRun';
import {
  CAFE24_ARTICLES_PER_REQUEST,
  chunkForCafe24,
  type Cafe24AttachFileUrl,
} from '@/app/lib/cafe24/reviewPayload';
import {
  TRIAL_ATTACHMENTS_UNAVAILABLE_MESSAGE,
  TRIAL_NO_IMAGE_CANDIDATE_MESSAGE,
  TRIAL_RECHECK_GUIDE,
  compareTrialAttachments,
  requestTrialRegister,
  requestTrialVerify,
  selectTrialRegisterCandidate,
  trialConfirmMessage,
  type TrialFetch,
} from '@/app/lib/cafe24/trialRegister';
import type { Cafe24BatchStopReason } from '@/app/lib/cafe24/batchOutcome';
import type {
  AdminDecisionMap,
  Cafe24DevErrorDetail,
  DuplicateCheckResultItem,
  RegisterAttemptItem,
  RegisterBatchDiagnostic,
  RegisterBlockReason,
  RegisterBlockedItem,
  RegisterDevMultiStatus,
  RegisterFailure,
  RegisterPrecheckFailure,
  RegisterPrecheckSuccess,
  RegisterResultItem,
  RegisterReviewInput,
  RegisterSuccess,
  RegisterVerifyArticle,
  RegisterVerifyFailure,
  RegisterVerifySuccess,
} from '../types';

/**
 * Cafe24 신규 리뷰 등록 영역.
 *
 * 이 컴포넌트만 실제 등록 API를 호출하고, 그것도 관리자가 [등록 전 최종 확인] 뒤에
 * [이미지 리뷰 1건 시험 등록] 또는 [Cafe24에 신규 리뷰 N건 등록] 버튼을 직접 누르고
 * 확인창에 동의한 경우에만 실행됩니다.
 * 화면이 처음 그려질 때나 상태가 바뀔 때 자동으로 등록하는 경로는 없습니다.
 *
 * 등록 대상은 4단계에서 계산한 최종 등록 후보(서버 판정 new + 관리자 '신규 후보로 유지')뿐이고,
 * 서버도 같은 기준으로 다시 검증합니다.
 */

/** 등록 영역의 진행 상태. 상단 진행 단계 배지에도 그대로 쓰입니다. */
export type RegisterPhase = 'idle' | 'checked' | 'registering' | 'done' | 'stopped';

/** 카페24 게시글 등록에 필요한 권한 */
const WRITE_SCOPE = 'mall.write_community';

const RE_CHECK_GUIDE = '중복 등록 방지를 위해 [기존 리뷰 중복 검사]를 다시 실행한 후 남은 리뷰를 등록해 주세요.';

const BLOCK_REASON_LABELS: Record<RegisterBlockReason, string> = {
  already_registered: '이미 같은 리뷰글번호가 카페24에 등록되어 있습니다.',
  became_duplicate: '재검사에서 중복으로 바뀌었습니다.',
  became_needs_review: '재검사에서 확인 필요로 바뀌었습니다.',
  evidence_changed: '관리자 판정 이후 후보 게시글이나 판정 근거가 달라졌습니다.',
  undecided_needs_review: '아직 판정하지 않은 확인 필요 리뷰입니다.',
  not_a_candidate: '등록 후보가 아닙니다.',
  missing_data: '등록에 필요한 값이 없습니다.',
};

const ERROR_MESSAGES: Record<string, string> = {
  forbidden_origin: '요청이 거절되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
  not_connected: '카페24 연결이 필요합니다. 먼저 카페24를 연결해 주세요.',
  reauth_required: '카페24 연결이 만료되었습니다. 연결을 해제한 뒤 다시 연결해 주세요.',
  token_error: '카페24 인증 토큰을 갱신하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  write_forbidden:
    '카페24 게시글 쓰기 권한(mall.write_community)이 없습니다. 카페24 연결을 해제한 뒤 다시 연결해 권한에 동의해 주세요.',
  network_error: '카페24에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  rate_limited: '카페24 API 요청 제한에 걸렸습니다. 잠시 후 다시 시도해 주세요.',
  cafe24_unavailable: '카페24 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.',
};

const DEFAULT_PRECHECK_ERROR = '등록 전 최종 확인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const DEFAULT_REGISTER_ERROR = '리뷰 등록을 완료하지 못했습니다.';

/**
 * 묶음 하나의 결과를 설명할 수 없어 멈출 때의 안내 문구.
 * 성공·실패를 임의로 판정하지 않고, 무엇이 맞지 않았는지만 알려 줍니다.
 */
const STOP_REASON_MESSAGES: Record<Cafe24BatchStopReason, string> = {
  unreadable_response: '카페24 응답 구조를 해석하지 못해 등록을 중단했습니다.',
  conflicting_result: '같은 리뷰가 성공과 실패 양쪽에 들어 있어 등록을 중단했습니다.',
  position_conflict: '카페24 응답의 위치 정보가 서로 충돌해 등록을 중단했습니다.',
  position_out_of_range: '카페24 응답이 요청 범위를 벗어난 위치를 알려 와 등록을 중단했습니다.',
  count_mismatch: '성공 건수와 실패 건수의 합이 요청 건수와 달라 등록을 중단했습니다.',
  unclear_items: '등록 결과를 확인하지 못한 리뷰가 있어 등록을 중단했습니다.',
};

/** 멈춘 이유와 그 묶음의 집계를 한 문장으로 만듭니다. (리뷰 원문·개인정보는 담지 않습니다) */
function stopReasonMessage(batch: RegisterSuccess): string {
  const reason = batch.stopReason ? STOP_REASON_MESSAGES[batch.stopReason] : '';
  const head = reason || '이번 묶음의 결과를 확인하지 못해 등록을 중단했습니다.';

  return (
    `${head} (성공 ${batch.registeredCount.toLocaleString()}건 · ` +
    `명시적 실패 ${batch.explicitFailedCount.toLocaleString()}건 · ` +
    `결과 불명확 ${batch.unclearCount.toLocaleString()}건) ` +
    '중복 등록을 막기 위해 자동으로 다시 시도하지 않았습니다.'
  );
}

/** 등록 실패 사유. 서버는 `missing_data:필드명` · `cafe24_rejected` · `not_confirmed`를 내려 줍니다. */
function itemFailureReason(code: string | undefined): string {
  if (code === 'cafe24_rejected') return '카페24가 이 리뷰의 등록을 거절했습니다.';
  if (code === 'not_confirmed') return '카페24 응답에서 등록을 확인하지 못했습니다.';

  const missing = code?.startsWith('missing_data:') ? code.slice('missing_data:'.length) : '';
  if (missing) return `등록에 필요한 값이 없거나 규격에 맞지 않습니다. (${missing})`;

  return '등록에 실패했습니다.';
}

/** 실패 응답에서 화면에 보여 줄 문장을 고릅니다. 토큰·원문은 담지 않습니다. */
function failureMessage(
  failure: { error?: string; code?: string },
  fallback: string
): string {
  return ERROR_MESSAGES[failure.code ?? ''] ?? failure.error ?? fallback;
}

/** 실패 응답에서 개발 전용 원본 오류 요약만 꺼냅니다. 운영에서는 서버가 넣지 않으므로 항상 null입니다. */
function devErrorDetailOf(failure: { devDetail?: Cafe24DevErrorDetail }): Cafe24DevErrorDetail | null {
  return failure.devDetail ?? null;
}

/**
 * 카페24가 돌려준 원본 오류 요약 (개발 환경 전용).
 *
 * 서버가 개발 환경에서만 devDetail을 내려주므로 운영 화면에는 이 블록이 나타나지 않습니다.
 * 값은 서버에서 이미 정리·제거된 상태로 오고, 여기서는 그대로 보여 주기만 합니다.
 *
 * fields에는 카페24가 필드와 사유를 함께 적어 준 항목만 들어옵니다.
 * 비어 있으면 사유를 받지 못한 것이므로, 빈 자리를 두지 않고 그렇게 적어 줍니다.
 */
function Cafe24DevErrorDetailBox({
  detail,
  title = 'Cafe24 원본 오류 (개발 환경에서만 표시)',
}: {
  detail: Cafe24DevErrorDetail | null;
  /** 207 개별 실패처럼 어느 단계의 오류인지 구분해야 할 때만 바꿉니다. */
  title?: string;
}) {
  if (!detail) return null;

  return (
    <div className="mt-2 bg-gray-900 rounded-md px-3 py-2">
      <p className="text-[12px] font-bold text-gray-300 mb-1">{title}</p>

      <div className="space-y-0.5 text-[12px] font-bold text-gray-100 break-all">
        <p>HTTP status: {detail.status ?? '확인 불가'}</p>
        <p>오류 code: {detail.code ?? '확인 불가'}</p>
        <p>오류 message: {detail.message ?? '응답에 없음'}</p>
      </div>

      {detail.fields.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {detail.fields.map((field) => (
            <li key={field} className="text-[12px] font-bold text-amber-300 break-all">
              {field}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[12px] font-bold text-amber-300 break-all">
          {CAFE24_NO_FIELD_DETAIL_MESSAGE}
        </p>
      )}
    </div>
  );
}

/**
 * 사유를 이 건에 연결하지 못한 실패에 붙이는 한 줄 안내.
 *
 * 사유를 특정 리뷰에 임의로 배정하지 않기 위해, 여기서는 어디를 봐야 하는지만 가리킵니다.
 * 진단 요약은 개발 환경에서만 내려오므로 운영 화면에는 아무것도 나타나지 않습니다.
 */
function FailureGroupHint({
  info,
  batchNumber,
}: {
  info: RegisterDevMultiStatus | undefined;
  batchNumber: number;
}) {
  if (!info) return null;

  const message = info.reasonsMissing
    ? CAFE24_NO_MULTI_STATUS_REASON
    : info.commonFailureDetail
      ? `묶음 ${batchNumber.toLocaleString()} 공통 실패 사유는 아래에 있습니다.`
      : info.reasonsUnlinkable
        ? `개별 사유 연결 불가 — 묶음 ${batchNumber.toLocaleString()}의 사유 목록을 확인해 주세요.`
        : '';

  if (!message) return null;

  return <p className="mt-1 text-[12px] font-bold text-amber-700 break-all">{message}</p>;
}

type ChunkOutcome =
  | { kind: 'ok'; data: RegisterSuccess }
  | { kind: 'error'; message: string; devDetail: Cafe24DevErrorDetail | null };

/**
 * 묶음 한 개를 등록 API로 보냅니다.
 *
 * 실패하면 여기서 다시 보내지 않고 사유만 돌려줍니다.
 * 응답을 받지 못한 경우도 "성공 여부 확인 불가"로 다루어 호출부가 즉시 멈추게 합니다.
 */
async function sendChunk(chunk: RegisterReviewInput[], batchStart: number): Promise<ChunkOutcome> {
  try {
    const res = await fetch('/api/review-migration/cafe24/reviews/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // batchStart는 서버 개발 로그에만 쓰입니다. 등록 판단에는 영향을 주지 않습니다.
      body: JSON.stringify({ reviews: chunk, batchStart }),
    });

    const data = (await res.json()) as RegisterSuccess | RegisterFailure;

    if (!res.ok || !('ok' in data)) {
      return {
        kind: 'error',
        message: failureMessage(data as RegisterFailure, DEFAULT_REGISTER_ERROR),
        devDetail: devErrorDetailOf(data as RegisterFailure),
      };
    }

    return { kind: 'ok', data: data as RegisterSuccess };
  } catch {
    return {
      kind: 'error',
      message:
        '등록 요청 응답을 받지 못해 이번 묶음이 등록됐는지 확인할 수 없습니다. 중복 등록을 막기 위해 자동으로 다시 시도하지 않았습니다.',
      devDetail: null,
    };
  }
}

/**
 * 브라우저 fetch를 그대로 쓰되 window에 묶어 둔 형태.
 * 시험 등록 모듈은 이 자리에 가짜 함수를 끼울 수 있어 카페24 호출 없이 검증할 수 있습니다.
 */
const browserFetch: TrialFetch = (input, init) => fetch(input, init);

/**
 * 모든 묶음을 끝까지 보냈고 결과가 전부 확인된 경우에만 Google 피드 스냅샷 갱신을 요청합니다.
 *
 * 등록은 이미 끝났고 성공했으므로, 갱신 실패가 등록 결과 화면에 영향을 주면 안 됩니다.
 * 그래서 await 하지 않고 오류도 삼킵니다. 갱신에 실패해도 직전 스냅샷이 계속 제공되고,
 * 매일 23:30 예약 갱신이 다시 시도합니다.
 *
 * keepalive를 쓰는 이유는, 등록이 끝난 직후 관리자가 화면을 닫거나 이동해도
 * 이 요청만은 브라우저가 끝까지 보내 주기 때문입니다.
 * (스냅샷 생성은 서버에서 20초 정도 걸리지만 응답을 기다리지 않으므로 상관없습니다)
 */
function requestFeedSnapshotRefresh(): void {
  try {
    void fetch('/api/review-migration/google-reviews/snapshot/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'after_upload' }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 갱신 요청을 보내지 못해도 등록 결과에는 영향을 주지 않습니다.
  }
}

/**
 * 시험 등록을 시작한 순간의 대상 정보.
 *
 * 관리자 판정이 바뀌어 최종 확인 결과가 지워져도 시험 결과는 그대로 남아야 하므로
 * 계산된 값을 그대로 보지 않고 눌렀을 때의 값을 복사해 둡니다.
 */
interface TrialTargetSnapshot {
  naverReviewId: string;
  productName: string;
  cafe24ProductNo: number;
  registeredAt: string;
  /** 실제로 attach_file_urls에 실려 나간 네이버 이미지 */
  attachments: Cafe24AttachFileUrl[];
}

export interface Cafe24ReviewRegisterProps {
  /** 검사 대상 리뷰 전체 (제목·첨부용 값 포함). 이 중 등록 후보만 골라 보냅니다. */
  registerTargets: RegisterReviewInput[];
  /** 4단계가 계산한 최종 등록 후보 리뷰글번호 */
  registrationCandidateIds: string[];
  /** 서버 판정 + 관리자 판정을 합친 중복 확정 건수 */
  duplicateConfirmedCount: number;
  /** 아직 판정하지 않은 확인 필요 건수 */
  needsReviewCount: number;
  /** 상품 매칭 건너뜀으로 검사에서 빠진 리뷰 수 */
  skippedReviewCount: number;
  /** 서버 중복 검사 결과 원본 (최종 확인에서 지금 결과와 비교합니다) */
  duplicateCheckResults: DuplicateCheckResultItem[];
  adminDecisions: AdminDecisionMap;
  cafe24Connected: boolean;
  cafe24Scopes: string[];
  onPhaseChange: (phase: RegisterPhase) => void;
}

function SummaryTile({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <p className="text-[12px] font-bold text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueClass}`}>{value.toLocaleString()}</p>
    </div>
  );
}

export default function Cafe24ReviewRegister({
  registerTargets,
  registrationCandidateIds,
  duplicateConfirmedCount,
  needsReviewCount,
  skippedReviewCount,
  duplicateCheckResults,
  adminDecisions,
  cafe24Connected,
  cafe24Scopes,
  onPhaseChange,
}: Cafe24ReviewRegisterProps) {
  const [isPrechecking, setIsPrechecking] = useState(false);
  const [precheckError, setPrecheckError] = useState('');
  const [precheck, setPrecheck] = useState<RegisterPrecheckSuccess | null>(null);

  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  /** 개발 환경에서만 채워지는 카페24 원본 오류 요약 */
  const [registerErrorDetail, setRegisterErrorDetail] = useState<Cafe24DevErrorDetail | null>(null);
  const [sentCount, setSentCount] = useState(0);

  /**
   * 등록이 한 건이라도 시작되면 현재 검사 결과는 오래된 상태가 됩니다.
   * 완료·중단 뒤에도 이 값이 true인 동안에는 같은 결과로 다시 등록할 수 없습니다.
   */
  const [hasStarted, setHasStarted] = useState(false);

  const [successItems, setSuccessItems] = useState<RegisterAttemptItem[]>([]);
  /** 등록되지 않은 것이 확실한 리뷰. 이 목록은 남겨 두어 나중에 다시 등록할 수 있게 합니다. */
  const [failedItems, setFailedItems] = useState<RegisterAttemptItem[]>([]);
  /** 성공도 실패도 확인하지 못한 리뷰. 한 건이라도 있으면 그 자리에서 등록을 멈춥니다. */
  const [unclearItems, setUnclearItems] = useState<RegisterAttemptItem[]>([]);
  /**
   * 묶음별 207 진단 요약 (개발 환경에서만 채워집니다).
   * 개별 사유는 각 실패 건의 devDetail에 있고, 연결하지 못한 사유는 여기에 묶음 단위로 남습니다.
   */
  const [batchDiagnostics, setBatchDiagnostics] = useState<RegisterBatchDiagnostic[]>([]);
  const [notProcessedCount, setNotProcessedCount] = useState(0);
  const [stoppedByUser, setStoppedByUser] = useState(false);
  /** 결과를 설명할 수 없거나 요청이 실패해 중간에 멈춘 경우 true */
  const [haltedByProblem, setHaltedByProblem] = useState(false);
  /**
   * Google 피드 스냅샷 갱신을 요청했는지.
   *
   * 응답을 기다리지 않으므로 '완료'가 아니라 '요청됨'입니다.
   * 실제 갱신 결과는 위쪽 [Google 상품평 피드] 영역에서 확인합니다.
   */
  const [feedRefreshRequested, setFeedRefreshRequested] = useState(false);

  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifyResult, setVerifyResult] = useState<RegisterVerifySuccess | null>(null);

  /**
   * 이미지 리뷰 1건 시험 등록.
   *
   * 한 번이라도 시작하면 현재 검사 결과는 오래된 상태가 되므로
   * trialStarted가 true인 동안에는 같은 결과로 전체 등록을 할 수 없습니다.
   */
  const [trialStarted, setTrialStarted] = useState(false);
  const [isTrialRunning, setIsTrialRunning] = useState(false);
  const [trialError, setTrialError] = useState('');
  /** 개발 환경에서만 채워지는 카페24 원본 오류 요약 */
  const [trialErrorDetail, setTrialErrorDetail] = useState<Cafe24DevErrorDetail | null>(null);
  const [trialTarget, setTrialTarget] = useState<TrialTargetSnapshot | null>(null);
  const [trialResult, setTrialResult] = useState<RegisterResultItem | null>(null);
  const [trialVerifyError, setTrialVerifyError] = useState('');
  const [trialArticle, setTrialArticle] = useState<RegisterVerifyArticle | null>(null);

  /** 중단 요청. 진행 중인 묶음이 끝난 뒤에 확인합니다. */
  const stopRequested = useRef(false);

  const hasWriteScope = cafe24Scopes.includes(WRITE_SCOPE);

  /** 등록 대상 리뷰를 리뷰글번호로 찾기 위한 표 */
  const targetById = useMemo(
    () => new Map(registerTargets.map((review) => [review.naverReviewId, review])),
    [registerTargets]
  );

  const candidateCount = registrationCandidateIds.length;

  /**
   * 검사 결과가 새로 오면(재검사·새 엑셀·상품 매칭 변경) 이 영역을 완전히 초기화합니다.
   * 이때만 등록 이력도 함께 지웁니다.
   */
  useEffect(() => {
    stopRequested.current = false;
    setIsPrechecking(false);
    setPrecheckError('');
    setPrecheck(null);
    setIsRegistering(false);
    setRegisterError('');
    setRegisterErrorDetail(null);
    setSentCount(0);
    setHasStarted(false);
    setSuccessItems([]);
    setFailedItems([]);
    setUnclearItems([]);
    setBatchDiagnostics([]);
    setNotProcessedCount(0);
    setStoppedByUser(false);
    setHaltedByProblem(false);
    setFeedRefreshRequested(false);
    setIsVerifying(false);
    setVerifyError('');
    setVerifyResult(null);
    setTrialStarted(false);
    setIsTrialRunning(false);
    setTrialError('');
    setTrialErrorDetail(null);
    setTrialTarget(null);
    setTrialResult(null);
    setTrialVerifyError('');
    setTrialArticle(null);
  }, [duplicateCheckResults]);

  /**
   * 관리자 판정이나 카페24 연결 상태가 바뀌면 최종 확인 결과만 무효화합니다.
   * (등록 이력은 남겨 두어야 이미 등록한 리뷰를 다시 등록하지 않습니다)
   */
  useEffect(() => {
    setPrecheck(null);
    setPrecheckError('');
  }, [adminDecisions, registerTargets, cafe24Connected]);

  /** 현재 단계를 부모에게 알려 상단 진행 단계 배지를 맞춥니다. */
  useEffect(() => {
    if (isRegistering || isTrialRunning) return onPhaseChange('registering');

    if (!hasStarted) {
      // 시험 등록만 한 상태는 전체 등록이 끝난 것이 아니므로 완료로 표시하지 않습니다.
      if (trialStarted) return onPhaseChange('stopped');
      return onPhaseChange(precheck ? 'checked' : 'idle');
    }

    /**
     * 명확히 실패한 리뷰가 있어도 모든 묶음을 끝까지 보냈다면 완료입니다.
     * 결과가 불명확해 멈춘 경우나 사용자가 중단한 경우만 'stopped'로 알립니다.
     */
    const finishedAll =
      !haltedByProblem && !stoppedByUser && notProcessedCount === 0 && unclearItems.length === 0;
    onPhaseChange(finishedAll ? 'done' : 'stopped');
  }, [
    onPhaseChange,
    isRegistering,
    isTrialRunning,
    trialStarted,
    hasStarted,
    precheck,
    haltedByProblem,
    notProcessedCount,
    unclearItems.length,
    stoppedByUser,
  ]);

  /** 최종 확인에서 실제로 등록해도 되는 후보. 확인 전에는 비어 있습니다. */
  const allowedIds = useMemo(() => {
    if (!precheck) return [];
    // 확인 이후 관리자 판정이 바뀌었다면 위 useEffect가 precheck를 비웁니다.
    return precheck.allowedNaverReviewIds.filter((id) => targetById.has(id));
  }, [precheck, targetById]);

  const blockedItems: RegisterBlockedItem[] = precheck?.blocked ?? [];

  const registerBlockReason = useMemo(() => {
    if (!cafe24Connected) return '카페24 연결이 필요합니다. 위 카페24 연결 영역에서 먼저 연결해 주세요.';
    if (needsReviewCount > 0) return '확인 필요 리뷰의 판정을 모두 완료해야 Cafe24에 등록할 수 있습니다.';
    if (candidateCount === 0) return '등록할 신규 리뷰가 없습니다.';
    if (!hasWriteScope) {
      return `연결된 카페24 토큰에 게시글 쓰기 권한(${WRITE_SCOPE})이 없습니다. 이미 연결된 토큰에는 새 권한이 자동으로 반영되지 않으므로, 카페24 연결을 해제한 뒤 다시 연결해 권한에 동의해 주세요.`;
    }
    return '';
  }, [cafe24Connected, needsReviewCount, candidateCount, hasWriteScope]);

  const runPrecheck = useCallback(async () => {
    if (registerBlockReason || isPrechecking || isRegistering || hasStarted) return;
    // 시험 등록으로 게시판이 이미 달라졌으므로 같은 검사 결과로는 다시 확인하지 않습니다.
    if (trialStarted || isTrialRunning) return;

    setIsPrechecking(true);
    setPrecheck(null);
    setPrecheckError('');

    try {
      const res = await fetch('/api/review-migration/cafe24/reviews/register-precheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviews: registerTargets.map((review) => ({
            naverReviewId: review.naverReviewId,
            cafe24ProductNo: review.cafe24ProductNo,
            content: review.content,
            rating: review.rating,
            writer: review.writer,
            registeredAt: review.registeredAt,
          })),
          expected: duplicateCheckResults.map((item) => ({
            naverReviewId: item.naverReviewId,
            status: item.status,
            matchedCafe24ArticleNo: item.matchedCafe24ArticleNo,
            candidateCount: item.candidateCount,
            adminDecision: resolveAdminDecision(item, adminDecisions),
          })),
        }),
      });

      const data = (await res.json()) as RegisterPrecheckSuccess | RegisterPrecheckFailure;

      if (!res.ok || !('ok' in data)) {
        setPrecheckError(failureMessage(data as RegisterPrecheckFailure, DEFAULT_PRECHECK_ERROR));
        return;
      }

      setPrecheck(data);
    } catch {
      setPrecheckError(ERROR_MESSAGES.network_error);
    } finally {
      setIsPrechecking(false);
    }
  }, [
    registerBlockReason,
    isPrechecking,
    isRegistering,
    hasStarted,
    trialStarted,
    isTrialRunning,
    registerTargets,
    duplicateCheckResults,
    adminDecisions,
  ]);

  /**
   * 실제 등록. 최대 10건씩 순차로 보냅니다. (병렬로 보내지 않습니다)
   *
   * 카페24가 이 묶음의 결과를 전부 설명해 준 경우에는 실패가 있어도 다음 묶음으로 넘어갑니다.
   * 명확히 실패한 리뷰는 목록에 따로 모아 두기만 하고 같은 실행에서 다시 보내지 않습니다.
   *
   * 다음 조건 중 하나라도 걸리면 다음 묶음을 보내지 않고 멈춥니다.
   *  - 사용자가 중단을 눌렀다
   *  - 묶음 요청이 실패했다 (네트워크·429·5xx·인증·JSON 오류 등. 자동 재시도하지 않습니다)
   *  - 서버가 결과를 전부 설명하지 못했다 (canContinue = false)
   */
  const runRegister = useCallback(async () => {
    if (isRegistering || hasStarted) return;
    /**
     * 시험 등록으로 게시판에 글이 하나 늘었으니 지금 검사 결과는 실제 상태와 다릅니다.
     * 중복 등록을 막기 위해 중복 검사를 다시 하기 전에는 전체 등록을 시작하지 않습니다.
     */
    if (trialStarted || isTrialRunning) return;
    if (registerBlockReason || !precheck) return;
    if (allowedIds.length === 0) return;

    const confirmed = window.confirm(
      `신규 등록 후보 ${allowedIds.length.toLocaleString()}건을 Cafe24 상품후기 게시판에 등록합니다. ` +
        `중복 확정 ${duplicateConfirmedCount.toLocaleString()}건과 상품 매칭 건너뜀 ${skippedReviewCount.toLocaleString()}건은 등록하지 않습니다. ` +
        '등록을 시작하시겠습니까?'
    );
    if (!confirmed) return;

    const queue = allowedIds
      .map((id) => targetById.get(id))
      .filter((review): review is RegisterReviewInput => Boolean(review));

    const chunks = chunkForCafe24(queue);

    stopRequested.current = false;
    setIsRegistering(true);
    setHasStarted(true);
    setRegisterError('');
    setRegisterErrorDetail(null);
    setSentCount(0);
    setSuccessItems([]);
    setFailedItems([]);
    setUnclearItems([]);
    setBatchDiagnostics([]);
    setNotProcessedCount(0);
    setStoppedByUser(false);
    setHaltedByProblem(false);
    setFeedRefreshRequested(false);

    const diagnostics: RegisterBatchDiagnostic[] = [];

    try {
      /**
       * 진행 규칙은 registerRun.ts가 갖고 있습니다.
       * 이 화면은 요청을 보내는 방법(fetch)과 중단 버튼 상태만 넘겨 줍니다.
       */
      const run = await runCafe24RegisterBatches({
        chunks,
        send: sendChunk,
        stopMessage: stopReasonMessage,
        shouldStop: () => stopRequested.current,
        onBatch: (batchNumber, data) => {
          // 개발 환경에서만 내려오는 207 진단 요약. 표시 전용이고 진행 판단에는 쓰지 않습니다.
          if (data.devMultiStatus) diagnostics.push({ batchNumber, info: data.devMultiStatus });
        },
        onProgress: (progress) => {
          setSentCount(progress.processed);
          setSuccessItems(progress.succeeded);
          setFailedItems(progress.failed);
          setUnclearItems(progress.unclear);
          setBatchDiagnostics([...diagnostics]);
        },
      });

      setSentCount(run.processed);
      setSuccessItems(run.succeeded);
      setFailedItems(run.failed);
      setUnclearItems(run.unclear);
      setBatchDiagnostics([...diagnostics]);
      setNotProcessedCount(run.halted || run.stoppedByUser ? queue.length - run.processed : 0);
      setStoppedByUser(run.stoppedByUser);
      setHaltedByProblem(run.halted);

      if (run.error) {
        setRegisterError(run.error.message);
        setRegisterErrorDetail(run.error.devDetail);
      }

      /**
       * 모든 묶음을 끝까지 보냈고, 중단도 없었고, 결과가 불명확한 건도 없고,
       * 실제로 등록된 리뷰가 있을 때만 Google 피드 스냅샷 갱신을 요청합니다.
       *
       * finally가 아니라 이 자리인 이유는, 중단된 실행 뒤에 갱신을 걸면 안 되기 때문입니다.
       * 게시판 상태가 관리자가 의도한 모습이 아닐 수 있습니다.
       */
      const finishedAll =
        !run.halted &&
        !run.stoppedByUser &&
        run.unclear.length === 0 &&
        run.processed === queue.length &&
        run.succeeded.length > 0;

      if (finishedAll) {
        requestFeedSnapshotRefresh();
        setFeedRefreshRequested(true);
      }
    } finally {
      setIsRegistering(false);
      stopRequested.current = false;
    }
  }, [
    isRegistering,
    hasStarted,
    trialStarted,
    isTrialRunning,
    registerBlockReason,
    precheck,
    allowedIds,
    targetById,
    duplicateConfirmedCount,
    skippedReviewCount,
  ]);

  /**
   * 이미지 리뷰 1건 시험 등록 대상.
   *
   * 최종 확인을 통과한 후보를 그 순서대로 훑어, 서버가 실제 첨부로 인정하는
   * https 이미지 주소가 1개 이상인 첫 리뷰 한 건만 고릅니다. 없으면 null입니다.
   */
  const trialCandidate = useMemo(
    () => selectTrialRegisterCandidate(allowedIds, targetById),
    [allowedIds, targetById]
  );

  /**
   * 이미지가 있는 신규 후보 한 건만 실제로 등록해 봅니다.
   *
   * 기존 등록 API에 리뷰 한 건만 담아 보내고, 성공하면 기존 등록 결과 확인 API로
   * 같은 리뷰글번호를 다시 조회해 카페24가 첨부를 어떻게 보관했는지 확인합니다.
   * 정상 신규 후보이므로 등록한 게시글은 지우지 않습니다.
   */
  const runTrialRegister = useCallback(async () => {
    if (isRegistering || hasStarted || trialStarted || isTrialRunning) return;
    if (registerBlockReason || !precheck) return;
    if (precheck.blocked.length > 0) return;

    const candidate = selectTrialRegisterCandidate(allowedIds, targetById);
    if (!candidate) return;

    const { review, attachments } = candidate;

    if (!window.confirm(trialConfirmMessage(review.naverReviewId))) return;

    setTrialStarted(true);
    setIsTrialRunning(true);
    setTrialError('');
    setTrialErrorDetail(null);
    setTrialResult(null);
    setTrialVerifyError('');
    setTrialArticle(null);
    setTrialTarget({
      naverReviewId: review.naverReviewId,
      productName: review.productName,
      cafe24ProductNo: review.cafe24ProductNo,
      registeredAt: review.registeredAt,
      attachments,
    });

    try {
      const outcome = await requestTrialRegister(review, browserFetch).catch(() => null);

      // 응답을 받지 못하면 등록됐는지 알 수 없으므로 다시 보내지 않습니다.
      if (!outcome) {
        setTrialError(
          '등록 요청 응답을 받지 못해 이 리뷰가 등록됐는지 확인할 수 없습니다. 중복 등록을 막기 위해 자동으로 다시 시도하지 않았습니다.'
        );
        return;
      }

      const data = outcome.data as RegisterSuccess | RegisterFailure;

      if (!outcome.ok || !('ok' in data)) {
        setTrialError(failureMessage(data as RegisterFailure, DEFAULT_REGISTER_ERROR));
        // 개발 환경에서만 서버가 실어 준 카페24 원본 오류 요약
        setTrialErrorDetail(devErrorDetailOf(data as RegisterFailure));
        return;
      }

      const item = (data as RegisterSuccess).results.find(
        (result) => result.naverReviewId === review.naverReviewId
      );

      if (!item) {
        setTrialError('카페24 응답에서 이 리뷰의 등록 결과를 확인하지 못했습니다.');
        return;
      }

      setTrialResult(item);
      if (!item.registered) return;

      /**
       * 게시판 목록을 다시 읽어 확인합니다.
       * 등록 응답의 게시글번호는 naverpay_review_id로 찾지 못했을 때의 2순위 기준으로만 넘깁니다.
       */
      const verified = await requestTrialVerify(
        review.naverReviewId,
        item.articleNo,
        browserFetch
      ).catch(() => null);

      if (!verified) {
        setTrialVerifyError(ERROR_MESSAGES.network_error);
        return;
      }

      const verifyData = verified.data as RegisterVerifySuccess | RegisterVerifyFailure;

      if (!verified.ok || !('ok' in verifyData)) {
        setTrialVerifyError(
          failureMessage(verifyData as RegisterVerifyFailure, '등록 결과를 확인하지 못했습니다.')
        );
        return;
      }

      const article =
        (verifyData as RegisterVerifySuccess).articles?.find(
          (found) => found.naverReviewId === review.naverReviewId
        ) ?? null;

      if (!article) {
        setTrialVerifyError('카페24 게시판에서 이 리뷰글번호를 다시 찾지 못했습니다.');
        return;
      }

      setTrialArticle(article);
    } finally {
      setIsTrialRunning(false);
    }
  }, [
    isRegistering,
    hasStarted,
    trialStarted,
    isTrialRunning,
    registerBlockReason,
    precheck,
    allowedIds,
    targetById,
  ]);

  /** 보낸 네이버 이미지 주소와 카페24가 돌려준 주소 비교 */
  const trialComparisons = useMemo(() => {
    if (!trialTarget || !trialArticle) return [];
    return compareTrialAttachments(trialTarget.attachments, trialArticle.attachments);
  }, [trialTarget, trialArticle]);

  const successIds = useMemo(
    () => successItems.map((item) => item.naverReviewId),
    [successItems]
  );

  /** 이미지 주소가 유효하지 않아 첨부만 빼고 등록한 리뷰 */
  const attachmentSkipped = useMemo(
    () => successItems.filter((item) => Boolean(item.attachmentSkippedReason)),
    [successItems]
  );

  const runVerify = useCallback(async () => {
    if (isVerifying || successIds.length === 0) return;

    setIsVerifying(true);
    setVerifyError('');
    setVerifyResult(null);

    try {
      const res = await fetch('/api/review-migration/cafe24/reviews/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naverReviewIds: successIds }),
      });

      const data = (await res.json()) as RegisterVerifySuccess | RegisterVerifyFailure;

      if (!res.ok || !('ok' in data)) {
        setVerifyError(failureMessage(data as RegisterVerifyFailure, '등록 결과를 확인하지 못했습니다.'));
        return;
      }

      setVerifyResult(data);
    } catch {
      setVerifyError(ERROR_MESSAGES.network_error);
    } finally {
      setIsVerifying(false);
    }
  }, [isVerifying, successIds]);

  const totalToRegister = allowedIds.length;
  const isComplete = hasStarted && !isRegistering;
  const isFullSuccess =
    isComplete && failedItems.length === 0 && unclearItems.length === 0 && notProcessedCount === 0;

  /**
   * 실패는 있었지만 모든 묶음을 끝까지 처리한 상태.
   * 이때는 중단 안내를 쓰지 않고 '완료 + 일부 실패'로 알려 줍니다.
   */
  const completedWithFailures =
    isComplete && !isFullSuccess && !haltedByProblem && !stoppedByUser && notProcessedCount === 0;

  /** 묶음 번호로 그 묶음의 진단 요약을 찾기 위한 표 (개발 환경에서만 값이 있습니다) */
  const diagnosticByBatch = useMemo(
    () => new Map(batchDiagnostics.map((entry) => [entry.batchNumber, entry.info])),
    [batchDiagnostics]
  );

  return (
    <div className="mt-8 border-2 border-[#5244e8]/30 bg-[#5244e8]/5 rounded-lg p-4 sm:p-5">
      <h3 className="text-[15px] font-bold text-gray-900 mb-1">Cafe24 신규 리뷰 등록</h3>
      <p className="text-[12px] text-gray-500 mb-4 leading-relaxed">
        위 중복 검사와 관리자 판정에서 최종 상태가 신규인 리뷰만 카페24 상품후기 게시판에 등록합니다. 카페24
        공식 제한에 맞춰 한 번에 최대 {CAFE24_ARTICLES_PER_REQUEST}건씩 순차로 보냅니다.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <SummaryTile label="등록 예정" value={candidateCount} valueClass="text-emerald-600" />
        <SummaryTile label="중복 제외" value={duplicateConfirmedCount} valueClass="text-red-600" />
        <SummaryTile label="확인 필요" value={needsReviewCount} valueClass="text-amber-600" />
        <SummaryTile label="상품 매칭 건너뜀" value={skippedReviewCount} valueClass="text-gray-500" />
      </div>

      {registerBlockReason && !hasStarted && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-[13px] font-bold text-amber-700 leading-relaxed">{registerBlockReason}</p>
        </div>
      )}

      {/* 1) 등록 전 최종 확인 — 게시판을 다시 읽기만 합니다. */}
      {!hasStarted && !trialStarted && !registerBlockReason && (
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={() => void runPrecheck()}
              disabled={isPrechecking}
              className="w-full sm:w-auto px-5 h-[42px] !bg-white hover:!bg-gray-100 border-2 border-[#5244e8] !text-[#5244e8] font-bold text-[13px] rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPrechecking && (
                <span className="w-4 h-4 border-2 border-[#5244e8] border-t-transparent rounded-full animate-spin" />
              )}
              {isPrechecking ? '확인 중...' : '등록 전 최종 확인'}
            </button>

            <p className="text-[12px] text-gray-500 leading-relaxed">
              카페24 게시판을 다시 조회해 리뷰글번호 중복과 판정 근거가 그대로인지 확인합니다. 이 과정에서는
              게시글을 등록·수정하지 않습니다.
            </p>
          </div>

          {precheckError && (
            <p className="mt-3 text-[13px] font-bold text-red-600 leading-relaxed">{precheckError}</p>
          )}
        </div>
      )}

      {/* 2) 최종 확인 결과 */}
      {precheck && !hasStarted && !trialStarted && (
        <div className="mb-4 bg-white border border-gray-200 rounded-lg px-4 py-3">
          <p className="text-[13px] font-bold text-gray-900 mb-1">
            최종 확인 완료 · 게시판 {precheck.boardNo}번 · 확인한 기존 게시글{' '}
            {precheck.scannedArticleCount.toLocaleString()}건
          </p>

          {blockedItems.length > 0 ? (
            <>
              <p className="text-[13px] font-bold text-red-600 leading-relaxed">
                등록할 수 없는 리뷰가 {blockedItems.length.toLocaleString()}건 있어 등록을 시작하지 않았습니다.
              </p>
              <p className="mt-1 text-[12px] font-bold text-gray-600 leading-relaxed">
                [기존 리뷰 중복 검사]를 다시 실행한 뒤 판정을 마치고 등록해 주세요.
              </p>

              <ul className="mt-2 space-y-1">
                {blockedItems.slice(0, 20).map((item) => (
                  <li key={item.naverReviewId} className="text-[12px] font-bold text-gray-700">
                    {item.naverReviewId} — {BLOCK_REASON_LABELS[item.reason]}
                  </li>
                ))}
              </ul>

              {blockedItems.length > 20 && (
                <p className="mt-1 text-[12px] font-bold text-gray-500">
                  외 {(blockedItems.length - 20).toLocaleString()}건
                </p>
              )}
            </>
          ) : (
            <p className="text-[13px] font-bold text-emerald-600 leading-relaxed">
              등록 후보 {totalToRegister.toLocaleString()}건 모두 등록할 수 있습니다.
            </p>
          )}
        </div>
      )}

      {/*
        3) 이미지 리뷰 1건 시험 등록.

        카페24 공식 문서에 attach_file_urls 이미지를 카페24가 자체 저장·리사이징하는지가 적혀 있지 않아,
        전체 등록 전에 이미지가 있는 정상 신규 후보 한 건만 실제로 등록해 결과를 눈으로 확인합니다.
      */}
      {precheck && blockedItems.length === 0 && !hasStarted && !trialStarted && (
        <div className="mb-4 bg-white border border-gray-200 rounded-lg px-4 py-3">
          <p className="text-[13px] font-bold text-gray-900 mb-1">이미지 리뷰 1건 시험 등록</p>
          <p className="text-[12px] text-gray-500 mb-3 leading-relaxed">
            카페24 공식 문서는 첨부 이미지를 카페24가 직접 보관하는지 밝히지 않습니다. 전체 등록 전에 이미지가
            있는 신규 후보 한 건만 실제로 등록해 보관 방식과 이미지 주소를 확인합니다.
          </p>

          {trialCandidate ? (
            <>
              <div className="mb-3 space-y-1 text-[13px] font-bold text-gray-700">
                <p>네이버 리뷰글번호: {trialCandidate.review.naverReviewId}</p>
                <p>네이버 상품명: {trialCandidate.review.productName}</p>
                <p>연결된 Cafe24 상품번호: {trialCandidate.review.cafe24ProductNo}</p>
                <p>작성일: {trialCandidate.review.registeredAt}</p>
                <p>이미지 수: {trialCandidate.attachments.length.toLocaleString()}개</p>
              </div>

              <button
                type="button"
                onClick={() => void runTrialRegister()}
                disabled={isTrialRunning}
                className="w-full sm:w-auto px-5 h-[42px] !bg-white hover:!bg-gray-100 border-2 border-[#5244e8] !text-[#5244e8] font-bold text-[13px] rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이미지 리뷰 1건 시험 등록
              </button>
            </>
          ) : (
            <p className="text-[13px] font-bold text-amber-700 leading-relaxed">
              {TRIAL_NO_IMAGE_CANDIDATE_MESSAGE}
            </p>
          )}
        </div>
      )}

      {/* 4) 시험 등록 결과 */}
      {trialStarted && trialTarget && (
        <div className="mb-4 bg-white border-2 border-[#5244e8] rounded-lg px-4 py-3">
          <p className="text-[13px] font-bold text-gray-900 mb-2">
            {isTrialRunning ? '이미지 리뷰 1건 시험 등록 중...' : '이미지 리뷰 1건 시험 등록 결과'}
          </p>

          <div className="space-y-1 text-[13px] font-bold text-gray-700">
            <p>네이버 리뷰글번호: {trialTarget.naverReviewId}</p>
            <p>네이버 상품명: {trialTarget.productName}</p>
            <p>연결된 Cafe24 상품번호: {trialTarget.cafe24ProductNo}</p>
            <p>작성일: {trialTarget.registeredAt}</p>
            <p>이미지 수: {trialTarget.attachments.length.toLocaleString()}개</p>
          </div>

          {!isTrialRunning && (
            <div className="mt-2 space-y-1 text-[13px] font-bold text-gray-700">
              <p className={trialResult?.registered ? 'text-emerald-600' : 'text-red-600'}>
                등록 성공 여부: {trialResult?.registered ? '성공' : '실패'}
              </p>
              <p>Cafe24 게시글번호: {trialResult?.articleNo ?? trialArticle?.articleNo ?? '확인 불가'}</p>

              {trialResult && !trialResult.registered && (
                <p className="text-red-600">{itemFailureReason(trialResult.code)}</p>
              )}

              {trialResult?.attachmentSkippedReason && (
                <p className="text-amber-700">{trialResult.attachmentSkippedReason}</p>
              )}
            </div>
          )}

          {/* 카페24가 돌려준 첨부 파일명·주소 */}
          {trialArticle && (
            <div className="mt-3 border-t border-gray-200 pt-3">
              <p className="text-[13px] font-bold text-gray-900 mb-1">
                Cafe24가 돌려준 첨부 {trialArticle.attachments.length.toLocaleString()}개
              </p>

              {trialComparisons.length === 0 ? (
                <p className="text-[12px] font-bold text-amber-700 leading-relaxed">
                  {TRIAL_ATTACHMENTS_UNAVAILABLE_MESSAGE}
                </p>
              ) : (
                <ul className="space-y-2">
                  {trialComparisons.map((item, index) => (
                    <li
                      key={`${item.url}-${index}`}
                      className="text-[12px] font-bold text-gray-700 break-all space-y-0.5"
                    >
                      <p>첨부파일명: {item.filename || '확인 불가'}</p>
                      <p>이미지 URL: {item.url || '확인 불가'}</p>
                      <p>반환 URL 호스트명: {item.host || '확인 불가'}</p>
                      <p className={item.sameAsNaverUrl ? 'text-amber-700' : 'text-emerald-600'}>
                        원래 네이버 이미지 URL과 동일: {item.sameAsNaverUrl ? '동일 (카페24가 네이버 주소를 그대로 참조)' : '다름 (카페24가 자체 저장)'}
                      </p>
                      {!item.sameAsNaverUrl && item.naverUrl && (
                        <p className="text-gray-500">원래 네이버 이미지 URL: {item.naverUrl}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {trialError && (
            <>
              <p className="mt-2 text-[13px] font-bold text-red-600 leading-relaxed">{trialError}</p>
              <Cafe24DevErrorDetailBox detail={trialErrorDetail} />
            </>
          )}

          {trialVerifyError && (
            <p className="mt-2 text-[13px] font-bold text-red-600 leading-relaxed">
              {trialVerifyError}
            </p>
          )}

          {/* 성공·실패와 관계없이 다음 등록 전에 중복 검사를 다시 하도록 안내합니다. */}
          {!isTrialRunning && (
            <p className="mt-3 text-[13px] font-bold text-amber-700 leading-relaxed">
              {TRIAL_RECHECK_GUIDE}
            </p>
          )}
        </div>
      )}

      {/* 5) 실제 등록 버튼 — 최종 확인을 통과했고 아직 등록·시험 등록을 시작하지 않은 경우에만 보입니다. */}
      {precheck && blockedItems.length === 0 && totalToRegister > 0 && !hasStarted && !trialStarted && (
        <button
          type="button"
          onClick={() => void runRegister()}
          disabled={isRegistering || isTrialRunning}
          className="w-full sm:w-auto px-6 h-[46px] !bg-[#5244e8] hover:!bg-blue-700 !text-white font-bold text-sm rounded-md transition-colors shadow-sm disabled:!bg-gray-400 disabled:cursor-not-allowed"
        >
          Cafe24에 신규 리뷰 {totalToRegister.toLocaleString()}건 등록
        </button>
      )}

      {/* 6) 등록 진행률과 중단 버튼 */}
      {isRegistering && (
        <div className="bg-white border-2 border-[#5244e8] rounded-lg px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[15px] font-bold text-[#5244e8]">
              등록 중 {sentCount.toLocaleString()} / {totalToRegister.toLocaleString()}
            </p>

            <button
              type="button"
              onClick={() => {
                stopRequested.current = true;
              }}
              className="px-4 h-[38px] !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[13px] rounded-md transition-colors"
            >
              중단
            </button>
          </div>

          <p className="mt-2 text-[12px] text-gray-500 leading-relaxed">
            중단을 누르면 지금 보내고 있는 묶음이 끝난 뒤에 멈춥니다. 이미 등록된 리뷰는 취소되지 않습니다.
          </p>
        </div>
      )}

      {/* 7) 등록 결과 */}
      {isComplete && (
        <div
          className={`rounded-lg px-4 py-3 border ${
            isFullSuccess ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
          }`}
        >
          <p
            className={`text-[15px] font-bold leading-relaxed ${
              isFullSuccess ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {isFullSuccess
              ? 'Cafe24 신규 리뷰 등록이 완료되었습니다.'
              : completedWithFailures
                ? '등록이 완료되었지만 일부 리뷰가 실패했습니다.'
                : stoppedByUser
                  ? '요청에 따라 등록을 중단했습니다.'
                  : '등록 중 문제가 발생해 중단했습니다.'}
          </p>

          <div className="mt-2 space-y-1 text-[13px] font-bold text-gray-700">
            <p>최초 등록 요청: {totalToRegister.toLocaleString()}건</p>
            <p>등록 성공: {successIds.length.toLocaleString()}건</p>
            <p>명시적 등록 실패: {failedItems.length.toLocaleString()}건</p>
            <p>결과 불명확: {unclearItems.length.toLocaleString()}건</p>
            <p>처리 전 중단: {notProcessedCount.toLocaleString()}건</p>
            <p>중복 확정으로 제외: {duplicateConfirmedCount.toLocaleString()}건</p>
            <p>상품 매칭 건너뜀: {skippedReviewCount.toLocaleString()}건</p>
            {successIds.length > 0 && (
              <p>마지막으로 성공한 네이버 리뷰글번호: {successIds[successIds.length - 1]}</p>
            )}
          </div>

          {/*
            응답을 기다리지 않고 보낸 요청이므로 '완료'가 아니라 '요청됨'입니다.
            실제 반영 여부는 [Google 상품평 피드] 영역의 생성 시각으로 확인합니다.
          */}
          {feedRefreshRequested && (
            <p className="mt-2 text-[13px] font-bold text-gray-700 leading-relaxed">
              Google 상품평 피드 갱신 요청됨 — 위 [Google 상품평 피드] 영역에서 [상태 새로고침]을 눌러 생성
              시각이 바뀌었는지 확인해 주세요. 갱신에는 20초쯤 걸립니다.
            </p>
          )}

          {completedWithFailures && (
            <p className="mt-2 text-[13px] font-bold text-gray-700 leading-relaxed">
              실패한 리뷰는 아래 목록에 남겨 두었습니다. 같은 실행에서 자동으로 다시 보내지 않았으니, 원인을
              해결한 뒤 [기존 리뷰 중복 검사]부터 다시 실행해 등록해 주세요.
            </p>
          )}

          {registerError && (
            <>
              <p className="mt-2 text-[13px] font-bold text-red-600 leading-relaxed">{registerError}</p>
              <Cafe24DevErrorDetailBox detail={registerErrorDetail} />
            </>
          )}

          {/*
            등록되지 않은 것이 확실한 리뷰.
            카페24가 사유를 이 건에 연결해 준 경우에는 code·message·필드별 사유를 그대로 보여 주고,
            연결할 수 없었으면 묶음 단위 사유만 가리킵니다. 사유를 임의로 배정하지 않습니다.
          */}
          {failedItems.length > 0 && (
            <div className="mt-2">
              <p className="text-[13px] font-bold text-gray-700 leading-relaxed">
                명시적으로 실패한 리뷰 {failedItems.length.toLocaleString()}건
              </p>

              <ul className="mt-1 space-y-2">
                {failedItems.slice(0, 20).map((item) => (
                  <li key={item.naverReviewId}>
                    <p className="text-[12px] font-bold text-red-600">
                      {item.naverReviewId} — 묶음 {item.batchNumber.toLocaleString()}
                      {typeof item.requestIndex === 'number' && ` · 묶음 내 위치 ${item.requestIndex}`} —{' '}
                      {itemFailureReason(item.code)}
                      {item.reasonLinked ? ' · 개별 사유 연결됨' : ' · 개별 사유 연결 불가'}
                    </p>

                    {item.devDetail ? (
                      <Cafe24DevErrorDetailBox
                        detail={item.devDetail}
                        title="Cafe24 207 개별 실패 사유 (개발 환경에서만 표시)"
                      />
                    ) : (
                      <FailureGroupHint info={diagnosticByBatch.get(item.batchNumber)} batchNumber={item.batchNumber} />
                    )}
                  </li>
                ))}
              </ul>

              {failedItems.length > 20 && (
                <p className="mt-1 text-[12px] font-bold text-gray-500">
                  외 {(failedItems.length - 20).toLocaleString()}건
                </p>
              )}
            </div>
          )}

          {/* 성공도 실패도 확인하지 못한 리뷰. 이 건이 있으면 등록을 그 자리에서 멈춥니다. */}
          {unclearItems.length > 0 && (
            <div className="mt-2">
              <p className="text-[13px] font-bold text-amber-700 leading-relaxed">
                결과를 확인하지 못한 리뷰 {unclearItems.length.toLocaleString()}건 — 실제 등록 여부를 반드시
                [기존 리뷰 중복 검사]로 확인해 주세요.
              </p>

              <ul className="mt-1 space-y-1">
                {unclearItems.slice(0, 20).map((item) => (
                  <li key={item.naverReviewId} className="text-[12px] font-bold text-amber-700">
                    {item.naverReviewId} — 묶음 {item.batchNumber.toLocaleString()}
                    {typeof item.requestIndex === 'number' && ` · 묶음 내 위치 ${item.requestIndex}`} —{' '}
                    {itemFailureReason(item.code)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 묶음별 사유 (개발 환경 전용). 어느 리뷰의 것인지 연결하지 못한 사유를 그대로 보존합니다. */}
          {batchDiagnostics.map(({ batchNumber, info }) =>
            info.commonFailureDetail === null && info.unattributed.length === 0 ? null : (
              <div key={batchNumber} className="mt-2">
                <p className="text-[13px] font-bold text-gray-700 leading-relaxed">
                  묶음 {batchNumber.toLocaleString()} · Cafe24 {info.status} 응답 사유{' '}
                  {info.reasonsUnlinkable
                    ? '(개별 사유 연결 불가)'
                    : info.commonFailureDetail
                      ? `(묶음 공통 사유 · 대상 ${info.unlinkedFailedCount.toLocaleString()}건)`
                      : ''}
                </p>

                {info.commonFailureDetail && (
                  <Cafe24DevErrorDetailBox
                    detail={info.commonFailureDetail}
                    title="Cafe24 207 묶음 공통 실패 사유 (개발 환경에서만 표시)"
                  />
                )}

                {info.reasonsUnlinkable &&
                  info.unattributed.map((note, index) => (
                    <Cafe24DevErrorDetailBox
                      key={`${note.reportedIndex ?? 'none'}-${index}`}
                      detail={note.detail}
                      title={`Cafe24 207 미연결 실패 사유 (응답의 위치값: ${
                        note.reportedIndex ?? '없음'
                      } · 개발 환경에서만 표시)`}
                    />
                  ))}
              </div>
            )
          )}

          {/* 완료 + 일부 실패일 때는 위에서 이미 같은 안내를 했으므로 다시 쓰지 않습니다. */}
          {!isFullSuccess && !completedWithFailures && (
            <p className="mt-2 text-[13px] font-bold text-amber-700 leading-relaxed">{RE_CHECK_GUIDE}</p>
          )}

          {/* 이미지 주소가 유효하지 않아 첨부만 빼고 등록한 리뷰 */}
          {attachmentSkipped.length > 0 && (
            <div className="mt-2">
              <p className="text-[13px] font-bold text-gray-700 leading-relaxed">
                첨부 이미지를 제외하고 등록한 리뷰 {attachmentSkipped.length.toLocaleString()}건
              </p>
              <ul className="mt-1 space-y-1">
                {attachmentSkipped.slice(0, 20).map((item) => (
                  <li key={item.naverReviewId} className="text-[12px] font-bold text-gray-500">
                    {item.naverReviewId} — {item.attachmentSkippedReason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {successIds.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void runVerify()}
                disabled={isVerifying}
                className="px-5 h-[40px] !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[13px] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isVerifying && (
                  <span className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                )}
                {isVerifying ? '확인 중...' : '등록 결과 확인'}
              </button>

              {verifyError && (
                <p className="mt-2 text-[13px] font-bold text-red-600 leading-relaxed">{verifyError}</p>
              )}

              {verifyResult && (
                <div className="mt-2 text-[13px] font-bold text-gray-700 space-y-1">
                  <p>
                    확인 완료 {verifyResult.foundCount.toLocaleString()} /{' '}
                    {verifyResult.requestedCount.toLocaleString()}
                  </p>
                  {verifyResult.missingNaverReviewIds.length > 0 && (
                    <p className="text-red-600">
                      누락 리뷰글번호: {verifyResult.missingNaverReviewIds.join(', ')}
                    </p>
                  )}
                  {verifyResult.duplicatedNaverReviewIds.length > 0 && (
                    <p className="text-red-600">
                      중복 생성된 리뷰글번호: {verifyResult.duplicatedNaverReviewIds.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
