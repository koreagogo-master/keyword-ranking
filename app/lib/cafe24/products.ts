import { CAFE24_PRODUCTS_MAX_PAGES, CAFE24_PRODUCTS_PAGE_LIMIT, resolveMallId } from './config';
import { callCafe24Admin, type Cafe24AdminFailure } from './adminApi';

/**
 * 카페24 상품 목록 수집기.
 *
 * 공식 문서 기준:
 *  - GET /api/v2/admin/products, limit 최대 100
 *  - 상품이 5,000개를 넘으면 offset으로는 조회할 수 없고 since_product_no를 써야 합니다.
 *  - since_product_no 사용 시 product_no·sort·order·offset은 함께 쓸 수 없습니다.
 *
 * 판매중지·미진열·품절 상품도 제외하지 않고 모두 가져옵니다.
 * 옵션·품목(variants)은 이번 단계에서 조회하지 않습니다.
 */

/**
 * 상품 매칭에 필요한 필드만 요청해 응답 크기를 줄입니다.
 *
 * 이미지 필드는 공식 Products property list의 목록·축소용 세 가지만 사용합니다.
 *  - list_image  : 목록이미지 (상품 분류·메인·검색 화면용)
 *  - small_image : 축소이미지
 *  - tiny_image  : 작은목록이미지
 * 상세이미지(detail_image)는 용량이 커서 썸네일로 쓰지 않습니다.
 */
const PRODUCT_FIELDS = [
  'product_no',
  'product_code',
  'custom_product_code',
  'product_name',
  'list_image',
  'small_image',
  'tiny_image',
  'display',
  'selling',
  'sold_out',
  'has_option',
  'updated_date',
] as const;

/**
 * 썸네일로 허용할 호스트.
 * 카페24가 내려준 값이라도 이 목록 밖의 호스트면 버립니다.
 * (외부에서 임의 호스트를 주입할 수 없게 하기 위한 화이트리스트입니다)
 */
const ALLOWED_IMAGE_HOST_SUFFIXES = ['.cafe24.com', '.cafe24img.com', '.cafe24cdn.com'] as const;

export interface Cafe24ProductSummary {
  productNo: number;
  productCode: string;
  customProductCode: string;
  productName: string;
  /** 목록·축소 이미지 절대 URL. 없거나 허용 호스트가 아니면 빈 문자열 */
  thumbnailUrl: string;
  /** 고정 mallId + productNo로 만든 상품 상세 페이지 주소 */
  productUrl: string;
  /** 진열상태 (display) */
  display: boolean;
  /** 판매상태 (selling) */
  selling: boolean;
  /** 품절여부 (sold_out) */
  soldOut: boolean;
  /** 옵션 사용여부 (has_option) */
  hasOption: boolean;
  updatedDate: string;
}

export type FetchProductsResult =
  | {
      ok: true;
      products: Cafe24ProductSummary[];
      /** 실제로 호출한 페이지 수 */
      pageCount: number;
      /** 안전장치에 걸려 중간에 멈췄는지 여부 */
      reachedPageLimit: boolean;
    }
  | Cafe24AdminFailure;

interface ProductsPayload {
  products?: unknown;
}

/** 카페24는 T/F 문자열로 내려주지만 방어적으로 boolean도 받아들입니다. */
function toFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return typeof value === 'string' && value.trim().toUpperCase() === 'T';
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function toProductNo(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'cafe24.com') return true;
  return ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * 카페24가 내려준 이미지 값을 안전한 절대 URL로 바꿉니다.
 *
 * - '//host/path'는 https를 붙입니다.
 * - '/path' 또는 'path'는 고정 mallId의 쇼핑몰 주소를 기준으로 붙입니다.
 * - 이미 절대 URL이면 호스트가 카페24 계열일 때만 받아들입니다.
 * 어느 조건도 만족하지 못하면 빈 문자열을 돌려주고 화면은 기본 아이콘을 씁니다.
 */
function toAbsoluteImageUrl(raw: unknown, mallId: string): string {
  const value = toText(raw).trim();
  if (!value) return '';

  const mallOrigin = `https://${mallId}.cafe24.com`;

  let candidate: string;
  if (value.startsWith('//')) {
    candidate = `https:${value}`;
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    // 스킴이 이미 붙어 있는 경우 (http:, https:, 그리고 javascript: 같은 위험한 값 포함)
    candidate = value;
  } else if (value.startsWith('/')) {
    candidate = `${mallOrigin}${value}`;
  } else {
    candidate = `${mallOrigin}/${value}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return '';
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
  if (!isAllowedImageHost(url.hostname)) return '';

  url.protocol = 'https:';
  return url.toString();
}

/** 상품 상세 페이지 주소. 사용자 입력이 아니라 고정 mallId와 productNo로만 만듭니다. */
function buildProductUrl(mallId: string, productNo: number): string {
  return `https://${mallId}.cafe24.com/product/detail.html?product_no=${productNo}`;
}

function toSummary(raw: unknown, mallId: string): Cafe24ProductSummary | null {
  if (!raw || typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const productNo = toProductNo(record.product_no);
  if (productNo === null) return null;

  // 목록 → 축소 → 작은목록 순으로 먼저 값이 있는 이미지를 씁니다.
  const thumbnailUrl =
    toAbsoluteImageUrl(record.list_image, mallId) ||
    toAbsoluteImageUrl(record.small_image, mallId) ||
    toAbsoluteImageUrl(record.tiny_image, mallId);

  return {
    productNo,
    productCode: toText(record.product_code),
    customProductCode: toText(record.custom_product_code),
    productName: toText(record.product_name),
    thumbnailUrl,
    productUrl: buildProductUrl(mallId, productNo),
    display: toFlag(record.display),
    selling: toFlag(record.selling),
    soldOut: toFlag(record.sold_out),
    hasOption: toFlag(record.has_option),
    updatedDate: toText(record.updated_date),
  };
}

/**
 * 상품 전체를 커서 방식으로 수집합니다.
 * 요청은 직렬로 보내고, 간격 제어는 adminApi의 레이트리밋 게이트가 담당합니다.
 */
export async function fetchAllProducts(): Promise<FetchProductsResult> {
  // 썸네일·상품 페이지 주소는 환경변수의 고정 mallId로만 만듭니다.
  const mallId = resolveMallId();
  if (!mallId) {
    console.error('[cafe24/products] 설정 오류: invalid_mall_id');
    return { ok: false, kind: 'config_error', retryable: false };
  }

  const products: Cafe24ProductSummary[] = [];
  const seen = new Set<number>();

  let cursor = 0;
  let pageCount = 0;
  let reachedPageLimit = false;

  while (pageCount < CAFE24_PRODUCTS_MAX_PAGES) {
    const page = await callCafe24Admin<ProductsPayload>({
      path: '/api/v2/admin/products',
      searchParams: {
        limit: String(CAFE24_PRODUCTS_PAGE_LIMIT),
        since_product_no: String(cursor),
        fields: PRODUCT_FIELDS.join(','),
      },
    });

    if (!page.ok) return page;

    pageCount += 1;

    const rawItems = Array.isArray(page.data.products) ? page.data.products : [];

    let maxProductNo = cursor;
    for (const raw of rawItems) {
      const summary = toSummary(raw, mallId);
      if (!summary) continue;

      if (!seen.has(summary.productNo)) {
        seen.add(summary.productNo);
        products.push(summary);
      }

      if (summary.productNo > maxProductNo) {
        maxProductNo = summary.productNo;
      }
    }

    // 마지막 페이지
    if (rawItems.length < CAFE24_PRODUCTS_PAGE_LIMIT) {
      return { ok: true, products, pageCount, reachedPageLimit: false };
    }

    // 커서가 전진하지 않으면 같은 페이지를 무한히 받게 되므로 중단합니다.
    if (maxProductNo <= cursor) {
      console.error('[cafe24/products] 커서가 전진하지 않아 수집을 중단합니다.');
      return { ok: true, products, pageCount, reachedPageLimit: true };
    }

    cursor = maxProductNo;

    if (pageCount >= CAFE24_PRODUCTS_MAX_PAGES) {
      reachedPageLimit = true;
    }
  }

  if (reachedPageLimit) {
    console.error('[cafe24/products] 최대 페이지 수에 도달해 수집을 중단합니다.');
  }

  return { ok: true, products, pageCount, reachedPageLimit };
}
