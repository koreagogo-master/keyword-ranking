// app/review-migration/types.ts
// 코만도몰 리뷰 이전 1차 개발: 엑셀 업로드 → 검증 → 미리보기 단계에서 사용하는 공통 타입

import type { Cafe24BatchStopReason } from '@/app/lib/cafe24/batchOutcome';
import type { Cafe24ErrorDetail } from '@/app/lib/cafe24/errorDetail';

/**
 * 개발 환경에서만 응답에 실려 오는 카페24 원본 오류 요약.
 * 운영 환경에서는 서버가 이 값을 만들지 않으므로 화면에도 표시되지 않습니다.
 */
export type Cafe24DevErrorDetail = Cafe24ErrorDetail;

/** 업로드 엑셀에 반드시 있어야 하는 열 (네이버 스마트스토어 리뷰 다운로드 기준) */
export const REQUIRED_COLUMN_LABELS = [
  '상품번호',
  '상품명',
  '리뷰구분',
  '구매자평점',
  '포토/영상',
  '리뷰상세내용',
  '등록자',
  '리뷰등록일',
  '리뷰글번호',
  '상품주문번호',
] as const;

/** 행 검증 결과 상태 */
export type ReviewRowStatus = 'ok' | 'duplicate' | 'error';

export interface ReviewRow {
  /** 엑셀 원본 행 번호 (1부터 시작, 헤더 행 포함) */
  excelRow: number;
  /** 리뷰글번호 — 향후 카페24 중복 업로드 방지용 고유키 */
  reviewNo: string;
  productNo: string;
  productName: string;
  reviewType: string;
  /** 구매자평점 원본 문자열 */
  rating: string;
  /** 1~5로 해석된 평점. 해석 불가 시 null */
  ratingValue: number | null;
  writer: string;
  writtenAt: string;
  content: string;
  /** 리뷰 내용이 길어서 잘렸는지 여부 */
  contentTruncated: boolean;
  /** 포토/영상 열 원본 값 */
  imageRaw: string;
  hasImage: boolean;
  orderNo: string;
  status: ReviewRowStatus;
  /** 검증에서 발견된 문제 설명 */
  issues: string[];
}

export interface ReviewSummary {
  /** 전체 리뷰 수 */
  totalCount: number;
  /** 상품 수 (상품번호 기준 고유 개수) */
  productCount: number;
  /** 포토/영상 리뷰 수 */
  photoCount: number;
  /** 일반 리뷰 수 */
  generalCount: number;
  /** 한달사용 리뷰 수 */
  monthUseCount: number;
  /** 누락되거나 잘못된 데이터 수 */
  invalidCount: number;
  /** 리뷰글번호가 파일 안에서 중복된 행 수 */
  duplicateCount: number;
}

export interface ParseSuccess {
  ok: true;
  fileName: string;
  sheetName: string;
  summary: ReviewSummary;
  /** 데이터 행 전체 (한 파일당 최대 maxRowCount건) */
  rows: ReviewRow[];
  /** 검증에 사용된 전체 데이터 행 수 */
  totalRowCount: number;
  /** 한 파일에서 처리할 수 있는 최대 행 수 */
  maxRowCount: number;
}

export interface ParseFailure {
  ok: false;
  error: string;
  /** 필수 열이 없을 때 어떤 열이 없는지 */
  missingColumns?: string[];
  /** 화면에서 원인을 구분할 수 있는 짧은 코드 (예: row_limit_exceeded) */
  code?: string;
  /** 행 수 제한을 넘은 경우 실제 데이터 행 수 */
  rowCount?: number;
  /** 행 수 제한을 넘은 경우 허용 행 수 */
  maxRowCount?: number;
}

export type ParseResponse = ParseSuccess | ParseFailure;

// ──────────────────────────────────────────────────────────────
// 3단계: 상품 매칭
// ──────────────────────────────────────────────────────────────

/**
 * /api/review-migration/cafe24/products 응답의 상품 한 건.
 * 서버(app/lib/cafe24/products.ts)의 Cafe24ProductSummary와 같은 모양입니다.
 */
export interface Cafe24Product {
  productNo: number;
  productCode: string;
  customProductCode: string;
  productName: string;
  /** 목록·축소 이미지 절대 URL. 없으면 빈 문자열 */
  thumbnailUrl: string;
  /** 상품 상세 페이지 주소 (서버가 고정 mallId로 생성) */
  productUrl: string;
  /** 진열상태 */
  display: boolean;
  /** 판매상태 */
  selling: boolean;
  /** 품절여부 */
  soldOut: boolean;
  /** 옵션 사용여부 */
  hasOption: boolean;
  updatedDate: string;
}

export interface Cafe24ProductsSuccess {
  products: Cafe24Product[];
  totalCount: number;
  fetchedAt: string;
  /** 안전장치에 걸려 일부만 가져온 경우 true */
  truncated: boolean;
}

export interface Cafe24ProductsFailure {
  error: string;
  /** not_connected · reauth_required · network_error · rate_limited 등 */
  code?: string;
  retryable?: boolean;
  retryAfterSeconds?: number | null;
}

/** 엑셀 rows를 네이버 상품번호로 묶은 결과 */
export interface NaverProductGroup {
  /** 네이버 상품번호 (엑셀 '상품번호') */
  naverProductNo: string;
  /** 같은 상품번호에서 가장 많이 나온 상품명 */
  productName: string;
  /** 이 상품번호로 묶인 리뷰 수 */
  reviewCount: number;
}

/**
 * 매칭 상태.
 *  - unmatched : 후보가 없거나 아직 아무 판단도 하지 않음
 *  - suggested : 자동 추천만 된 상태 (확정 아님)
 *  - confirmed : 관리자가 직접 확정함
 *  - skipped   : 관리자가 건너뛰기로 정함
 */
export type ProductMatchStatus = 'unmatched' | 'suggested' | 'confirmed' | 'skipped';

/** 자동 추천 후보 한 건 */
export interface ProductMatchCandidate {
  product: Cafe24Product;
  /** 0~100 점수 (높을수록 유사) */
  score: number;
  /** 화면에 보여 줄 추천 이유 */
  reason: string;
}

/** 네이버 상품 하나에 대한 매칭 상태 */
export interface ProductMatch {
  naverProductNo: string;
  status: ProductMatchStatus;
  /** 확정된 카페24 상품번호. 확정 전이거나 건너뛴 경우 null */
  cafe24ProductNo: number | null;
  /** 점수순 상위 후보 (최대 5개) */
  candidates: ProductMatchCandidate[];
  /** 1위와 2위 점수 차가 작아 사람이 확인해야 하는 경우 true */
  ambiguous: boolean;
}

/**
 * 3단계가 페이지로 올려 주는 최소 매칭 결과.
 * 관리자가 직접 판단을 끝낸 confirmed·skipped만 담고 추천 상태는 담지 않습니다.
 */
export interface ProductMatchEntry {
  naverProductNo: string;
  /** confirmed면 확정된 카페24 상품번호, skipped면 null */
  cafe24ProductNo: number | null;
  status: 'confirmed' | 'skipped';
}

// ──────────────────────────────────────────────────────────────
// 4단계: 등록 전 중복 검사
// ──────────────────────────────────────────────────────────────

export type DuplicateStatus = 'duplicate' | 'needs_review' | 'new';

/**
 * 판정 이유.
 *
 * `legacy_strong_match`는 과거 리뷰를 자동 '확실한 중복'으로 올리던 이유였습니다.
 * 이제는 naverpay_review_id가 일치할 때만 자동 중복으로 판정하므로 서버가 이 값을 내보내지 않습니다.
 * 예전 응답을 읽는 화면이 깨지지 않도록 타입과 화면 문구만 남겨 둡니다.
 */
export type DuplicateReason =
  | 'naver_review_id'
  | 'legacy_strong_match'
  | 'legacy_possible_match'
  | 'no_match';

/** duplicate-check API로 보내는 리뷰 한 건 */
export interface DuplicateCheckRequestReview {
  naverReviewId: string;
  cafe24ProductNo: number;
  content: string;
  rating: number | null;
  writer: string;
  registeredAt: string;
}

/**
 * 기존 리뷰와 실제로 일치한 항목.
 * boolean은 양쪽 값이 있어 비교한 결과이고, null은 한쪽이 비어 비교하지 못한 경우입니다.
 */
export interface DuplicateMatchedFields {
  product: boolean;
  content: boolean;
  writer: boolean | null;
  date: boolean | null;
  rating: boolean | null;
  /** 한국시간 분 단위 작성시각 일치 여부. 한쪽이라도 해석하지 못하면 null */
  time?: boolean | null;
}

export interface DuplicateCheckResultItem {
  naverReviewId: string;
  status: DuplicateStatus;
  reason: DuplicateReason;
  /** 가장 강하게 일치한 기존 게시글 번호. 없으면 null */
  matchedCafe24ArticleNo: number | null;
  /** 조건을 모두 만족한 기존 리뷰 후보 수 */
  candidateCount: number;
  matchedFields: DuplicateMatchedFields;
  /**
   * 정규화된 본문 유사도 (0~1). 본문 비교를 한 경우에만 들어옵니다.
   * 수치만 담고 본문 원문은 담지 않습니다.
   */
  contentSimilarity?: number;
  /** 관리자가 알아야 할 짧은 안내 (원문·개인정보는 담지 않습니다) */
  warning?: string;
}

export interface DuplicateCheckSuccess {
  ok: true;
  boardNo: number;
  /** 게시판에서 훑은 기존 게시글 수 */
  scannedArticleCount: number;
  checkedReviewCount: number;
  summary: {
    duplicate: number;
    needsReview: number;
    new: number;
  };
  results: DuplicateCheckResultItem[];
  fetchedAt: string;
}

export interface DuplicateCheckFailure {
  error: string;
  /** not_connected · scan_truncated · rate_limited 등 */
  code?: string;
  retryable?: boolean;
  retryAfterSeconds?: number | null;
}

/**
 * 관리자가 '확인 필요' 리뷰를 직접 판정한 값.
 *
 * 서버가 내려준 DuplicateCheckResultItem.status는 그대로 두고 이 값만 따로 관리합니다.
 * `duplicate`는 중복으로 확정해 등록 대상에서 빼고, `new`는 신규 등록 후보로 유지합니다.
 * 값이 없으면 미판정이라 '확인 필요'로 남습니다. 자동으로 채우지 않습니다.
 */
export type AdminDuplicateDecision = 'duplicate' | 'new';

/**
 * 네이버 리뷰글번호 → 관리자 판정.
 * 현재 중복 검사 결과가 살아 있는 동안만 쓰는 화면 상태이고 sessionStorage·DB에 저장하지 않습니다.
 */
export type AdminDecisionMap = Record<string, AdminDuplicateDecision>;

// ──────────────────────────────────────────────────────────────
// 5단계: 신규 리뷰 카페24 등록
// ──────────────────────────────────────────────────────────────

/**
 * 등록 API로 보내는 리뷰 한 건.
 *
 * 중복 검사 요청(DuplicateCheckRequestReview)에 카페24 게시글 제목·첨부에 필요한 값만 더한 형태입니다.
 * 서버는 이 값을 그대로 믿지 않고 형식·상품 매칭·필수 항목을 다시 검증합니다.
 */
export interface RegisterReviewInput extends DuplicateCheckRequestReview {
  /** 네이버 상품명. 게시글 제목(title)으로 씁니다. */
  productName: string;
  /** 엑셀 '포토/영상' 열 원본 값. 서버가 이 안에서 https 이미지 주소만 골라 씁니다. */
  imageRaw: string;
}

/** 등록 전 최종 확인에서 한 건이 막힌 이유 */
export type RegisterBlockReason =
  | 'already_registered'
  | 'became_duplicate'
  | 'became_needs_review'
  | 'evidence_changed'
  | 'undecided_needs_review'
  | 'not_a_candidate'
  | 'missing_data';

/** 등록 전 최종 확인에서 막힌 리뷰 한 건 */
export interface RegisterBlockedItem {
  naverReviewId: string;
  reason: RegisterBlockReason;
}

/**
 * 등록 전 최종 확인 응답.
 * 게시판을 다시 읽고 같은 중복 판정 함수를 재사용하며 카페24에 아무것도 쓰지 않습니다.
 */
export interface RegisterPrecheckSuccess {
  ok: true;
  boardNo: number;
  scannedArticleCount: number;
  checkedAt: string;
  /** 등록해도 되는 리뷰글번호 */
  allowedNaverReviewIds: string[];
  /** 등록을 막은 리뷰와 사유 */
  blocked: RegisterBlockedItem[];
}

export interface RegisterPrecheckFailure {
  error: string;
  /** not_connected · scan_truncated · client_ip_unavailable 등 */
  code?: string;
  retryable?: boolean;
  retryAfterSeconds?: number | null;
}

/** 등록 한 건의 결과. 성공 응답을 실제로 받은 건만 registered가 true입니다. */
export interface RegisterResultItem {
  naverReviewId: string;
  registered: boolean;
  /** 카페24가 돌려준 게시글 번호. 확인하지 못하면 null */
  articleNo: number | null;
  /** 실패했을 때의 짧은 사유 코드 */
  code?: string;
  /**
   * 등록되지 않은 것이 확실한 건인지.
   * false면 성공도 실패도 확인하지 못한 '결과 불명확'이므로 등록을 멈춰야 합니다.
   */
  failureConfirmed?: boolean;
  /** 실패 사유를 이 건에 개별로 연결했는지. false면 묶음 단위 사유만 알 수 있습니다. */
  reasonLinked?: boolean;
  /** 첨부를 빼고 등록한 경우의 사유 (등록 자체는 성공) */
  attachmentSkippedReason?: string;
  /** 카페24로 보낸 requests 배열에서의 위치 (0부터) */
  requestIndex?: number;
  /**
   * 207 응답에서 이 건에 대해 카페24가 준 개별 실패 사유 (개발 환경에서만).
   * 없으면 카페24가 이 건의 사유를 알려 주지 않은 것입니다.
   */
  devDetail?: Cafe24DevErrorDetail;
}

/** 207 응답에서 어느 건인지 특정하지 못한 실패 사유 한 건 (개발 환경 전용) */
export interface RegisterDevMultiStatusNote {
  /** 카페24가 적어 준 요청 배열 위치 원본값. 없으면 null */
  reportedIndex: number | null;
  detail: Cafe24DevErrorDetail;
}

/**
 * 성공·실패가 섞인 207 응답의 진단 요약 (개발 환경 전용).
 * 운영 환경에서는 서버가 넣지 않으므로 항상 undefined입니다.
 */
export interface RegisterDevMultiStatus {
  /** 카페24 HTTP status (다중 등록은 207) */
  status: number;
  /** 응답에서 읽어 낸 개별 실패 사유 수 */
  failureCount: number;
  /** 사유를 하나도 받지 못한 경우 true */
  reasonsMissing: boolean;
  /** 어느 리뷰의 실패인지 특정하지 못한 사유 */
  unattributed: RegisterDevMultiStatusNote[];
  /** 사유가 모두 같을 때의 묶음 공통 실패 사유. 서로 다르면 null */
  commonFailureDetail: Cafe24DevErrorDetail | null;
  /** 실패는 확정했지만 사유를 개별 연결하지 못한 건수 */
  unlinkedFailedCount: number;
  /** 사유가 서로 달라 개별 연결이 불가능한 경우 true */
  reasonsUnlinkable: boolean;
}

/**
 * 등록 응답 (한 묶음 = 최대 10건).
 *
 * outcome이 'unknown'이면 성공 여부를 확인할 수 없다는 뜻이므로
 * 화면은 다음 묶음을 보내지 않고 즉시 중단해야 합니다.
 */
export interface RegisterSuccess {
  ok: true;
  boardNo: number;
  outcome: 'applied' | 'partial';
  results: RegisterResultItem[];
  registeredCount: number;
  /** 등록되지 않은 건수 (명시적 실패 + 결과 불명확) */
  failedCount: number;
  /** 등록되지 않은 것이 확실한 건수 */
  explicitFailedCount: number;
  /** 성공도 실패도 확인하지 못한 건수. 0이 아니면 등록을 멈춰야 합니다. */
  unclearCount: number;
  /** 성공·명시적 실패로 설명되지 않은 건수 */
  unaccountedCount: number;
  /**
   * 다음 묶음을 이어서 보내도 되는지 (서버 판단).
   * 성공 확정 · 실패 명확 · 성공+실패 = 요청 수 · 불명확 0건을 모두 만족할 때만 true입니다.
   */
  canContinue: boolean;
  /** canContinue가 false일 때의 사유 */
  stopReason?: Cafe24BatchStopReason;
  /** 207 응답의 개별 실패 사유 요약 (개발 환경에서 실패가 있었을 때만) */
  devMultiStatus?: RegisterDevMultiStatus;
}

/** 화면이 배치 번호까지 붙여 보관하는 등록 결과 한 건 */
export interface RegisterAttemptItem extends RegisterResultItem {
  /** 이 건이 실린 묶음 번호 (1부터) */
  batchNumber: number;
}

/** 묶음 하나의 207 진단 요약 (개발 환경 전용). 화면이 묶음 번호를 붙여 보관합니다. */
export interface RegisterBatchDiagnostic {
  batchNumber: number;
  info: RegisterDevMultiStatus;
}

export interface RegisterFailure {
  error: string;
  /** write_forbidden · reauth_required · unknown_result · rate_limited · client_ip_unavailable 등 */
  code?: string;
  retryable?: boolean;
  retryAfterSeconds?: number | null;
  /** true면 카페24에 반영됐는지 알 수 없으므로 재시도하면 중복 등록될 수 있습니다. */
  outcomeUnknown?: boolean;
  /** 개발 환경에서만 들어오는 카페24 원본 오류 요약 (운영에서는 없습니다) */
  devDetail?: Cafe24DevErrorDetail;
}

/** 카페24가 게시글에 보관한 첨부 한 건 (공식 응답 필드: name · url) */
export interface RegisterVerifyAttachment {
  /** 카페24가 돌려준 첨부 파일명. 읽지 못하면 빈 문자열 */
  name: string;
  /** 카페24가 돌려준 이미지 주소. 읽지 못하면 빈 문자열 */
  url: string;
}

/**
 * 등록된 게시글 한 건의 상세.
 *
 * 요청에 includeArticleDetails를 넣은 경우에만 내려옵니다.
 * (이미지 리뷰 1건 시험 등록에서 카페24가 이미지를 어떻게 보관했는지 확인하는 용도입니다)
 * 값은 공식 목록 조회 응답에서 읽습니다. 게시글 한 건을 번호로 조회하는 공식 API는 없습니다.
 */
export interface RegisterVerifyArticle {
  naverReviewId: string;
  /** 카페24 게시글번호 */
  articleNo: number;
  /** 목록에서 어느 기준으로 찾았는지. naverpay_review_id가 1순위입니다. */
  matchedBy: 'naverpay_review_id' | 'article_no';
  /** 목록 응답에서 첨부 항목을 1개 이상 읽었으면 true */
  attachmentsAvailable: boolean;
  attachments: RegisterVerifyAttachment[];
}

/** 등록 결과 확인 (읽기 전용) */
export interface RegisterVerifySuccess {
  ok: true;
  boardNo: number;
  checkedAt: string;
  requestedCount: number;
  foundCount: number;
  /** 게시판에서 찾지 못한 리뷰글번호 */
  missingNaverReviewIds: string[];
  /** 게시글이 두 건 이상 만들어진 리뷰글번호 */
  duplicatedNaverReviewIds: string[];
  /** includeArticleDetails를 요청한 경우의 게시글 상세 */
  articles?: RegisterVerifyArticle[];
}

export interface RegisterVerifyFailure {
  error: string;
  code?: string;
  retryable?: boolean;
  retryAfterSeconds?: number | null;
}
