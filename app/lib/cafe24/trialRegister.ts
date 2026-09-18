/**
 * 이미지 리뷰 1건 시험 등록 모듈.
 *
 * 카페24 공식 문서는 attach_file_urls로 넘긴 이미지를 카페24가 직접 내려받아 보관하는지,
 * 아니면 넘긴 주소를 그대로 참조만 하는지 명시하지 않습니다.
 * 그래서 전체 등록을 돌리기 전에 이미지가 있는 정상 신규 후보 딱 한 건만 실제로 등록해 보고,
 * 카페24가 돌려주는 첨부 파일명·주소·호스트를 직접 확인하기 위한 것입니다.
 *
 * 이 파일에는 카페24 호출이 없습니다. 값 고르기·요청 본문 만들기·응답 비교만 하고,
 * 실제 요청은 우리 서버의 기존 register / register-verify 라우트로만 나갑니다.
 * 덕분에 카페24를 한 번도 호출하지 않고 순수 함수와 가짜 fetch만으로 검증할 수 있습니다.
 */

import { extractImageAttachments, type Cafe24AttachFileUrl } from './reviewPayload';

/** 시험 등록이 쓰는 기존 라우트. 새 등록 경로를 만들지 않습니다. */
export const TRIAL_REGISTER_PATH = '/api/review-migration/cafe24/reviews/register';
export const TRIAL_VERIFY_PATH = '/api/review-migration/cafe24/reviews/register-verify';

/** 이미지가 있는 신규 후보가 하나도 없을 때의 안내 */
export const TRIAL_NO_IMAGE_CANDIDATE_MESSAGE =
  '이미지 URL이 포함된 신규 등록 후보가 없습니다. 엑셀 이미지 필드 파싱을 확인해 주세요.';

/** 시험 등록 뒤에는 중복 상태가 달라지므로 성공·실패와 관계없이 보여 주는 안내 */
export const TRIAL_RECHECK_GUIDE =
  '시험 등록 후에는 중복 상태가 변경됩니다. [기존 리뷰 중복 검사]를 다시 실행한 뒤 다음 등록을 진행해 주세요.';

/**
 * 목록 응답에 첨부 상세가 없을 때의 안내.
 * 확인하지 못한 것을 확인한 것처럼 보여 주지 않기 위해 따로 둡니다.
 */
export const TRIAL_ATTACHMENTS_UNAVAILABLE_MESSAGE =
  'Cafe24 목록 API 응답에서 첨부 이미지 상세를 확인할 수 없습니다. 상품후기 화면에서 직접 확인해 주세요.';

/** 버튼을 눌렀을 때 띄우는 확인 문구 */
export function trialConfirmMessage(naverReviewId: string): string {
  return `네이버 리뷰글번호 ${naverReviewId} 1건을 Cafe24에 시험 등록합니다. 실제 상품후기 게시판에 등록됩니다. 계속하시겠습니까?`;
}

/** 시험 대상을 고르는 데 필요한 최소 정보 */
export interface TrialSelectableReview {
  naverReviewId: string;
  imageRaw: string;
}

export interface TrialRegisterCandidate<T extends TrialSelectableReview> {
  review: T;
  /** 실제로 attach_file_urls에 실려 나갈 이미지. 서버의 추출 규칙을 그대로 씁니다. */
  attachments: Cafe24AttachFileUrl[];
}

/**
 * 시험 대상 한 건을 고릅니다.
 *
 * 최종 사전 확인(register-precheck)을 통과한 순서를 그대로 따라가며,
 * 서버가 실제 첨부로 인정하는 https 이미지 주소가 1개 이상인 첫 번째 리뷰를 고릅니다.
 * (화면에서 따로 주소를 해석하지 않고 등록 때와 같은 extractImageAttachments를 씁니다)
 */
export function selectTrialRegisterCandidate<T extends TrialSelectableReview>(
  allowedNaverReviewIds: readonly string[],
  targetById: ReadonlyMap<string, T>
): TrialRegisterCandidate<T> | null {
  for (const naverReviewId of allowedNaverReviewIds) {
    const review = targetById.get(naverReviewId);
    if (!review) continue;

    const { attachments } = extractImageAttachments(review.imageRaw);
    if (attachments.length === 0) continue;

    return { review, attachments };
  }

  return null;
}

/**
 * 시험 등록 요청 본문.
 *
 * 리뷰 한 건만 받아 그 자리에서 길이 1짜리 배열을 만듭니다.
 * 목록을 받아 자르는 방식이 아니므로 두 건 이상이 실릴 수 없습니다.
 */
export function buildTrialRegisterBody<T>(review: T): { reviews: [T] } {
  return { reviews: [review] };
}

/** 등록 응답이 알려 준 게시글번호. 목록에서 찾을 때의 2순위 기준입니다. */
export interface TrialArticleNoHint {
  naverReviewId: string;
  articleNo: number;
}

/**
 * 시험 등록 결과 확인 요청 본문. 첨부 정보까지 함께 받아 옵니다.
 *
 * 서버는 공식 목록 조회 결과에서 naverpay_review_id로 먼저 찾고,
 * 찾지 못했을 때만 여기 담긴 게시글번호로 찾습니다.
 */
export function buildTrialVerifyBody(
  naverReviewId: string,
  articleNo: number | null
): {
  naverReviewIds: [string];
  includeArticleDetails: true;
  registeredArticleNos?: [TrialArticleNoHint];
} {
  return {
    naverReviewIds: [naverReviewId],
    includeArticleDetails: true,
    ...(articleNo !== null ? { registeredArticleNos: [{ naverReviewId, articleNo }] as [TrialArticleNoHint] } : {}),
  };
}

// ──────────────────────────────────────────────────────────────
// 카페24가 돌려준 첨부 읽기
// ──────────────────────────────────────────────────────────────

/** 첨부 한 건에서 파일명으로 쓸 값을 찾습니다. 공식 응답은 `name`입니다. */
function readAttachmentFilename(record: Record<string, unknown>): string {
  for (const key of ['name', 'filename', 'file_name']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/** 첨부 한 건에서 주소로 쓸 값을 찾습니다. 공식 응답은 `url`입니다. */
function readAttachmentUrl(record: Record<string, unknown>): string {
  for (const key of ['url', 'file_url', 'path']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/**
 * 목록 조회 응답의 첨부 항목을 읽습니다.
 *
 * 공식 문서는 attach_file_urls의 하위 항목을 `name`(파일명)·`url`(파일 주소)로 적고 있지만,
 * 응답 예시의 정확한 형태까지는 공개돼 있지 않습니다.
 * 그래서 문자열만 오는 경우와 키 이름이 다른 경우까지 함께 받아들이고,
 * 읽지 못한 값은 억지로 만들지 않고 빈 문자열로 남겨 화면이 "확인 불가"로 보여 주게 합니다.
 */
export function parseCafe24Attachments(raw: unknown): Cafe24AttachFileUrl[] {
  if (!Array.isArray(raw)) return [];

  const attachments: Cafe24AttachFileUrl[] = [];

  for (const item of raw) {
    if (typeof item === 'string') {
      const url = item.trim();
      if (url) attachments.push({ name: '', url });
      continue;
    }

    if (!item || typeof item !== 'object') continue;

    const record = item as Record<string, unknown>;
    const url = readAttachmentUrl(record);
    const name = readAttachmentFilename(record);
    if (!url && !name) continue;

    attachments.push({ name, url });
  }

  return attachments;
}

/**
 * 목록 응답의 게시글 한 건에서 첨부 목록을 찾습니다.
 * 공식 게시글 필드에 attach_file_urls·attached_file_urls·attached_file_detail이 모두 있어 셋 다 살핍니다.
 */
export function readArticleAttachments(article: unknown): Cafe24AttachFileUrl[] {
  if (!article || typeof article !== 'object') return [];

  const record = article as Record<string, unknown>;

  for (const key of ['attach_file_urls', 'attached_file_urls', 'attached_file_detail']) {
    const attachments = parseCafe24Attachments(record[key]);
    if (attachments.length > 0) return attachments;
  }

  return [];
}

// ──────────────────────────────────────────────────────────────
// 목록 응답에서 시험 게시글 찾기
// ──────────────────────────────────────────────────────────────

/**
 * 목록 조회 중에 첨부까지 읽어 둘 게시글.
 *
 * 카페24 공식 API에는 게시글 한 건을 번호로 조회하는 GET 상세 엔드포인트가 없고
 * article_no로 거르는 검색 파라미터도 문서에 없습니다.
 * 그래서 공식 목록 조회(GET /boards/{board_no}/articles) 결과를 서버 메모리에서 직접 찾습니다.
 */
export interface AttachmentCaptureTarget {
  naverReviewId: string;
  /** 등록 응답이 알려 준 게시글번호. 없으면 null */
  articleNo: number | null;
}

/** 목록 응답에서 실제로 읽어 낸 첨부 */
export interface CapturedArticleAttachments {
  naverReviewId: string;
  articleNo: number;
  /** 어느 기준으로 찾았는지. naverpay_review_id가 1순위입니다. */
  matchedBy: 'naverpay_review_id' | 'article_no';
  attachments: Cafe24AttachFileUrl[];
}

export interface AttachmentCollector {
  /** 목록 응답의 게시글 한 건을 살펴 대상이면 첨부를 담아 둡니다. */
  inspect(record: Record<string, unknown>, articleNo: number, naverReviewId: string): void;
  /** 1순위 naverpay_review_id → 2순위 article_no 순으로 결과를 맞춥니다. */
  collect(): CapturedArticleAttachments[];
}

/**
 * 게시판 목록을 훑는 동안 시험 게시글의 첨부만 모으는 수집기.
 *
 * 페이지를 한 번 훑는 동안 함께 동작하므로 추가 조회가 없고,
 * 네트워크를 모르기 때문에 카페24 호출 없이 그대로 검증할 수 있습니다.
 */
export function createAttachmentCollector(
  targets: readonly AttachmentCaptureTarget[]
): AttachmentCollector {
  const wantedNaverReviewIds = new Set(targets.map((target) => target.naverReviewId));
  const wantedArticleNos = new Set(
    targets
      .map((target) => target.articleNo)
      .filter((articleNo): articleNo is number => articleNo !== null)
  );

  const byNaverReviewId = new Map<string, { articleNo: number; attachments: Cafe24AttachFileUrl[] }>();
  const byArticleNo = new Map<number, Cafe24AttachFileUrl[]>();

  return {
    inspect(record, articleNo, naverReviewId) {
      if (targets.length === 0) return;

      // 같은 값이 두 번 나오면 먼저 만난 게시글을 그대로 둡니다.
      if (naverReviewId && wantedNaverReviewIds.has(naverReviewId) && !byNaverReviewId.has(naverReviewId)) {
        byNaverReviewId.set(naverReviewId, { articleNo, attachments: readArticleAttachments(record) });
      }

      if (wantedArticleNos.has(articleNo) && !byArticleNo.has(articleNo)) {
        byArticleNo.set(articleNo, readArticleAttachments(record));
      }
    },

    collect() {
      const captured: CapturedArticleAttachments[] = [];

      for (const target of targets) {
        const primary = byNaverReviewId.get(target.naverReviewId);

        if (primary) {
          captured.push({
            naverReviewId: target.naverReviewId,
            articleNo: primary.articleNo,
            matchedBy: 'naverpay_review_id',
            attachments: primary.attachments,
          });
          continue;
        }

        if (target.articleNo === null) continue;

        const fallback = byArticleNo.get(target.articleNo);
        if (!fallback) continue;

        captured.push({
          naverReviewId: target.naverReviewId,
          articleNo: target.articleNo,
          matchedBy: 'article_no',
          attachments: fallback,
        });
      }

      return captured;
    },
  };
}

// ──────────────────────────────────────────────────────────────
// 돌려받은 주소 확인
// ──────────────────────────────────────────────────────────────

/** 주소의 호스트명. 해석할 수 없으면 빈 문자열 */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export interface TrialAttachmentComparison {
  /** 카페24가 돌려준 첨부 파일명 */
  filename: string;
  /** 카페24가 돌려준 이미지 주소 */
  url: string;
  /** 위 주소의 호스트명 */
  host: string;
  /** 보낸 네이버 이미지 주소와 완전히 같은지 */
  sameAsNaverUrl: boolean;
  /** 같은 주소가 아니라면 어느 네이버 주소에 대응하는지 (순서 기준). 없으면 빈 문자열 */
  naverUrl: string;
}

/**
 * 보낸 네이버 이미지 주소와 카페24가 돌려준 주소를 견줍니다.
 *
 * 카페24가 이미지를 자체 저장하면 주소와 호스트가 바뀌고, 참조만 하면 그대로 남습니다.
 * 짝은 순서로 맞추되, 같은 주소가 목록 어딘가에 있으면 그것을 우선해 동일로 봅니다.
 */
export function compareTrialAttachments(
  sentToCafe24: readonly Cafe24AttachFileUrl[],
  returnedByCafe24: readonly Cafe24AttachFileUrl[]
): TrialAttachmentComparison[] {
  const sentUrls = sentToCafe24.map((item) => item.url);

  return returnedByCafe24.map((item, index) => {
    const sameAsNaverUrl = item.url !== '' && sentUrls.includes(item.url);

    return {
      filename: item.name,
      url: item.url,
      host: hostnameOf(item.url),
      sameAsNaverUrl,
      naverUrl: sameAsNaverUrl ? item.url : (sentUrls[index] ?? ''),
    };
  });
}

// ──────────────────────────────────────────────────────────────
// 요청 보내기 (우리 서버 라우트로만 나갑니다)
// ──────────────────────────────────────────────────────────────

/** fetch의 최소 형태. 검증에서 가짜 함수로 바꿔 끼우기 위해 따로 둡니다. */
export type TrialFetch = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export interface TrialRequestOutcome {
  ok: boolean;
  data: unknown;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * 기존 등록 API에 정확히 한 건만 보냅니다.
 *
 * 본문은 buildTrialRegisterBody가 만든 길이 1 배열뿐이라 여러 건이 섞일 수 없고,
 * 이 함수는 재시도를 하지 않습니다. (응답을 받지 못한 경우 다시 보내면 중복 등록이 됩니다)
 */
export async function requestTrialRegister<T>(
  review: T,
  fetchImpl: TrialFetch
): Promise<TrialRequestOutcome> {
  const res = await fetchImpl(TRIAL_REGISTER_PATH, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(buildTrialRegisterBody(review)),
  });

  return { ok: res.ok, data: await res.json() };
}

/** 기존 등록 결과 확인 API로 그 리뷰글번호 하나만 다시 조회합니다. (읽기 전용) */
export async function requestTrialVerify(
  naverReviewId: string,
  articleNo: number | null,
  fetchImpl: TrialFetch
): Promise<TrialRequestOutcome> {
  const res = await fetchImpl(TRIAL_VERIFY_PATH, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(buildTrialVerifyBody(naverReviewId, articleNo)),
  });

  return { ok: res.ok, data: await res.json() };
}
