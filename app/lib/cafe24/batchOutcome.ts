/**
 * 등록 묶음 한 개(최대 10건)의 결과를 성공·명시적 실패·결과 불명확으로 나누는 순수 함수 모듈.
 *
 * 왜 필요한가
 *  Cafe24가 207로 "성공 2건 · 명확한 실패 8건"을 알려 준 경우, 실패 8건 때문에 남은 후보 74건까지
 *  멈춰 있었습니다. 결과가 전부 설명되는 묶음이라면 실패를 따로 기록하고 다음 묶음으로 넘어가야 합니다.
 *  반대로 결과를 확인할 수 없는 건이 하나라도 있으면 지금처럼 즉시 멈춰야 합니다.
 *
 * 판단 원칙
 *  - 성공은 응답에서 확인된 것만 성공입니다. (기존 성공 확인 로직을 그대로 씁니다)
 *  - 실패는 카페24가 명확히 알려 준 것만 실패입니다.
 *  - 설명되지 않는 건이 있으면 성공도 실패도 아닌 '결과 불명확'으로 두고 멈춥니다. 추측하지 않습니다.
 *  - 실패로 확정했더라도 사유를 특정 리뷰에 임의로 배정하지 않습니다.
 *    사유가 모두 같으면 묶음 공통 사유로, 서로 다르면 '개별 사유 연결 불가'로 남깁니다.
 *  - 여기서 자동 재시도를 하지 않습니다. 실패한 리뷰는 목록으로만 남습니다.
 *
 * 네트워크 호출도 환경변수 접근도 없어 가짜 응답만으로 그대로 검증할 수 있습니다.
 */

import type { Cafe24MultiStatusAttribution, Cafe24MultiStatusFailure } from './multiStatus';

/** 다음 묶음을 보내지 않고 즉시 멈춰야 하는 사유 */
export type Cafe24BatchStopReason =
  /** 응답 구조를 해석하지 못했습니다. */
  | 'unreadable_response'
  /** 같은 리뷰가 성공과 실패 양쪽에 들어 있습니다. */
  | 'conflicting_result'
  /** 두 사유가 같은 응답 위치를 가리켰습니다. */
  | 'position_conflict'
  /** 요청 범위를 벗어난 위치를 가리켰습니다. */
  | 'position_out_of_range'
  /** 성공 + 명시적 실패가 요청 건수와 맞지 않습니다. */
  | 'count_mismatch'
  /** 결과를 확인하지 못한 리뷰가 있습니다. */
  | 'unclear_items';

export interface Cafe24BatchInput {
  /** 카페24로 실제 보낸 요청 수 */
  requestCount: number;
  /** 응답에서 등록이 확인된 위치 */
  confirmedIndexes: readonly number[];
  /** 응답을 JSON 구조로 읽을 수 있었는지 */
  responseReadable: boolean;
  /** 위치를 맞춘 결과 */
  attribution: Cafe24MultiStatusAttribution;
}

export interface Cafe24BatchClassification {
  requestCount: number;
  /** 등록이 확인된 위치 */
  registeredIndexes: number[];
  /** 카페24가 준 사유를 이 건에 연결할 수 있는 실패 위치 */
  failedIndexesWithReason: number[];
  /**
   * 실패로 확정했지만 사유를 개별로 연결할 수 없는 위치.
   * (성공이 확인된 나머지 자리이고, 남은 수와 카페24가 준 사유 수가 정확히 같을 때만 확정합니다)
   */
  failedIndexesWithoutReason: number[];
  /** 성공도 실패도 확인하지 못한 위치 */
  unclearIndexes: number[];
  /** 성공·명시적 실패로 설명되지 않은 건수 (0이 아니면 멈춥니다) */
  unaccountedCount: number;
  /** 사유를 개별 연결하지 못한 실패에 공통으로 적용되는 사유. 사유가 모두 같을 때만 채워집니다. */
  commonFailure: Cafe24MultiStatusFailure | null;
  /** 사유가 서로 달라 어느 리뷰의 것인지 연결할 수 없는 경우 true */
  reasonsUnlinkable: boolean;
  /** 다음 묶음을 이어서 보내도 되는지 */
  canContinue: boolean;
  stopReason: Cafe24BatchStopReason | null;
}

/** 등록 결과 한 건의 공통 부분. 라우트가 여기에 개발 전용 상세와 첨부 안내만 덧붙입니다. */
export interface Cafe24BatchResultItem {
  naverReviewId: string;
  registered: boolean;
  articleNo: number | null;
  /** 실패 사유 코드. 명시적 실패는 cafe24_rejected, 결과 불명확은 not_confirmed */
  code?: string;
  /** 카페24로 보낸 requests 배열에서의 위치 */
  requestIndex: number;
  /** 등록되지 않은 것이 확실한지 */
  failureConfirmed?: boolean;
  /** 사유를 이 건에 개별로 연결했는지 */
  reasonLinked?: boolean;
}

/** 사유 두 건이 같은 내용인지 (code·message·필드별 사유가 모두 같아야 같은 사유입니다) */
function sameFailureReason(a: Cafe24MultiStatusFailure, b: Cafe24MultiStatusFailure): boolean {
  return (
    a.detail.code === b.detail.code &&
    a.detail.message === b.detail.message &&
    a.detail.fields.length === b.detail.fields.length &&
    a.detail.fields.every((field, index) => field === b.detail.fields[index])
  );
}

/**
 * 묶음 한 개의 결과를 나눕니다.
 *
 * 계속 진행하는 조건은 네 가지를 모두 만족하는 경우뿐입니다.
 *  1. 성공 건수가 응답에서 확정됐다
 *  2. 실패 건수가 응답에서 명확히 확인됐다
 *  3. 성공 + 실패 = 이 묶음의 요청 건수
 *  4. 결과가 불명확한 리뷰가 0건이다
 */
export function classifyCafe24Batch(input: Cafe24BatchInput): Cafe24BatchClassification {
  const { attribution, requestCount } = input;

  const registeredIndexes = [
    ...new Set(input.confirmedIndexes.filter((index) => index >= 0 && index < requestCount)),
  ].sort((a, b) => a - b);

  const failedIndexesWithReason = [...attribution.byIndex.keys()].sort((a, b) => a - b);

  const accountedFor = new Set([...registeredIndexes, ...failedIndexesWithReason]);
  const remaining: number[] = [];
  for (let index = 0; index < requestCount; index += 1) {
    if (!accountedFor.has(index)) remaining.push(index);
  }

  const unlinkedReasons = attribution.unattributed;

  /**
   * 남은 자리 수와 카페24가 준 사유 수가 정확히 같을 때만 남은 자리를 실패로 확정합니다.
   * 하나라도 어긋나면 어느 리뷰가 실패했는지 알 수 없으므로 전부 '결과 불명확'으로 둡니다.
   */
  const remainingAllFailed = remaining.length > 0 && unlinkedReasons.length === remaining.length;

  const failedIndexesWithoutReason = remainingAllFailed ? remaining : [];
  const unclearIndexes = remainingAllFailed ? [] : remaining;

  const unaccountedCount = Math.max(0, remaining.length - unlinkedReasons.length);

  const commonFailure =
    failedIndexesWithoutReason.length > 0 &&
    unlinkedReasons.length > 0 &&
    unlinkedReasons.every((failure) => sameFailureReason(failure, unlinkedReasons[0]))
      ? unlinkedReasons[0]
      : null;

  const reasonsUnlinkable = failedIndexesWithoutReason.length > 0 && commonFailure === null;

  const stopReason: Cafe24BatchStopReason | null = !input.responseReadable
    ? 'unreadable_response'
    : attribution.conflictingCount > 0
      ? 'conflicting_result'
      : attribution.duplicateIndexes.length > 0
        ? 'position_conflict'
        : attribution.outOfRangeCount > 0
          ? 'position_out_of_range'
          : unlinkedReasons.length > remaining.length
            ? 'count_mismatch'
            : unclearIndexes.length > 0
              ? 'unclear_items'
              : registeredIndexes.length + failedIndexesWithReason.length + failedIndexesWithoutReason.length !==
                  requestCount
                ? 'count_mismatch'
                : null;

  return {
    requestCount,
    registeredIndexes,
    failedIndexesWithReason,
    failedIndexesWithoutReason,
    unclearIndexes,
    unaccountedCount,
    commonFailure,
    reasonsUnlinkable,
    canContinue: stopReason === null,
    stopReason,
  };
}

/**
 * 분류 결과를 화면이 쓰는 등록 결과 목록으로 바꿉니다.
 *
 * 라우트와 자동 검증이 같은 함수를 쓰기 위해 여기에 둡니다.
 * 보낸 순서를 그대로 유지하고, 성공·명시적 실패·결과 불명확을 코드와 표시값으로 구분합니다.
 */
export function buildCafe24BatchResults(input: {
  /** 보낸 순서대로의 리뷰글번호 */
  naverReviewIdByIndex: readonly string[];
  /** 등록에 성공한 위치의 게시글번호 (확인하지 못하면 null) */
  articleNoByIndex: readonly (number | null)[];
  classification: Cafe24BatchClassification;
}): Cafe24BatchResultItem[] {
  const { classification } = input;

  const registered = new Set(classification.registeredIndexes);
  const linked = new Set(classification.failedIndexesWithReason);
  const unlinked = new Set(classification.failedIndexesWithoutReason);

  return input.naverReviewIdByIndex.map((naverReviewId, index) => {
    if (registered.has(index)) {
      return {
        naverReviewId,
        registered: true,
        articleNo: input.articleNoByIndex[index] ?? null,
        requestIndex: index,
      };
    }

    const reasonLinked = linked.has(index);
    const failureConfirmed = reasonLinked || unlinked.has(index);

    return {
      naverReviewId,
      registered: false,
      articleNo: null,
      code: failureConfirmed ? 'cafe24_rejected' : 'not_confirmed',
      requestIndex: index,
      failureConfirmed,
      reasonLinked,
    };
  });
}
