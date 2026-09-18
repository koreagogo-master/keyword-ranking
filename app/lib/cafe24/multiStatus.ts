/**
 * 카페24 다중 등록 207(Multi-Status) 응답에서 개별 실패 사유만 뽑는 순수 함수 모듈.
 *
 * 왜 필요한가
 *  여러 건을 한 번에 등록하면 카페24는 성공과 실패를 한 응답에 섞어 207로 돌려줍니다.
 *  이때 `response.ok`가 true라서 adminApi의 거절 처리(extractCafe24ErrorDetail)를 타지 않고,
 *  등록 라우트는 성공 항목(articles)만 읽고 나머지 본문을 버렸습니다.
 *  그래서 "requested: 10 registered: 6"만 남고 실패 4건의 사유가 사라졌습니다.
 *
 * 안전 원칙
 *  - 값 해석과 정리만 합니다. 네트워크 호출도 환경변수 접근도 없습니다.
 *  - 사유 문장은 errorDetail.ts의 sanitizeCafe24ErrorText·collectCafe24FieldErrors를 그대로 씁니다.
 *    (새 masking 규칙을 만들지 않습니다. 우리가 보낸 값 제거는 호출부의 redact가 담당합니다)
 *  - 카페24가 사유를 주지 않았으면 만들어 내지 않습니다. 아무 정보도 없는 항목은 버리고,
 *    호출부가 CAFE24_NO_MULTI_STATUS_REASON을 그대로 보여 주게 합니다.
 *  - 어느 리뷰의 실패인지 확실하지 않으면 특정하지 않습니다. (엉뚱한 리뷰에 사유를 붙이지 않습니다)
 */

import {
  collectCafe24FieldErrors,
  extractCafe24ErrorCode,
  sanitizeCafe24ErrorText,
  type Cafe24ErrorDetail,
} from './errorDetail';

/** 다중 등록 응답의 HTTP status */
export const CAFE24_MULTI_STATUS = 207;

/** 207 본문에 개별 실패 사유가 없을 때 화면·로그에 그대로 쓰는 문구 */
export const CAFE24_NO_MULTI_STATUS_REASON = 'Cafe24 207 응답에 개별 실패 사유가 없습니다.';

/**
 * 한 요청당 객체 수 상한(10)과 같은 값.
 * 응답이 예상보다 큰 목록을 담고 있어도 이 개수까지만 읽습니다.
 */
const MAX_FAILURES = 10;

/** 실패 목록이 들어 있을 수 있는 최상위 키 */
const FAILURE_CONTAINER_KEYS = ['error', 'errors', 'failures', 'fails', 'rejected'] as const;

/** 위 컨테이너 안에서 실패 목록으로 쓰이는 키 */
const FAILURE_LIST_KEYS = [
  'received_message',
  'received_messages',
  'errors',
  'error',
  'items',
  'results',
  'details',
  'detail',
  'more_info',
  'messages',
  'list',
] as const;

/** 요청 배열 위치를 담는 키. 값의 시작이 0인지 1인지는 문서에 없어 그대로 읽어 둡니다. */
const INDEX_KEYS = ['index', 'request_index', 'requests_index', 'seq', 'sequence'] as const;

/** 사유 문장을 담는 키 */
const MESSAGE_KEYS = ['message', 'error_message', 'reason', 'description', 'received_message'] as const;

/** 성공 항목이 들어 있는 키 (등록 성공 판정에는 쓰지 않고 개수만 셉니다) */
const SUCCESS_LIST_KEYS = ['articles', 'article'] as const;

/** 207 응답에서 읽은 개별 실패 한 건 */
export interface Cafe24MultiStatusFailure {
  /**
   * 카페24가 적어 준 요청 배열 위치 원본값.
   * 0부터인지 1부터인지 공식 문서에 없어 여기서는 해석하지 않고 그대로 둡니다.
   */
  reportedIndex: number | null;
  /**
   * 실패 목록의 길이가 우리가 보낸 요청 수와 같아 자리로 맞출 수 있는 경우의 위치(0부터).
   * 그렇지 않으면 null입니다.
   */
  positionIndex: number | null;
  /** 응답이 직접 알려 준 naverpay_review_id. 없으면 빈 문자열 */
  naverReviewId: string;
  /** 카페24가 준 code·message·필드별 사유 */
  detail: Cafe24ErrorDetail;
}

export interface Cafe24MultiStatusReport {
  /** 성공·실패가 섞인 응답으로 볼 수 있는지 (207이거나 본문에 실패 목록이 있는 경우) */
  isMultiStatus: boolean;
  /** 응답의 성공 항목 수 */
  successCount: number;
  /** 읽어 낸 개별 실패 사유 */
  failures: Cafe24MultiStatusFailure[];
  /** 실패 사유를 하나도 읽지 못한 경우 true */
  reasonsMissing: boolean;
}

/** 0 이상의 정수만 위치로 인정합니다. */
function toIndexValue(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw >= 0 ? raw : null;
  if (typeof raw === 'string' && /^\d{1,4}$/.test(raw.trim())) return Number.parseInt(raw.trim(), 10);
  return null;
}

function readReportedIndex(record: Record<string, unknown>): number | null {
  for (const key of INDEX_KEYS) {
    const value = toIndexValue(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function readMessage(record: Record<string, unknown>): string | null {
  for (const key of MESSAGE_KEYS) {
    const text = sanitizeCafe24ErrorText(record[key]);
    if (text) return text;
  }
  return null;
}

/** 응답이 실패 항목에 직접 적어 준 naverpay_review_id. 없으면 빈 문자열 */
function readNaverReviewId(record: Record<string, unknown>): string {
  const raw = record.naverpay_review_id;
  const value = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';
  return value === '0' ? '' : value;
}

/**
 * 실패 항목 한 개를 사유로 바꿉니다.
 *
 * code·message·필드별 사유가 하나도 없으면 null을 돌려줍니다.
 * 빈 껍데기를 실패 사유로 만들어 두면 "사유를 받았다"고 잘못 보이기 때문입니다.
 */
function toFailure(
  entry: unknown,
  positionIndex: number | null,
  status: number | null
): Cafe24MultiStatusFailure | null {
  if (typeof entry === 'string' || typeof entry === 'number') {
    const message = sanitizeCafe24ErrorText(entry);
    if (!message) return null;

    return {
      reportedIndex: null,
      positionIndex,
      naverReviewId: '',
      detail: { status, code: null, message, fields: [] },
    };
  }

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

  const record = entry as Record<string, unknown>;

  const code = extractCafe24ErrorCode(record);
  const message = readMessage(record);
  const fields = collectCafe24FieldErrors(record);

  // 카페24가 아무 사유도 적지 않은 항목입니다. 추측해서 채우지 않습니다.
  if (code === null && message === null && fields.length === 0) return null;

  return {
    reportedIndex: readReportedIndex(record),
    positionIndex,
    naverReviewId: readNaverReviewId(record),
    detail: { status, code, message, fields },
  };
}

/** 실패 목록으로 쓸 배열을 찾습니다. 배열을 찾지 못하면 컨테이너 자체를 한 건으로 봅니다. */
function findFailureEntries(container: unknown): { entries: unknown[]; fromArray: boolean } {
  if (Array.isArray(container)) return { entries: container, fromArray: true };

  if (container && typeof container === 'object') {
    const record = container as Record<string, unknown>;

    for (const key of FAILURE_LIST_KEYS) {
      const value = record[key];
      if (Array.isArray(value)) return { entries: value, fromArray: true };
    }

    return { entries: [container], fromArray: false };
  }

  if (typeof container === 'string' || typeof container === 'number') {
    return { entries: [container], fromArray: false };
  }

  return { entries: [], fromArray: false };
}

/** 응답의 성공 항목 수. 등록 성공 판정에는 쓰지 않고 대조용으로만 셉니다. */
function countSuccessItems(record: Record<string, unknown>): number {
  for (const key of SUCCESS_LIST_KEYS) {
    const value = record[key];
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return 1;
  }
  return 0;
}

/**
 * 207 응답 본문에서 성공 항목 수와 개별 실패 사유를 분리해 읽습니다.
 *
 * 카페24 공식 문서는 다중 등록 실패 항목의 정확한 형태를 공개하지 않습니다.
 * 그래서 실패 목록이 올 수 있는 자리를 모두 살피되, 항목 안에서는
 * code·message·`{ field, reason }`처럼 실제로 적혀 있는 값만 읽습니다.
 *
 * requestCount를 넘기면 실패 목록의 길이가 그 수와 같을 때만 자리로 위치를 맞춥니다.
 * (길이가 다르면 몇 번째 요청의 실패인지 단정할 수 없으므로 위치를 비워 둡니다)
 */
export function extractCafe24MultiStatusReport(
  body: unknown,
  status: number | null,
  requestCount: number
): Cafe24MultiStatusReport {
  const record = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  const failures: Cafe24MultiStatusFailure[] = [];
  let sawFailureContainer = false;

  for (const key of FAILURE_CONTAINER_KEYS) {
    const container = record[key];
    if (container === undefined || container === null) continue;

    sawFailureContainer = true;

    const { entries, fromArray } = findFailureEntries(container);

    /**
     * 응답이 요청과 같은 길이의 배열을 돌려준 경우에만 자리로 위치를 맞춥니다.
     * 성공 자리에 빈 값이 들어 있는 형태라도 이때는 몇 번째 요청인지 확실합니다.
     */
    const alignedByPosition = fromArray && requestCount > 0 && entries.length === requestCount;

    for (const [position, entry] of entries.slice(0, MAX_FAILURES).entries()) {
      const failure = toFailure(entry, alignedByPosition ? position : null, status);
      if (failure) failures.push(failure);
      if (failures.length >= MAX_FAILURES) break;
    }

    if (failures.length >= MAX_FAILURES) break;
  }

  return {
    isMultiStatus: status === CAFE24_MULTI_STATUS || sawFailureContainer,
    successCount: countSuccessItems(record),
    failures,
    reasonsMissing: failures.length === 0,
  };
}

/** 실패 사유를 우리가 보낸 요청의 어느 위치에 붙일지 정한 결과 */
export interface Cafe24MultiStatusAttribution {
  /** 요청 배열 위치 → 그 위치의 실패 사유 */
  byIndex: Map<number, Cafe24MultiStatusFailure>;
  /** 어느 건인지 특정할 수 없었던 실패 사유 */
  unattributed: Cafe24MultiStatusFailure[];
  /**
   * reportedIndex를 위치로 쓸 때 적용한 시작값(0 또는 1).
   * 응답의 위치값을 쓰지 않았으면 null입니다.
   */
  indexBase: 0 | 1 | null;
  /**
   * 두 사유가 같은 위치를 가리킨 경우의 위치.
   * 응답을 그대로 믿을 수 없다는 신호이므로 호출부가 등록을 멈추는 근거로 씁니다.
   */
  duplicateIndexes: number[];
  /** 요청 범위를 벗어난 위치를 가리킨 사유 수 */
  outOfRangeCount: number;
  /** 등록이 확인된 위치를 가리킨 사유 수 (성공·실패가 동시에 온 경우) */
  conflictingCount: number;
}

export interface Cafe24MultiStatusContext {
  /** 우리가 보낸 요청 수 */
  requestCount: number;
  /** 위치별 naverpay_review_id (보낸 순서 그대로) */
  naverReviewIdByIndex: readonly string[];
  /** 응답에서 등록을 확인하지 못한 위치 */
  unconfirmedIndexes: readonly number[];
}

/**
 * reportedIndex의 시작값을 정합니다.
 *
 * 공식 문서에 0부터인지 1부터인지 적혀 있지 않아 값만 보고는 알 수 없습니다.
 * 그래서 "실패 사유는 등록되지 않은 리뷰에만 붙는다"는 사실로 대조합니다.
 * 0부터와 1부터 중 한쪽만 앞뒤가 맞으면 그것을 쓰고, 둘 다 맞거나 둘 다 안 맞으면
 * 어느 리뷰의 실패인지 단정할 수 없으므로 null을 돌려줍니다. (추측하지 않습니다)
 */
function resolveIndexBase(
  reportedIndexes: readonly number[],
  context: Cafe24MultiStatusContext
): 0 | 1 | null {
  if (reportedIndexes.length === 0) return null;

  const unconfirmed = new Set(context.unconfirmedIndexes);
  const consistent: (0 | 1)[] = [];

  for (const base of [0, 1] as const) {
    const mapped = reportedIndexes.map((value) => value - base);

    const inRange = mapped.every((index) => index >= 0 && index < context.requestCount);
    const allUnconfirmed = mapped.every((index) => unconfirmed.has(index));
    const distinct = new Set(mapped).size === mapped.length;

    if (inRange && allUnconfirmed && distinct) consistent.push(base);
  }

  return consistent.length === 1 ? consistent[0] : null;
}

/**
 * 읽어 낸 실패 사유를 요청 배열 위치에 붙입니다.
 *
 * 확실한 순서로만 맞춥니다.
 *  1. 응답이 적어 준 naverpay_review_id가 우리가 보낸 값과 같은 위치
 *  2. 실패 목록 길이가 요청 수와 같아 자리로 맞춰진 위치(positionIndex)
 *  3. reportedIndex + 위에서 대조로 확정한 시작값
 * 어느 것도 확실하지 않으면 unattributed에 남겨 특정 리뷰에 붙이지 않습니다.
 *
 * 등록이 확인된 위치로 계산된 사유도 붙이지 않고 unattributed로 남깁니다.
 * 등록 성공 판정(응답의 성공 항목)과 어긋나는 값이므로 지우지 않고 그대로 보여 주기 위한 것입니다.
 */
export function attributeCafe24MultiStatusFailures(
  failures: readonly Cafe24MultiStatusFailure[],
  context: Cafe24MultiStatusContext
): Cafe24MultiStatusAttribution {
  const byIndex = new Map<number, Cafe24MultiStatusFailure>();
  const unattributed: Cafe24MultiStatusFailure[] = [];

  const unconfirmed = new Set(context.unconfirmedIndexes);
  const indexByNaverReviewId = new Map<string, number>();
  context.naverReviewIdByIndex.forEach((naverReviewId, index) => {
    if (naverReviewId && !indexByNaverReviewId.has(naverReviewId)) {
      indexByNaverReviewId.set(naverReviewId, index);
    }
  });

  /** 1·2번 기준으로 이미 자리를 찾은 사유는 시작값 대조에서 제외합니다. */
  const needsReportedIndex = failures.filter(
    (failure) =>
      !indexByNaverReviewId.has(failure.naverReviewId) &&
      failure.positionIndex === null &&
      failure.reportedIndex !== null
  );

  const indexBase = resolveIndexBase(
    needsReportedIndex.map((failure) => failure.reportedIndex as number),
    context
  );

  const duplicateIndexes: number[] = [];
  let outOfRangeCount = 0;
  let conflictingCount = 0;

  /**
   * 응답이 알려 준 위치값 자체가 이상한 경우는 시작값과 상관없이 먼저 셉니다.
   *
   * 시작값은 0 또는 1뿐이므로 요청 수보다 큰 값은 어느 쪽으로도 요청 범위에 들어올 수 없고,
   * 같은 값이 두 번 나오면 두 사유가 같은 자리를 가리킨 것입니다.
   * 둘 다 응답을 그대로 믿을 수 없다는 신호이므로 호출부가 등록을 멈추는 근거로 씁니다.
   */
  const seenReported = new Set<number>();
  for (const failure of failures) {
    const reported = failure.reportedIndex;
    if (reported === null) continue;

    if (reported > context.requestCount) outOfRangeCount += 1;
    else if (seenReported.has(reported)) duplicateIndexes.push(reported);
    else seenReported.add(reported);
  }

  for (const failure of failures) {
    const byReviewId = failure.naverReviewId ? indexByNaverReviewId.get(failure.naverReviewId) : undefined;

    const resolved =
      byReviewId ??
      failure.positionIndex ??
      (indexBase !== null && failure.reportedIndex !== null ? failure.reportedIndex - indexBase : null);

    if (resolved === null) {
      unattributed.push(failure);
      continue;
    }

    // 아래 세 가지는 응답을 그대로 믿을 수 없는 상태입니다. 사유는 버리지 않고 따로 셉니다.
    if (resolved < 0 || resolved >= context.requestCount) {
      outOfRangeCount += 1;
      unattributed.push(failure);
      continue;
    }

    if (!unconfirmed.has(resolved)) {
      conflictingCount += 1;
      unattributed.push(failure);
      continue;
    }

    if (byIndex.has(resolved)) {
      duplicateIndexes.push(resolved);
      unattributed.push(failure);
      continue;
    }

    byIndex.set(resolved, failure);
  }

  return { byIndex, unattributed, indexBase, duplicateIndexes, outOfRangeCount, conflictingCount };
}
