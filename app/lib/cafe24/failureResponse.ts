import { NextResponse } from 'next/server';
import type { Cafe24AdminFailure } from './adminApi';
import { devOnlyCafe24ErrorDetail } from './errorDetail';

/**
 * 카페24 Admin API 실패를 화면에서 쓸 수 있는 JSON 응답으로 바꿉니다.
 *
 * - 응답에는 짧은 코드와 한국어 안내만 담고, 토큰·설정값·원문 오류는 넣지 않습니다.
 * - subject는 마지막 기본 문장에만 들어갑니다. (예: '상품 목록')
 * - 개발 환경에서만 devDetail로 카페24 원본 오류 요약을 덧붙입니다.
 *   운영 환경에서는 devOnlyCafe24ErrorDetail()이 항상 undefined를 돌려주므로 응답에 들어가지 않습니다.
 */

export const CAFE24_NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: CAFE24_NO_STORE_HEADERS });
}

export function cafe24FailureResponse(failure: Cafe24AdminFailure, subject: string) {
  switch (failure.kind) {
    case 'config_error':
      return json(
        {
          error: '카페24 연동 설정이 올바르지 않습니다. 관리자에게 문의해 주세요.',
          code: 'config_error',
          retryable: false,
        },
        500
      );

    case 'not_connected':
      return json(
        {
          error: '카페24가 아직 연결되지 않았습니다. 먼저 카페24를 연결해 주세요.',
          code: 'not_connected',
          retryable: false,
        },
        409
      );

    case 'reauth_required':
      return json(
        {
          error: '카페24 연결이 만료되었습니다. 연결을 해제한 뒤 다시 연결해 주세요.',
          code: 'reauth_required',
          retryable: false,
        },
        409
      );

    case 'store_error':
      return json(
        {
          error: '연결 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
          code: 'store_error',
          retryable: false,
        },
        500
      );

    case 'token_error':
      return json(
        {
          error: '카페24 인증 토큰을 갱신하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          code: 'token_error',
          retryable: false,
        },
        502
      );

    case 'network':
      return json(
        {
          error: '카페24에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          code: 'network_error',
          retryable: true,
        },
        503
      );

    case 'rate_limited':
      return json(
        {
          error: '카페24 호출 제한에 걸렸습니다. 잠시 후 다시 시도해 주세요.',
          code: 'rate_limited',
          retryable: true,
          retryAfterSeconds: failure.retryAfterSeconds,
        },
        503
      );

    case 'server_error':
      return json(
        {
          error: '카페24 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.',
          code: 'cafe24_unavailable',
          retryable: true,
        },
        502
      );

    /**
     * 쓰기 요청이 반영됐는지 확인할 수 없는 상태.
     * 그대로 다시 보내면 중복 등록될 수 있으므로 재시도를 권하지 않고 재검사를 안내합니다.
     */
    case 'unknown_result':
      return json(
        {
          error: `카페24 응답을 받지 못해 ${subject} 처리 결과를 확인할 수 없습니다. 중복 등록을 막기 위해 자동으로 다시 시도하지 않았습니다. [기존 리뷰 중복 검사]를 다시 실행해 현재 상태를 확인해 주세요.`,
          code: 'unknown_result',
          retryable: false,
          outcomeUnknown: true,
        },
        502
      );

    // kind: 'http' — 카페24가 요청을 거절한 경우
    default: {
      const devDetail = devOnlyCafe24ErrorDetail(failure.detail);

      return json(
        {
          error: `카페24가 ${subject} 요청을 거절했습니다. 잠시 후 다시 시도해 주세요.`,
          code: 'cafe24_error',
          retryable: false,
          ...(devDetail ? { devDetail } : {}),
        },
        502
      );
    }
  }
}
