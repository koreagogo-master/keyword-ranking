import {
  CAFE24_ARTICLES_MAX_COUNT,
  CAFE24_ARTICLES_PAGE_LIMIT,
  resolveReviewBoardNo,
} from './config';
import { callCafe24Admin, type Cafe24AdminFailure } from './adminApi';
import {
  hashNormalizedContent,
  normalizeReviewContent,
  normalizeReviewRating,
  normalizeReviewWriter,
  toKstDateString,
  toKstTimeString,
} from './reviewNormalize';
import {
  createAttachmentCollector,
  type AttachmentCaptureTarget,
  type CapturedArticleAttachments,
} from './trialRegister';

/**
 * 시험 등록 확인용 타입.
 * 이 모듈의 목록 조회 결과로 함께 나가므로 여기서도 그대로 내보냅니다.
 */
export type { AttachmentCaptureTarget, CapturedArticleAttachments };

/**
 * 기존 카페24 리뷰 게시글의 naverpay_review_id 보관 현황 집계기.
 *
 * 공식 문서 기준:
 *  - GET /api/v2/admin/boards/{board_no}/articles, limit 최대 100
 *  - offset으로 페이지를 넘기고 상한은 8,000입니다.
 *
 * 카페24 공식 게시글 API는 같은 naverpay_review_id로 다시 등록하면 422를 돌려줍니다.
 * 그래서 기존 리뷰에 이 값이 실제로 남아 있는지 먼저 확인해야
 * 다음 단계의 중복 검사 방식을 정할 수 있습니다.
 *
 * 이 모듈은 읽기만 합니다. 게시글을 만들거나 고치지 않습니다.
 * 리뷰 본문·작성자·주문번호는 집계에 쓰지 않고 밖으로 내보내지도 않으며,
 * naverpay_review_id 값 자체도 로그에 남기지 않습니다. (있다·없다만 셉니다)
 */

export interface ReviewIdentifierStats {
  /** 실제로 조회한 게시판 번호 */
  boardNo: number;
  /** 확인한 게시글 수 */
  totalArticles: number;
  /** naverpay_review_id가 저장돼 있는 게시글 수 */
  articlesWithNaverReviewId: number;
  /** naverpay_review_id가 비어 있는 게시글 수 */
  articlesWithoutNaverReviewId: number;
  /** 보관율 (%). 소수점 한 자리까지 */
  coveragePercent: number;
  /** 8,000건 상한에 걸려 일부만 확인한 경우 true */
  truncated: boolean;
}

export type FetchReviewIdentifierStatsResult =
  | ({ ok: true } & ReviewIdentifierStats)
  | Cafe24AdminFailure;

interface ArticlesPayload {
  articles?: unknown;
}

/**
 * naverpay_review_id가 "값이 있는 상태"인지 판단합니다.
 * 값 자체는 어디에도 남기지 않고 존재 여부만 돌려줍니다.
 */
function hasNaverReviewId(raw: unknown): boolean {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0;
  if (typeof raw === 'string') {
    const value = raw.trim();
    return value !== '' && value !== '0';
  }
  return false;
}

/** 중복 집계를 막기 위한 게시글 식별자. 해석할 수 없으면 null */
function toArticleNo(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    const parsed = Number.parseInt(raw.trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

/**
 * 리뷰 게시판 전체를 offset으로 훑어 naverpay_review_id 보관 현황만 집계합니다.
 * 요청은 직렬로 보내고, 간격 제어는 adminApi의 레이트리밋 게이트가 담당합니다.
 */
export async function fetchReviewIdentifierStats(): Promise<FetchReviewIdentifierStatsResult> {
  const boardNo = resolveReviewBoardNo();

  let totalArticles = 0;
  let withId = 0;
  let offset = 0;
  let truncated = false;

  // 같은 게시글이 두 페이지에 걸쳐 나오는 경우를 대비한 중복 방지용입니다.
  const seen = new Set<number>();

  for (;;) {
    const page = await callCafe24Admin<ArticlesPayload>({
      path: `/api/v2/admin/boards/${boardNo}/articles`,
      searchParams: {
        limit: String(CAFE24_ARTICLES_PAGE_LIMIT),
        offset: String(offset),
      },
    });

    if (!page.ok) return page;

    const items = Array.isArray(page.data.articles) ? page.data.articles : [];

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      const record = item as Record<string, unknown>;
      const articleNo = toArticleNo(record.article_no);
      if (articleNo !== null) {
        if (seen.has(articleNo)) continue;
        seen.add(articleNo);
      }

      totalArticles += 1;
      if (hasNaverReviewId(record.naverpay_review_id)) withId += 1;
    }

    // 마지막 페이지
    if (items.length < CAFE24_ARTICLES_PAGE_LIMIT) break;

    offset += CAFE24_ARTICLES_PAGE_LIMIT;

    if (offset >= CAFE24_ARTICLES_MAX_COUNT) {
      truncated = true;
      break;
    }
  }

  if (truncated) {
    console.error('[cafe24/reviews] 조회 상한에 도달해 일부만 집계했습니다. boardNo:', boardNo);
  }

  const coveragePercent =
    totalArticles === 0 ? 0 : Math.round((withId / totalArticles) * 1000) / 10;

  return {
    ok: true,
    boardNo,
    totalArticles,
    articlesWithNaverReviewId: withId,
    articlesWithoutNaverReviewId: totalArticles - withId,
    coveragePercent,
    truncated,
  };
}

// ──────────────────────────────────────────────────────────────
// 중복 검사용 기존 리뷰 수집
// ──────────────────────────────────────────────────────────────

/**
 * 중복 검사에 쓰는 기존 리뷰 한 건. 서버 메모리 안에서만 사용합니다.
 *
 * 리뷰 본문·작성자·주문번호·naverpay_review_id 원문은 여기까지만 들어오고
 * 응답이나 로그로는 절대 나가지 않습니다. 본문은 해시로만 보관합니다.
 */
export interface ExistingReviewRecord {
  articleNo: number;
  /** 게시글에 연결된 카페24 상품번호 */
  productNo: number;
  /** 카페24에 저장된 naverpay_review_id (없으면 빈 문자열) */
  naverReviewId: string;
  /** 정규화된 본문의 SHA-256 해시. 본문이 비어 있으면 빈 문자열 */
  contentHash: string;
  /**
   * 정규화된 본문 원문.
   *
   * 본문 유사도를 계산하려면 해시가 아니라 글자가 필요해서 여기까지만 들고 옵니다.
   * 서버 메모리 안의 비교에만 쓰고 응답·로그에는 절대 내보내지 않습니다.
   */
  contentNormalized: string;
  /** 정규화 후에도 본문이 남아 있는지 */
  hasContent: boolean;
  /** 정규화된 본문 길이 (짧고 흔한 문구를 자동 중복에서 빼기 위한 값) */
  contentLength: number;
  /** 정규화된 작성자. 없으면 빈 문자열 */
  writerKey: string;
  /** 한국시간 기준 작성일. 해석 실패 시 null */
  dateKst: string | null;
  /** 한국시간 기준 작성시각 `HH:mm`. 해석 실패 시 null */
  timeKst: string | null;
  rating: number | null;
}

export interface FetchExistingReviewsOptions {
  /**
   * 첨부까지 읽어 둘 대상.
   *
   * 지정하지 않으면 중복 검사·최종 확인과 완전히 같게 동작합니다. (첨부를 읽지 않습니다)
   * 지정해도 목록 조회 횟수는 늘어나지 않습니다. 이미 훑고 있는 페이지에서 함께 읽습니다.
   */
  captureAttachmentsFor?: readonly AttachmentCaptureTarget[];
}

export type FetchExistingReviewsResult =
  | {
      ok: true;
      boardNo: number;
      /** 게시판에서 실제로 훑은 게시글 수 (답변글·공지글 포함) */
      scannedArticleCount: number;
      /** 비교 대상으로 남긴 상품 리뷰 원글 */
      reviews: ExistingReviewRecord[];
      /** 8,000건 상한에 걸려 일부만 확인한 경우 true */
      truncated: boolean;
      /** captureAttachmentsFor로 요청한 게시글의 첨부. 요청하지 않았으면 빈 배열 */
      capturedAttachments: CapturedArticleAttachments[];
    }
  | Cafe24AdminFailure;

/** 0 이상의 정수로 해석합니다. 해석할 수 없으면 null */
function toNonNegativeInt(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 0 ? raw : null;
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    const parsed = Number.parseInt(raw.trim(), 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

/** 카페24 게시글의 T/F 플래그를 비교합니다. */
function flagEquals(raw: unknown, expected: 'T' | 'F'): boolean {
  return typeof raw === 'string' && raw.trim().toUpperCase() === expected;
}

/**
 * 상품과 연결된 실제 리뷰 원글만 남깁니다. (공식 게시글 필드 기준)
 *
 *  - product_no가 없는 글: 상품 리뷰가 아니므로 제외
 *  - notice = 'T'         : 공지글 제외
 *  - deleted = 'T'        : 삭제된 글 제외 ('B'는 승인 대기 상태라 실재하므로 포함)
 *  - reply_depth > 0      : 답변글·댓글 제외
 *  - parent_article_no가 자기 자신이 아닌 글: 답변글 제외
 *  - display = 'F'        : 숨김 상태여도 중복 방지를 위해 포함합니다.
 */
function isOriginalProductReview(record: Record<string, unknown>, articleNo: number): boolean {
  const productNo = toNonNegativeInt(record.product_no);
  if (productNo === null || productNo <= 0) return false;

  if (flagEquals(record.notice, 'T')) return false;
  if (flagEquals(record.fixed, 'T')) return false;
  if (flagEquals(record.deleted, 'T')) return false;

  const replyDepth = toNonNegativeInt(record.reply_depth);
  if (replyDepth !== null && replyDepth > 0) return false;

  const parentArticleNo = toNonNegativeInt(record.parent_article_no);
  if (parentArticleNo !== null && parentArticleNo > 0 && parentArticleNo !== articleNo) return false;

  return true;
}

/** 게시글에 저장된 naverpay_review_id. 없으면 빈 문자열 */
function readNaverReviewId(record: Record<string, unknown>): string {
  const value =
    typeof record.naverpay_review_id === 'string'
      ? record.naverpay_review_id.trim()
      : typeof record.naverpay_review_id === 'number'
        ? String(record.naverpay_review_id)
        : '';

  return value === '0' ? '' : value;
}

function toExistingReviewRecord(
  record: Record<string, unknown>,
  articleNo: number
): ExistingReviewRecord | null {
  if (!isOriginalProductReview(record, articleNo)) return null;

  const productNo = toNonNegativeInt(record.product_no);
  if (productNo === null || productNo <= 0) return null;

  const content = normalizeReviewContent(record.content);

  return {
    articleNo,
    productNo,
    naverReviewId: readNaverReviewId(record),
    contentHash: content ? hashNormalizedContent(content) : '',
    contentNormalized: content,
    hasContent: content.length > 0,
    contentLength: content.length,
    writerKey: normalizeReviewWriter(record.writer),
    dateKst: toKstDateString(record.created_date),
    timeKst: toKstTimeString(record.created_date),
    rating: normalizeReviewRating(record.rating),
  };
}

/**
 * 리뷰 게시판 전체를 offset으로 훑어 중복 비교용 정보만 남깁니다.
 *
 * 요청은 직렬로 보내고 access token 갱신·호출 간격은 adminApi가 맡습니다.
 * 본문·작성자 원문은 이 함수 안에서 해시와 정규화 문자열로 바뀌고 바로 버려집니다.
 *
 * options.captureAttachmentsFor를 넘기면 같은 목록 응답에서 그 게시글의 첨부만 함께 읽습니다.
 * 추가 요청을 보내지 않으므로 중복 검사·최종 확인의 동작과 호출 횟수는 그대로입니다.
 */
export async function fetchExistingReviewRecords(
  options?: FetchExistingReviewsOptions
): Promise<FetchExistingReviewsResult> {
  const boardNo = resolveReviewBoardNo();

  const reviews: ExistingReviewRecord[] = [];
  const seen = new Set<number>();

  const captureTargets = options?.captureAttachmentsFor ?? [];
  const attachmentCollector = createAttachmentCollector(captureTargets);

  let scannedArticleCount = 0;
  let offset = 0;
  let truncated = false;

  for (;;) {
    const page = await callCafe24Admin<ArticlesPayload>({
      path: `/api/v2/admin/boards/${boardNo}/articles`,
      searchParams: {
        limit: String(CAFE24_ARTICLES_PAGE_LIMIT),
        offset: String(offset),
      },
    });

    if (!page.ok) return page;

    const items = Array.isArray(page.data.articles) ? page.data.articles : [];

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      const record = item as Record<string, unknown>;
      const articleNo = toArticleNo(record.article_no);

      // 게시글 번호를 읽을 수 없으면 일치한 게시글을 화면에 알려 줄 수 없으므로 건너뜁니다.
      if (articleNo === null) continue;
      if (seen.has(articleNo)) continue;
      seen.add(articleNo);

      scannedArticleCount += 1;

      const parsed = toExistingReviewRecord(record, articleNo);
      if (parsed) reviews.push(parsed);

      // 시험 등록 확인 대상이면 이 페이지 응답에서 첨부만 함께 읽어 둡니다.
      if (captureTargets.length > 0) {
        attachmentCollector.inspect(record, articleNo, readNaverReviewId(record));
      }
    }

    if (items.length < CAFE24_ARTICLES_PAGE_LIMIT) break;

    offset += CAFE24_ARTICLES_PAGE_LIMIT;

    if (offset >= CAFE24_ARTICLES_MAX_COUNT) {
      truncated = true;
      break;
    }
  }

  if (truncated) {
    console.error(
      '[cafe24/reviews] 중복 검사: 조회 상한에 도달했습니다. boardNo:',
      boardNo,
      'scanned:',
      scannedArticleCount
    );
  }

  return {
    ok: true,
    boardNo,
    scannedArticleCount,
    reviews,
    truncated,
    // 1순위 naverpay_review_id → 2순위 등록 응답의 article_no 순으로 맞춘 결과
    capturedAttachments: attachmentCollector.collect(),
  };
}
