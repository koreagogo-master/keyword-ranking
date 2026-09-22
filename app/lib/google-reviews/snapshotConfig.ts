/**
 * 스냅샷 관련 설정값 (서버 전용).
 *
 * cafe24/config.ts와 같은 방침입니다.
 * 환경변수는 모듈 최상단이 아니라 호출 시점(요청 처리 중)에 읽고,
 * 형식이 잘못된 값은 예외를 던지지 않고 기본값으로 되돌립니다.
 */

/** 직전 스냅샷 대비 리뷰 수가 이 비율 아래로 떨어지면 갱신을 거부합니다. */
export const DEFAULT_MIN_RETAIN_RATIO = 0.9;

/** 스냅샷이 이 시간보다 오래되면 경고 로그를 남깁니다. (제공을 거부하는 기준이 아닙니다) */
export const DEFAULT_MAX_AGE_HOURS = 48;

/** 실패 기록 보존 기간 */
export const DEFAULT_FAILED_RETENTION_DAYS = 30;

/** 스냅샷이 없을 때 돌려줄 Retry-After (초) */
export const SNAPSHOT_MISSING_RETRY_AFTER_SECONDS = 1800;

function readNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number.parseFloat(raw?.trim() ?? '');

  if (!Number.isFinite(value)) return fallback;
  if (value < min || value > max) return fallback;

  return value;
}

/**
 * 리뷰 수 급감 거부 기준.
 *
 * 카페24가 ok를 주면서도 일부 페이지를 빈 배열로 돌려주는 경우
 * incomplete_scan에 걸리지 않고 통과합니다. 그때 잡아내는 마지막 방어선입니다.
 * 0(검사 안 함)부터 1(한 건도 줄면 안 됨) 사이만 허용합니다.
 */
export function resolveMinRetainRatio(): number {
  return readNumber(process.env.GOOGLE_REVIEW_FEED_MIN_RETAIN_RATIO, DEFAULT_MIN_RETAIN_RATIO, 0, 1);
}

/** 오래된 스냅샷 경고 기준 (시간). 1시간 ~ 1년 */
export function resolveMaxAgeHours(): number {
  return readNumber(process.env.GOOGLE_REVIEW_FEED_MAX_AGE_HOURS, DEFAULT_MAX_AGE_HOURS, 1, 8760);
}

/** 실패 기록 보존 기간 (일). 1일 ~ 1년 */
export function resolveFailedRetentionDays(): number {
  return readNumber(
    process.env.GOOGLE_REVIEW_FEED_FAILED_RETENTION_DAYS,
    DEFAULT_FAILED_RETENTION_DAYS,
    1,
    365
  );
}

/** 스냅샷 나이 (시간). 해석할 수 없으면 null */
export function snapshotAgeHours(generatedAt: string, now: number = Date.now()): number | null {
  const parsed = Date.parse(generatedAt);
  if (Number.isNaN(parsed)) return null;

  return (now - parsed) / (60 * 60 * 1000);
}
