/**
 * 피드 응답의 조건부 요청 처리 (순수 함수 모듈).
 *
 * 네트워크·DB를 쓰지 않으므로 네트워크 없이 그대로 검증할 수 있습니다.
 *
 * Google이 같은 스냅샷을 다시 가져갈 때 886KB를 또 내려보내지 않기 위한 것입니다.
 * 304로 끝나면 xml 컬럼 조회 자체를 건너뜁니다.
 */

/**
 * ETag는 XML 본문의 SHA-256을 그대로 씁니다.
 * 내용이 같으면 항상 같은 값이고, 한 글자라도 다르면 반드시 달라집니다.
 */
export function buildFeedETag(sha256: string): string {
  return `"${sha256}"`;
}

/** HTTP-date (RFC 7231 IMF-fixdate). 해석할 수 없으면 null */
export function toHttpDate(isoTimestamp: string): string | null {
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return null;

  return new Date(parsed).toUTCString();
}

/**
 * 약한 비교(weak comparison)를 위해 `W/` 접두를 떼어 냅니다.
 * RFC 7232는 If-None-Match에 약한 비교를 쓰도록 정하고 있습니다.
 */
function stripWeakPrefix(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('W/') ? trimmed.slice(2).trim() : trimmed;
}

/**
 * If-None-Match 헤더가 이 ETag와 일치하는지 확인합니다.
 *
 * `*`는 리소스가 존재하기만 하면 일치로 봅니다.
 * 우리 ETag는 hex와 따옴표뿐이라 쉼표가 들어가지 않으므로 쉼표로 안전하게 나눌 수 있습니다.
 */
export function matchesIfNoneMatch(headerValue: string, etag: string): boolean {
  const target = stripWeakPrefix(etag);

  for (const candidate of headerValue.split(',')) {
    const normalized = stripWeakPrefix(candidate);
    if (normalized === '*') return true;
    if (normalized === target) return true;
  }

  return false;
}

/**
 * If-Modified-Since 이후로 바뀌지 않았는지 확인합니다.
 *
 * HTTP-date는 초 단위라 비교 전에 생성 시각도 초로 내립니다.
 * 밀리초를 남겨 두면 같은 시각인데도 계속 200을 돌려주게 됩니다.
 */
export function isNotModifiedSince(headerValue: string, generatedAt: string): boolean {
  const since = Date.parse(headerValue);
  if (Number.isNaN(since)) return false;

  const generated = Date.parse(generatedAt);
  if (Number.isNaN(generated)) return false;

  return Math.floor(generated / 1000) * 1000 <= since;
}

export interface ConditionalRequestInput {
  ifNoneMatch: string | null;
  ifModifiedSince: string | null;
  etag: string;
  generatedAt: string;
}

/**
 * 조건부 요청을 판정합니다.
 *
 * **If-None-Match를 우선합니다.** 헤더가 있으면 If-Modified-Since는 아예 보지 않습니다.
 * ETag가 일치하면 304, 일치하지 않으면 (날짜와 무관하게) XML을 담은 200입니다.
 * ETag는 내용 해시라 날짜보다 정확하고, 둘을 섞어 판단하면
 * 내용이 바뀌었는데도 날짜 때문에 304를 돌려주는 경우가 생길 수 있습니다.
 */
export function evaluateConditionalRequest(
  input: ConditionalRequestInput
): 'not_modified' | 'send_body' {
  const ifNoneMatch = input.ifNoneMatch?.trim();

  if (ifNoneMatch) {
    return matchesIfNoneMatch(ifNoneMatch, input.etag) ? 'not_modified' : 'send_body';
  }

  const ifModifiedSince = input.ifModifiedSince?.trim();

  if (ifModifiedSince) {
    return isNotModifiedSince(ifModifiedSince, input.generatedAt) ? 'not_modified' : 'send_body';
  }

  return 'send_body';
}
