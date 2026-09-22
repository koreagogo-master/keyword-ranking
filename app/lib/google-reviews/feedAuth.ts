import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * 공개 피드 주소의 HTTP Basic 인증 (서버 전용).
 *
 * Google Merchant Center는 로그인 세션을 쓸 수 없어 관리자 가드를 걸 수 없습니다.
 * 대신 Merchant Center가 지원하는 Basic 인증으로 주소를 보호합니다.
 *
 * 아이디·비밀번호는 환경변수에서만 읽습니다.
 * 기본값을 코드에 두지 않고, 값 자체는 반환값·로그·오류 메시지 어디에도 남기지 않습니다.
 */

/** 인증정보를 넣지 않았거나 틀렸을 때 돌려줄 인증 요구 헤더 */
export const FEED_AUTH_CHALLENGE = 'Basic realm="Google product review feed", charset="UTF-8"';

export interface FeedCredentials {
  username: string;
  password: string;
}

/**
 * 환경변수에서 인증정보를 읽습니다. 둘 중 하나라도 비어 있으면 null입니다.
 *
 * null이면 라우트가 503으로 응답합니다.
 * 인증을 걸지 않은 채 리뷰를 공개하는 경로를 만들지 않기 위한 것입니다.
 */
export function resolveFeedCredentials(): FeedCredentials | null {
  const username = process.env.GOOGLE_REVIEW_FEED_USERNAME?.trim() ?? '';
  const password = process.env.GOOGLE_REVIEW_FEED_PASSWORD ?? '';

  if (!username || !password) return null;

  return { username, password };
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

/** `Basic <base64>` 형식만 받아들입니다. */
const BASIC_AUTH_HEADER = /^\s*Basic\s+([A-Za-z0-9+/]+={0,2})\s*$/i;

/**
 * Authorization 헤더가 설정된 인증정보와 일치하는지 확인합니다.
 *
 * 아이디와 비밀번호 비교를 항상 둘 다 실행합니다.
 * 아이디가 틀렸을 때 더 빨리 끝나면 그 자체가 단서가 되기 때문입니다.
 * 실패 사유(아이디가 틀림·비밀번호가 틀림)는 구분해서 돌려주지 않습니다.
 */
export function verifyFeedBasicAuth(
  authorizationHeader: string | null | undefined,
  credentials: FeedCredentials
): boolean {
  if (typeof authorizationHeader !== 'string') return false;

  const matched = BASIC_AUTH_HEADER.exec(authorizationHeader);
  if (!matched) return false;

  const decoded = Buffer.from(matched[1], 'base64').toString('utf8');

  // 비밀번호에 ':'가 들어갈 수 있으므로 첫 번째 ':'에서만 자릅니다.
  const separator = decoded.indexOf(':');
  if (separator < 0) return false;

  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  const usernameMatches = timingSafeEquals(username, credentials.username);
  const passwordMatches = timingSafeEquals(password, credentials.password);

  return usernameMatches && passwordMatches;
}
