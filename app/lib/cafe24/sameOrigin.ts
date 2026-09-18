import type { NextRequest } from 'next/server';

/**
 * 동일 출처에서 온 POST인지 확인합니다. (CSRF 방어)
 * 브라우저는 cross-site POST에도 Origin 헤더를 붙이므로 값을 비교하면 됩니다.
 *
 * 연결 해제 라우트에서 쓰던 검증을 그대로 옮겨 온 것이고,
 * 리뷰 이전의 모든 POST 라우트가 같은 기준을 쓰도록 공용화했습니다.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');
  if (originHost === forwardedHost || originHost === host) return true;

  // 프록시 뒤에서 Host 헤더가 내부 주소로 바뀌는 경우를 대비해
  // 고정된 redirect URI의 호스트도 허용합니다.
  const configuredRedirectUri = process.env.CAFE24_REVIEW_REDIRECT_URI?.trim();
  if (configuredRedirectUri) {
    try {
      return originHost === new URL(configuredRedirectUri).host;
    } catch {
      return false;
    }
  }

  return false;
}
