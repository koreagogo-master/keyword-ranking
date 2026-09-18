import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import {
  CAFE24_CLIENT_IP_ERROR_STATUS,
  cafe24ClientIpErrorBody,
  cafe24ClientIpHeadersOf,
  describeCafe24ClientIpSources,
  resolveCafe24ClientIp,
} from '@/app/lib/cafe24/clientIp';
import { runDuplicateCheck } from '@/app/lib/cafe24/duplicateCheck';
import { isCafe24DebugEnabled } from '@/app/lib/cafe24/errorDetail';
import { CAFE24_NO_STORE_HEADERS, cafe24FailureResponse } from '@/app/lib/cafe24/failureResponse';
import {
  validateDuplicateCheckReviews,
  validateExpectedResults,
} from '@/app/lib/cafe24/registerRequest';
import { fetchExistingReviewRecords } from '@/app/lib/cafe24/reviews';
import { isSameOrigin } from '@/app/lib/cafe24/sameOrigin';
import type { RegisterBlockReason, RegisterBlockedItem } from '@/app/review-migration/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 등록 전 최종 확인 (읽기 전용).
 *
 * 게시판을 다시 읽어 같은 중복 판정 함수(runDuplicateCheck)를 그대로 돌린 뒤
 * 화면이 갖고 있던 이전 결과와 어긋나는 리뷰를 찾아냅니다.
 * 카페24에 POST·PUT·DELETE를 보내지 않고, Supabase에도 아무것도 쓰지 않습니다.
 *
 * 판정 기준·후보 검색 조건은 4단계 중복 검사와 완전히 같습니다. (같은 함수를 재사용합니다)
 * 등록에 필요한 공인 IPv4(client_ip)도 등록 라우트와 같은 함수로 미리 확인합니다.
 */

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: CAFE24_NO_STORE_HEADERS });
}

function badRequest(message: string, code: string) {
  return jsonResponse({ error: message, code, retryable: false }, 400);
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    console.error('[cafe24/register-precheck] 출처 검증 실패');
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

  const validated = validateDuplicateCheckReviews(body);
  if (!validated.ok) {
    console.error('[cafe24/register-precheck] 요청 검증 실패 code:', validated.code);
    return badRequest(validated.message, validated.code);
  }

  const expectedResults = validateExpectedResults(body);
  if (!expectedResults.ok) {
    console.error('[cafe24/register-precheck] 이전 결과 검증 실패 code:', expectedResults.code);
    return badRequest(expectedResults.message, expectedResults.code);
  }

  /**
   * 등록에 쓸 공인 IPv4를 여기서 미리 확인합니다.
   * 등록 라우트와 완전히 같은 resolveCafe24ClientIp()를 쓰므로,
   * 최종 확인을 통과했다면 client_ip 때문에 422가 나지 않습니다.
   * (시험 등록·전체 등록 모두 이 최종 확인을 지난 뒤에만 실행됩니다)
   */
  const ipHeaders = cafe24ClientIpHeadersOf(request.headers);
  const ipOverride = process.env.CAFE24_REVIEW_CLIENT_IP ?? null;

  if (!resolveCafe24ClientIp(ipHeaders, ipOverride).ok) {
    console.error(
      '[cafe24/register-precheck] 공인 IPv4 확인 실패 —',
      describeCafe24ClientIpSources(ipHeaders, ipOverride)
    );
    return jsonResponse(
      cafe24ClientIpErrorBody(isCafe24DebugEnabled()),
      CAFE24_CLIENT_IP_ERROR_STATUS
    );
  }

  const existing = await fetchExistingReviewRecords();
  if (!existing.ok) {
    return cafe24FailureResponse(existing, '리뷰 게시글 조회');
  }

  // 게시판을 끝까지 확인하지 못하면 이미 등록된 리뷰를 놓칠 수 있어 등록을 허용하지 않습니다.
  if (existing.truncated) {
    return jsonResponse(
      {
        error:
          '기존 카페24 리뷰를 끝까지 확인하지 못해 등록 전 점검을 완료할 수 없습니다. 게시판 글이 조회 상한(8,000건)을 넘었습니다. 관리자에게 문의해 주세요.',
        code: 'scan_truncated',
        retryable: false,
      },
      409
    );
  }

  const current = runDuplicateCheck(validated.reviews, existing.reviews);

  const allowedNaverReviewIds: string[] = [];
  const blocked: RegisterBlockedItem[] = [];

  const block = (naverReviewId: string, reason: RegisterBlockReason) => {
    blocked.push({ naverReviewId, reason });
  };

  for (const item of current) {
    const expected = expectedResults.expected.get(item.naverReviewId);

    // 이전 검사 결과에 없던 리뷰라면 입력 자체가 달라진 것이므로 등록하지 않습니다.
    if (!expected) {
      block(item.naverReviewId, 'evidence_changed');
      continue;
    }

    // 아직 판정하지 않은 '확인 필요'가 남아 있으면 등록 단계로 넘어갈 수 없습니다.
    if (expected.status === 'needs_review' && expected.adminDecision === null) {
      block(item.naverReviewId, 'undecided_needs_review');
      continue;
    }

    // 서버·관리자가 중복으로 확정한 리뷰는 등록 대상이 아닙니다. (막힌 것이 아니라 제외입니다)
    const isCandidate =
      expected.status === 'new' ||
      (expected.status === 'needs_review' && expected.adminDecision === 'new');

    if (!isCandidate) continue;

    // 리뷰글번호가 이미 게시판에 있으면 어떤 경우에도 등록하지 않습니다.
    if (item.status === 'duplicate') {
      block(item.naverReviewId, 'already_registered');
      continue;
    }

    if (expected.status === 'new') {
      // 처음 검사에서 신규였는데 지금은 후보가 생겼다면 관리자가 다시 판정해야 합니다.
      if (item.status !== 'new') {
        block(item.naverReviewId, 'became_needs_review');
        continue;
      }

      allowedNaverReviewIds.push(item.naverReviewId);
      continue;
    }

    // 관리자가 '신규 후보로 유지'한 리뷰는 재검사 결과가 같은 '확인 필요'일 때만 허용합니다.
    if (item.status !== 'needs_review') {
      block(item.naverReviewId, 'became_duplicate');
      continue;
    }

    // 판정 근거(대표 후보 게시글·후보 수)가 달라졌으면 관리자가 다시 확인해야 합니다.
    if (
      item.matchedCafe24ArticleNo !== expected.matchedCafe24ArticleNo ||
      item.candidateCount !== expected.candidateCount
    ) {
      block(item.naverReviewId, 'evidence_changed');
      continue;
    }

    allowedNaverReviewIds.push(item.naverReviewId);
  }

  // 이전 결과에는 있었지만 이번 요청에 없는 리뷰가 있으면 입력이 달라진 것입니다.
  const currentIds = new Set(current.map((item) => item.naverReviewId));
  for (const [naverReviewId] of expectedResults.expected) {
    if (!currentIds.has(naverReviewId)) block(naverReviewId, 'evidence_changed');
  }

  return jsonResponse({
    ok: true,
    boardNo: existing.boardNo,
    scannedArticleCount: existing.scannedArticleCount,
    checkedAt: new Date().toISOString(),
    allowedNaverReviewIds,
    blocked,
  });
}
