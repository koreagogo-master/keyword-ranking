import type {
  Cafe24Product,
  NaverProductGroup,
  ProductMatch,
  ProductMatchCandidate,
} from '@/app/review-migration/types';

/**
 * 네이버 상품명 ↔ 카페24 상품명 매칭 도우미.
 *
 * 외부 패키지를 쓰지 않고 순수 함수로만 구현합니다.
 * 자동 확정은 절대 하지 않고 'suggested'까지만 만듭니다.
 */

/** 후보로 보여 줄 최소 점수. 이보다 낮으면 아예 제시하지 않습니다. */
const MIN_CANDIDATE_SCORE = 20;

/** 네이버 상품 하나당 제시할 후보 수 */
const MAX_CANDIDATES = 5;

/** 1·2위 점수 차가 이보다 작으면 '유사 후보 있음'으로 표시합니다. */
const AMBIGUOUS_SCORE_GAP = 5;

/**
 * 상품명에서 빼도 되는 일반 문구.
 * 모델명·숫자·브랜드는 절대 넣지 않습니다. (매칭 근거가 사라지기 때문입니다)
 */
const NOISE_PHRASES = [
  '결합상품',
  '묶음상품',
  '세트상품',
  '이벤트',
  '사은품',
  '사은품증정',
  '증정',
  '무료배송',
  '무배',
  '당일발송',
  '당일출고',
  '오늘출발',
  '한정수량',
  '품절임박',
  '재입고',
  '신상품',
  '베스트',
  '추천',
  '특가',
  '할인',
  '세일',
  'best',
  'new',
  'hot',
  'sale',
  'event',
] as const;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  middot: '·',
  hellip: '…',
  ndash: '-',
  mdash: '-',
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
};

/** HTML 태그 제거. 상품명에는 HTML을 넣을 수 있다고 공식 문서에 명시돼 있습니다. */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, ' ');
}

/** HTML 엔티티를 평문으로 바꿉니다. */
export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const body = entity.toLowerCase();

    if (body.startsWith('#x')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }

    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }

    return NAMED_ENTITIES[body] ?? match;
  });
}

/** 노이즈 문구만 걸러냅니다. 대괄호 안이라도 내용이 노이즈일 때만 지웁니다. */
function removeNoise(input: string): string {
  // [결합상품], (이벤트) 처럼 괄호로 감싼 노이즈
  let text = input.replace(/[[(【《]([^\][)】》]{1,20})[\])】》]/g, (match, inner: string) => {
    const compact = inner.replace(/\s+/g, '');
    return NOISE_PHRASES.some((phrase) => compact === phrase) ? ' ' : match;
  });

  // 괄호 없이 그대로 쓰인 노이즈
  for (const phrase of NOISE_PHRASES) {
    text = text.split(phrase).join(' ');
  }

  return text;
}

/**
 * 비교용으로 상품명을 정규화합니다.
 *
 * 태그 제거 → 엔티티 해제 → NFKC → 소문자 → 노이즈 제거 →
 * 한글·영문·숫자만 남기고 나머지는 공백으로 → 공백 정리
 * 모델명과 숫자는 그대로 보존됩니다.
 */
export function normalizeProductName(raw: string): string {
  if (!raw) return '';

  // 엔티티를 풀면 태그가 새로 드러날 수 있어 한 번 더 지웁니다.
  let text = stripHtmlTags(raw);
  text = decodeHtmlEntities(text);
  text = stripHtmlTags(text);

  text = text.normalize('NFKC').toLowerCase();
  text = removeNoise(text);

  // 한글(음절·자모), 영문, 숫자만 남깁니다.
  text = text.replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]+/g, ' ');

  return text.replace(/\s+/g, ' ').trim();
}

/** 공백까지 없앤 형태. 완전일치·포함·bigram 비교에 씁니다. */
export function compactProductName(raw: string): string {
  return normalizeProductName(raw).replace(/\s+/g, '');
}

/** 정규화된 이름을 토큰으로 쪼갭니다. */
export function tokenizeProductName(raw: string): string[] {
  const normalized = normalizeProductName(raw);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length > 0);
}

/** 숫자·영문이 섞인 토큰은 모델명일 가능성이 높아 가중치를 더 줍니다. */
function tokenWeight(token: string): number {
  return /[0-9a-z]/.test(token) ? 2 : 1;
}

/** 가중 자카드 유사도 (0~1) */
export function tokenSimilarity(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;

  const leftSet = new Set(left);
  const rightSet = new Set(right);

  let intersection = 0;
  let union = 0;

  for (const token of new Set([...leftSet, ...rightSet])) {
    const weight = tokenWeight(token);
    union += weight;
    if (leftSet.has(token) && rightSet.has(token)) intersection += weight;
  }

  return union === 0 ? 0 : intersection / union;
}

function toBigrams(text: string): string[] {
  const grams: string[] = [];
  for (let i = 0; i < text.length - 1; i += 1) {
    grams.push(text.slice(i, i + 2));
  }
  return grams;
}

/** Dice 계수 기반 bigram 유사도 (0~1) */
export function bigramSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return left === right ? 1 : 0;

  const leftGrams = toBigrams(left);
  const rightGrams = toBigrams(right);

  const pool = new Map<string, number>();
  for (const gram of leftGrams) {
    pool.set(gram, (pool.get(gram) ?? 0) + 1);
  }

  let shared = 0;
  for (const gram of rightGrams) {
    const remaining = pool.get(gram) ?? 0;
    if (remaining > 0) {
      pool.set(gram, remaining - 1);
      shared += 1;
    }
  }

  return (2 * shared) / (leftGrams.length + rightGrams.length);
}

/** 판매·진열·품절 상태에 따른 감점 */
function statusPenalty(product: Cafe24Product): { penalty: number; notes: string[] } {
  const notes: string[] = [];
  let penalty = 0;

  if (!product.selling) {
    penalty += 12;
    notes.push('판매중지');
  }
  if (!product.display) {
    penalty += 8;
    notes.push('미진열');
  }
  if (product.soldOut) {
    penalty += 5;
    notes.push('품절');
  }

  return { penalty, notes };
}

interface ScoredProduct {
  score: number;
  reason: string;
}

/**
 * 후보 한 건의 점수를 계산합니다.
 *
 * 우선순위(점수 구간이 서로 겹치지 않게 설계했습니다)
 *  1. 자체상품코드 == 네이버 상품번호   → 100
 *  2. 정규화 상품명 완전일치            → 92
 *  3. 한쪽이 다른 쪽을 포함             → 72~88
 *  4·5. 핵심 토큰 일치율 + bigram 유사도 → 0~70
 *  6. 판매중지·미진열·품절이면 감점
 */
export function scoreProduct(group: NaverProductGroup, product: Cafe24Product): ScoredProduct {
  const { penalty, notes } = statusPenalty(product);
  const suffix = notes.length > 0 ? ` · ${notes.join('·')}` : '';

  const finish = (base: number, reason: string): ScoredProduct => ({
    score: Math.max(0, Math.min(100, Math.round((base - penalty) * 10) / 10)),
    reason: `${reason}${suffix}`,
  });

  // 1. 자체상품코드 완전일치
  const customCode = product.customProductCode.trim();
  const naverNo = group.naverProductNo.trim();
  if (customCode !== '' && naverNo !== '' && customCode === naverNo) {
    return finish(100, '자체상품코드가 네이버 상품번호와 일치');
  }

  const leftCompact = compactProductName(group.productName);
  const rightCompact = compactProductName(product.productName);

  if (!leftCompact || !rightCompact) {
    return finish(0, '상품명을 비교할 수 없음');
  }

  // 2. 상품명 완전일치
  if (leftCompact === rightCompact) {
    return finish(92, '상품명 완전일치');
  }

  // 3. 포함 관계 (너무 짧은 이름은 우연히 겹칠 수 있어 4자 이상만 인정)
  const shorter = leftCompact.length <= rightCompact.length ? leftCompact : rightCompact;
  const longer = leftCompact.length <= rightCompact.length ? rightCompact : leftCompact;

  if (shorter.length >= 4 && longer.includes(shorter)) {
    const ratio = shorter.length / longer.length;
    return finish(72 + 16 * ratio, '한쪽 상품명이 다른 쪽에 포함됨');
  }

  // 4·5. 토큰 일치율 + bigram 유사도
  const leftTokens = tokenizeProductName(group.productName);
  const rightTokens = tokenizeProductName(product.productName);

  const tokens = tokenSimilarity(leftTokens, rightTokens);
  const bigrams = bigramSimilarity(leftCompact, rightCompact);
  const combined = 0.65 * tokens + 0.35 * bigrams;

  const sharedCount = leftTokens.filter((token) => rightTokens.includes(token)).length;
  const reason =
    sharedCount > 0
      ? `핵심 단어 ${sharedCount}개 일치 (유사도 ${Math.round(combined * 100)}%)`
      : `이름 유사도 ${Math.round(combined * 100)}%`;

  return finish(combined * 70, reason);
}

/** 점수순 상위 후보를 만듭니다. */
export function buildMatchCandidates(
  group: NaverProductGroup,
  products: Cafe24Product[]
): ProductMatchCandidate[] {
  return products
    .map((product) => {
      const { score, reason } = scoreProduct(group, product);
      return { product, score, reason };
    })
    .filter((candidate) => candidate.score >= MIN_CANDIDATE_SCORE)
    .sort((a, b) => b.score - a.score || a.product.productNo - b.product.productNo)
    .slice(0, MAX_CANDIDATES);
}

/**
 * 네이버 상품 하나의 매칭 상태를 만듭니다.
 * 후보가 있어도 'suggested'까지만 올라가고 확정은 관리자가 직접 해야 합니다.
 */
export function buildProductMatch(
  group: NaverProductGroup,
  products: Cafe24Product[]
): ProductMatch {
  const candidates = buildMatchCandidates(group, products);

  const ambiguous =
    candidates.length >= 2 && candidates[0].score - candidates[1].score < AMBIGUOUS_SCORE_GAP;

  return {
    naverProductNo: group.naverProductNo,
    status: candidates.length > 0 ? 'suggested' : 'unmatched',
    cafe24ProductNo: null,
    candidates,
    ambiguous,
  };
}

/** 검색창에서 상품명·productNo·productCode로 카페24 상품을 찾습니다. */
export function searchProducts(products: Cafe24Product[], keyword: string): Cafe24Product[] {
  const raw = keyword.trim();
  if (!raw) return [];

  const lowered = raw.toLowerCase();
  const normalized = compactProductName(raw);

  return products.filter((product) => {
    if (String(product.productNo) === raw) return true;
    if (product.productCode.toLowerCase().includes(lowered)) return true;
    if (product.customProductCode.toLowerCase().includes(lowered)) return true;
    if (product.productName.toLowerCase().includes(lowered)) return true;
    if (normalized && compactProductName(product.productName).includes(normalized)) return true;
    return false;
  });
}
