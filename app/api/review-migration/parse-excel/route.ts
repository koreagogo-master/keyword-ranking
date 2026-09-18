import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { adminGuardResponse, requireAdmin } from '@/app/lib/requireAdmin';
import type {
  ParseResponse,
  ReviewRow,
  ReviewRowStatus,
  ReviewSummary,
} from '@/app/review-migration/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_REVIEW_ROWS = 500; // 한 파일에서 처리할 수 있는 실제 데이터 행 수
const MAX_CONTENT_LENGTH = 3000; // 리뷰 본문 1건당 최대 보관 길이
const HEADER_SCAN_ROWS = 20; // 헤더 행을 찾기 위해 살펴볼 상단 행 수

type ColumnKey =
  | 'productNo'
  | 'productName'
  | 'reviewType'
  | 'rating'
  | 'image'
  | 'content'
  | 'writer'
  | 'writtenAt'
  | 'reviewNo'
  | 'orderNo';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  /** normalizeHeader를 거친 형태로 작성합니다 (공백 제거, 소문자) */
  aliases: string[];
}

const COLUMN_DEFS: ColumnDef[] = [
  { key: 'productNo', label: '상품번호', aliases: ['상품번호'] },
  { key: 'productName', label: '상품명', aliases: ['상품명'] },
  { key: 'reviewType', label: '리뷰구분', aliases: ['리뷰구분'] },
  { key: 'rating', label: '구매자평점', aliases: ['구매자평점', '구매자별점', '평점'] },
  { key: 'image', label: '포토/영상', aliases: ['포토/영상', '포토영상', '포토·영상', '포토/동영상'] },
  { key: 'content', label: '리뷰상세내용', aliases: ['리뷰상세내용', '리뷰내용'] },
  { key: 'writer', label: '등록자', aliases: ['등록자', '작성자'] },
  { key: 'writtenAt', label: '리뷰등록일', aliases: ['리뷰등록일', '등록일'] },
  { key: 'reviewNo', label: '리뷰글번호', aliases: ['리뷰글번호', '리뷰번호'] },
  { key: 'orderNo', label: '상품주문번호', aliases: ['상품주문번호', '주문번호'] },
];

/** 헤더 비교용 정규화: 공백/BOM 제거 후 소문자 변환 */
function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** 네이버 리뷰 본문에 자주 섞여 들어오는 HTML 엔티티 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', middot: '·', bull: '•', ndash: '–', mdash: '—',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
  laquo: '«', raquo: '»', prime: '′', Prime: '″',
  deg: '°', times: '×', divide: '÷', plusmn: '±', permil: '‰',
  frac12: '½', frac14: '¼', frac34: '¾',
  copy: '©', reg: '®', trade: '™', sect: '§', para: '¶',
  euro: '€', pound: '£', yen: '¥', cent: '¢',
  larr: '←', uarr: '↑', rarr: '→', darr: '↓', harr: '↔',
  hearts: '♥', starf: '★', star: '☆', check: '✓',
};

/**
 * `&hellip;`, `&#8230;`, `&#x2026;` 같은 엔티티를 사람이 읽는 글자로 바꿉니다.
 * 결과는 HTML이 아니라 문자열로만 사용하므로(React가 그대로 이스케이프하여 출력)
 * `&lt;script&gt;`가 `<script>`로 바뀌어도 실행되지 않습니다.
 */
function decodeHtmlEntities(text: string): string {
  if (!text.includes('&')) return text;

  return text.replace(/&(#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]{1,31});/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = Number.parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);

      // 제어 문자·서로게이트·범위를 벗어난 값은 되돌리지 않고 원문을 남깁니다.
      const isUnsafe =
        !Number.isFinite(code) ||
        code < 32 ||
        (code >= 127 && code <= 159) ||
        (code >= 0xd800 && code <= 0xdfff) ||
        code > 0x10ffff;

      return isUnsafe ? match : String.fromCodePoint(code);
    }

    return NAMED_ENTITIES[entity] ?? NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** 화면에 그대로 출력되는 값이므로 엔티티를 풀고 제어 문자를 제거합니다 */
function cleanText(value: unknown): string {
  return decodeHtmlEntities(String(value ?? ''))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

/**
 * 상단 몇 개 행을 훑어 필수 열이 가장 많이 일치하는 행을 헤더로 판단합니다.
 * (다운로드 파일 위에 안내 문구 행이 붙어 있는 경우에도 동작하도록)
 */
function findHeaderRow(grid: unknown[][]): { headerIndex: number; matched: number } {
  let headerIndex = -1;
  let matched = 0;

  const scanUntil = Math.min(grid.length, HEADER_SCAN_ROWS);
  for (let i = 0; i < scanUntil; i += 1) {
    const normalized = (grid[i] ?? []).map(normalizeHeader);
    const count = COLUMN_DEFS.filter((def) =>
      def.aliases.some((alias) => normalized.includes(alias))
    ).length;

    if (count > matched) {
      matched = count;
      headerIndex = i;
    }
  }

  return { headerIndex, matched };
}

function buildColumnIndex(headerRow: unknown[]): {
  indexMap: Record<ColumnKey, number>;
  missing: string[];
} {
  const normalized = headerRow.map(normalizeHeader);
  const indexMap = {} as Record<ColumnKey, number>;
  const missing: string[] = [];

  for (const def of COLUMN_DEFS) {
    let found = -1;
    for (const alias of def.aliases) {
      const idx = normalized.indexOf(alias);
      if (idx !== -1) {
        found = idx;
        break;
      }
    }
    indexMap[def.key] = found;
    if (found === -1) missing.push(def.label);
  }

  return { indexMap, missing };
}

/** "5", "5.0", "5점" 형태를 모두 숫자로 해석합니다. 실패하면 null */
function parseRating(raw: string): number | null {
  const digits = raw.replace(/[^\d.]/g, '');
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return value;
}

/**
 * 포토/영상 열에 주소가 들어 있으면 http(s) 형식인지 확인합니다.
 * "Y", "포토" 처럼 주소가 아닌 값은 검사 대상에서 제외하기 위해
 * 영문/기호로만 이루어져 있고 "/" 또는 ":"를 포함한 값만 검사합니다.
 */
function findInvalidImageUrls(raw: string): string[] {
  const tokens = raw.split(/[\s,;|]+/).filter(Boolean);
  const candidates = tokens.filter(
    (token) => /^[\x21-\x7E]+$/.test(token) && (token.includes('/') || token.includes(':'))
  );

  return candidates.filter((token) => {
    // 프로토콜이 생략된 //cdn.example.com/a.jpg 형태는 허용합니다.
    const normalized = token.startsWith('//') ? `https:${token}` : token;
    if (!/^https?:\/\//i.test(normalized)) return true;

    try {
      return !new URL(normalized).hostname;
    } catch {
      return true;
    }
  });
}

function fail(error: string, status: number, missingColumns?: string[]) {
  const body: ParseResponse = missingColumns
    ? { ok: false, error, missingColumns }
    : { ok: false, error };
  return NextResponse.json(body, { status });
}

/** 행 수 제한 초과는 화면에서 안내 문구를 만들 수 있도록 코드와 숫자를 함께 돌려줍니다. */
function failRowLimit(rowCount: number) {
  const body: ParseResponse = {
    ok: false,
    error: `한 파일에서 처리할 수 있는 리뷰는 최대 ${MAX_REVIEW_ROWS.toLocaleString()}건입니다. (현재 ${rowCount.toLocaleString()}건) 기간을 나누어 업로드해 주세요.`,
    code: 'row_limit_exceeded',
    rowCount,
    maxRowCount: MAX_REVIEW_ROWS,
  };
  return NextResponse.json(body, { status: 413 });
}

export async function POST(request: Request) {
  // 엑셀 파싱은 관리자 전용 기능입니다. (아래 파싱 동작 자체는 그대로입니다)
  const admin = await requireAdmin();
  if (!admin.ok) {
    return adminGuardResponse(admin);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail('파일을 읽지 못했습니다. 다시 업로드해 주세요.', 400);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return fail('엑셀 파일이 첨부되지 않았습니다.', 400);
  }

  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return fail('.xlsx 파일만 업로드할 수 있습니다.', 400);
  }

  if (file.size === 0) {
    return fail('파일 내용이 비어 있습니다.', 400);
  }

  if (file.size > MAX_FILE_BYTES) {
    return fail('파일 크기가 10MB를 넘습니다. 파일을 나눠서 업로드해 주세요.', 413);
  }

  // 파일은 메모리에서만 처리하고 디스크·DB·외부 저장소에 남기지 않습니다.
  const buffer = Buffer.from(await file.arrayBuffer());

  let grid: unknown[][];
  let sheetName: string;
  try {
    // 첫 번째 시트만 읽습니다. 수식·HTML 해석은 사용하지 않습니다.
    const readOptions: XLSX.ParsingOptions = {
      type: 'buffer',
      cellFormula: false,
      cellHTML: false,
      sheets: 0,
    };
    let workbook = XLSX.read(buffer, readOptions);
    sheetName = workbook.SheetNames[0] ?? '';
    if (!sheetName) {
      return fail('엑셀 파일에 시트가 없습니다.', 400);
    }

    let sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      workbook = XLSX.read(buffer, { ...readOptions, sheets: undefined });
      sheet = workbook.Sheets[sheetName];
    }
    if (!sheet) {
      return fail('첫 번째 시트를 읽지 못했습니다.', 400);
    }

    grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      // 빈 행을 남겨 두어야 엑셀 실제 행 번호를 그대로 안내할 수 있습니다.
      blankrows: true,
    });
  } catch {
    return fail('엑셀 파일을 분석하지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요.', 400);
  }

  if (grid.length === 0) {
    return fail('첫 번째 시트에 데이터가 없습니다.', 400);
  }

  const { headerIndex } = findHeaderRow(grid);
  if (headerIndex === -1) {
    return fail(
      '필수 열을 찾지 못했습니다. 네이버 스마트스토어에서 내려받은 리뷰 엑셀이 맞는지 확인해 주세요.',
      400
    );
  }

  const { indexMap, missing } = buildColumnIndex(grid[headerIndex] ?? []);
  if (missing.length > 0) {
    return fail(`필수 열이 없습니다: ${missing.join(', ')}`, 400, missing);
  }

  const dataRows = grid.slice(headerIndex + 1);

  const cellOf = (row: unknown[], key: ColumnKey): string => {
    const idx = indexMap[key];
    return idx === -1 ? '' : cleanText(row[idx]);
  };

  /**
   * 값이 하나도 없는 행은 데이터로 세지 않습니다.
   * (엑셀 실제 행 번호를 유지하려고 빈 행을 남겨 둔 상태이기 때문입니다)
   */
  const isDataRow = (row: unknown[]): boolean =>
    Boolean(
      cellOf(row, 'reviewNo') ||
        cellOf(row, 'productNo') ||
        cellOf(row, 'productName') ||
        cellOf(row, 'reviewType') ||
        cellOf(row, 'rating') ||
        cellOf(row, 'content') ||
        cellOf(row, 'orderNo')
    );

  // 1차 순회: 실제 데이터 행 수와 리뷰글번호 중복 여부를 먼저 집계합니다.
  const reviewNoCount = new Map<string, number>();
  let dataRowCount = 0;

  for (const row of dataRows) {
    if (!isDataRow(row ?? [])) continue;
    dataRowCount += 1;

    const reviewNo = cellOf(row ?? [], 'reviewNo');
    if (reviewNo) {
      reviewNoCount.set(reviewNo, (reviewNoCount.get(reviewNo) ?? 0) + 1);
    }
  }

  // 행 수 제한은 서버에서 반드시 검사하고, 넘으면 파싱 결과를 내려보내지 않습니다.
  if (dataRowCount > MAX_REVIEW_ROWS) {
    return failRowLimit(dataRowCount);
  }

  const productNoSet = new Set<string>();
  const summary: ReviewSummary = {
    totalCount: 0,
    productCount: 0,
    photoCount: 0,
    generalCount: 0,
    monthUseCount: 0,
    invalidCount: 0,
    duplicateCount: 0,
  };
  const rows: ReviewRow[] = [];

  for (let i = 0; i < dataRows.length; i += 1) {
    const row = dataRows[i] ?? [];

    const reviewNo = cellOf(row, 'reviewNo');
    const productNo = cellOf(row, 'productNo');
    const productName = cellOf(row, 'productName');
    const reviewType = cellOf(row, 'reviewType');
    const rating = cellOf(row, 'rating');
    const imageRaw = cellOf(row, 'image');
    const rawContent = cellOf(row, 'content');
    const writer = cellOf(row, 'writer');
    const writtenAt = cellOf(row, 'writtenAt');
    const orderNo = cellOf(row, 'orderNo');

    // 1차 순회와 같은 기준으로 빈 행을 건너뜁니다.
    if (!isDataRow(row)) continue;

    summary.totalCount += 1;
    if (productNo) productNoSet.add(productNo);

    const normalizedType = normalizeHeader(reviewType);
    const hasImage = imageRaw.length > 0;

    // 일반/한달사용은 리뷰구분 값으로 나눕니다.
    // 포토/영상은 리뷰구분이 '일반'인 행에도 붙을 수 있어 중복 집계합니다.
    if (normalizedType === '일반') summary.generalCount += 1;
    if (normalizedType.includes('한달')) summary.monthUseCount += 1;
    if (hasImage || normalizedType.includes('포토') || normalizedType.includes('영상')) {
      summary.photoCount += 1;
    }

    const issues: string[] = [];
    if (!reviewNo) issues.push('리뷰글번호가 없습니다.');
    if (!productNo) issues.push('상품번호가 없습니다.');
    if (!rawContent) issues.push('리뷰 내용이 없습니다.');

    const ratingValue = parseRating(rating);
    if (ratingValue === null || !Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      issues.push('구매자평점이 1~5가 아닙니다.');
    }

    const invalidUrls = findInvalidImageUrls(imageRaw);
    if (invalidUrls.length > 0) {
      issues.push(`이미지 주소 형식이 올바르지 않습니다. (${invalidUrls[0]})`);
    }

    const isDuplicate = reviewNo.length > 0 && (reviewNoCount.get(reviewNo) ?? 0) > 1;
    if (isDuplicate) {
      issues.push('같은 리뷰글번호가 파일 안에 중복되어 있습니다.');
      summary.duplicateCount += 1;
    }

    // 중복만 있는 행은 '중복', 그 외 문제가 있으면 '오류'로 구분합니다.
    const hasError = issues.length > (isDuplicate ? 1 : 0);
    const status: ReviewRowStatus = hasError ? 'error' : isDuplicate ? 'duplicate' : 'ok';
    if (hasError) summary.invalidCount += 1;

    // 500건 제한을 서버에서 이미 확인했으므로 모든 행을 그대로 내려보냅니다.
    const contentTruncated = rawContent.length > MAX_CONTENT_LENGTH;
    rows.push({
      excelRow: headerIndex + 2 + i,
      reviewNo,
      productNo,
      productName,
      reviewType,
      rating,
      ratingValue,
      writer,
      writtenAt,
      content: contentTruncated ? rawContent.slice(0, MAX_CONTENT_LENGTH) : rawContent,
      contentTruncated,
      imageRaw,
      hasImage,
      orderNo,
      status,
      issues,
    });
  }

  if (summary.totalCount === 0) {
    return fail('리뷰 데이터가 한 건도 없습니다. 파일 내용을 확인해 주세요.', 400);
  }

  summary.productCount = productNoSet.size;

  const body: ParseResponse = {
    ok: true,
    fileName: file.name,
    sheetName,
    summary,
    rows,
    totalRowCount: summary.totalCount,
    maxRowCount: MAX_REVIEW_ROWS,
  };

  return NextResponse.json(body);
}
