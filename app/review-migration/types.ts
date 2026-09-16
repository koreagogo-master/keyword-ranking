// app/review-migration/types.ts
// 코만도몰 리뷰 이전 1차 개발: 엑셀 업로드 → 검증 → 미리보기 단계에서 사용하는 공통 타입

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
  /** 미리보기용 행 목록 (행이 많으면 앞에서부터 일부만 내려옵니다) */
  rows: ReviewRow[];
  /** 검증에 사용된 전체 데이터 행 수 */
  totalRowCount: number;
  /** rows가 잘렸는지 여부 */
  truncated: boolean;
}

export interface ParseFailure {
  ok: false;
  error: string;
  /** 필수 열이 없을 때 어떤 열이 없는지 */
  missingColumns?: string[];
}

export type ParseResponse = ParseSuccess | ParseFailure;
