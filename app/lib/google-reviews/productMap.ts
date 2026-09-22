/**
 * Google 상품평 피드용 상품 식별정보 매핑 (순수 함수 모듈).
 *
 * 네트워크·DB를 쓰지 않으므로 네트워크 없이 그대로 검증할 수 있습니다.
 *
 * 여기서 만드는 주소는 카페24 기본 도메인(`{mallId}.cafe24.com`)이 아니라
 * 실제 고객이 보는 대표 도메인(commandomall.com)입니다.
 * 3단계 상품 매칭 화면이 쓰는 products.ts의 buildProductUrl()과는 용도가 다르므로
 * 그 함수를 건드리지 않고 이 모듈에서 따로 만듭니다.
 *
 * 브랜드·MPN은 확인된 상품만 적습니다. 확인되지 않은 상품에 값을 추측해서 넣지 않습니다.
 */

/** 고객이 보는 대표 도메인 */
export const COMMANDOMALL_ORIGIN = 'https://commandomall.com';

/** 피드의 publisher 이름 (대표 도메인과 같은 이름을 씁니다) */
export const FEED_PUBLISHER_NAME = 'commandomall';

/**
 * 리뷰 게시판 상세 주소의 게시판 이름 구간.
 *
 * `https://commandomall.com/article/상품리뷰/4/{article_no}/`의 `상품리뷰`를
 * 퍼센트 인코딩한 값입니다. (`%EC%83%81%ED%92%88%EB%A6%AC%EB%B7%B0`)
 */
export const REVIEW_BOARD_URL_SEGMENT = encodeURIComponent('상품리뷰');

/** 피드 전체에서 공통으로 쓰는 몰 식별값 */
export interface FeedIdentity {
  /** 환경변수의 고정 mall_id (예: tmgmall01) */
  mallId: string;
  /** 연결된 카페24 shop_no (예: 1) */
  shopNo: number;
  /** 리뷰 게시판 번호 (예: 4) */
  boardNo: number;
}

/** 상품 한 건의 추가 식별정보. 확인된 값만 채웁니다. */
export interface GoogleProductIdentity {
  brand?: string;
  mpn?: string;
}

/**
 * 카페24 상품번호 → 확인된 브랜드·MPN.
 *
 * 목록에 없는 상품은 SKU와 상품 주소만 내보냅니다.
 * 값을 추가할 때는 실제로 확인된 상품만 적습니다.
 */
const PRODUCT_IDENTITIES: Readonly<Record<number, GoogleProductIdentity>> = {
  35: { brand: '코만도빔', mpn: 'commandobeam2' },
};

/** 확인된 브랜드·MPN. 등록되지 않은 상품이면 빈 객체 */
export function resolveProductIdentity(productNo: number): GoogleProductIdentity {
  return PRODUCT_IDENTITIES[productNo] ?? {};
}

/** 리뷰 식별자. 네이버 리뷰글번호 유무와 무관하게 카페24 게시글번호로만 만듭니다. */
export function buildReviewId(boardNo: number, articleNo: number): string {
  return `cafe24-${boardNo}-${articleNo}`;
}

/** 리뷰 한 건의 상세 주소 (게시판 글 주소) */
export function buildReviewPageUrl(boardNo: number, articleNo: number): string {
  return `${COMMANDOMALL_ORIGIN}/article/${REVIEW_BOARD_URL_SEGMENT}/${boardNo}/${articleNo}/`;
}

/** 상품 상세 페이지 주소 */
export function buildProductPageUrl(productNo: number): string {
  return `${COMMANDOMALL_ORIGIN}/product/detail.html?product_no=${productNo}`;
}

/** 상품 SKU. 몰·샵·상품번호를 묶어 다른 채널과 겹치지 않게 만듭니다. */
export function buildSku(identity: FeedIdentity, productNo: number): string {
  return `cafe24_${identity.mallId}_${identity.shopNo}_${productNo}`;
}
