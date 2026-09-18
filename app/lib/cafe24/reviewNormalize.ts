import { createHash } from 'node:crypto';

/**
 * 리뷰 중복 검사용 정규화 유틸리티 (서버 전용).
 *
 * 네이버 엑셀 리뷰와 기존 카페24 게시글을 같은 기준으로 맞춰 비교하기 위한 모듈입니다.
 * 외부 패키지를 쓰지 않고 표준 내장 기능만 사용합니다.
 *
 * 여기서 만든 정규화 결과와 해시는 서버 메모리 안의 비교에만 쓰고
 * 로그·응답 어디에도 남기지 않습니다. 클라이언트에서 import 하지 않습니다.
 */

/** 리뷰 본문에 섞여 들어오는 일반 HTML entity */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', middot: '·', bull: '•', ndash: '–', mdash: '—',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
  laquo: '«', raquo: '»', prime: '′', Prime: '″',
  deg: '°', times: '×', divide: '÷', plusmn: '±', permil: '‰',
  frac12: '½', frac14: '¼', frac34: '¾',
  copy: '©', reg: '®', trade: '™', sect: '§', para: '¶',
  euro: '€', pound: '£', yen: '¥', cent: '¢',
  larr: '←', uarr: '↑', rarr: '→', darr: '↓', harr: '↔',
  hearts: '♥', starf: '★', star: '☆', check: '✓',
};

/**
 * 줄바꿈 의미를 가진 태그. 지우기 전에 공백 한 칸으로 바꿔서
 * `첫줄<br>둘째줄`이 `첫줄둘째줄`로 붙어 버리는 일을 막습니다.
 */
const BLOCK_LEVEL_TAG =
  /<\s*\/?\s*(?:br|p|div|li|ul|ol|dl|dt|dd|tr|td|th|table|thead|tbody|tfoot|h[1-6]|blockquote|section|article|header|footer|hr|pre|figure|figcaption)\b[^>]*>/gi;

const ANY_TAG = /<[^>]*>/g;

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * 제거해도 되는 것이 확실한 출처 표기만 담습니다.
 *
 * 카페24로 옮겨 온 네이버페이 리뷰 앞뒤에 붙는 대괄호 표기만 대상으로 하고,
 * 본문 중간의 일반 문장은 어떤 경우에도 건드리지 않습니다.
 * 확실하지 않은 문구를 여기에 추가하면 서로 다른 리뷰가 같아 보일 수 있습니다.
 */
const KNOWN_SOURCE_MARKERS = [
  '[네이버페이]',
  '[네이버 페이]',
  '[네이버페이 구매평]',
  '[네이버쇼핑]',
  '[네이버 쇼핑]',
  '[스마트스토어]',
  '[네이버 스마트스토어]',
  '[naverpay]',
  '[naver pay]',
] as const;

/**
 * 카페24가 스마트스토어 리뷰를 옮겨 올 때 본문 **맨 끝**에 붙이는 출처표기입니다.
 *
 *   `(2026-07-01 08:47 스마트스토어에서 등록된 구매평)`
 *   `(2026-07-01 08:47:18 스마트스토어에서 등록된 구매평)`
 *
 * 특정 날짜를 넣지 않고 형식으로만 찾고, `$`로 끝에 있을 때만 지웁니다.
 * 본문 중간의 일반 괄호 문장은 이 정규식에 걸리지 않습니다.
 */
const TRAILING_SMARTSTORE_STAMP =
  /\s*\(\s*\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}\.?\s+\d{1,2}:\d{2}(?::\d{2})?\s*스마트스토어에서\s*등록된\s*구매평\s*\)$/;

/** `&hellip;`, `&#8230;`, `&#x2026;` 형태를 사람이 읽는 글자로 되돌립니다. */
function decodeHtmlEntities(text: string): string {
  if (!text.includes('&')) return text;

  return text.replace(/&(#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]{1,31});/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = Number.parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);

      const isUnsafe =
        !Number.isFinite(code) ||
        code < 32 ||
        (code >= 127 && code <= 159) ||
        (code >= 0xd800 && code <= 0xdfff) ||
        code > 0x10ffff;

      return isUnsafe ? match : String.fromCodePoint(code);
    }

    return NAMED_ENTITIES[entity] ?? NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** 줄바꿈·탭·연속 공백을 한 칸으로 통일하고 앞뒤 공백을 지웁니다. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** 앞이나 뒤에 통째로 붙어 있는 알려진 출처 표기만 떼어 냅니다. */
function stripKnownSourceMarkers(text: string): string {
  let result = text;

  for (let changed = true; changed; ) {
    changed = false;

    for (const marker of KNOWN_SOURCE_MARKERS) {
      const lowered = result.toLowerCase();

      if (lowered.startsWith(marker)) {
        result = result.slice(marker.length).trim();
        changed = true;
      }
      if (lowered.endsWith(marker)) {
        result = result.slice(0, result.length - marker.length).trim();
        changed = true;
      }
    }

    // 끝에 붙은 스마트스토어 출처표기도 같은 방식으로 한 번에 하나씩 떼어 냅니다.
    const withoutStamp = result.replace(TRAILING_SMARTSTORE_STAMP, '');
    if (withoutStamp !== result) {
      result = withoutStamp.trim();
      changed = true;
    }
  }

  return result;
}

/**
 * 리뷰 본문 정규화.
 *
 * 태그 제거 → entity 해제 → NFKC → 공백 통일 → 알려진 출처 표기 제거 순서입니다.
 * entity를 태그보다 먼저 풀면 `&lt;b&gt;`처럼 글자로 적힌 값이 태그로 오해받으므로
 * 반드시 태그를 먼저 처리합니다.
 */
export function normalizeReviewContent(raw: unknown): string {
  const source = typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : '';
  if (!source) return '';

  const withoutTags = source.replace(BLOCK_LEVEL_TAG, ' ').replace(ANY_TAG, '');
  const decoded = decodeHtmlEntities(withoutTags).replace(CONTROL_CHARS, '');
  const collapsed = collapseWhitespace(decoded.normalize('NFKC'));

  return collapseWhitespace(stripKnownSourceMarkers(collapsed));
}

/**
 * 작성자 정규화.
 *
 * 별표 마스킹(`김*수`)은 원래 이름을 알 수 없으므로 보이는 문자열 그대로 비교합니다.
 * 이름을 복원하거나 추측하지 않습니다.
 */
export function normalizeReviewWriter(raw: unknown): string {
  const source = typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : '';
  if (!source) return '';

  return collapseWhitespace(source.replace(CONTROL_CHARS, '').normalize('NFKC')).toLowerCase();
}

/** 평점을 1~5 정수로 해석합니다. 해석할 수 없거나 범위를 벗어나면 null */
export function normalizeReviewRating(raw: unknown): number | null {
  let value: number;

  if (typeof raw === 'number') {
    value = raw;
  } else if (typeof raw === 'string') {
    const digits = raw.replace(/[^\d.]/g, '');
    if (!digits) return null;
    value = Number(digits);
  } else {
    return null;
  }

  if (!Number.isFinite(value)) return null;

  const rounded = Math.round(value);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** `2019-04-30T16:44:21+09:00`처럼 시간대가 명시된 값 */
const ZONED_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})$/i;

/** `2024.01.15`, `2024-01-15 13:24:05`, `2024. 1. 15.`처럼 시간대가 없는 값 */
const PLAIN_DATE = /^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*\.?(?:[T\s].*)?$/;

/**
 * `2026.07.01. 08:47:18`처럼 시간대가 없고 시:분이 있는 값.
 * 네이버 엑셀 `리뷰등록일`이 이 형식이며, 적혀 있는 시간을 한국시간으로 봅니다.
 */
const PLAIN_DATETIME =
  /^\d{4}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}\s*\.?[T\s]+(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?\s*$/;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 달력에 실제로 있는 날짜인지 확인합니다. (2월 30일 같은 값 거르기) */
function formatIfRealDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * 작성일을 한국시간 기준 `YYYY-MM-DD`로 바꿉니다.
 *
 * - 시간대가 명시된 값(카페24 `created_date`)은 한국시간으로 옮긴 뒤 날짜를 뽑습니다.
 * - 시간대가 없는 값(네이버 엑셀 `리뷰등록일`)은 적혀 있는 날짜를 그대로 씁니다.
 *   서버 로컬시간으로 해석하면 배포 환경에 따라 하루가 밀릴 수 있어 추측하지 않습니다.
 * - 해석할 수 없으면 null입니다.
 */
export function toKstDateString(raw: unknown): string | null {
  const source = typeof raw === 'string' ? raw.trim() : '';
  if (!source) return null;

  const zoned = ZONED_DATETIME.exec(source);
  if (zoned) {
    const parsed = Date.parse(source.replace(' ', 'T'));
    if (Number.isNaN(parsed)) return null;

    const shifted = new Date(parsed + KST_OFFSET_MS);
    return formatIfRealDate(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth() + 1,
      shifted.getUTCDate()
    );
  }

  const plain = PLAIN_DATE.exec(source);
  if (plain) {
    return formatIfRealDate(Number(plain[1]), Number(plain[2]), Number(plain[3]));
  }

  return null;
}

/**
 * 작성시각을 한국시간 기준 `HH:mm`으로 바꿉니다. (초는 비교하지 않습니다)
 *
 * - 시간대가 명시된 값(카페24 `created_date`)은 한국시간으로 옮긴 뒤 시·분을 뽑습니다.
 * - 시간대가 없는 값(네이버 엑셀 `리뷰등록일`)은 적혀 있는 시각을 한국시간으로 봅니다.
 * - 서버 로컬 시간대는 어느 경로에서도 사용하지 않습니다.
 * - 시각이 없거나 해석할 수 없으면 null입니다.
 */
export function toKstTimeString(raw: unknown): string | null {
  const source = typeof raw === 'string' ? raw.trim() : '';
  if (!source) return null;

  const zoned = ZONED_DATETIME.exec(source);
  if (zoned) {
    const parsed = Date.parse(source.replace(' ', 'T'));
    if (Number.isNaN(parsed)) return null;

    const shifted = new Date(parsed + KST_OFFSET_MS);
    return `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`;
  }

  const plain = PLAIN_DATETIME.exec(source);
  if (plain) {
    const hour = Number(plain[1]);
    const minute = Number(plain[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

    return `${pad2(hour)}:${pad2(minute)}`;
  }

  return null;
}

/**
 * 정규화된 본문의 비교용 해시.
 * 500건 × 8,000건 전체 비교 대신 Map 인덱스를 만들기 위한 내부 키이며
 * 응답·로그에 내보내지 않습니다.
 */
export function hashNormalizedContent(normalized: string): string {
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

// ──────────────────────────────────────────────────────────────
// 본문 유사도
// ──────────────────────────────────────────────────────────────

/** 이 값 이상이면 본문 조건을 통과합니다. (0~1) */
export const CONTENT_SIMILARITY_THRESHOLD = 0.3;

/** 문자 2-gram을 개수와 함께 셉니다. (같은 조각이 여러 번 나오는 경우까지 반영) */
function countBigrams(text: string): Map<string, number> {
  const counts = new Map<string, number>();

  for (let i = 0; i < text.length - 1; i += 1) {
    const gram = text.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }

  return counts;
}

/**
 * 문자 2-gram Dice 계수. 외부 패키지·AI를 쓰지 않는 결정적 계산입니다.
 *
 * 한글은 단어 경계가 일정하지 않아 단어 단위보다 글자 2-gram이 안정적입니다.
 * 같은 입력이면 항상 같은 값이 나오고, 결과는 0~1입니다.
 */
function diceCoefficient(left: string, right: string): number {
  if (left.length < 2 || right.length < 2) return 0;

  const leftGrams = countBigrams(left);
  const rightGrams = countBigrams(right);

  let leftTotal = 0;
  for (const count of leftGrams.values()) leftTotal += count;

  let rightTotal = 0;
  for (const count of rightGrams.values()) rightTotal += count;

  if (leftTotal === 0 || rightTotal === 0) return 0;

  let shared = 0;
  for (const [gram, count] of leftGrams) {
    const other = rightGrams.get(gram);
    if (other) shared += Math.min(count, other);
  }

  return (2 * shared) / (leftTotal + rightTotal);
}

/**
 * 정규화된 두 본문을 비교합니다.
 *
 * - 한쪽이라도 비어 있으면 통과하지 않습니다. (빈 본문은 자동 후보가 되지 않습니다)
 * - 완전히 같거나 한쪽 전체가 다른 쪽에 들어 있으면 통과합니다.
 * - 그 밖에는 Dice 계수가 임계값 이상일 때 통과합니다.
 *
 * similarity는 화면에 실제 계산값을 보여 주기 위해 소수점 넷째 자리까지 남깁니다.
 */
export function compareReviewContent(
  left: string,
  right: string
): { similarity: number; passed: boolean; contained: boolean } {
  if (!left || !right) return { similarity: 0, passed: false, contained: false };

  if (left === right) return { similarity: 1, passed: true, contained: true };

  const contained = left.includes(right) || right.includes(left);
  const similarity = Math.round(diceCoefficient(left, right) * 10_000) / 10_000;

  return {
    similarity,
    passed: contained || similarity >= CONTENT_SIMILARITY_THRESHOLD,
    contained,
  };
}
