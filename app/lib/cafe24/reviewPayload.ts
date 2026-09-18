/**
 * 네이버 엑셀 리뷰 → 카페24 게시글 등록 요청 변환기 (순수 함수 모듈).
 *
 * 공식 문서 기준 (POST /api/v2/admin/boards/{board_no}/articles)
 *  - SCOPE           : mall.write_community
 *  - 한 요청당 객체 수 : 최대 10건
 *  - 게시판번호       : URL PATH 파라미터입니다. 요청 본문 requests[]에는 board_no 필드가 없습니다.
 *  - 필수            : writer(≤100) · title(≤256) · content · client_ip
 *  - 선택            : created_date · rating(1~5) · product_no · naverpay_review_id(≤20)
 *                      sales_channel(≤20) · input_channel(P·M) · attach_file_urls(name·url)
 *
 * 이 파일에는 네트워크 호출이 없습니다. 값 변환과 검증만 하므로 화면에서도 안전하게 import 할 수 있고
 * 실제 카페24 호출 없이 그대로 검증할 수 있습니다.
 *
 * 날짜 변환 정규식은 reviewNormalize.ts와 같은 형식을 다루지만 일부러 따로 갖고 있습니다.
 * 중복 판정에 쓰이는 그 파일을 이 기능 때문에 건드리지 않기 위한 것이고,
 * 그쪽은 초를 버린 `HH:mm`을 쓰지만 등록에는 초까지 그대로 넘겨야 합니다.
 *
 * client_ip는 이 파일에서 만들지 않습니다. 공인 IPv4 판별은 clientIp.ts가 담당하고,
 * 여기서는 넘겨받은 값이 규격에 맞는지만 마지막으로 다시 확인합니다.
 */

import { isPublicIpv4 } from './clientIp';

/** 공식 문서의 "objects per single API call Limit" */
export const CAFE24_ARTICLES_PER_REQUEST = 10;

/** 공식 문서의 길이 제한 */
const MAX_WRITER_LENGTH = 100;
const MAX_TITLE_LENGTH = 256;
const MAX_NAVERPAY_REVIEW_ID_LENGTH = 20;
export const MAX_SALES_CHANNEL_LENGTH = 20;

/** 게시글 첨부 파일명 길이 상한 (카페24가 파일명을 그대로 저장하므로 넉넉히 잘라 둡니다) */
const MAX_ATTACHMENT_FILENAME_LENGTH = 100;

/** 리뷰 한 건에 붙일 수 있는 첨부 이미지 수 */
const MAX_ATTACHMENTS_PER_ARTICLE = 10;

/** 공식 문서의 input_channel 허용값 중 PC */
const INPUT_CHANNEL_PC = 'P';

const IMAGE_EXTENSION = /\.(jpe?g|png|gif|webp|bmp)$/i;

/**
 * 카페24 게시글 첨부 한 건.
 *
 * 하위 키는 공식 문서(2026-06-01·2026-09-01 동일)와 공식 요청 예제가 정한 `name`·`url`입니다.
 * 예전에는 `filename`으로 보냈지만 그런 키는 어느 버전에도 없습니다.
 * 요청과 응답이 같은 이름을 쓰므로 보낼 때와 돌려받을 때 모두 이 타입을 씁니다.
 */
export interface Cafe24AttachFileUrl {
  name: string;
  url: string;
}

/**
 * 카페24 게시글 등록 요청 객체 한 건 (공식 필드명 그대로).
 *
 * 게시판번호는 여기에 없습니다. 공식 규격에서 board_no는 URL PATH 파라미터이고
 * 요청 본문 requests[] 필드 목록에는 들어 있지 않습니다.
 */
export interface Cafe24ArticleRequest {
  writer: string;
  title: string;
  content: string;
  client_ip: string;
  input_channel: string;
  product_no: number;
  naverpay_review_id: string;
  created_date?: string;
  rating?: number;
  sales_channel?: string;
  attach_file_urls?: Cafe24AttachFileUrl[];
}

/** 등록 요청으로 바꿀 리뷰 한 건 (서버 검증을 통과한 값) */
export interface ReviewPayloadSource {
  naverReviewId: string;
  cafe24ProductNo: number;
  productName: string;
  content: string;
  rating: number | null;
  writer: string;
  registeredAt: string;
  imageRaw: string;
}

export type BuildArticleResult =
  | {
      ok: true;
      article: Cafe24ArticleRequest;
      /** 첨부를 빼고 등록하는 경우의 사유. 등록 자체는 정상 진행합니다. */
      attachmentSkippedReason?: string;
    }
  | { ok: false; reason: string };

// ──────────────────────────────────────────────────────────────
// 작성일시
// ──────────────────────────────────────────────────────────────

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** `2019-04-30T16:44:21+09:00`처럼 시간대가 명시된 값 */
const ZONED_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})$/i;

/** `2026.07.01. 08:47:18`처럼 시간대가 없는 값. 네이버 엑셀 '리뷰등록일' 형식입니다. */
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

/** 한국시간 기준 날짜·시각 조각 */
interface KstParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * 작성일시를 한국시간 조각으로 바꿉니다. 해석할 수 없으면 null
 *
 * - 시간대가 명시된 값은 한국시간으로 옮깁니다.
 * - 시간대가 없는 값(네이버 엑셀)은 적혀 있는 시각을 한국시간으로 봅니다.
 * - 서버 로컬 시간대는 어느 경로에서도 쓰지 않습니다.
 */
function toKstParts(raw: unknown): KstParts | null {
  const source = typeof raw === 'string' ? raw.trim() : '';
  if (!source) return null;

  if (ZONED_DATETIME.test(source)) {
    const parsed = Date.parse(source.replace(' ', 'T'));
    if (Number.isNaN(parsed)) return null;

    const shifted = new Date(parsed + KST_OFFSET_MS);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      second: shifted.getUTCSeconds(),
    };
  }

  const plain = PLAIN_DATETIME.exec(source);
  if (!plain) return null;

  const year = Number(plain[1]);
  const month = Number(plain[2]);
  const day = Number(plain[3]);
  if (!isRealDate(year, month, day)) return null;

  // 시각이 없는 값은 그 날의 0시로 봅니다. 서버 시각으로 채우지 않습니다.
  const hour = plain[4] === undefined ? 0 : Number(plain[4]);
  const minute = plain[5] === undefined ? 0 : Number(plain[5]);
  const second = plain[6] === undefined ? 0 : Number(plain[6]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;

  return { year, month, day, hour, minute, second };
}

/**
 * 카페24 `created_date`로 보낼 값.
 * 한국시간 오프셋을 명시해 서버 시간대와 무관하게 같은 시각이 저장되도록 합니다.
 */
export function toCafe24CreatedDate(raw: unknown): string | null {
  const parts = toKstParts(raw);
  if (!parts) return null;

  const date = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
  const time = `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;

  return `${date}T${time}+09:00`;
}

// ──────────────────────────────────────────────────────────────
// 본문
// ──────────────────────────────────────────────────────────────

/**
 * 카페24가 스마트스토어 리뷰를 옮겨 올 때 본문 맨 끝에 붙이는 출처표기와 같은 형식입니다.
 *
 *   `(2026-07-01 08:47 스마트스토어에서 등록된 구매평)`
 *
 * 중복 검사의 normalizeReviewContent()가 이 문구를 끝에서 떼어 내므로
 * 등록한 리뷰를 다시 검사해도 본문 유사도가 낮아지지 않습니다.
 * (reviewNormalize.ts의 TRAILING_SMARTSTORE_STAMP와 같은 형식을 유지해야 합니다)
 */
const TRAILING_SMARTSTORE_STAMP =
  /\(\s*\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}\.?\s+\d{1,2}:\d{2}(?::\d{2})?\s*스마트스토어에서\s*등록된\s*구매평\s*\)\s*$/;

/** 본문 끝에 붙일 출처 문구. 해석할 수 없는 날짜면 붙이지 않습니다. */
export function buildSmartstoreStamp(registeredAt: unknown): string {
  const parts = toKstParts(registeredAt);
  if (!parts) return '';

  const date = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
  return `(${date} ${pad2(parts.hour)}:${pad2(parts.minute)} 스마트스토어에서 등록된 구매평)`;
}

/** HTML 특수문자를 모두 엔티티로 바꿔 스크립트가 실행되지 않게 합니다. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 게시글 본문을 만듭니다.
 *
 * - 사용자 본문은 전부 escape 하므로 태그·스크립트가 실행되지 않습니다.
 * - 줄바꿈은 `<br />`로 보존합니다.
 * - 출처 문구는 정확히 한 번만 붙입니다. 원문 끝에 같은 형식이 이미 있으면 붙이지 않습니다.
 */
export function buildArticleContent(rawContent: string, registeredAt: unknown): string {
  const normalizedNewlines = rawContent.replace(/\r\n?/g, '\n').trim();
  const escaped = escapeHtml(normalizedNewlines).replace(/\n/g, '<br />');

  const stamp = buildSmartstoreStamp(registeredAt);
  if (!stamp) return escaped;

  // 이미 같은 형식의 출처 문구로 끝나면 중복해서 붙이지 않습니다.
  if (TRAILING_SMARTSTORE_STAMP.test(normalizedNewlines)) return escaped;

  return escaped ? `${escaped}<br /><br />${stamp}` : stamp;
}

// ──────────────────────────────────────────────────────────────
// 첨부 이미지
// ──────────────────────────────────────────────────────────────

/** URL 경로에서 파일명을 뽑아 안전한 문자만 남깁니다. 만들 수 없으면 빈 문자열 */
function toAttachmentFilename(url: URL): string {
  const lastSegment = url.pathname.split('/').filter(Boolean).pop() ?? '';

  let decoded = lastSegment;
  try {
    decoded = decodeURIComponent(lastSegment);
  } catch {
    decoded = lastSegment;
  }

  const safe = decoded.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^[._-]+/, '');
  if (!IMAGE_EXTENSION.test(safe)) return '';

  return safe.slice(0, MAX_ATTACHMENT_FILENAME_LENGTH);
}

export interface ImageAttachmentResult {
  attachments: Cafe24AttachFileUrl[];
  /** 후보가 있었지만 하나도 쓸 수 없었을 때의 사유. 첨부만 빼고 등록은 진행합니다. */
  skippedReason?: string;
}

/**
 * 엑셀 '포토/영상' 열에서 첨부로 쓸 수 있는 이미지 주소만 골라냅니다.
 *
 * - https 이미지 주소만 씁니다. (http·프로토콜 생략·동영상 주소는 제외)
 * - 확장자로 이미지임을 확인할 수 없는 주소는 쓰지 않습니다. 동영상은 공식 지원이 확인되지 않아 제외합니다.
 * - 주소가 없으면 attach_file_urls 자체를 보내지 않습니다. (빈 배열을 억지로 넣지 않습니다)
 */
export function extractImageAttachments(imageRaw: string): ImageAttachmentResult {
  const tokens = imageRaw.split(/[\s,;|]+/).filter(Boolean);
  if (tokens.length === 0) return { attachments: [] };

  const attachments: Cafe24AttachFileUrl[] = [];
  const seen = new Set<string>();

  let urlLikeCount = 0;
  let notHttps = 0;
  let notImage = 0;

  for (const token of tokens) {
    if (!token.includes('/') && !token.includes(':')) continue;
    urlLikeCount += 1;

    let url: URL;
    try {
      url = new URL(token);
    } catch {
      notHttps += 1;
      continue;
    }

    if (url.protocol !== 'https:' || !url.hostname) {
      notHttps += 1;
      continue;
    }

    const name = toAttachmentFilename(url);
    if (!name) {
      notImage += 1;
      continue;
    }

    const absolute = url.toString();
    if (seen.has(absolute)) continue;
    seen.add(absolute);

    attachments.push({ name, url: absolute });
    if (attachments.length >= MAX_ATTACHMENTS_PER_ARTICLE) break;
  }

  if (attachments.length > 0) return { attachments };

  // 'Y'·'포토'처럼 주소가 아닌 값만 있었으면 첨부할 것이 없던 것이라 사유를 남기지 않습니다.
  if (urlLikeCount === 0) return { attachments: [] };

  if (notHttps > 0 && notImage === 0) {
    return { attachments: [], skippedReason: 'https 이미지 주소가 아니어서 첨부를 제외했습니다.' };
  }

  return {
    attachments: [],
    skippedReason: '이미지 파일명을 확인할 수 없어 첨부를 제외했습니다.',
  };
}

// ──────────────────────────────────────────────────────────────
// 게시글 요청 만들기
// ──────────────────────────────────────────────────────────────

/**
 * 리뷰 한 건을 카페24 게시글 등록 요청으로 바꿉니다.
 *
 * 필수 값이 없거나 형식이 맞지 않으면 등록하지 않고 사유를 돌려줍니다.
 * (클라이언트가 보낸 값을 그대로 믿지 않기 위한 서버 측 마지막 확인입니다)
 *
 * options.boardNo는 POST 경로 `/boards/{board_no}/articles`에 들어가는 값입니다.
 * 여기서는 그 값이 쓸 수 있는 번호인지만 마지막으로 확인하고, 요청 본문에는 넣지 않습니다.
 */
export function buildArticleRequest(
  source: ReviewPayloadSource,
  options: { boardNo: number; clientIp: string; salesChannel: string | null }
): BuildArticleResult {
  // 게시판번호는 URL 경로에 들어가므로 정수만 통과시킵니다. (config의 선택 규칙과 같은 조건)
  if (!Number.isInteger(options.boardNo) || options.boardNo <= 0) {
    return { ok: false, reason: '등록할 게시판번호를 확인하지 못했습니다.' };
  }

  const naverpayReviewId = source.naverReviewId.trim();
  if (!naverpayReviewId || naverpayReviewId.length > MAX_NAVERPAY_REVIEW_ID_LENGTH) {
    return { ok: false, reason: '리뷰글번호가 없거나 20자를 넘습니다.' };
  }

  if (!Number.isInteger(source.cafe24ProductNo) || source.cafe24ProductNo <= 0) {
    return { ok: false, reason: '카페24 상품번호가 확정되지 않았습니다.' };
  }

  /**
   * 공식 문서의 client_ip는 string<ipv4> 필수 항목입니다.
   * 라우트가 이미 확인하고 넘기지만, 규격에 맞지 않는 값이 절대 실려 나가지 않도록 여기서도 막습니다.
   */
  if (!isPublicIpv4(options.clientIp)) {
    return { ok: false, reason: '등록에 사용할 공인 IPv4를 확인하지 못했습니다.' };
  }

  const writer = source.writer.trim().slice(0, MAX_WRITER_LENGTH);
  if (!writer) {
    return { ok: false, reason: '작성자가 비어 있습니다.' };
  }

  const title = source.productName.trim().slice(0, MAX_TITLE_LENGTH);
  if (!title) {
    return { ok: false, reason: '상품명이 비어 있어 제목을 만들 수 없습니다.' };
  }

  const content = buildArticleContent(source.content, source.registeredAt);
  if (!content) {
    return { ok: false, reason: '리뷰 본문이 비어 있습니다.' };
  }

  const createdDate = toCafe24CreatedDate(source.registeredAt);
  if (!createdDate) {
    return { ok: false, reason: '작성일시를 해석할 수 없습니다.' };
  }

  const { attachments, skippedReason } = extractImageAttachments(source.imageRaw);

  // 게시판번호(options.boardNo)는 POST 경로에만 들어가므로 이 객체에 넣지 않습니다.
  const article: Cafe24ArticleRequest = {
    writer,
    title,
    content,
    client_ip: options.clientIp,
    input_channel: INPUT_CHANNEL_PC,
    product_no: source.cafe24ProductNo,
    naverpay_review_id: naverpayReviewId,
    created_date: createdDate,
    // 평점은 1~5로 해석된 경우에만 보냅니다. (공식 제한과 같은 범위)
    ...(source.rating !== null && Number.isInteger(source.rating) && source.rating >= 1 && source.rating <= 5
      ? { rating: source.rating }
      : {}),
    ...(options.salesChannel ? { sales_channel: options.salesChannel } : {}),
    ...(attachments.length > 0 ? { attach_file_urls: attachments } : {}),
  };

  return skippedReason ? { ok: true, article, attachmentSkippedReason: skippedReason } : { ok: true, article };
}

/** 공식 제한(한 요청당 10건)에 맞춰 순서를 유지한 채 나눕니다. */
export function chunkForCafe24<T>(items: T[], size: number = CAFE24_ARTICLES_PER_REQUEST): T[][] {
  const limit = Number.isInteger(size) && size > 0 ? size : CAFE24_ARTICLES_PER_REQUEST;
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += limit) {
    chunks.push(items.slice(i, i + limit));
  }

  return chunks;
}
