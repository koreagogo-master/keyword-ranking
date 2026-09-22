import {
  CAFE24_ARTICLES_MAX_COUNT,
  CAFE24_ARTICLES_PAGE_LIMIT,
  resolveReviewBoardNo,
} from './config';
import { callCafe24Admin, type Cafe24AdminFailure } from './adminApi';
import { hasSmartstoreSourceStamp, type FeedReviewInput } from '../google-reviews/buildFeed';

/**
 * Google 상품평 피드용 카페24 게시판 수집기 (읽기 전용).
 *
 * 중복 검사에 쓰는 reviews.ts와 목적이 다릅니다.
 * 그쪽은 본문·작성자를 해시·정규화해 버려서 원문이 남지 않는데,
 * 피드에는 고객이 쓴 문장과 이름이 그대로 필요합니다.
 * 중복 검사·최종 확인·등록 결과 확인 세 경로가 공유하는 파일을 이 기능 때문에 바꾸지 않으려고
 * 공통 호출기(callCafe24Admin)만 재사용해 여기에 따로 만들었습니다.
 *
 * 공식 문서 기준:
 *  - GET /api/v2/admin/boards/{board_no}/articles, limit 최대 100
 *  - offset으로 페이지를 넘기고 상한은 8,000입니다.
 *
 * 이 모듈은 게시글을 만들거나 고치지 않습니다.
 * 리뷰 본문·작성자·naverpay_review_id는 호출부로만 돌려주고 로그에는 건수만 남깁니다.
 */

export type FetchReviewExportResult =
  | {
      ok: true;
      boardNo: number;
      /** 게시판에서 실제로 훑은 게시글 수 (공지·답변글 포함) */
      scannedArticleCount: number;
      /** 피드 후보로 남긴 상품 리뷰 원글 */
      reviews: FeedReviewInput[];
    }
  /**
   * 8,000건 상한에 걸려 게시판을 끝까지 읽지 못한 경우.
   *
   * 일부만 담긴 피드를 내보내면 Google이 사라진 리뷰를 삭제된 것으로 처리하므로
   * 여기서 실패로 끊고 XML을 만들지 않습니다.
   */
  | { ok: false; kind: 'incomplete_scan'; boardNo: number; scannedArticleCount: number }
  | Cafe24AdminFailure;

interface ArticlesPayload {
  articles?: unknown;
}

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

/** 게시글 식별자. 해석할 수 없으면 null */
function toArticleNo(raw: unknown): number | null {
  const parsed = toNonNegativeInt(raw);
  return parsed !== null && parsed > 0 ? parsed : null;
}

/** 카페24 게시글의 T/F 플래그를 비교합니다. */
function flagEquals(raw: unknown, expected: 'T' | 'F'): boolean {
  return typeof raw === 'string' && raw.trim().toUpperCase() === expected;
}

/**
 * 상품과 연결된 실제 리뷰 원글만 남깁니다.
 *
 *  - product_no가 없는 글: 상품 리뷰가 아니므로 제외
 *  - notice = 'T' · fixed = 'T' : 공지글 제외
 *  - deleted = 'T'              : 삭제된 글 제외
 *  - reply_depth > 0            : 답변글·댓글 제외
 *  - parent_article_no가 자기 자신이 아닌 글: 답변글 제외
 *  - display = 'F'              : 숨김 상태인 글은 고객에게 보이지 않으므로 제외
 *
 * display만 중복 검사(reviews.ts)와 다릅니다.
 * 그쪽은 중복 등록을 막으려고 숨김 글까지 포함하지만,
 * 피드는 고객이 실제로 볼 수 있는 리뷰만 담아야 합니다.
 */
function isPublicProductReview(record: Record<string, unknown>, articleNo: number): boolean {
  const productNo = toNonNegativeInt(record.product_no);
  if (productNo === null || productNo <= 0) return false;

  if (flagEquals(record.notice, 'T')) return false;
  if (flagEquals(record.fixed, 'T')) return false;
  if (flagEquals(record.deleted, 'T')) return false;
  if (flagEquals(record.display, 'F')) return false;

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

/**
 * 평점을 1~5 정수로 읽습니다. 소수·범위 밖·해석 불가는 모두 null입니다.
 * (null인 리뷰는 피드 생성 단계에서 사유와 함께 제외됩니다)
 */
function readRating(raw: unknown): number | null {
  let value: number;

  if (typeof raw === 'number') {
    value = raw;
  } else if (typeof raw === 'string' && /^\s*\d+\s*$/.test(raw)) {
    value = Number.parseInt(raw.trim(), 10);
  } else {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 5) return null;

  return value;
}

function toText(raw: unknown): string {
  return typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : '';
}

function toFeedReviewInput(
  record: Record<string, unknown>,
  articleNo: number
): FeedReviewInput | null {
  if (!isPublicProductReview(record, articleNo)) return null;

  const productNo = toNonNegativeInt(record.product_no);
  if (productNo === null || productNo <= 0) return null;

  const contentRaw = toText(record.content);

  return {
    articleNo,
    productNo,
    writerRaw: toText(record.writer),
    contentRaw,
    createdDateRaw: toText(record.created_date),
    rating: readRating(record.rating),
    naverReviewId: readNaverReviewId(record),
    hasSmartstoreSource: hasSmartstoreSourceStamp(contentRaw),
  };
}

/**
 * 리뷰 게시판 전체를 offset으로 훑어 피드에 필요한 값을 원문 그대로 모읍니다.
 *
 * 요청은 직렬로 보내고 access token 갱신·호출 간격은 adminApi가 맡습니다.
 * 게시판을 끝까지 읽지 못하면 부분 결과를 돌려주지 않고 incomplete_scan으로 끊습니다.
 */
export async function fetchReviewExportRecords(): Promise<FetchReviewExportResult> {
  const boardNo = resolveReviewBoardNo();

  const reviews: FeedReviewInput[] = [];
  const seen = new Set<number>();

  let scannedArticleCount = 0;
  let offset = 0;

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

      // 게시글번호가 없으면 review_id도 리뷰 주소도 만들 수 없으므로 건너뜁니다.
      if (articleNo === null) continue;
      if (seen.has(articleNo)) continue;
      seen.add(articleNo);

      scannedArticleCount += 1;

      const parsed = toFeedReviewInput(record, articleNo);
      if (parsed) reviews.push(parsed);
    }

    // 마지막 페이지
    if (items.length < CAFE24_ARTICLES_PAGE_LIMIT) break;

    offset += CAFE24_ARTICLES_PAGE_LIMIT;

    if (offset >= CAFE24_ARTICLES_MAX_COUNT) {
      console.error(
        '[cafe24/reviewExport] 조회 상한에 도달해 피드를 만들지 않았습니다. boardNo:',
        boardNo,
        'scanned:',
        scannedArticleCount
      );
      return { ok: false, kind: 'incomplete_scan', boardNo, scannedArticleCount };
    }
  }

  return { ok: true, boardNo, scannedArticleCount, reviews };
}
