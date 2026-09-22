import { NextResponse } from 'next/server';
import {
  FEED_AUTH_CHALLENGE,
  resolveFeedCredentials,
  verifyFeedBasicAuth,
} from '@/app/lib/google-reviews/feedAuth';
import {
  buildFeedETag,
  evaluateConditionalRequest,
  toHttpDate,
} from '@/app/lib/google-reviews/feedHttp';
import { readCachedXml, writeCachedXml } from '@/app/lib/google-reviews/snapshotCache';
import { readLatestReadyMeta, readSnapshotXml } from '@/app/lib/google-reviews/snapshotStore';
import {
  SNAPSHOT_MISSING_RETRY_AFTER_SECONDS,
  resolveMaxAgeHours,
  snapshotAgeHours,
} from '@/app/lib/google-reviews/snapshotConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Google Merchant Center가 가져가는 상품평 피드 (읽기 전용).
 *
 *   https://tmgad.com/google-product-reviews.xml
 *
 * - 로그인 세션을 쓸 수 없는 경로라 HTTP Basic 인증으로 보호합니다.
 *   인증정보를 설정하지 않았으면 피드를 공개하지 않고 503으로 막습니다.
 * - 요청마다 카페24를 부르지 않고, 미리 만들어 둔 최신 정상 스냅샷을 그대로 돌려줍니다.
 *   카페24 게시판 전체를 읽으면 15초가 넘게 걸려 Google이나 배포 서버의 시간 제한에 걸립니다.
 * - **실시간 수집으로 폴백하지 않습니다.** 폴백하면 그 15초와 부분 수집 위험이 되살아납니다.
 *   스냅샷이 없으면 503으로 끊어 Google이 자기 쪽 직전 피드를 유지하게 합니다.
 * - **스냅샷이 오래됐다는 이유로 거부하지 않습니다.** 조금 오래된 리뷰를 주는 편이
 *   503을 줘서 Google이 아예 갱신하지 못하게 만드는 것보다 안전합니다. 경고 로그만 남깁니다.
 * - 운영용 응답에는 진단 주석을 넣지 않습니다. (관리자 미리보기에만 넣습니다)
 * - 로그에는 건수와 스냅샷 나이만 남깁니다. 리뷰 본문·작성자·인증정보는 남기지 않습니다.
 */

const LOG_LABEL = 'google-reviews/feed';

/**
 * 모든 응답에 붙이는 헤더.
 *
 * no-store가 아니라 no-cache입니다.
 * no-cache는 "캐시 금지"가 아니라 "쓰기 전에 반드시 재확인하라"는 뜻이라,
 * 오래된 리뷰가 나갈 위험 없이 ETag 기반 304를 쓸 수 있습니다.
 * Basic 인증 뒤의 응답이므로 private는 유지합니다.
 */
const FEED_HEADERS = {
  'Cache-Control': 'private, no-cache, must-revalidate',
  'X-Robots-Tag': 'noindex',
} as const;

function textResponse(body: string, status: number, headers: Record<string, string> = {}) {
  return new NextResponse(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...FEED_HEADERS,
      ...headers,
    },
  });
}

export async function GET(request: Request) {
  const credentials = resolveFeedCredentials();

  /**
   * 인증정보가 없으면 인증 요구 헤더도 보내지 않습니다.
   * 아직 쓸 수 없는 주소라는 뜻이지, 인증을 시도하라는 뜻이 아니기 때문입니다.
   */
  if (!credentials) {
    console.error(`[${LOG_LABEL}] 피드 인증정보가 설정되지 않아 응답하지 않았습니다.`);
    return textResponse('Feed is not configured.', 503);
  }

  if (!verifyFeedBasicAuth(request.headers.get('authorization'), credentials)) {
    // 어느 쪽이 틀렸는지, 어떤 값이 들어왔는지는 남기지 않습니다.
    console.error(`[${LOG_LABEL}] 인증 실패`);
    return textResponse('Authentication required.', 401, {
      'WWW-Authenticate': FEED_AUTH_CHALLENGE,
    });
  }

  /**
   * 1. 메타데이터만 읽습니다. (xml 컬럼 제외)
   *    886KB를 매 요청마다 끌어오지 않기 위한 것이고,
   *    조건부 요청이면 여기서 끝나 XML 조회 자체를 건너뜁니다.
   */
  const meta = await readLatestReadyMeta();

  if (!meta.ok) {
    console.error(`[${LOG_LABEL}] 스냅샷 조회 실패:`, meta.reason);
    return textResponse('Review feed is temporarily unavailable.', 503);
  }

  if (!meta.data) {
    console.error(`[${LOG_LABEL}] 제공할 스냅샷이 없습니다.`);
    return textResponse('Review feed is not ready yet.', 503, {
      'Retry-After': String(SNAPSHOT_MISSING_RETRY_AFTER_SECONDS),
    });
  }

  const snapshot = meta.data;

  // 오래된 스냅샷은 경고만 남기고 그대로 제공합니다.
  const ageHours = snapshotAgeHours(snapshot.generatedAt);
  const maxAgeHours = resolveMaxAgeHours();

  if (ageHours !== null && ageHours > maxAgeHours) {
    console.error(
      `[${LOG_LABEL}] 스냅샷이 오래되었습니다. age(h):`,
      Math.round(ageHours),
      'limit(h):',
      maxAgeHours
    );
  }

  const etag = buildFeedETag(snapshot.sha256);
  const lastModified = toHttpDate(snapshot.generatedAt);

  const validatorHeaders: Record<string, string> = {
    ETag: etag,
    'X-Feed-Generated-At': snapshot.generatedAt,
    ...(lastModified ? { 'Last-Modified': lastModified } : {}),
  };

  /**
   * 2. 조건부 요청 판정.
   *    If-None-Match를 우선하며, 있으면 If-Modified-Since는 보지 않습니다.
   */
  const conditional = evaluateConditionalRequest({
    ifNoneMatch: request.headers.get('if-none-match'),
    ifModifiedSince: request.headers.get('if-modified-since'),
    etag,
    generatedAt: snapshot.generatedAt,
  });

  if (conditional === 'not_modified') {
    return new NextResponse(null, {
      status: 304,
      headers: { ...FEED_HEADERS, ...validatorHeaders },
    });
  }

  /**
   * 3. XML 본문.
   *    메모리 캐시의 해시가 같으면 그대로 쓰고, 다르면 그때만 xml 컬럼을 읽습니다.
   */
  let xml = readCachedXml(snapshot.id, snapshot.sha256);

  if (xml === null) {
    const loaded = await readSnapshotXml(snapshot.id);

    if (!loaded.ok) {
      console.error(`[${LOG_LABEL}] 스냅샷 본문 조회 실패:`, loaded.reason);
      return textResponse('Review feed is temporarily unavailable.', 503);
    }

    if (loaded.data === null) {
      // 메타는 읽혔는데 본문이 없는 경우. 정리 작업이 최신 5개를 남기므로 정상적으로는 생기지 않습니다.
      console.error(`[${LOG_LABEL}] 스냅샷 본문이 비어 있습니다.`);
      return textResponse('Review feed is temporarily unavailable.', 503);
    }

    xml = loaded.data;
    writeCachedXml(snapshot.id, snapshot.sha256, xml);
  }

  console.log(
    `[${LOG_LABEL}] 스냅샷 제공 reviews:`,
    snapshot.reviewCount,
    'bytes:',
    snapshot.byteSize,
    'age(h):',
    ageHours === null ? '-' : Math.round(ageHours)
  );

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...FEED_HEADERS,
      ...validatorHeaders,
    },
  });
}
