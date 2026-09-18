/**
 * 카페24 게시글 등록용 client_ip 판별 모듈 (순수 함수).
 *
 * 공식 문서 (POST /api/v2/admin/boards/{board_no}/articles)
 *  - client_ip : string<ipv4> · required · 작성자 IP
 *
 * 카페24는 IPv4만 받습니다. `::1`·IPv4-mapped IPv6·포트가 붙은 주소·루프백을 보내면
 * `Invalid IP address. (parameter.client_ip[0])`로 422를 돌려줍니다.
 * 그래서 여기서 "정상 공인 IPv4"만 통과시키고, 얻지 못하면 등록을 아예 시작하지 않습니다.
 *
 * 안전 원칙
 *  - 형식이 틀린 값을 127.0.0.1 같은 값으로 임의 대체하지 않습니다. (카페24가 거절하는 값입니다)
 *  - 클라이언트 JSON이 보낸 IP는 어떤 경우에도 쓰지 않습니다. 서버가 헤더에서만 읽습니다.
 *  - 공인 IP를 코드에 하드코딩하지 않고, 외부 IP 확인 서비스도 호출하지 않습니다.
 *  - process.env를 직접 읽지 않습니다. 환경변수 값은 서버 라우트가 인자로 넘깁니다.
 *    (이 파일이 화면 번들에 섞여도 서버 환경변수를 건드리지 않게 하려는 것입니다)
 *
 * 네트워크 호출이 없어 카페24를 부르지 않고 그대로 검증할 수 있습니다.
 */

/** 등록에 쓸 공인 IPv4를 확인하지 못했을 때의 코드 */
export const CAFE24_CLIENT_IP_ERROR_CODE = 'client_ip_unavailable';

/** 등록 전 차단이므로 재시도가 아니라 설정 확인이 필요한 상태로 알려 줍니다. */
export const CAFE24_CLIENT_IP_ERROR_STATUS = 409;

/** 화면에 보여 줄 안내. 실제 IP 값은 넣지 않습니다. */
export const CAFE24_CLIENT_IP_ERROR_MESSAGE = 'Cafe24 등록에 사용할 공인 IPv4를 확인할 수 없습니다.';

/** 개발·로컬 환경에서만 덧붙이는 안내 */
export const CAFE24_CLIENT_IP_LOCAL_GUIDE =
  '로컬 환경에서는 프록시가 없어 공인 IP 헤더가 오지 않습니다. .env.local에 CAFE24_REVIEW_CLIENT_IP=사용할 공인 IPv4를 설정한 뒤 개발 서버를 다시 시작해 주세요.';

/** x-forwarded-for에서 살펴볼 최대 항목 수 (프록시가 길게 이어 붙여도 여기서 멈춥니다) */
const MAX_FORWARDED_ENTRIES = 8;

/** 점 넷 형태 */
const DOTTED_QUAD = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/** `1.2.3.4:8080` — 포트가 붙은 IPv4 */
const IPV4_WITH_PORT = /^((?:\d{1,3}\.){3}\d{1,3}):\d{1,5}$/;

/** `[::ffff:1.2.3.4]` · `[2001:db8::1]:443` — 대괄호로 싸인 형태 */
const BRACKETED = /^\[([^\]]+)\](?::\d{1,5})?$/;

/**
 * `::ffff:1.2.3.4` · `0:0:0:0:0:ffff:1.2.3.4` — IPv4-mapped IPv6
 *
 * `0{0,4}`가 빈 문자열도 받아들이므로 `::`처럼 0을 생략한 형태까지 함께 처리합니다.
 * 뽑아낸 점 넷 부분은 아래에서 다시 엄격하게 검사합니다.
 */
const IPV4_MAPPED = /^(?:0{0,4}:)*:?ffff:(?:0{1,4}:)?((?:\d{1,3}\.){3}\d{1,3})$/i;

/**
 * 각 옥텟이 0~255인 정상 IPv4인지 엄격하게 확인합니다.
 * `01.2.3.4`처럼 앞에 0이 붙은 값은 8진수로 해석될 수 있어 거부합니다.
 */
export function isStrictIpv4(value: string): boolean {
  if (!DOTTED_QUAD.test(value)) return false;

  return value.split('.').every((octet) => {
    if (octet.length > 1 && octet.startsWith('0')) return false;

    const num = Number(octet);
    return Number.isInteger(num) && num >= 0 && num <= 255;
  });
}

/**
 * 후보 한 개를 카페24가 받는 IPv4 형태로 정규화합니다. 만들 수 없으면 null
 *
 * - 앞뒤 공백을 지웁니다.
 * - `[...]`와 zone id(`%eth0`)를 벗겨 냅니다.
 * - `::ffff:1.2.3.4`는 `1.2.3.4`로 바꿉니다.
 * - `1.2.3.4:8080`은 포트를 떼어 냅니다.
 * - 순수 IPv6·`::1`·빈 값·잘못된 옥텟은 거부합니다.
 */
export function normalizeIpv4(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  let value = raw.trim();
  if (!value) return null;

  const bracketed = BRACKETED.exec(value);
  if (bracketed) value = bracketed[1].trim();

  // IPv6 zone id (fe80::1%eth0)
  const zoneAt = value.indexOf('%');
  if (zoneAt !== -1) value = value.slice(0, zoneAt).trim();
  if (!value) return null;

  if (value.includes(':')) {
    const withPort = IPV4_WITH_PORT.exec(value);
    const mapped = withPort ? null : IPV4_MAPPED.exec(value);

    // 포트가 붙은 IPv4도, IPv4-mapped IPv6도 아니면 순수 IPv6이므로 쓰지 않습니다.
    if (!withPort && !mapped) return null;

    value = (withPort ?? mapped)![1];
  }

  return isStrictIpv4(value) ? value : null;
}

/**
 * 등록용으로 쓸 수 있는 공인 IPv4인지 확인합니다.
 *
 * 루프백·사설·link-local·CGNAT·multicast·예약·문서용 주소는 작성자 IP가 될 수 없어 제외합니다.
 * (카페24가 거절하거나, 거절하지 않아도 실제 작성자 IP가 아닙니다)
 */
export function isPublicIpv4(value: string): boolean {
  if (!isStrictIpv4(value)) return false;

  const [a, b, c] = value.split('.').map(Number);

  if (a === 0) return false; // 0.0.0.0/8 (this network)
  if (a === 10) return false; // 사설 10/8
  if (a === 127) return false; // loopback 127/8
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT 100.64/10
  if (a === 169 && b === 254) return false; // link-local 169.254/16
  if (a === 172 && b >= 16 && b <= 31) return false; // 사설 172.16/12
  if (a === 192 && b === 168) return false; // 사설 192.168/16
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // IETF 프로토콜 · TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return false; // 6to4 relay (예약)
  if (a === 198 && (b === 18 || b === 19)) return false; // 벤치마크 198.18/15
  if (a === 198 && b === 51 && c === 100) return false; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false; // TEST-NET-3
  if (a >= 224) return false; // multicast 224/4 · 예약 240/4 · 브로드캐스트

  return true;
}

/**
 * `x-forwarded-for`처럼 쉼표로 이어진 값에서 쓸 수 있는 공인 IPv4를 고릅니다.
 *
 * 프록시가 왼쪽부터 원래 요청자 순서로 이어 붙이므로 앞에서부터 살펴보고,
 * 처음 만난 정상 공인 IPv4 하나만 씁니다. 없으면 null입니다.
 */
export function pickPublicIpv4(headerValue: unknown): string | null {
  if (typeof headerValue !== 'string' || !headerValue.trim()) return null;

  for (const entry of headerValue.split(',').slice(0, MAX_FORWARDED_ENTRIES)) {
    const normalized = normalizeIpv4(entry);
    if (normalized && isPublicIpv4(normalized)) return normalized;
  }

  return null;
}

/** 서버가 헤더에서 읽어 넘기는 값. 클라이언트 JSON 값은 여기에 넣지 않습니다. */
export interface Cafe24ClientIpHeaders {
  /** x-forwarded-for (Cloud Run이 채워 줍니다) */
  forwardedFor: string | null;
  /** x-real-ip (nginx 계열 프록시) */
  realIp: string | null;
}

/** 어디서 얻은 IP인지. 값 대신 이 이름만 로그에 남깁니다. */
export type Cafe24ClientIpSource = 'x-forwarded-for' | 'x-real-ip' | 'env';

export type Cafe24ClientIpResult =
  | { ok: true; clientIp: string; source: Cafe24ClientIpSource }
  | { ok: false; code: typeof CAFE24_CLIENT_IP_ERROR_CODE };

/**
 * 등록에 쓸 공인 IPv4를 정합니다.
 *
 * 우선순위
 *  1. x-forwarded-for — 배포 환경(Cloud Run)이 채우는 헤더. 이 프로젝트의 다른 서버 경로도 같은 헤더를 씁니다.
 *  2. x-real-ip       — nginx 계열 프록시가 있을 때의 보조 헤더
 *  3. envOverride     — 로컬 시험용 CAFE24_REVIEW_CLIENT_IP. 배포 환경에는 설정하지 않습니다.
 *
 * 세 경로 모두 같은 검사를 통과해야 하므로, 헤더에 아무 값이나 넣어도 공인 IPv4가 아니면 쓰이지 않습니다.
 * 이 값은 게시글의 작성자 IP 항목으로만 쓰이고 인증·권한·호출 제한 판단에는 쓰이지 않습니다.
 */
export function resolveCafe24ClientIp(
  headers: Cafe24ClientIpHeaders,
  envOverride: string | null
): Cafe24ClientIpResult {
  const fromForwardedFor = pickPublicIpv4(headers.forwardedFor);
  if (fromForwardedFor) return { ok: true, clientIp: fromForwardedFor, source: 'x-forwarded-for' };

  const fromRealIp = pickPublicIpv4(headers.realIp);
  if (fromRealIp) return { ok: true, clientIp: fromRealIp, source: 'x-real-ip' };

  const fromEnv = pickPublicIpv4(envOverride);
  if (fromEnv) return { ok: true, clientIp: fromEnv, source: 'env' };

  return { ok: false, code: CAFE24_CLIENT_IP_ERROR_CODE };
}

/** Headers 객체에서 검사에 필요한 두 헤더만 뽑습니다. */
export function cafe24ClientIpHeadersOf(headers: {
  get(name: string): string | null;
}): Cafe24ClientIpHeaders {
  return {
    forwardedFor: headers.get('x-forwarded-for'),
    realIp: headers.get('x-real-ip'),
  };
}

/**
 * 공인 IPv4를 확인하지 못했을 때 화면에 돌려줄 응답 본문.
 * register와 register-precheck가 같은 문구를 쓰도록 여기서 만듭니다.
 */
export function cafe24ClientIpErrorBody(includeLocalGuide: boolean): {
  error: string;
  code: string;
  retryable: false;
} {
  return {
    error: includeLocalGuide
      ? `${CAFE24_CLIENT_IP_ERROR_MESSAGE} ${CAFE24_CLIENT_IP_LOCAL_GUIDE}`
      : CAFE24_CLIENT_IP_ERROR_MESSAGE,
    code: CAFE24_CLIENT_IP_ERROR_CODE,
    retryable: false,
  };
}

/** 값을 남기지 않고 어떤 경로가 비어 있었는지만 알려 주는 로그용 요약 */
export function describeCafe24ClientIpSources(
  headers: Cafe24ClientIpHeaders,
  envOverride: string | null
): string {
  const present = (value: string | null) => (value && value.trim() ? '있음' : '없음');

  return `x-forwarded-for: ${present(headers.forwardedFor)} / x-real-ip: ${present(
    headers.realIp
  )} / CAFE24_REVIEW_CLIENT_IP: ${present(envOverride)}`;
}
