/**
 * Google Product Review Feeds 2.4 XML 생성기 (순수 함수 모듈).
 *
 * 공식 스키마: http://www.google.com/shopping/reviews/schema/product/2.4/product_reviews.xsd
 * 요소 순서는 XSD의 sequence를 그대로 따릅니다.
 *
 *   review_id → reviewer → is_verified_purchase → review_timestamp → content
 *   → review_url → ratings → products → collection_method
 *
 * 네트워크 호출이 없습니다. 값 변환과 XML 조립만 하므로 카페24를 부르지 않고 그대로 검증할 수 있습니다.
 *
 * 기존 업로드 기능(reviewPayload.ts·reviewNormalize.ts)과 같은 형식을 다루지만
 * 그 파일들을 건드리지 않기 위해 변환 규칙을 여기에 따로 갖고 있습니다.
 */

import {
  FEED_PUBLISHER_NAME,
  buildProductPageUrl,
  buildReviewId,
  buildReviewPageUrl,
  buildSku,
  resolveProductIdentity,
  type FeedIdentity,
} from './productMap';

/** 카페24 게시판에서 읽어 온 리뷰 한 건 (원문 그대로) */
export interface FeedReviewInput {
  /** 카페24 게시글번호 */
  articleNo: number;
  /** 게시글에 연결된 카페24 상품번호 */
  productNo: number;
  /** 카페24 작성자명 원문 (마스킹된 값일 수 있습니다) */
  writerRaw: string;
  /** 카페24 본문 원문 (HTML) */
  contentRaw: string;
  /** 카페24 작성일 원문 */
  createdDateRaw: string;
  /** 1~5 정수로 확인된 평점. 확인할 수 없으면 null */
  rating: number | null;
  /** 카페24에 저장된 naverpay_review_id. 없으면 빈 문자열 */
  naverReviewId: string;
  /** 본문 끝에 스마트스토어 출처 문구가 있는지 */
  hasSmartstoreSource: boolean;
}

/** 리뷰를 XML에서 뺀 사유 */
export type FeedExclusionReason =
  | 'invalid_article_no'
  | 'invalid_product_no'
  | 'invalid_rating'
  | 'invalid_timestamp'
  | 'empty_content'
  | 'duplicate_review_id';

/** 화면·로그에 그대로 보여 줄 수 있는 사유 설명 (리뷰 내용이 들어가지 않습니다) */
export const FEED_EXCLUSION_LABELS: Readonly<Record<FeedExclusionReason, string>> = {
  invalid_article_no: '게시글번호를 읽을 수 없음',
  invalid_product_no: '상품번호가 없음',
  invalid_rating: '평점이 없거나 1~5 정수가 아님',
  invalid_timestamp: '작성일을 해석할 수 없음',
  empty_content: '고객이 작성한 본문이 없음',
  duplicate_review_id: 'review_id가 중복됨',
};

export interface FeedExclusionCount {
  reason: FeedExclusionReason;
  label: string;
  count: number;
}

export interface BuildFeedResult {
  xml: string;
  /** XML에 담긴 리뷰 수 */
  includedCount: number;
  /** XML에서 뺀 리뷰 수 */
  excludedCount: number;
  /** 사유별 제외 건수 (0건인 사유는 담지 않습니다) */
  exclusions: FeedExclusionCount[];
  /** 구매 확인(is_verified_purchase=true)으로 표시한 리뷰 수 */
  verifiedPurchaseCount: number;
}

export interface BuildFeedOptions {
  identity: FeedIdentity;
  /** true면 XML 선언 다음에 집계 요약을 주석으로 넣습니다. (관리자 미리보기용) */
  summaryComment?: boolean;
}

// ──────────────────────────────────────────────────────────────
// 본문 정리
// ──────────────────────────────────────────────────────────────

/** 줄바꿈으로 바꿀 태그. 요구사항대로 `<br>` 계열만 대상으로 합니다. */
const BR_TAG = /<\s*br\s*\/?\s*>/gi;

/** 남은 모든 태그 */
const ANY_TAG = /<[^>]*>/g;

/** 줄바꿈(\n)을 제외한 제어문자. XML 1.0에서 쓸 수 없는 값이라 지웁니다. */
const CONTROL_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;

/** 본문에 섞여 들어오는 일반 HTML entity */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  middot: '·',
  bull: '•',
  ndash: '–',
  mdash: '—',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201C',
  rdquo: '\u201D',
  deg: '°',
  times: '×',
  copy: '©',
  reg: '®',
  trade: '™',
};

/**
 * 카페24가 스마트스토어 리뷰를 옮겨 올 때, 그리고 우리 업로드 기능이
 * 본문 맨 끝에 붙이는 출처 문구입니다.
 *
 *   `(2026-07-01 08:47 스마트스토어에서 등록된 구매평)`
 *
 * 고객이 쓴 문장이 아니므로 피드에서는 뺍니다.
 * 특정 날짜를 넣지 않고 형식으로만 찾습니다.
 */
const SMARTSTORE_STAMP_BODY =
  /\(\s*\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}\.?\s+\d{1,2}:\d{2}(?::\d{2})?\s*스마트스토어에서\s*등록된\s*구매평\s*\)/;

/** 본문 맨 끝에 붙어 있을 때만 떼어 내기 위한 형태 */
const TRAILING_SMARTSTORE_STAMP = new RegExp(`\\s*${SMARTSTORE_STAMP_BODY.source}\\s*$`);

/**
 * 본문에 스마트스토어 출처 문구가 있는지 확인합니다.
 * 구매 확인 여부를 판단할 때 쓰며, 본문 값 자체는 돌려주지 않습니다.
 */
export function hasSmartstoreSourceStamp(rawContent: unknown): boolean {
  const source = typeof rawContent === 'string' ? rawContent : '';
  return source !== '' && SMARTSTORE_STAMP_BODY.test(source);
}

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

/**
 * 카페24 본문(HTML)을 고객이 쓴 글만 남긴 평문으로 바꿉니다.
 *
 * `<br>` 계열은 줄바꿈으로 바꾸고 나머지 태그는 지웁니다.
 * 우리 업로드 기능이 본문을 전부 escape 한 뒤 저장하므로 entity를 되돌려야 원문이 나옵니다.
 * 마지막으로 시스템 출처 문구를 떼어 냅니다.
 */
export function toPlainReviewText(rawContent: unknown): string {
  const source = typeof rawContent === 'string' ? rawContent : '';
  if (!source) return '';

  const withNewlines = source.replace(/\r\n?/g, '\n').replace(BR_TAG, '\n');
  const withoutTags = withNewlines.replace(ANY_TAG, '');
  const decoded = decodeHtmlEntities(withoutTags).replace(CONTROL_CHARS, '');

  const lines = decoded
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim());

  // 빈 줄이 세 줄 이상 이어지면 두 줄로 줄입니다.
  const collapsed = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return collapsed.replace(TRAILING_SMARTSTORE_STAMP, '').trim();
}

// ──────────────────────────────────────────────────────────────
// 작성자
// ──────────────────────────────────────────────────────────────

/** 이름이 가려진 작성자에 카페24가 쓰는 문자 */
const MASK_CHARS = /[*＊]/;

export interface FeedReviewerName {
  name: string;
  isAnonymous: boolean;
}

/**
 * 카페24 작성자명을 피드용 이름으로 바꿉니다.
 *
 * - 마스킹된 이름은 보이는 그대로 쓰고 익명으로 표시합니다. (원래 이름을 추측하지 않습니다)
 * - 비어 있으면 `Anonymous`로 쓰고 익명으로 표시합니다.
 */
export function toFeedReviewerName(rawWriter: unknown): FeedReviewerName {
  const source = typeof rawWriter === 'string' ? rawWriter : '';
  const cleaned = source.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();

  if (!cleaned) return { name: 'Anonymous', isAnonymous: true };

  return { name: cleaned, isAnonymous: MASK_CHARS.test(cleaned) };
}

// ──────────────────────────────────────────────────────────────
// 작성일시
// ──────────────────────────────────────────────────────────────

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** `2019-04-30T16:44:21+09:00`처럼 시간대가 명시된 값 */
const ZONED_DATETIME =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?\s*(?:Z|[+-]\d{2}:?\d{2})$/i;

/** `2026-07-01 08:47:18`처럼 시간대가 없는 값 */
const PLAIN_DATETIME =
  /^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*\.?(?:[T\s]+(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?)?\s*$/;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 달력에 실제로 있는 날짜인지 확인합니다. */
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * 작성일을 `YYYY-MM-DDTHH:mm:ss+09:00`으로 바꿉니다. 해석할 수 없으면 null
 *
 * - 시간대가 명시된 값은 한국시간으로 옮깁니다.
 * - 시간대가 없는 값은 적혀 있는 시각을 한국시간으로 봅니다.
 * - 서버 로컬 시간대는 어느 경로에서도 쓰지 않습니다.
 */
export function toKstTimestamp(raw: unknown): string | null {
  const source = typeof raw === 'string' ? raw.trim() : '';
  if (!source) return null;

  if (ZONED_DATETIME.test(source)) {
    const parsed = Date.parse(source.replace(' ', 'T'));
    if (Number.isNaN(parsed)) return null;

    const shifted = new Date(parsed + KST_OFFSET_MS);
    const date = `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
    const time = `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}`;

    return `${date}T${time}+09:00`;
  }

  const plain = PLAIN_DATETIME.exec(source);
  if (!plain) return null;

  const year = Number(plain[1]);
  const month = Number(plain[2]);
  const day = Number(plain[3]);
  if (!isRealDate(year, month, day)) return null;

  // 시각이 없으면 그 날의 0시로 봅니다. 현재 시각으로 채우지 않습니다.
  const hour = plain[4] === undefined ? 0 : Number(plain[4]);
  const minute = plain[5] === undefined ? 0 : Number(plain[5]);
  const second = plain[6] === undefined ? 0 : Number(plain[6]);

  if (hour > 23 || minute > 59 || second > 59) return null;

  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}+09:00`;
}

// ──────────────────────────────────────────────────────────────
// XML 조립
// ──────────────────────────────────────────────────────────────

/** XML 특수문자 다섯 개를 모두 엔티티로 바꿉니다. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function indent(depth: number): string {
  return '  '.repeat(depth);
}

function element(depth: number, name: string, value: string, attributes = ''): string {
  return `${indent(depth)}<${name}${attributes}>${escapeXml(value)}</${name}>`;
}

/** 평점은 1~5 정수만 씁니다. */
function isUsableRating(rating: number | null): rating is number {
  return rating !== null && Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

function buildProductBlock(identity: FeedIdentity, productNo: number): string[] {
  const { brand, mpn } = resolveProductIdentity(productNo);
  const lines: string[] = [];

  lines.push(`${indent(4)}<product>`);
  lines.push(`${indent(5)}<product_ids>`);

  // XSD 순서: gtins → mpns → skus → brands → asins
  if (mpn) {
    lines.push(`${indent(6)}<mpns>`);
    lines.push(element(7, 'mpn', mpn));
    lines.push(`${indent(6)}</mpns>`);
  }

  lines.push(`${indent(6)}<skus>`);
  lines.push(element(7, 'sku', buildSku(identity, productNo)));
  lines.push(`${indent(6)}</skus>`);

  if (brand) {
    lines.push(`${indent(6)}<brands>`);
    lines.push(element(7, 'brand', brand));
    lines.push(`${indent(6)}</brands>`);
  }

  lines.push(`${indent(5)}</product_ids>`);
  lines.push(element(5, 'product_url', buildProductPageUrl(productNo)));
  lines.push(`${indent(4)}</product>`);

  return lines;
}

interface PreparedReview {
  reviewId: string;
  articleNo: number;
  productNo: number;
  reviewer: FeedReviewerName;
  timestamp: string;
  content: string;
  rating: number;
  isVerifiedPurchase: boolean;
}

function buildReviewBlock(review: PreparedReview, identity: FeedIdentity): string[] {
  const lines: string[] = [];

  lines.push(`${indent(2)}<review>`);
  lines.push(element(3, 'review_id', review.reviewId));

  lines.push(`${indent(3)}<reviewer>`);
  lines.push(
    element(4, 'name', review.reviewer.name, review.reviewer.isAnonymous ? ' is_anonymous="true"' : '')
  );
  lines.push(`${indent(3)}</reviewer>`);

  /**
   * 구매 확인은 근거가 있는 리뷰에만 넣습니다.
   * 근거는 카페24에 남아 있는 naverpay_review_id 또는 본문의 스마트스토어 출처 문구입니다.
   */
  if (review.isVerifiedPurchase) {
    lines.push(element(3, 'is_verified_purchase', 'true'));
  }

  lines.push(element(3, 'review_timestamp', review.timestamp));
  lines.push(element(3, 'content', review.content));
  lines.push(
    element(3, 'review_url', buildReviewPageUrl(identity.boardNo, review.articleNo), ' type="singleton"')
  );

  lines.push(`${indent(3)}<ratings>`);
  lines.push(element(4, 'overall', String(review.rating), ' min="1" max="5"'));
  lines.push(`${indent(3)}</ratings>`);

  lines.push(`${indent(3)}<products>`);
  lines.push(...buildProductBlock(identity, review.productNo));
  lines.push(`${indent(3)}</products>`);

  if (review.isVerifiedPurchase) {
    lines.push(element(3, 'collection_method', 'post_fulfillment'));
  }

  lines.push(`${indent(2)}</review>`);

  return lines;
}

/** 주석 안에서는 `--`를 쓸 수 없습니다. */
function toXmlComment(text: string): string {
  return `<!-- ${text.replace(/-{2,}/g, '-').replace(/>/g, '')} -->`;
}

/**
 * 수집한 리뷰를 Google 상품평 피드 XML로 바꿉니다.
 *
 * 필수값이 없는 리뷰는 XML에 넣지 않고 사유별로 세어 돌려줍니다.
 * 이번 단계에서는 제목·리뷰 이미지를 넣지 않습니다.
 */
export function buildGoogleReviewFeed(
  reviews: readonly FeedReviewInput[],
  options: BuildFeedOptions
): BuildFeedResult {
  const { identity } = options;

  const prepared: PreparedReview[] = [];
  const excluded = new Map<FeedExclusionReason, number>();
  const seenReviewIds = new Set<string>();

  const exclude = (reason: FeedExclusionReason) => {
    excluded.set(reason, (excluded.get(reason) ?? 0) + 1);
  };

  for (const review of reviews) {
    if (!Number.isInteger(review.articleNo) || review.articleNo <= 0) {
      exclude('invalid_article_no');
      continue;
    }

    if (!Number.isInteger(review.productNo) || review.productNo <= 0) {
      exclude('invalid_product_no');
      continue;
    }

    if (!isUsableRating(review.rating)) {
      exclude('invalid_rating');
      continue;
    }

    const timestamp = toKstTimestamp(review.createdDateRaw);
    if (!timestamp) {
      exclude('invalid_timestamp');
      continue;
    }

    const content = toPlainReviewText(review.contentRaw);
    if (!content) {
      exclude('empty_content');
      continue;
    }

    const reviewId = buildReviewId(identity.boardNo, review.articleNo);
    if (seenReviewIds.has(reviewId)) {
      exclude('duplicate_review_id');
      continue;
    }
    seenReviewIds.add(reviewId);

    prepared.push({
      reviewId,
      articleNo: review.articleNo,
      productNo: review.productNo,
      reviewer: toFeedReviewerName(review.writerRaw),
      timestamp,
      content,
      rating: review.rating,
      isVerifiedPurchase: review.naverReviewId.trim() !== '' || review.hasSmartstoreSource,
    });
  }

  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  const exclusions: FeedExclusionCount[] = [...excluded.entries()].map(([reason, count]) => ({
    reason,
    label: FEED_EXCLUSION_LABELS[reason],
    count,
  }));

  const excludedCount = exclusions.reduce((sum, item) => sum + item.count, 0);
  const verifiedPurchaseCount = prepared.filter((review) => review.isVerifiedPurchase).length;

  if (options.summaryComment) {
    const summary =
      exclusions.length === 0
        ? '제외 0건'
        : exclusions.map((item) => `${item.label} ${item.count}건`).join(' / ');

    lines.push(
      toXmlComment(
        `게시판 ${identity.boardNo} · 포함 ${prepared.length}건 · 제외 ${excludedCount}건 · 구매확인 ${verifiedPurchaseCount}건`
      )
    );
    lines.push(toXmlComment(`제외 사유: ${summary}`));
  }

  lines.push(
    '<feed xmlns:vc="http://www.w3.org/2007/XMLSchema-versioning"',
    '      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '      xsi:noNamespaceSchemaLocation="http://www.google.com/shopping/reviews/schema/product/2.4/product_reviews.xsd">'
  );

  lines.push(element(1, 'version', '2.4'));
  lines.push(`${indent(1)}<publisher>`);
  lines.push(element(2, 'name', FEED_PUBLISHER_NAME));
  lines.push(`${indent(1)}</publisher>`);

  lines.push(`${indent(1)}<reviews>`);
  for (const review of prepared) {
    lines.push(...buildReviewBlock(review, identity));
  }
  lines.push(`${indent(1)}</reviews>`);

  lines.push('</feed>');

  return {
    xml: `${lines.join('\n')}\n`,
    includedCount: prepared.length,
    excludedCount,
    exclusions,
    verifiedPurchaseCount,
  };
}
