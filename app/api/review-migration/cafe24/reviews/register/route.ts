import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import { callCafe24Admin } from '@/app/lib/cafe24/adminApi';
import { buildCafe24BatchResults, classifyCafe24Batch } from '@/app/lib/cafe24/batchOutcome';
import {
  CAFE24_CLIENT_IP_ERROR_STATUS,
  cafe24ClientIpErrorBody,
  cafe24ClientIpHeadersOf,
  describeCafe24ClientIpSources,
  resolveCafe24ClientIp,
} from '@/app/lib/cafe24/clientIp';
import { resolveReviewBoardNo } from '@/app/lib/cafe24/config';
import {
  devOnlyCafe24ErrorDetail,
  formatCafe24ErrorDetailForLog,
  isCafe24DebugEnabled,
  redactCafe24ErrorDetail,
  type Cafe24ErrorDetail,
} from '@/app/lib/cafe24/errorDetail';
import { CAFE24_NO_STORE_HEADERS, cafe24FailureResponse } from '@/app/lib/cafe24/failureResponse';
import {
  CAFE24_NO_MULTI_STATUS_REASON,
  attributeCafe24MultiStatusFailures,
  extractCafe24MultiStatusReport,
} from '@/app/lib/cafe24/multiStatus';
import { validateRegisterReviews } from '@/app/lib/cafe24/registerRequest';
import {
  CAFE24_ARTICLES_PER_REQUEST,
  MAX_SALES_CHANNEL_LENGTH,
  buildArticleRequest,
  type Cafe24ArticleRequest,
  type ReviewPayloadSource,
} from '@/app/lib/cafe24/reviewPayload';
import { isSameOrigin } from '@/app/lib/cafe24/sameOrigin';
import type { RegisterResultItem } from '@/app/review-migration/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 신규 리뷰 카페24 게시판 등록 (이 프로젝트에서 카페24에 쓰기를 하는 유일한 경로).
 *
 * 공식 엔드포인트: POST /api/v2/admin/boards/{board_no}/articles
 *  - 게시판 번호는 resolveReviewBoardNo()에서 가져와 URL PATH에만 넣습니다.
 *    공식 요청 본문 requests[]에는 board_no 필드가 없으므로 본문에 담지 않습니다.
 *  - 한 요청당 최대 10건이라는 공식 제한을 그대로 지킵니다.
 *  - 여러 건을 한 번에 만드는 API라 공식 다중 객체 형식(`requests` 배열)으로 보냅니다.
 *
 * 안전 원칙
 *  - 화면이 계산한 후보 목록을 그대로 믿지 않고 필수 값을 다시 검증합니다.
 *  - 실패한 요청을 이 라우트에서 자동으로 다시 보내지 않습니다. (중복 등록 방지)
 *  - 성공 여부를 확인할 수 없으면 outcomeUnknown으로 알려 화면이 즉시 멈추게 합니다.
 *  - 토큰·client secret·본문·작성자 원문은 로그에 남기지 않습니다.
 *  - 개발 환경에서만 카페24가 거절한 사유(status·code·message·필드별 오류)를 터미널과 응답에 남깁니다.
 *    이때도 우리가 보낸 값은 지운 뒤 남기고, 운영 환경에서는 일반 안내 문구만 돌려줍니다.
 */

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: CAFE24_NO_STORE_HEADERS });
}

/**
 * 개발 환경에서만 쓰는 카페24 원본 오류 요약.
 *
 * 422처럼 사유가 응답 본문에만 담기는 거절의 원인을 확인하기 위한 것이고,
 * 운영 환경에서는 devOnlyCafe24ErrorDetail()이 undefined를 돌려주므로 아무것도 남지 않습니다.
 *
 * 오류 문장에 우리가 보낸 값이 섞여 있을 수 있으므로,
 * 리뷰 본문·작성자·리뷰글번호·작성자 IP·이미지 주소·첨부 파일명을 목록으로 넘겨 정확히 지웁니다.
 * (주문번호는 등록 요청에 넣지 않으므로 애초에 응답에 나올 수 없습니다)
 */
function devRegisterErrorDetail(
  detail: Cafe24ErrorDetail | undefined,
  reviews: readonly ReviewPayloadSource[],
  articles: readonly Cafe24ArticleRequest[]
): Cafe24ErrorDetail | undefined {
  const safe = devOnlyCafe24ErrorDetail(detail);
  if (!safe) return undefined;

  const sentValues: string[] = [];

  for (const review of reviews) {
    sentValues.push(review.naverReviewId, review.content, review.writer, review.imageRaw);
  }

  for (const article of articles) {
    sentValues.push(article.writer, article.content, article.client_ip, article.naverpay_review_id);
    for (const attachment of article.attach_file_urls ?? []) {
      sentValues.push(attachment.url, attachment.name);
    }
  }

  return redactCafe24ErrorDetail(safe, sentValues);
}

/**
 * 207 응답의 개별 실패 사유 한 건 (개발 환경 전용).
 * 어느 요청인지 특정하지 못한 사유는 카페24가 적어 준 위치값만 함께 남깁니다.
 */
interface DevMultiStatusNote {
  /** 카페24가 적어 준 요청 배열 위치 원본값. 없으면 null */
  reportedIndex: number | null;
  detail: Cafe24ErrorDetail;
}

/** 화면에 넘길 207 진단 요약 (개발 환경 전용) */
interface DevMultiStatusSummary {
  status: number;
  /** 응답에서 읽어 낸 실패 사유 수 */
  failureCount: number;
  /** 사유를 하나도 읽지 못한 경우 true. 화면은 이때 규정된 안내 문구만 보여 줍니다. */
  reasonsMissing: boolean;
  /** 어느 리뷰의 실패인지 특정하지 못한 사유 */
  unattributed: DevMultiStatusNote[];
  /** 사유가 모두 같을 때의 묶음 공통 실패 사유. 서로 다르면 null */
  commonFailureDetail: Cafe24ErrorDetail | null;
  /** 실패는 확정했지만 사유를 개별 연결하지 못한 건수 */
  unlinkedFailedCount: number;
  /** 사유가 서로 달라 개별 연결이 불가능한 경우 true */
  reasonsUnlinkable: boolean;
}

/**
 * 개발 환경 로그에 남길 묶음 시작 위치. 화면이 알려 주지 않으면 null입니다.
 * 로그 표시에만 쓰고 등록 판단에는 어떤 영향도 주지 않습니다.
 */
function readBatchStart(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;

  const raw = (body as Record<string, unknown>).batchStart;
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < 100_000 ? raw : null;
}

/**
 * 207 응답의 개별 실패 사유를 개발 환경 터미널에 남깁니다.
 *
 * 어느 건인지는 요청 배열 위치(`requests[i]`)로만 가리킵니다.
 * 리뷰글번호·작성자·본문·작성자 IP·이미지 주소·토큰·요청 본문은 남기지 않고,
 * 사유 문장도 devRegisterErrorDetail()로 이미 지운 값만 씁니다.
 *
 * 운영 환경에서는 넘어오는 목록이 비어 있어 위 요약 한 줄 외에는 아무것도 남지 않습니다.
 */
function logMultiStatusFailures(
  status: number,
  failureCount: number,
  byIndex: ReadonlyMap<number, Cafe24ErrorDetail>,
  unattributed: readonly DevMultiStatusNote[],
  indexBase: 0 | 1 | null
): void {
  if (!isCafe24DebugEnabled()) return;

  if (byIndex.size === 0 && unattributed.length === 0) {
    console.error(
      '[cafe24/register] 개별 실패 사유 없음 (개발 전용) status:',
      status,
      '—',
      CAFE24_NO_MULTI_STATUS_REASON
    );
    return;
  }

  console.error(
    '[cafe24/register] 개별 실패 사유 (개발 전용) status:',
    status,
    'failures:',
    failureCount,
    'indexBase:',
    indexBase ?? '-'
  );

  for (const [index, detail] of [...byIndex].sort(([a], [b]) => a - b)) {
    console.error(`  requests[${index}]`, formatCafe24ErrorDetailForLog(detail));
  }

  for (const note of unattributed) {
    console.error(
      `  requests[?] (응답의 위치값: ${note.reportedIndex ?? '-'})`,
      formatCafe24ErrorDetailForLog(note.detail)
    );
  }
}

function badRequest(message: string, code: string) {
  return jsonResponse({ error: message, code, retryable: false }, 400);
}

/**
 * sales_channel 값.
 *
 * 공식 문서는 이 필드를 "sales channel (Max Length 20)"으로만 정의하고 허용값을 나열하지 않습니다.
 * 값을 추측해서 넣으면 422로 거절되거나 잘못된 값이 저장될 수 있어,
 * 운영자가 CAFE24_REVIEW_SALES_CHANNEL로 지정한 경우에만 보냅니다.
 * 지정하지 않으면 이 필드를 넣지 않고, 스마트스토어 출처는 본문 끝 출처 문구로 남습니다.
 */
function resolveSalesChannel(): string | null {
  const raw = process.env.CAFE24_REVIEW_SALES_CHANNEL?.trim() ?? '';
  if (!raw || raw.length > MAX_SALES_CHANNEL_LENGTH) return null;
  return raw;
}

interface ArticlesResponse {
  articles?: unknown;
  article?: unknown;
}

/** 응답에서 `naverpay_review_id → article_no`만 뽑습니다. 본문·작성자 값은 읽지 않습니다. */
function readCreatedArticles(data: ArticlesResponse): Map<string, number | null> {
  const created = new Map<string, number | null>();

  const items = Array.isArray(data.articles)
    ? data.articles
    : data.article && typeof data.article === 'object'
      ? [data.article]
      : [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const record = item as Record<string, unknown>;

    const rawId = record.naverpay_review_id;
    const naverpayReviewId =
      typeof rawId === 'string' ? rawId.trim() : typeof rawId === 'number' ? String(rawId) : '';
    if (!naverpayReviewId) continue;

    const rawArticleNo = record.article_no;
    const articleNo =
      typeof rawArticleNo === 'number' && Number.isInteger(rawArticleNo) && rawArticleNo > 0
        ? rawArticleNo
        : typeof rawArticleNo === 'string' && /^\d+$/.test(rawArticleNo.trim())
          ? Number.parseInt(rawArticleNo.trim(), 10)
          : null;

    created.set(naverpayReviewId, articleNo);
  }

  return created;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    console.error('[cafe24/register] 출처 검증 실패');
    return jsonResponse({ error: '잘못된 요청입니다.', code: 'forbidden_origin' }, 403);
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return jsonResponse({ error: admin.message, code: admin.code }, admin.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('요청 본문을 읽지 못했습니다.', 'invalid_json');
  }

  // 공식 제한과 같은 10건을 서버에서도 강제합니다. 더 많이 보내면 등록하지 않고 거절합니다.
  const validated = validateRegisterReviews(body, CAFE24_ARTICLES_PER_REQUEST);
  if (!validated.ok) {
    console.error('[cafe24/register] 요청 검증 실패 code:', validated.code);
    return badRequest(validated.message, validated.code);
  }

  const boardNo = resolveReviewBoardNo();

  /**
   * 공식 문서의 client_ip는 string<ipv4> 필수 항목입니다.
   * 공인 IPv4를 얻지 못하면 카페24에 POST를 보내기 전에 여기서 멈춥니다.
   * (예전처럼 127.0.0.1로 대체하면 `Invalid IP address.`로 422를 받습니다)
   */
  const ipHeaders = cafe24ClientIpHeadersOf(request.headers);
  const ipOverride = process.env.CAFE24_REVIEW_CLIENT_IP ?? null;
  const clientIpResult = resolveCafe24ClientIp(ipHeaders, ipOverride);

  if (!clientIpResult.ok) {
    // IP 값 자체는 남기지 않고 어느 경로가 비어 있었는지만 남깁니다.
    console.error(
      '[cafe24/register] 공인 IPv4 확인 실패 —',
      describeCafe24ClientIpSources(ipHeaders, ipOverride)
    );
    return jsonResponse(
      cafe24ClientIpErrorBody(isCafe24DebugEnabled()),
      CAFE24_CLIENT_IP_ERROR_STATUS
    );
  }

  const clientIp = clientIpResult.clientIp;
  const salesChannel = resolveSalesChannel();

  const articles: Cafe24ArticleRequest[] = [];
  const attachmentNotes = new Map<string, string>();
  const failures: RegisterResultItem[] = [];

  for (const review of validated.reviews) {
    const built = buildArticleRequest(review, { boardNo, clientIp, salesChannel });

    if (!built.ok) {
      /**
       * 카페24로 보내지 않은 건입니다. 등록되지 않은 것이 확실하고 사유도 우리가 알고 있으므로
       * '명시적 실패'로 기록합니다. (결과를 확인할 수 없는 건과 구분합니다)
       */
      failures.push({
        naverReviewId: review.naverReviewId,
        registered: false,
        articleNo: null,
        code: `missing_data:${built.reason}`,
        failureConfirmed: true,
        reasonLinked: true,
      });
      continue;
    }

    if (built.attachmentSkippedReason) {
      attachmentNotes.set(review.naverReviewId, built.attachmentSkippedReason);
    }
    articles.push(built.article);
  }

  /**
   * 보낼 것이 하나도 없으면 카페24를 호출하지 않습니다.
   * 모든 건의 결과가 확실하므로(전부 값 부족으로 보내지 않음) 다음 묶음은 이어서 보낼 수 있습니다.
   */
  if (articles.length === 0) {
    return jsonResponse({
      ok: true,
      boardNo,
      outcome: 'partial',
      results: failures,
      registeredCount: 0,
      failedCount: failures.length,
      explicitFailedCount: failures.length,
      unclearCount: 0,
      unaccountedCount: 0,
      canContinue: true,
    });
  }

  const response = await callCafe24Admin<ArticlesResponse>({
    method: 'POST',
    path: `/api/v2/admin/boards/${boardNo}/articles`,
    body: { shop_no: 1, requests: articles },
  });

  if (!response.ok) {
    // 권한이 없으면 재연결이 필요하다는 것을 정확히 알려 줍니다. (403 = scope 부족)
    if (response.kind === 'http' && response.status === 403) {
      return jsonResponse(
        {
          error:
            '카페24 게시글 쓰기 권한(mall.write_community)이 없어 등록하지 못했습니다. 카페24 연결을 해제한 뒤 다시 연결해 권한에 동의해 주세요. 등록된 리뷰는 없습니다.',
          code: 'write_forbidden',
          retryable: false,
        },
        403
      );
    }

    /**
     * 카페24가 거절한 경우. 개발 환경에서만 원본 오류 요약을 터미널과 화면에서 확인할 수 있게 합니다.
     * 사용자 안내 문구와 상태 코드는 그대로입니다.
     */
    if (response.kind === 'http') {
      const devDetail = devRegisterErrorDetail(response.detail, validated.reviews, articles);

      if (devDetail) {
        console.error(
          '[cafe24/register] 카페24 거절 상세 (개발 전용)',
          formatCafe24ErrorDetailForLog(devDetail)
        );
      }

      if (response.status === 422) {
        return jsonResponse(
          {
            error:
              '카페24가 리뷰 값을 처리할 수 없다고 응답했습니다. 이미 등록된 리뷰글번호이거나 필수 값이 규격에 맞지 않습니다. [기존 리뷰 중복 검사]를 다시 실행해 주세요.',
            code: 'unprocessable',
            retryable: false,
            ...(devDetail ? { devDetail } : {}),
          },
          422
        );
      }

      // 그 밖의 거절은 공통 응답을 쓰되, 값을 지운 상세만 넘깁니다.
      return cafe24FailureResponse({ ...response, detail: devDetail }, '리뷰 등록');
    }

    if (response.kind === 'unknown_result') {
      return jsonResponse(
        {
          error:
            '카페24 응답을 받지 못해 이번 묶음이 등록됐는지 확인할 수 없습니다. 중복 등록을 막기 위해 자동으로 다시 시도하지 않았습니다. [기존 리뷰 중복 검사]를 다시 실행해 실제 등록 여부를 확인해 주세요.',
          code: 'unknown_result',
          retryable: false,
          outcomeUnknown: true,
        },
        502
      );
    }

    return cafe24FailureResponse(response, '리뷰 등록');
  }

  const created = readCreatedArticles(response.data);

  /**
   * 카페24는 여러 건을 한 번에 등록하면 성공과 실패를 한 응답에 섞어 207로 돌려줍니다.
   * 위 readCreatedArticles()는 성공 항목만 읽으므로 실패 항목의 사유는 여기서 따로 읽습니다.
   *
   * 등록 성공 판정은 그대로 created 기준입니다.
   * 실패 사유는 표시·진단에 쓰고, 실패 건수 확정(계속 진행 판단)에도 함께 씁니다.
   * (성공 판정·중복 판정·자동 재시도 금지는 이 수정으로 달라지지 않습니다)
   */
  const naverReviewIdByIndex = articles.map((article) => article.naverpay_review_id);
  const unconfirmedIndexes = naverReviewIdByIndex
    .map((naverReviewId, index) => ({ naverReviewId, index }))
    .filter(({ naverReviewId }) => !created.has(naverReviewId))
    .map(({ index }) => index);

  const multiStatus = extractCafe24MultiStatusReport(response.data, response.status, articles.length);
  const attribution = attributeCafe24MultiStatusFailures(multiStatus.failures, {
    requestCount: articles.length,
    naverReviewIdByIndex,
    unconfirmedIndexes,
  });

  /**
   * 이 묶음의 결과를 성공·명시적 실패·결과 불명확으로 나눕니다.
   *
   * 네 조건(성공 확정 · 실패 명확 · 성공+실패 = 요청 수 · 불명확 0건)을 모두 만족할 때만
   * canContinue가 true가 되고, 화면이 다음 묶음을 이어서 보냅니다.
   * 실패한 건은 여기서도 화면에서도 자동으로 다시 보내지 않습니다.
   */
  const classification = classifyCafe24Batch({
    requestCount: articles.length,
    confirmedIndexes: naverReviewIdByIndex
      .map((naverReviewId, index) => ({ naverReviewId, index }))
      .filter(({ naverReviewId }) => created.has(naverReviewId))
      .map(({ index }) => index),
    // 응답 본문을 읽지 못한 쓰기 요청은 adminApi가 unknown_result로 먼저 막습니다.
    responseReadable: true,
    attribution,
  });

  /**
   * 개발 환경에서만 채워지는 개별 사유. 우리가 보낸 값은 여기서 모두 지웁니다.
   * 운영 환경에서는 devRegisterErrorDetail()이 undefined를 돌려주므로 아무것도 남지 않습니다.
   */
  const devFailureByIndex = new Map<number, Cafe24ErrorDetail>();
  for (const [index, failure] of attribution.byIndex) {
    const safe = devRegisterErrorDetail(failure.detail, validated.reviews, articles);
    if (safe) devFailureByIndex.set(index, safe);
  }

  const devUnattributed: DevMultiStatusNote[] = [];
  for (const failure of attribution.unattributed) {
    const safe = devRegisterErrorDetail(failure.detail, validated.reviews, articles);
    if (safe) devUnattributed.push({ reportedIndex: failure.reportedIndex, detail: safe });
  }

  /**
   * 결과 목록.
   *
   *  - 성공        : 응답에서 등록이 확인된 건
   *  - 명시적 실패 : 카페24가 이 묶음에서 실패로 알려 준 건. 사유가 개별로 연결된 경우도 있고,
   *                 남은 수와 사유 수가 정확히 같아 실패임은 확정했지만 사유는 묶음 단위로만
   *                 알 수 있는 경우도 있습니다. (사유를 임의로 배정하지 않습니다)
   *  - 결과 불명확 : 성공도 실패도 확인하지 못한 건. 화면이 여기서 멈추고 재검사를 안내합니다.
   *
   * 위 구분은 buildCafe24BatchResults()가 하고, 여기서는 개발 전용 사유와 첨부 안내만 덧붙입니다.
   */
  const results: RegisterResultItem[] = [...failures];

  for (const base of buildCafe24BatchResults({
    naverReviewIdByIndex,
    articleNoByIndex: naverReviewIdByIndex.map(
      (naverReviewId) => created.get(naverReviewId) ?? null
    ),
    classification,
  })) {
    const devDetail = devFailureByIndex.get(base.requestIndex);
    const attachmentSkippedReason = attachmentNotes.get(base.naverReviewId);

    results.push({
      ...base,
      ...(devDetail ? { devDetail } : {}),
      ...(attachmentSkippedReason ? { attachmentSkippedReason } : {}),
    });
  }

  const registeredCount = classification.registeredIndexes.length;
  const failedCount = results.length - registeredCount;
  const unclearCount = classification.unclearIndexes.length;
  const explicitFailedCount = failedCount - unclearCount;

  if (failedCount > 0) {
    console.error(
      '[cafe24/register] 일부 등록 실패 status:',
      response.status,
      'batchStart:',
      readBatchStart(body) ?? '-',
      'requested:',
      validated.reviews.length,
      'registered:',
      registeredCount,
      'explicitFailed:',
      explicitFailedCount,
      'unclear:',
      unclearCount,
      'continue:',
      classification.canContinue ? 'yes' : `no (${classification.stopReason})`
    );

    logMultiStatusFailures(
      response.status,
      multiStatus.failures.length,
      devFailureByIndex,
      devUnattributed,
      attribution.indexBase
    );
  }

  /** 개발 환경에서 실패가 있었을 때만 화면에 넘깁니다. */
  const devMultiStatus: DevMultiStatusSummary | undefined =
    isCafe24DebugEnabled() && failedCount > 0
      ? {
          status: response.status,
          failureCount: multiStatus.failures.length,
          reasonsMissing: devFailureByIndex.size === 0 && devUnattributed.length === 0,
          unattributed: devUnattributed,
          /**
           * 사유를 개별 연결하지 못한 실패의 묶음 공통 사유.
           * 사유가 서로 다르면 null이고, 화면은 '개별 사유 연결 불가'로 표시합니다.
           */
          commonFailureDetail:
            classification.commonFailure === null
              ? null
              : (devRegisterErrorDetail(classification.commonFailure.detail, validated.reviews, articles) ??
                null),
          unlinkedFailedCount: classification.failedIndexesWithoutReason.length,
          reasonsUnlinkable: classification.reasonsUnlinkable,
        }
      : undefined;

  return jsonResponse({
    ok: true,
    boardNo,
    outcome: failedCount > 0 ? 'partial' : 'applied',
    results,
    registeredCount,
    failedCount,
    explicitFailedCount,
    unclearCount,
    unaccountedCount: classification.unaccountedCount,
    canContinue: classification.canContinue,
    ...(classification.stopReason ? { stopReason: classification.stopReason } : {}),
    ...(devMultiStatus ? { devMultiStatus } : {}),
  });
}
