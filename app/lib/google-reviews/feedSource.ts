import { resolveMallId, toShopNo } from '../cafe24/config';
import { getConnectionStatus } from '../cafe24/tokenStore';
import { fetchReviewExportRecords } from '../cafe24/reviewExport';
import type { Cafe24AdminFailure } from '../cafe24/adminApi';
import { buildGoogleReviewFeed, type BuildFeedResult } from './buildFeed';

/**
 * Google 상품평 피드 생성 공통 경로 (읽기 전용).
 *
 * 관리자 미리보기와 공개 피드가 같은 리뷰를 같은 규칙으로 내보내야 하므로
 * 몰 식별값 확인 → 게시판 수집 → XML 생성까지를 여기에 모아 두었습니다.
 * 두 라우트의 차이는 인증 방식과 진단 주석 포함 여부뿐입니다.
 *
 * 게시글을 만들거나 고치지 않습니다.
 * 로그에는 건수만 남기고 리뷰 본문·작성자는 남기지 않습니다.
 */

export type LoadGoogleReviewFeedResult =
  | {
      ok: true;
      feed: BuildFeedResult;
      boardNo: number;
      /** 게시판에서 훑은 글 수 (공지·답변글 포함) */
      scannedArticleCount: number;
      /** 피드 후보로 남은 상품 리뷰 원글 수 */
      candidateCount: number;
    }
  /** 환경변수 설정이 올바르지 않음 */
  | { ok: false; kind: 'config_error' }
  /** 연결 정보를 읽지 못함 */
  | { ok: false; kind: 'store_error' }
  /** 카페24를 아직 연결하지 않음 */
  | { ok: false; kind: 'not_connected' }
  /** 저장된 연결 정보를 쓸 수 없음 */
  | { ok: false; kind: 'reauth_required' }
  /** 게시판을 끝까지 읽지 못함 */
  | { ok: false; kind: 'incomplete_scan'; scannedArticleCount: number }
  /** 카페24 호출 실패 (그대로 응답으로 변환합니다) */
  | { ok: false; kind: 'cafe24'; failure: Cafe24AdminFailure };

export interface LoadGoogleReviewFeedOptions {
  /** true면 XML 맨 앞에 집계 요약을 주석으로 넣습니다. (관리자 미리보기 전용) */
  summaryComment: boolean;
  /** 로그 구분용 짧은 이름. 값은 고정 문자열만 넘깁니다. */
  logLabel: string;
}

/**
 * 카페24 게시판을 전부 읽어 Google 상품평 피드 XML을 만듭니다.
 *
 * 게시판을 끝까지 읽지 못하면 일부만 담긴 XML을 돌려주지 않고 incomplete_scan으로 끊습니다.
 * 일부만 담긴 피드를 올리면 Google이 빠진 리뷰를 삭제된 것으로 처리하기 때문입니다.
 */
export async function loadGoogleReviewFeed(
  options: LoadGoogleReviewFeedOptions
): Promise<LoadGoogleReviewFeedResult> {
  // SKU에 들어가는 mall_id는 환경변수의 고정값만 씁니다. 요청 값은 쓰지 않습니다.
  const mallId = resolveMallId();
  if (!mallId) {
    console.error(`[${options.logLabel}] 설정 오류: invalid_mall_id`);
    return { ok: false, kind: 'config_error' };
  }

  const connection = await getConnectionStatus(mallId);
  if (!connection.ok) {
    console.error(`[${options.logLabel}] 연결 정보 조회 실패:`, connection.reason);
    return { ok: false, kind: 'store_error' };
  }

  if (!connection.data) {
    return { ok: false, kind: 'not_connected' };
  }

  const shopNo = toShopNo(connection.data.shop_no);
  if (shopNo === null) {
    console.error(`[${options.logLabel}] 저장된 shop_no를 사용할 수 없습니다.`);
    return { ok: false, kind: 'reauth_required' };
  }

  const collected = await fetchReviewExportRecords();

  if (!collected.ok) {
    if (collected.kind === 'incomplete_scan') {
      return {
        ok: false,
        kind: 'incomplete_scan',
        scannedArticleCount: collected.scannedArticleCount,
      };
    }

    return { ok: false, kind: 'cafe24', failure: collected };
  }

  const feed = buildGoogleReviewFeed(collected.reviews, {
    identity: { mallId, shopNo, boardNo: collected.boardNo },
    summaryComment: options.summaryComment,
  });

  console.log(
    `[${options.logLabel}] boardNo:`,
    collected.boardNo,
    'scanned:',
    collected.scannedArticleCount,
    'candidates:',
    collected.reviews.length,
    'included:',
    feed.includedCount,
    'excluded:',
    feed.excludedCount
  );

  return {
    ok: true,
    feed,
    boardNo: collected.boardNo,
    scannedArticleCount: collected.scannedArticleCount,
    candidateCount: collected.reviews.length,
  };
}
