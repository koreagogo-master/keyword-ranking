import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import { CAFE24_NO_STORE_HEADERS } from '@/app/lib/cafe24/failureResponse';
import { isSameOrigin } from '@/app/lib/cafe24/sameOrigin';
import { refreshGoogleReviewFeedSnapshot } from '@/app/lib/google-reviews/refreshSnapshot';
import { SNAPSHOT_REJECT_LABELS, type SnapshotRejectReason } from '@/app/lib/google-reviews/snapshotValidate';
import type { SnapshotSource } from '@/app/lib/google-reviews/snapshotStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 관리자 수동 스냅샷 갱신.
 *
 * - 관리자만 호출할 수 있고 POST만 제공합니다. 공개 주소가 아닙니다.
 *   Cloud Scheduler가 쓰는 주소는 /api/google-reviews/snapshot/refresh입니다.
 * - 리뷰 업로드가 모두 성공한 직후 화면이 자동으로 부르는 경로이기도 합니다.
 *   그때는 trigger: 'after_upload'로 넘어옵니다.
 * - force는 이 경로에서만 유효합니다. 리뷰 수 급감 검사 하나만 건너뜁니다.
 *   (관리자가 리뷰를 의도적으로 대량 삭제한 경우를 위한 것입니다)
 * - 카페24 게시판을 읽기만 하고 게시글을 만들거나 고치지 않습니다.
 * - 응답과 로그에는 건수와 짧은 코드만 남깁니다.
 */

const LOG_LABEL = 'google-reviews/snapshot-manual';

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: CAFE24_NO_STORE_HEADERS });
}

/** 화면이 보낸 trigger를 허용값으로만 좁힙니다. 모르는 값은 수동으로 봅니다. */
function readSource(body: unknown): SnapshotSource {
  if (!body || typeof body !== 'object') return 'manual';

  const trigger = (body as Record<string, unknown>).trigger;

  return trigger === 'after_upload' ? 'after_upload' : 'manual';
}

function readForce(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;

  return (body as Record<string, unknown>).force === true;
}

/** 검증 거부 사유를 관리자에게 보여 줄 한국어 문장으로 바꿉니다. */
function describeFailure(errorKind: string): string {
  if (errorKind.startsWith('validate:')) {
    const reason = errorKind.slice('validate:'.length) as SnapshotRejectReason;
    const label = SNAPSHOT_REJECT_LABELS[reason];

    if (reason === 'suspicious_shrink') {
      return (
        `${label}. 기존 스냅샷을 그대로 두고 갱신하지 않았습니다. ` +
        '리뷰를 의도적으로 많이 삭제한 것이 맞다면 [검사 무시하고 갱신]으로 다시 실행해 주세요.'
      );
    }

    return label
      ? `${label}. 기존 스냅샷을 그대로 두고 갱신하지 않았습니다.`
      : '만들어진 XML이 검증을 통과하지 못해 갱신하지 않았습니다.';
  }

  if (errorKind === 'incomplete_scan') {
    return '게시판을 끝까지 읽지 못해 갱신하지 않았습니다. 일부만 담긴 피드는 Google에서 삭제된 리뷰로 처리될 수 있습니다.';
  }

  if (errorKind === 'not_connected') {
    return '카페24가 아직 연결되지 않았습니다. 먼저 카페24를 연결해 주세요.';
  }

  if (errorKind === 'reauth_required') {
    return '카페24 연결 정보를 확인할 수 없습니다. 연결을 해제한 뒤 다시 연결해 주세요.';
  }

  if (errorKind === 'config_error') {
    return '카페24 연동 설정이 올바르지 않습니다. 관리자에게 문의해 주세요.';
  }

  if (errorKind.startsWith('cafe24:')) {
    return '카페24에서 리뷰를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  return '스냅샷을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    console.error(`[${LOG_LABEL}] 출처 검증 실패`);
    return json({ error: '잘못된 요청입니다.', code: 'forbidden_origin' }, 403);
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return json({ error: admin.message, code: admin.code }, admin.status);
  }

  // 본문은 없어도 됩니다. (업로드 완료 후 호출은 keepalive로 보내므로 최소한만 담습니다)
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const result = await refreshGoogleReviewFeedSnapshot({
    source: readSource(body),
    force: readForce(body),
    createdBy: admin.userId,
  });

  if (!result.ok) {
    if (result.kind === 'locked') {
      return json(
        {
          error: '다른 갱신이 진행 중입니다. 잠시 후 다시 시도해 주세요.',
          code: 'locked',
          retryable: true,
        },
        409
      );
    }

    return json(
      {
        error: describeFailure(result.errorKind),
        code: result.errorKind,
        retryable: result.kind === 'store',
      },
      502
    );
  }

  return json(
    {
      ok: true,
      reviewCount: result.snapshot.reviewCount,
      excludedCount: result.snapshot.excludedCount,
      byteSize: result.snapshot.byteSize,
      generatedAt: result.snapshot.generatedAt,
    },
    200
  );
}
