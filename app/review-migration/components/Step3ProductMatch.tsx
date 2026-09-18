'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildProductMatch, searchProducts } from '@/app/lib/matching/productName';
import { buildSmartstoreProductUrl } from './SmartstoreAddress';
import type {
  Cafe24Product,
  Cafe24ProductsFailure,
  Cafe24ProductsSuccess,
  NaverProductGroup,
  ProductMatch,
  ProductMatchEntry,
} from '../types';

/**
 * 3단계. 네이버 상품 ↔ 카페24 상품 매칭.
 *
 * - 썸네일과 상품 페이지 링크로 눈으로 확인하고,
 *   연결은 URL 문자열이 아니라 카페24 productNo로 저장합니다.
 * - 자동 추천은 'suggested'까지만이고, 확정은 관리자가 직접 눌러야 합니다.
 */

const STORAGE_VERSION = 1;
const SEARCH_RESULT_LIMIT = 20;

const PRODUCT_ERROR_MESSAGES: Record<string, string> = {
  not_connected: '카페24 연결이 필요합니다.',
  reauth_required: '카페24 재연결이 필요합니다.',
  network_error: '네트워크 오류가 발생했습니다.',
  rate_limited: '잠시 후 다시 시도해 주세요.',
  cafe24_unavailable: '카페24 서비스가 일시적으로 응답하지 않습니다.',
};

const DEFAULT_ERROR_MESSAGE = '상품을 불러오지 못했습니다.';

export interface ProductMatchSummary {
  /** 네이버 상품 수 */
  total: number;
  confirmed: number;
  skipped: number;
  /** 아직 확정도 건너뛰기도 하지 않은 수 */
  unresolved: number;
  /** 모든 상품이 확정 또는 건너뜀 */
  completed: boolean;
}

interface Step3ProductMatchProps {
  groups: NaverProductGroup[];
  /** 연결된 쇼핑몰 ID. sessionStorage 키에 포함합니다. */
  mallId: string;
  /**
   * 상단에서 확정한 스마트스토어 기본 주소. 미확정이면 빈 문자열입니다.
   * 입력·확정 영역은 페이지 상단에 있고, 여기서는 상품번호 링크를 만들 때만 씁니다.
   */
  smartstoreUrl: string;
  onSummaryChange?: (summary: ProductMatchSummary) => void;
  /**
   * 관리자가 판단을 끝낸 매칭 결과(confirmed·skipped)만 부모에게 올려 줍니다.
   * 4단계 중복 검사가 어떤 리뷰를 어느 카페24 상품으로 보낼지 정하는 데 씁니다.
   * 추천(suggested)·미확정(unmatched)은 올리지 않습니다.
   */
  onMatchesChange?: (entries: ProductMatchEntry[]) => void;
}

// ── sessionStorage ──────────────────────────────────────────────

interface StoredEntry {
  naverProductNo: string;
  cafe24ProductNo: number | null;
  status: 'confirmed' | 'skipped';
}

interface StoredPayload {
  version: number;
  mallId: string;
  entries: StoredEntry[];
}

function storageKey(mallId: string): string {
  return `review-migration:product-match:v${STORAGE_VERSION}:${mallId || 'unknown'}`;
}

function readStoredEntries(mallId: string): Map<string, StoredEntry> {
  const restored = new Map<string, StoredEntry>();
  if (typeof window === 'undefined') return restored;

  try {
    const raw = window.sessionStorage.getItem(storageKey(mallId));
    if (!raw) return restored;

    const parsed = JSON.parse(raw) as StoredPayload;
    if (parsed.version !== STORAGE_VERSION || parsed.mallId !== mallId) return restored;
    if (!Array.isArray(parsed.entries)) return restored;

    for (const entry of parsed.entries) {
      if (typeof entry?.naverProductNo !== 'string') continue;
      if (entry.status !== 'confirmed' && entry.status !== 'skipped') continue;
      restored.set(entry.naverProductNo, entry);
    }
  } catch {
    // 저장 값이 깨졌으면 복원하지 않고 새로 시작합니다.
  }

  return restored;
}

function clearStoredEntries(mallId: string) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(storageKey(mallId));
  } catch {
    // 지우지 못해도 화면 동작은 그대로 이어 갑니다.
  }
}

function writeStoredEntries(mallId: string, matches: Record<string, ProductMatch>) {
  if (typeof window === 'undefined') return;

  const entries: StoredEntry[] = Object.values(matches)
    .filter((match) => match.status === 'confirmed' || match.status === 'skipped')
    .map((match) => ({
      naverProductNo: match.naverProductNo,
      cafe24ProductNo: match.status === 'confirmed' ? match.cafe24ProductNo : null,
      status: match.status === 'confirmed' ? 'confirmed' : 'skipped',
    }));

  // 확정·건너뜀이 하나도 없으면 빈 기록을 남기지 않고 키를 지웁니다.
  if (entries.length === 0) {
    clearStoredEntries(mallId);
    return;
  }

  const payload: StoredPayload = { version: STORAGE_VERSION, mallId, entries };

  try {
    window.sessionStorage.setItem(storageKey(mallId), JSON.stringify(payload));
  } catch {
    // 저장 공간이 부족해도 화면 동작은 그대로 이어 갑니다.
  }
}

/**
 * 저장값 중 지금 엑셀과 지금 불러온 상품 목록에 실제로 적용할 수 있는 항목만 추립니다.
 *
 *  - 현재 엑셀에 없는 네이버 상품번호는 버립니다.
 *  - confirmed는 카페24 상품번호가 현재 상품 목록에 실제로 있어야 합니다.
 *  - skipped는 현재 엑셀에 해당 네이버 상품번호가 있을 때만 남깁니다.
 */
function collectValidStoredEntries(
  stored: Map<string, StoredEntry>,
  groups: NaverProductGroup[],
  products: Cafe24Product[]
): Map<string, StoredEntry> {
  const groupNos = new Set(groups.map((group) => group.naverProductNo));
  const availableNos = new Set(products.map((product) => product.productNo));
  const valid = new Map<string, StoredEntry>();

  for (const [naverProductNo, entry] of stored) {
    if (!groupNos.has(naverProductNo)) continue;

    if (entry.status === 'skipped') {
      valid.set(naverProductNo, { naverProductNo, cafe24ProductNo: null, status: 'skipped' });
      continue;
    }

    const cafe24ProductNo = entry.cafe24ProductNo;
    if (typeof cafe24ProductNo !== 'number' || !Number.isInteger(cafe24ProductNo)) continue;
    if (!availableNos.has(cafe24ProductNo)) continue;

    valid.set(naverProductNo, { naverProductNo, cafe24ProductNo, status: 'confirmed' });
  }

  return valid;
}

// ── 작은 표시용 조각들 ──────────────────────────────────────────

function DefaultProductIcon({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-gray-100 border border-gray-200 rounded-md text-gray-300 ${className}`}
      aria-hidden="true"
    >
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 9.75h.008v.008H18V9.75zM3.75 20.25h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v13.5a1.5 1.5 0 001.5 1.5z"
        />
      </svg>
    </div>
  );
}

function Thumbnail({ src, alt, size = 'w-16 h-16' }: { src: string; alt: string; size?: string }) {
  // 실패한 주소 자체를 기억해 두면 src가 바뀔 때 별도 초기화가 필요 없습니다.
  const [failedSrc, setFailedSrc] = useState('');

  if (!src || failedSrc === src) {
    return <DefaultProductIcon className={`${size} shrink-0`} />;
  }

  return (
    // 카페24 CDN 호스트가 상품마다 달라 next/image 대신 img를 사용합니다.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={`${size} shrink-0 object-cover rounded-md border border-gray-200 bg-white`}
    />
  );
}

function Pill({ tone, children }: { tone: 'gray' | 'red' | 'amber' | 'emerald' | 'violet'; children: React.ReactNode }) {
  const toneClass = {
    gray: 'bg-gray-100 text-gray-600',
    red: 'bg-red-100 text-red-600',
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    violet: 'bg-[#5244e8]/10 text-[#5244e8]',
  }[tone];

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${toneClass}`}>
      {children}
    </span>
  );
}

/**
 * 새 창으로 열리는 상품 링크 스타일.
 * 눌러도 되는 글자임을 알 수 있도록 평소에도 연한 밑줄을 두고,
 * 마우스를 올리면 글자색과 밑줄이 함께 진해집니다.
 */
const LINK_CLASS =
  'font-bold !text-[#5244e8] underline underline-offset-2 decoration-1 decoration-[#5244e8]/40 ' +
  'hover:!text-[#3a2fd0] hover:decoration-[#3a2fd0] transition-colors';

/** 한 줄 정보 사이의 구분자. 공간이 부족하면 이 지점에서 줄바꿈됩니다. */
function Divider() {
  return (
    <span className="text-gray-300" aria-hidden="true">
      /
    </span>
  );
}

/**
 * 카페24 상품 정보를 한 줄로 보여 줍니다.
 * 예) 상품번호 35 / 상품코드 P00000BJ / 판매중 / 진열중
 * 상품코드 자체가 상품 상세 페이지 링크입니다. (별도의 '상품 페이지 보기' 문구는 없습니다)
 */
function ProductInfo({ product }: { product: Cafe24Product }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-bold text-gray-800 leading-snug break-words">
        {product.productName || '(상품명 없음)'}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-gray-500">
        <span className="whitespace-nowrap">
          상품번호 <b className="text-gray-700">{product.productNo}</b>
        </span>

        {product.productCode && (
          <>
            <Divider />
            <span className="whitespace-nowrap">
              상품코드{' '}
              <a
                href={product.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLASS}
              >
                {product.productCode}
              </a>
            </span>
          </>
        )}

        <Divider />
        <span className={`font-bold whitespace-nowrap ${product.selling ? 'text-emerald-600' : 'text-red-500'}`}>
          {product.selling ? '판매중' : '판매중지'}
        </span>

        <Divider />
        <span className={`font-bold whitespace-nowrap ${product.display ? 'text-gray-600' : 'text-amber-600'}`}>
          {product.display ? '진열중' : '미진열'}
        </span>

        {product.soldOut && (
          <>
            <Divider />
            <span className="font-bold text-amber-600 whitespace-nowrap">품절</span>
          </>
        )}

        {product.hasOption && (
          <>
            <Divider />
            <span className="font-bold text-[#5244e8] whitespace-nowrap">옵션 있음</span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 네이버 상품 정보. 이미지 정보가 없으므로 빈 이미지 영역 없이 글자만 보여 줍니다.
 * 예) 상품번호 2839654108 / 리뷰 6건
 * 스마트스토어 주소가 확정된 경우에만 상품번호가 링크가 됩니다.
 */
function NaverProductInfo({
  group,
  smartstoreUrl,
}: {
  group: NaverProductGroup;
  smartstoreUrl: string;
}) {
  const productUrl = buildSmartstoreProductUrl(smartstoreUrl, group.naverProductNo);

  return (
    <div className="min-w-0">
      <p className="text-[13px] font-bold text-gray-800 leading-snug break-words">
        {group.productName || '(상품명 없음)'}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-gray-500">
        <span className="whitespace-nowrap">
          상품번호{' '}
          {productUrl ? (
            <a
              href={productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              {group.naverProductNo}
            </a>
          ) : (
            <b className="text-gray-700">{group.naverProductNo || '없음'}</b>
          )}
        </span>

        <Divider />
        <span className="whitespace-nowrap">
          리뷰 <b className="text-[#5244e8]">{group.reviewCount.toLocaleString()}</b>건
        </span>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, tone = 'default' }: { label: string; value: number | string; tone?: 'default' | 'warn' | 'good' }) {
  const valueClass =
    tone === 'warn' ? 'text-amber-600' : tone === 'good' ? 'text-emerald-600' : 'text-[#5244e8]';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
      <p className="text-[11px] font-bold text-gray-500 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

// ── 본체 ────────────────────────────────────────────────────────

export default function Step3ProductMatch({
  groups,
  mallId,
  smartstoreUrl,
  onSummaryChange,
  onMatchesChange,
}: Step3ProductMatchProps) {
  const [products, setProducts] = useState<Cafe24Product[]>([]);
  const [fetchedAt, setFetchedAt] = useState('');
  const [productsTruncated, setProductsTruncated] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [matches, setMatches] = useState<Record<string, ProductMatch>>({});

  const [showUnresolvedOnly, setShowUnresolvedOnly] = useState(false);
  /** 같은 카페24 상품에 연결된 네이버 상품만 모아 보는 중인지 */
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [nameKeyword, setNameKeyword] = useState('');

  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pickerKeyword, setPickerKeyword] = useState('');

  /**
   * 확정된 카드에서 추천 후보를 펼쳐 둔 네이버 상품번호.
   * 보기만 하는 UI 상태라서 matches에 넣지 않습니다. 이 값이 바뀌어도 매칭은 그대로입니다.
   */
  const [candidatesFor, setCandidatesFor] = useState<string | null>(null);

  /**
   * 저장된 매칭을 어떻게 할지에 대한 UI 전용 결정 상태.
   *  - pending  : 쓸 수 있는 저장값을 찾았고 아직 관리자가 고르지 않음 (이 동안 저장 금지)
   *  - restored : 저장값을 불러오기로 함
   *  - fresh    : 저장값을 버리고 새로 매칭하기로 함
   *  - none     : 적용할 유효한 저장값이 없음
   */
  const [restoreDecision, setRestoreDecision] = useState<'pending' | 'restored' | 'fresh' | 'none'>(
    'none'
  );
  /** pending 동안 들고 있는 유효한 저장값. 고르기 전에는 matches에 넣지 않습니다. */
  const [savedEntries, setSavedEntries] = useState<Map<string, StoredEntry>>(new Map());
  /** 저장값에서 복원된 네이버 상품번호. '저장된 매칭' 표시에만 씁니다. */
  const [restoredProductNos, setRestoredProductNos] = useState<Set<string>>(new Set());

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/review-migration/cafe24/products', { cache: 'no-store' });
      const data = (await res.json()) as Cafe24ProductsSuccess | Cafe24ProductsFailure;

      if (!res.ok) {
        const failure = data as Cafe24ProductsFailure;
        setErrorMessage(
          PRODUCT_ERROR_MESSAGES[failure.code ?? ''] ?? failure.error ?? DEFAULT_ERROR_MESSAGE
        );
        return;
      }

      const success = data as Cafe24ProductsSuccess;
      setProducts(Array.isArray(success.products) ? success.products : []);
      setFetchedAt(success.fetchedAt ?? '');
      setProductsTruncated(Boolean(success.truncated));
    } catch {
      setErrorMessage(PRODUCT_ERROR_MESSAGES.network_error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 상품 목록이나 엑셀 그룹이 바뀌면 추천을 다시 계산합니다.
   *
   * 저장값은 읽기만 하고 matches에는 절대 넣지 않습니다.
   * 모든 네이버 상품은 추천이 있으면 suggested, 없으면 unmatched로 시작하므로
   * 이 시점의 확정·건너뜀은 항상 0입니다. 적용 여부는 관리자가 직접 고릅니다.
   *
   * 새 엑셀을 검사하면 groups가 새 배열로 바뀌므로, 같은 상품번호가 들어 있는
   * 다른 파일에서도 이 판단을 처음부터 다시 합니다.
   */
  useEffect(() => {
    if (products.length === 0) {
      setMatches({});
      setSavedEntries(new Map());
      setRestoredProductNos(new Set());
      setRestoreDecision('none');
      return;
    }

    const next: Record<string, ProductMatch> = {};
    for (const group of groups) {
      next[group.naverProductNo] = buildProductMatch(group, products);
    }

    const valid = collectValidStoredEntries(readStoredEntries(mallId), groups, products);

    setMatches(next);
    setRestoredProductNos(new Set());
    setSavedEntries(valid);
    setRestoreDecision(valid.size > 0 ? 'pending' : 'none');
  }, [groups, products, mallId]);

  /**
   * 확정·건너뜀 상태만 세션에 저장합니다.
   *
   * 관리자가 저장값 적용 여부를 고르기 전(pending)에는 쓰지 않습니다.
   * 이때 저장하면 아직 아무것도 확정하지 않은 상태가 기존 저장값을 덮어써 버립니다.
   */
  useEffect(() => {
    if (products.length === 0) return;
    if (restoreDecision === 'pending') return;
    writeStoredEntries(mallId, matches);
  }, [matches, mallId, products.length, restoreDecision]);

  const productByNo = useMemo(
    () => new Map(products.map((product) => [product.productNo, product])),
    [products]
  );

  const summary = useMemo<ProductMatchSummary>(() => {
    let confirmed = 0;
    let skipped = 0;

    for (const group of groups) {
      const status = matches[group.naverProductNo]?.status;
      if (status === 'confirmed') confirmed += 1;
      else if (status === 'skipped') skipped += 1;
    }

    const total = groups.length;
    const unresolved = total - confirmed - skipped;

    return {
      total,
      confirmed,
      skipped,
      unresolved,
      completed: total > 0 && unresolved === 0,
    };
  }, [groups, matches]);

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [summary, onSummaryChange]);

  /**
   * 4단계로 넘길 최소 매칭 결과.
   * 매칭이 조금이라도 바뀌면 새 배열이 만들어지므로, 부모는 이 값이 바뀌는 것만 보고
   * 이전 중복 검사 결과를 무효화할 수 있습니다.
   */
  const matchEntries = useMemo<ProductMatchEntry[]>(() => {
    const entries: ProductMatchEntry[] = [];

    for (const group of groups) {
      const match = matches[group.naverProductNo];
      if (!match) continue;

      if (match.status === 'confirmed' && match.cafe24ProductNo !== null) {
        entries.push({
          naverProductNo: group.naverProductNo,
          cafe24ProductNo: match.cafe24ProductNo,
          status: 'confirmed',
        });
      } else if (match.status === 'skipped') {
        entries.push({
          naverProductNo: group.naverProductNo,
          cafe24ProductNo: null,
          status: 'skipped',
        });
      }
    }

    return entries;
  }, [groups, matches]);

  useEffect(() => {
    onMatchesChange?.(matchEntries);
  }, [matchEntries, onMatchesChange]);

  /** 같은 카페24 상품에 두 개 이상의 네이버 상품이 확정된 경우 */
  const duplicateProductNos = useMemo(() => {
    const counter = new Map<number, number>();

    for (const match of Object.values(matches)) {
      if (match.status !== 'confirmed' || match.cafe24ProductNo === null) continue;
      counter.set(match.cafe24ProductNo, (counter.get(match.cafe24ProductNo) ?? 0) + 1);
    }

    return new Set([...counter.entries()].filter(([, count]) => count > 1).map(([no]) => no));
  }, [matches]);

  /** 경고 문구에 그대로 넣을 중복 상품번호. 보기 편하도록 오름차순입니다. */
  const duplicateProductNoList = useMemo(
    () => [...duplicateProductNos].sort((a, b) => a - b),
    [duplicateProductNos]
  );

  // 매칭을 고쳐 중복이 모두 풀리면 중복만 보기 상태도 스스로 끝냅니다.
  useEffect(() => {
    if (duplicateProductNos.size === 0) setShowDuplicatesOnly(false);
  }, [duplicateProductNos]);

  const visibleGroups = useMemo(() => {
    const keyword = nameKeyword.trim().toLowerCase();

    return groups.filter((group) => {
      const match = matches[group.naverProductNo];
      const status = match?.status;

      // 중복만 보기는 미확정만 보기와 함께 쓰지 않습니다. (둘을 겹치면 항상 빈 목록이 됩니다)
      if (showDuplicatesOnly) {
        const isDuplicate =
          status === 'confirmed' &&
          match?.cafe24ProductNo != null &&
          duplicateProductNos.has(match.cafe24ProductNo);
        if (!isDuplicate) return false;
      } else if (showUnresolvedOnly && (status === 'confirmed' || status === 'skipped')) {
        return false;
      }

      if (keyword) {
        const haystack = `${group.productName} ${group.naverProductNo}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }

      return true;
    });
  }, [groups, matches, showUnresolvedOnly, showDuplicatesOnly, duplicateProductNos, nameKeyword]);

  const updateMatch = useCallback((naverProductNo: string, patch: Partial<ProductMatch>) => {
    setMatches((prev) => {
      const current = prev[naverProductNo];
      if (!current) return prev;
      return { ...prev, [naverProductNo]: { ...current, ...patch } };
    });

    // 관리자가 직접 바꾼 항목은 더 이상 '저장된 매칭'이 아닙니다.
    setRestoredProductNos((prev) => {
      if (!prev.has(naverProductNo)) return prev;
      const next = new Set(prev);
      next.delete(naverProductNo);
      return next;
    });

    // 안내를 그냥 두고 직접 매칭을 시작했다면 새로 매칭하는 것으로 봅니다.
    // (그대로 pending으로 두면 이후 작업이 저장되지 않습니다)
    setRestoreDecision((prev) => (prev === 'pending' ? 'fresh' : prev));
  }, []);

  /** 저장값을 지금 매칭에 적용합니다. 적용 직전에 유효성을 한 번 더 확인합니다. */
  const restoreSavedMatches = () => {
    const valid = collectValidStoredEntries(savedEntries, groups, products);

    setMatches((prev) => {
      const next = { ...prev };

      for (const [naverProductNo, entry] of valid) {
        const current = next[naverProductNo];
        if (!current) continue;

        next[naverProductNo] =
          entry.status === 'skipped'
            ? { ...current, status: 'skipped', cafe24ProductNo: null }
            : { ...current, status: 'confirmed', cafe24ProductNo: entry.cafe24ProductNo };
      }

      return next;
    });

    setRestoredProductNos(new Set(valid.keys()));
    setRestoreDecision('restored');
  };

  /** 저장값을 버리고 처음부터 매칭합니다. matches는 이미 추천 상태이므로 그대로 둡니다. */
  const startFreshMatching = () => {
    clearStoredEntries(mallId);
    setSavedEntries(new Map());
    setRestoredProductNos(new Set());
    setRestoreDecision('fresh');
  };

  /** 매칭은 이 함수로만 바뀝니다. 후보를 펼쳐 보거나 검색창을 여는 것만으로는 바뀌지 않습니다. */
  const confirmProduct = (naverProductNo: string, cafe24ProductNo: number) => {
    updateMatch(naverProductNo, { status: 'confirmed', cafe24ProductNo });
    setPickerFor(null);
    setPickerKeyword('');
    setCandidatesFor(null);
  };

  const skipProduct = (naverProductNo: string) => {
    updateMatch(naverProductNo, { status: 'skipped', cafe24ProductNo: null });
    setPickerFor(null);
    setCandidatesFor(null);
  };

  /**
   * 매칭 취소. 확인창에서 동의한 경우에만 확정을 풉니다.
   *
   * 확정이 풀리면 matches가 바뀌므로 sessionStorage 기록도 다시 쓰이고(확정·건너뜀만 저장),
   * onMatchesChange로 올라가는 목록에서도 빠져 4단계 중복 검사 결과가 무효화됩니다.
   * 중복 경고와 중복 상품 보기 상태도 같은 matches를 보고 있어 함께 갱신됩니다.
   */
  const cancelMatch = (naverProductNo: string) => {
    if (!window.confirm('현재 상품 매칭을 취소하시겠습니까?')) return;

    const match = matches[naverProductNo];
    updateMatch(naverProductNo, {
      status: (match?.candidates.length ?? 0) > 0 ? 'suggested' : 'unmatched',
      cafe24ProductNo: null,
    });
    setCandidatesFor(null);
  };

  const openPicker = (naverProductNo: string) => {
    setPickerFor((prev) => (prev === naverProductNo ? null : naverProductNo));
    setPickerKeyword('');
    // 큰 패널 두 개가 동시에 열리지 않도록 후보 목록은 접어 둡니다. (매칭은 그대로입니다)
    setCandidatesFor(null);
  };

  /** 추천 후보 펼치기·접기. UI만 바뀌고 확정 상태는 건드리지 않습니다. */
  const toggleCandidates = (naverProductNo: string) => {
    setCandidatesFor((prev) => (prev === naverProductNo ? null : naverProductNo));
    setPickerFor(null);
  };

  const pickerResults = useMemo(() => {
    if (!pickerFor) return [];
    return searchProducts(products, pickerKeyword).slice(0, SEARCH_RESULT_LIMIT);
  }, [pickerFor, pickerKeyword, products]);

  const hasLoaded = products.length > 0;

  return (
    <section className="mb-8">
      <h2 className="text-[15px] font-bold text-gray-900 mb-1">3단계. 상품 매칭</h2>
      <p className="text-[13px] text-gray-500 mb-4 leading-relaxed">
        네이버 상품과 카페24 상품을 연결합니다. 썸네일과 상품 페이지로 직접 확인한 뒤
        <b className="text-gray-700"> 확정 버튼</b>을 눌러야 연결됩니다. 자동으로 확정되는 경우는 없습니다.
      </p>

      {/* 상단 도구 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => void loadProducts()}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 h-[46px] bg-[#5244e8] hover:bg-blue-700 !text-white font-bold text-sm rounded-md transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isLoading ? '불러오는 중...' : hasLoaded ? '카페24 상품 다시 불러오기' : '카페24 상품 불러오기'}
          </button>

          <p className="text-[12px] text-gray-400 leading-relaxed">
            마지막 조회:{' '}
            <b className="text-gray-600">
              {fetchedAt ? new Date(fetchedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
            </b>
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <SummaryTile label="불러온 카페24 상품" value={products.length} />
          <SummaryTile label="네이버 상품 수" value={summary.total} />
          <SummaryTile label="확정" value={summary.confirmed} tone="good" />
          <SummaryTile label="미확정" value={summary.unresolved} tone={summary.unresolved > 0 ? 'warn' : 'good'} />
          <SummaryTile label="건너뜀" value={summary.skipped} />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
          <label className="flex items-center gap-2 text-[13px] font-bold text-gray-600 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showUnresolvedOnly}
              onChange={(e) => {
                setShowUnresolvedOnly(e.target.checked);
                // 두 필터를 겹치면 항상 빈 목록이 되므로 중복만 보기를 먼저 끕니다.
                if (e.target.checked) setShowDuplicatesOnly(false);
              }}
              className="w-4 h-4 accent-[#5244e8]"
            />
            미확정만 보기
          </label>

          <input
            type="search"
            value={nameKeyword}
            onChange={(e) => setNameKeyword(e.target.value)}
            placeholder="네이버 상품명 또는 상품번호 검색"
            className="w-full sm:max-w-xs px-3 h-[40px] border-2 border-gray-300 rounded-md text-[13px] font-bold text-gray-700 focus:border-[#5244e8] focus:outline-none"
          />

          <span className="text-[13px] font-bold text-gray-500 whitespace-nowrap">
            {visibleGroups.length.toLocaleString()}개 표시 중
            {showDuplicatesOnly && <b className="text-red-600"> (중복 연결만)</b>}
          </span>
        </div>
      </div>

      {/*
        저장된 매칭 안내.
        고르기 전까지는 matches에 아무것도 적용하지 않고 기존 저장값도 건드리지 않습니다.
      */}
      {restoreDecision === 'pending' && savedEntries.size > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-[#F6F7FF] border border-[#E3E5FF] rounded-lg px-4 py-3">
          <p className="text-[13px] font-bold text-gray-700 leading-relaxed flex-1">
            이전에 저장된 상품 매칭 {savedEntries.size.toLocaleString()}개가 있습니다. 현재 엑셀에 적용할지
            선택해 주세요.
          </p>

          <div className="shrink-0 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={restoreSavedMatches}
              className="px-4 py-2 bg-[#5244e8] hover:bg-blue-700 !text-white font-bold text-[13px] rounded-md transition-colors shadow-sm"
            >
              저장된 매칭 불러오기
            </button>
            <button
              type="button"
              onClick={startFreshMatching}
              className="px-4 py-2 !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[13px] rounded-md transition-colors shadow-sm"
            >
              새로 매칭
            </button>
          </div>
        </div>
      )}

      {/* 안내·경고 */}
      {productsTruncated && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-[13px] font-bold text-amber-700 leading-relaxed">
            카페24 상품이 너무 많아 일부만 불러왔습니다. 추천 목록에 없는 상품은 직접 선택으로도 찾지 못할 수
            있습니다.
          </p>
        </div>
      )}

      {/*
        같은 카페24 상품에 여러 네이버 상품을 연결하는 것이 의도된 경우도 있으므로
        진행을 막지 않고 경고만 유지합니다. 대신 해당 카드만 바로 찾아볼 수 있게 해 둡니다.
      */}
      {duplicateProductNos.size > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-[13px] font-bold text-red-600 leading-relaxed flex-1">
            같은 카페24 상품에 여러 네이버 상품이 연결되어 있습니다. 같은 상품이라면 그대로 진행하세요. 잘못
            연결됐다면 [다른 상품 선택]으로 변경하거나 [매칭 취소]로 해제하세요. (카페24 상품번호:{' '}
            {duplicateProductNoList.join(', ')})
          </p>

          <button
            type="button"
            onClick={() => {
              // 중복 카드는 모두 확정 상태라 '미확정만 보기'와 함께 켜면 아무것도 보이지 않습니다.
              if (!showDuplicatesOnly) setShowUnresolvedOnly(false);
              setShowDuplicatesOnly((prev) => !prev);
            }}
            className="shrink-0 px-4 py-2 !bg-white hover:!bg-gray-100 border-2 border-red-300 !text-red-600 font-bold text-[13px] rounded-md transition-colors shadow-sm"
          >
            {showDuplicatesOnly ? '전체 상품 보기' : '중복 상품 보기'}
          </button>
        </div>
      )}

      {summary.completed && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <p className="text-[13px] font-bold text-emerald-700 leading-relaxed">
            상품 매칭 완료 — 전체 {summary.total.toLocaleString()}개 중 확정 {summary.confirmed.toLocaleString()}개,
            건너뜀 {summary.skipped.toLocaleString()}개입니다.
          </p>
        </div>
      )}

      {/* 오류 */}
      {errorMessage && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-[13px] font-bold text-red-600 leading-relaxed flex-1">{errorMessage}</p>
          <button
            type="button"
            onClick={() => void loadProducts()}
            disabled={isLoading}
            className="shrink-0 px-4 py-2 !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[13px] rounded-md transition-colors shadow-sm disabled:opacity-50"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 목록 */}
      {!hasLoaded ? (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
          <p className="text-[13px] font-bold text-gray-500 leading-relaxed">
            먼저 <b className="text-gray-700">카페24 상품 불러오기</b>를 눌러 주세요. 상품 목록을 받아야 추천을
            계산할 수 있습니다.
          </p>
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-[13px] font-bold text-gray-400">조건에 맞는 상품이 없습니다.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleGroups.map((group) => {
            const match = matches[group.naverProductNo];
            if (!match) return null;

            const confirmedProduct =
              match.cafe24ProductNo !== null ? productByNo.get(match.cafe24ProductNo) ?? null : null;
            const topCandidate = match.candidates[0] ?? null;
            const isPickerOpen = pickerFor === group.naverProductNo;
            const isCandidatesOpen = candidatesFor === group.naverProductNo;
            const isRestored = restoredProductNos.has(group.naverProductNo);
            const isDuplicate =
              match.status === 'confirmed' &&
              match.cafe24ProductNo !== null &&
              duplicateProductNos.has(match.cafe24ProductNo);

            return (
              <li
                key={group.naverProductNo}
                className={`bg-white rounded-lg border shadow-sm overflow-hidden ${
                  isDuplicate
                    ? 'border-red-300'
                    : match.status === 'confirmed'
                      ? 'border-emerald-300'
                      : match.status === 'skipped'
                        ? 'border-gray-300'
                        : 'border-gray-200'
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  {/* 왼쪽: 네이버 상품 */}
                  <div className="p-4 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50/60">
                    <p className="text-[11px] font-bold text-gray-400 mb-2">네이버 상품 (엑셀)</p>
                    <NaverProductInfo group={group} smartstoreUrl={smartstoreUrl} />
                  </div>

                  {/* 오른쪽: 카페24 상품 */}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-[11px] font-bold text-gray-400">
                        {match.status === 'confirmed' ? '확정된 카페24 상품' : '카페24 추천 상품'}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {match.status === 'confirmed' && <Pill tone="emerald">확정</Pill>}
                        {match.status === 'confirmed' && isRestored && (
                          <Pill tone="violet">저장된 매칭</Pill>
                        )}
                        {match.status === 'skipped' && <Pill tone="gray">건너뜀</Pill>}
                        {match.status === 'suggested' && <Pill tone="violet">추천</Pill>}
                        {match.status === 'unmatched' && <Pill tone="amber">후보 없음</Pill>}
                        {match.ambiguous && match.status !== 'confirmed' && (
                          <Pill tone="amber">유사 후보 있음</Pill>
                        )}
                      </div>
                    </div>

                    {match.status === 'confirmed' && confirmedProduct ? (
                      <div className="flex items-start gap-3">
                        <Thumbnail src={confirmedProduct.thumbnailUrl} alt={confirmedProduct.productName} />
                        <ProductInfo product={confirmedProduct} />
                      </div>
                    ) : match.status === 'skipped' ? (
                      <p className="text-[13px] font-bold text-gray-500 py-4">
                        이 상품은 건너뛰기로 표시했습니다.
                      </p>
                    ) : topCandidate ? (
                      <div className="flex items-start gap-3">
                        <Thumbnail src={topCandidate.product.thumbnailUrl} alt={topCandidate.product.productName} />
                        <div className="min-w-0 flex-1">
                          <ProductInfo product={topCandidate.product} />
                          <p className="text-[12px] font-bold text-[#5244e8] mt-1.5">
                            추천 점수 {topCandidate.score} · {topCandidate.reason}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[13px] font-bold text-amber-600 py-4">
                        이름이 비슷한 카페24 상품을 찾지 못했습니다. 직접 선택해 주세요.
                      </p>
                    )}

                    {/* 버튼 */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {match.status === 'confirmed' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleCandidates(group.naverProductNo)}
                            className="px-4 py-2 !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[13px] rounded-md transition-colors shadow-sm"
                          >
                            {isCandidatesOpen ? '추천 후보 닫기' : '추천 후보 보기'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openPicker(group.naverProductNo)}
                            className="px-4 py-2 !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[13px] rounded-md transition-colors shadow-sm"
                          >
                            다른 상품 선택
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelMatch(group.naverProductNo)}
                            className="px-4 py-2 !bg-white hover:!bg-red-50 border-2 border-red-200 !text-red-600 font-bold text-[13px] rounded-md transition-colors shadow-sm"
                          >
                            매칭 취소
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openPicker(group.naverProductNo)}
                            className="px-4 py-2 !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[13px] rounded-md transition-colors shadow-sm"
                          >
                            다른 상품 선택
                          </button>
                          <button
                            type="button"
                            onClick={() => skipProduct(group.naverProductNo)}
                            className="px-4 py-2 !bg-white hover:!bg-gray-100 border-2 border-gray-300 !text-gray-500 font-bold text-[13px] rounded-md transition-colors"
                          >
                            건너뛰기
                          </button>
                          {topCandidate && (
                            <button
                              type="button"
                              onClick={() => confirmProduct(group.naverProductNo, topCandidate.product.productNo)}
                              className="px-4 py-2 bg-[#5244e8] hover:bg-blue-700 !text-white font-bold text-[13px] rounded-md transition-colors shadow-sm"
                            >
                              이 상품으로 확정
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/*
                  확정된 카드에서 펼쳐 보는 추천 후보.
                  여는 것만으로는 확정이 풀리지 않고, 아래 '이 상품으로 확정'을 눌러야 교체됩니다.
                */}
                {match.status === 'confirmed' && isCandidatesOpen && (
                  <div className="border-t border-gray-200 bg-gray-50/60 px-4 py-4">
                    <p className="text-[12px] font-bold text-gray-600 mb-2">
                      자동 추천 후보 {match.candidates.length}개 — 확정 버튼을 눌러야 지금 매칭이 바뀝니다.
                    </p>

                    {match.candidates.length === 0 ? (
                      <p className="text-[12px] font-bold text-amber-600">
                        이름이 비슷한 카페24 상품을 찾지 못했습니다. <b>다른 상품 선택</b>으로 직접 찾아 주세요.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {match.candidates.map((candidate) => {
                          const isCurrent = candidate.product.productNo === match.cafe24ProductNo;

                          return (
                            <li
                              key={candidate.product.productNo}
                              className={`flex items-start gap-3 bg-white border rounded-md p-3 ${
                                isCurrent ? 'border-emerald-300' : 'border-gray-200'
                              }`}
                            >
                              <Thumbnail
                                src={candidate.product.thumbnailUrl}
                                alt={candidate.product.productName}
                                size="w-12 h-12"
                              />
                              <div className="min-w-0 flex-1">
                                <ProductInfo product={candidate.product} />
                                <p className="text-[12px] font-bold text-gray-500 mt-1">
                                  추천 점수 {candidate.score} · {candidate.reason}
                                </p>
                              </div>

                              {isCurrent ? (
                                <span className="shrink-0 px-3 py-1.5 rounded-md text-[12px] font-bold bg-emerald-100 text-emerald-700 whitespace-nowrap">
                                  현재 확정
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    confirmProduct(group.naverProductNo, candidate.product.productNo)
                                  }
                                  className="shrink-0 px-3 py-1.5 bg-[#5244e8] hover:bg-blue-700 !text-white font-bold text-[12px] rounded-md transition-colors whitespace-nowrap"
                                >
                                  이 상품으로 확정
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {/* 나머지 추천 후보 */}
                {match.status !== 'confirmed' && match.status !== 'skipped' && match.candidates.length > 1 && (
                  <details className="border-t border-gray-200 bg-gray-50/60 px-4 py-3">
                    <summary className="text-[12px] font-bold text-gray-600 cursor-pointer">
                      다른 추천 후보 {match.candidates.length - 1}개 보기
                    </summary>
                    <ul className="mt-3 space-y-2">
                      {match.candidates.slice(1).map((candidate) => (
                        <li
                          key={candidate.product.productNo}
                          className="flex items-start gap-3 bg-white border border-gray-200 rounded-md p-3"
                        >
                          <Thumbnail
                            src={candidate.product.thumbnailUrl}
                            alt={candidate.product.productName}
                            size="w-12 h-12"
                          />
                          <div className="min-w-0 flex-1">
                            <ProductInfo product={candidate.product} />
                            <p className="text-[12px] font-bold text-gray-500 mt-1">
                              추천 점수 {candidate.score} · {candidate.reason}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => confirmProduct(group.naverProductNo, candidate.product.productNo)}
                            className="shrink-0 px-3 py-1.5 bg-[#5244e8] hover:bg-blue-700 !text-white font-bold text-[12px] rounded-md transition-colors"
                          >
                            확정
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* 직접 선택 */}
                {isPickerOpen && (
                  <div className="border-t border-gray-200 bg-white px-4 py-4">
                    <p className="text-[12px] font-bold text-gray-600 mb-2">
                      카페24 상품 직접 선택 (상품명 · 상품번호 · 상품코드로 검색)
                    </p>
                    <input
                      type="search"
                      value={pickerKeyword}
                      onChange={(e) => setPickerKeyword(e.target.value)}
                      placeholder="예) 전술조끼 / 1234 / P000000X"
                      className="w-full px-3 h-[40px] border-2 border-gray-300 rounded-md text-[13px] font-bold text-gray-700 focus:border-[#5244e8] focus:outline-none"
                    />

                    {pickerKeyword.trim() === '' ? (
                      <p className="text-[12px] text-gray-400 mt-2">검색어를 입력하면 상품을 찾아 드립니다.</p>
                    ) : pickerResults.length === 0 ? (
                      <p className="text-[12px] font-bold text-amber-600 mt-2">검색 결과가 없습니다.</p>
                    ) : (
                      <ul className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                        {pickerResults.map((product) => (
                          <li
                            key={product.productNo}
                            className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-md p-3"
                          >
                            <Thumbnail src={product.thumbnailUrl} alt={product.productName} size="w-12 h-12" />
                            <ProductInfo product={product} />
                            <button
                              type="button"
                              onClick={() => confirmProduct(group.naverProductNo, product.productNo)}
                              className="shrink-0 px-3 py-1.5 bg-[#5244e8] hover:bg-blue-700 !text-white font-bold text-[12px] rounded-md transition-colors"
                            >
                              이 상품으로 확정
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
