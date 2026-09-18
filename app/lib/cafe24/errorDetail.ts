/**
 * 카페24 오류 응답에서 "개발 환경에서만" 볼 안전한 진단 정보를 뽑는 순수 함수 모듈.
 *
 * 지금까지 adminApi는 오류 본문에서 짧은 code만 남기고 message·필드별 오류를 버렸습니다.
 * 그래서 422처럼 사유가 본문에만 담기는 거절은 원인을 알 수 없었습니다.
 * 이 모듈은 그 본문에서 status·code·message·필드별 오류만 정리해 돌려줍니다.
 *
 * 봉투 이름이 두 가지입니다.
 * Admin API는 보통 `error`(단수)를 쓰지만 422 중에는 `errors`(복수)로 내려주는 응답이 있어 둘 다 살핍니다.
 *
 * 필드별 오류는 "명시된 것만" 읽습니다.
 * 카페24는 422 본문의 more_info에 우리가 보낸 요청 객체를 그대로 되돌려 주는 경우가 있습니다.
 * 그 반향을 오류 사유로 착각해 늘어놓으면 원인은 알려 주지 못한 채 보낸 값만 드러납니다.
 * 그래서 `{ field, message }`처럼 필드와 사유가 함께 적힌 객체만 오류로 인정하고,
 * 그 밖의 값은 읽지 않습니다. 인정할 것이 없으면 목록을 비우고 안내 문구를 대신 보여 줍니다.
 *
 * 안전 원칙
 *  - 개발 환경(NODE_ENV !== 'production')에서만 쓰도록 isCafe24DebugEnabled()로 잠급니다.
 *  - 주소·이메일·IP·긴 숫자·긴 영숫자·인용된 값처럼 값으로 보이는 부분은 형태만 남기고 지웁니다.
 *  - 우리가 보낸 값(리뷰 본문·작성자·리뷰글번호·이미지 주소 등)은 호출부가 그 목록을 넘겨
 *    redactCafe24ErrorDetail()로 정확히 지웁니다. 패턴 masking은 그 위의 2차 방어입니다.
 *  - 토큰·client secret·요청 헤더·요청 본문은 애초에 이 모듈로 들어오지 않습니다.
 *
 * 네트워크 호출이 없어 실제 카페24를 부르지 않고 가짜 응답만으로 검증할 수 있습니다.
 */

/** 개발 환경에서만 보여 줄 카페24 원본 오류 요약 */
export interface Cafe24ErrorDetail {
  /** 카페24 HTTP status */
  status: number | null;
  /** 카페24 오류 code (형식 검사를 통과한 짧은 값) */
  code: string | null;
  /** 정리된 오류 message. 읽을 값이 없으면 null */
  message: string | null;
  /**
   * 카페24가 필드와 사유를 함께 적어 준 경우에만 채워지는 `필드: 사유` 목록.
   * 요청값 반향은 여기에 들어오지 않으므로, 비어 있으면 사유를 받지 못한 것입니다.
   */
  fields: string[];
}

/** 필드별 사유를 하나도 받지 못했을 때 화면과 로그에 그대로 쓰는 문구 */
export const CAFE24_NO_FIELD_DETAIL_MESSAGE =
  'Cafe24가 구체적인 필드 오류 사유를 제공하지 않았습니다.';

const MAX_MESSAGE_LENGTH = 300;
const MAX_FIELD_ITEMS = 10;
const MAX_FIELD_DEPTH = 4;
const MAX_QUOTED_VALUE_LENGTH = 200;

/**
 * 이 길이 이상인 값만 지웁니다.
 *
 * 한글 이름은 두세 자인 경우가 많아 기준을 2자로 둡니다.
 * 한 글자 값은 지우면 문장의 모든 같은 글자가 사라져 오류를 읽을 수 없게 되고,
 * 그 자체로 사람을 알아볼 수도 없어 제외합니다.
 */
const MIN_REDACTED_VALUE_LENGTH = 2;

/** 카페24 공식 필드명 형태 (attach_file_urls · requests[0].writer 등) */
const FIELD_NAME = /^[A-Za-z0-9_.[\]-]{1,40}$/;

/** 오류 code로 인정할 짧은 값의 형태. 예기치 않게 긴 원문이 흘러가지 않게 막습니다. */
const ERROR_CODE = /^[A-Za-z0-9_.-]{1,64}$/;

/** 필드별 오류 객체에서 "어느 필드인지"를 담는 키 */
const FIELD_ERROR_NAME_KEYS = ['field', 'parameter', 'param', 'name'] as const;

/** 필드별 오류 객체에서 "왜 틀렸는지"를 담는 키. 이 둘이 없으면 오류로 보지 않습니다. */
const FIELD_ERROR_REASON_KEYS = ['message', 'reason'] as const;

/** 개발 환경인지. 운영에서는 어떤 원본 오류 상세도 만들지 않습니다. */
export function isCafe24DebugEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * 오류 문장에서 값으로 보이는 부분을 지웁니다.
 *
 * 카페24가 무엇을 돌려줄지 확정할 수 없으므로, 사람이 읽을 문장 구조만 남기고
 * 주소·이메일·IP·긴 숫자(리뷰글번호·주문번호)·긴 영숫자(토큰 형태)·인용된 값은 표시로 바꿉니다.
 */
export function sanitizeCafe24ErrorText(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;

  const collapsed = String(raw)
    // 제어문자와 줄바꿈은 로그를 흐트러뜨리므로 공백 하나로 모읍니다.
    .replace(/[\s\u0000-\u001f\u007f]+/g, ' ')
    .trim();
  if (!collapsed) return null;

  const masked = collapsed
    // 이미지 원본 주소를 포함한 모든 URL
    .replace(/[A-Za-z][A-Za-z0-9+.-]*:\/\/\S*/g, '[url]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    // 작성자 IP
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]')
    /**
     * 토큰처럼 긴 영숫자.
     * 긴 숫자 masking보다 먼저 해야 합니다. 숫자를 먼저 지우면 토큰이 조각나
     * 남은 영문 조각이 그대로 노출됩니다.
     */
    .replace(/[A-Za-z0-9_-]{20,}/g, '[value]')
    // 리뷰글번호·주문번호처럼 긴 숫자
    .replace(/\d{7,}/g, '[number]')
    // 인용 부호 안의 값. 공식 필드명 형태만 그대로 남깁니다.
    .replace(
      /(['"`])([^'"`]{1,200})\1/g,
      (_match, quote: string, inner: string) =>
        inner.length <= MAX_QUOTED_VALUE_LENGTH && FIELD_NAME.test(inner)
          ? `${quote}${inner}${quote}`
          : `${quote}[value]${quote}`
    )
    // 리뷰 본문처럼 긴 한글 덩어리
    .replace(/[가-힣][가-힣\s]{29,}/g, '[text]');

  return masked.slice(0, MAX_MESSAGE_LENGTH);
}

/**
 * 카페24 오류 봉투를 찾습니다. `error`(단수)와 `errors`(복수)를 모두 살핍니다.
 *
 * 배열은 봉투가 아니라 오류 목록이므로 여기서 제외하고, 필드별 오류를 모을 때 따로 훑습니다.
 */
function readErrorEnvelope(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;

  const record = body as Record<string, unknown>;

  for (const key of ['error', 'errors']) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

/**
 * 오류 본문에서 짧은 code만 뽑습니다.
 *
 * `error`(단수)·`errors`(복수)·최상위를 차례로 살피므로 봉투 이름이 무엇이든 놓치지 않습니다.
 * 형식 검사를 통과한 값만 돌려주고, 값처럼 보이는 긴 문자열은 버립니다.
 */
export function extractCafe24ErrorCode(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;

  const record = body as Record<string, unknown>;
  const envelope = readErrorEnvelope(body);

  for (const candidate of [
    envelope?.code,
    typeof record.error === 'string' ? record.error : null,
    record.code,
  ]) {
    const text =
      typeof candidate === 'string'
        ? candidate.trim()
        : typeof candidate === 'number'
          ? String(candidate)
          : '';

    if (text && ERROR_CODE.test(text)) return text;
  }

  return null;
}

/**
 * 필드와 사유가 함께 적힌 객체에서만 `필드: 사유` 한 줄을 만듭니다.
 *
 * 사유(message·reason)가 없으면 null을 돌려줍니다.
 * 덕분에 `{ name, url }`처럼 이름만 있는 요청값 반향은 오류로 올라오지 않습니다.
 */
function readFieldError(record: Record<string, unknown>): string | null {
  const field = FIELD_ERROR_NAME_KEYS.map((key) => record[key]).find(
    (value): value is string => typeof value === 'string' && FIELD_NAME.test(value.trim())
  );
  if (!field) return null;

  const reason = FIELD_ERROR_REASON_KEYS.map((key) => record[key]).find(
    (value) => typeof value === 'string' || typeof value === 'number'
  );

  const text = sanitizeCafe24ErrorText(reason);
  return text ? `${field.trim()}: ${text}` : null;
}

/**
 * 필드별 오류 정보를 모읍니다.
 *
 * 카페24가 more_info에 요청 객체를 그대로 되돌려 주는 경우가 있어,
 * 말단값을 `키: 값`으로 찍으면 보낸 값이 오류 사유인 것처럼 표시됩니다.
 * 그래서 readFieldError()가 인정한 `{ field, message }` 형태만 담고
 * 문자열·숫자 말단값과 일반 키-값 쌍은 어떤 경우에도 읽지 않습니다.
 *
 * 구조 안쪽에 진짜 필드 오류가 숨어 있을 수 있으므로 배열·객체는 계속 따라 들어가되,
 * 깊이와 개수는 그대로 제한합니다. (개수 제한을 늘려 반향을 더 보여 주지 않습니다)
 */
function collectFieldErrors(value: unknown, out: string[], depth: number): void {
  if (out.length >= MAX_FIELD_ITEMS || depth > MAX_FIELD_DEPTH) return;

  if (Array.isArray(value)) {
    for (const item of value.slice(0, MAX_FIELD_ITEMS)) {
      collectFieldErrors(item, out, depth + 1);
      if (out.length >= MAX_FIELD_ITEMS) return;
    }
    return;
  }

  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;

  const line = readFieldError(record);
  if (line) {
    if (!out.includes(line)) out.push(line);
    return;
  }

  for (const item of Object.values(record)) {
    collectFieldErrors(item, out, depth + 1);
    if (out.length >= MAX_FIELD_ITEMS) return;
  }
}

/**
 * 응답의 한 조각에서 `필드: 사유` 목록만 모읍니다.
 *
 * 207 다중 등록 응답의 실패 항목 하나하나에도 같은 규칙을 쓰기 위한 입구입니다.
 * 인정 규칙(field+reason이 함께 있는 항목만)·개수 제한·masking은 위와 완전히 같습니다.
 */
export function collectCafe24FieldErrors(value: unknown): string[] {
  const fields: string[] = [];
  collectFieldErrors(value, fields, 0);
  return fields;
}

/**
 * 카페24 오류 본문에서 개발용 요약을 만듭니다.
 *
 * Admin API는 `{ "error": { "code": ..., "message": ... } }` 형태를 쓰지만
 * 422 중에는 `{ "errors": { "code": ..., "message": ..., "more_info": ... } }`로 오는 응답이 있어
 * 두 봉투에서 모두 code와 message를 읽습니다.
 * 필드별 오류는 more_info·detail·details·errors 중 하나로 오는 경우가 있어 모두 살피되,
 * 필드와 사유가 함께 적힌 항목만 인정합니다.
 */
export function extractCafe24ErrorDetail(
  body: unknown,
  status: number | null,
  code: string | null
): Cafe24ErrorDetail {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const envelope = readErrorEnvelope(body);

  const message =
    sanitizeCafe24ErrorText(envelope?.message) ??
    sanitizeCafe24ErrorText(record.message) ??
    sanitizeCafe24ErrorText(typeof record.error === 'string' ? record.error : null);

  const fields: string[] = [];

  for (const source of [
    envelope?.more_info,
    envelope?.detail,
    envelope?.details,
    envelope?.errors,
    record.detail,
    record.details,
    record.errors,
  ]) {
    if (source === undefined || source === null) continue;
    collectFieldErrors(source, fields, 0);
  }

  // 호출부가 code를 찾지 못했더라도 봉투 이름이 달랐을 뿐일 수 있어 여기서 한 번 더 살핍니다.
  return { status, code: code ?? extractCafe24ErrorCode(body), message, fields };
}

/** 운영 환경에서는 상세를 통째로 버립니다. (응답·화면에 넘기기 직전의 마지막 잠금) */
export function devOnlyCafe24ErrorDetail(
  detail: Cafe24ErrorDetail | undefined
): Cafe24ErrorDetail | undefined {
  if (!isCafe24DebugEnabled()) return undefined;
  return detail;
}

/**
 * 우리가 카페24로 보낸 값이 오류 문장에 그대로 섞여 있으면 지웁니다.
 *
 * 리뷰 본문·작성자·리뷰글번호·작성자 IP·이미지 주소처럼 노출하면 안 되는 값을
 * 호출부가 목록으로 넘겨 정확히 제거하는 방식입니다. (패턴 masking에 의존하지 않습니다)
 */
export function redactCafe24ErrorDetail(
  detail: Cafe24ErrorDetail,
  sentValues: readonly unknown[]
): Cafe24ErrorDetail {
  const targets = [
    ...new Set(
      sentValues
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length >= MIN_REDACTED_VALUE_LENGTH)
    ),
  ].sort((a, b) => b.length - a.length);

  const scrub = (text: string) =>
    targets.reduce(
      (acc, target) => (acc.includes(target) ? acc.split(target).join('[redacted]') : acc),
      text
    );

  return {
    status: detail.status,
    code: detail.code,
    message: detail.message === null ? null : scrub(detail.message),
    fields: detail.fields.map(scrub),
  };
}

/**
 * 서버 터미널 한 줄로 남길 문자열. 값이 없는 항목은 '-'로 남깁니다.
 * 필드별 사유가 없을 때는 '-' 대신 안내 문구를 남겨, 사유를 못 받은 것인지 바로 알 수 있게 합니다.
 */
export function formatCafe24ErrorDetailForLog(detail: Cafe24ErrorDetail): string {
  return [
    `status: ${detail.status ?? '-'}`,
    `code: ${detail.code ?? '-'}`,
    `message: ${detail.message ?? '-'}`,
    `fields: ${detail.fields.length > 0 ? detail.fields.join(' | ') : CAFE24_NO_FIELD_DETAIL_MESSAGE}`,
  ].join(' / ');
}
