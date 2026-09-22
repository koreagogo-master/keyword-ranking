import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * 예약 갱신 진입점의 공유 비밀 인증 (서버 전용).
 *
 * Cloud Run 서비스가 --allow-unauthenticated로 배포되어 있어
 * Cloud Scheduler가 부르는 주소에도 자체 인증이 필요합니다.
 *
 * feedAuth.ts와 같은 방침입니다.
 * 값은 환경변수에서만 읽고, 반환값·로그·오류 메시지 어디에도 남기지 않습니다.
 */

/** Cloud Scheduler가 붙여 보내는 헤더 이름 */
export const REFRESH_TOKEN_HEADER = 'x-feed-refresh-token';

/**
 * 설정된 토큰을 읽습니다. 비어 있으면 null입니다.
 *
 * null이면 라우트가 503으로 응답합니다.
 * 인증 없이 갱신을 실행할 수 있는 경로를 만들지 않기 위한 것입니다.
 */
export function resolveRefreshToken(): string | null {
  const token = process.env.GOOGLE_REVIEW_FEED_REFRESH_TOKEN?.trim() ?? '';
  return token ? token : null;
}

/**
 * 길이가 달라도 비교 시간이 값에 따라 달라지지 않도록 SHA-256 다이제스트를 비교합니다.
 * timingSafeEqual은 길이가 같아야 하므로, 해시로 길이를 32바이트로 맞춘 뒤 넘깁니다.
 */
function timingSafeEquals(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left, 'utf8').digest();
  const rightDigest = createHash('sha256').update(right, 'utf8').digest();

  return timingSafeEqual(leftDigest, rightDigest);
}

/** 헤더 값이 설정된 토큰과 일치하는지 확인합니다. 어떤 값이 들어왔는지는 남기지 않습니다. */
export function verifyRefreshToken(headerValue: string | null | undefined, expected: string): boolean {
  if (typeof headerValue !== 'string') return false;

  const received = headerValue.trim();
  if (!received) return false;

  return timingSafeEquals(received, expected);
}
