'use client';

import { useEffect, useState } from 'react';

/**
 * 네이버 스마트스토어 기본 주소 확인·확정 영역.
 *
 * 네이버 상품번호로 상품 페이지를 열려면 스토어 기본 주소가 필요한데,
 * 엑셀에는 그 정보가 없어서 관리자가 직접 확인해 주어야 합니다.
 *
 * 흐름: 주소 입력 → '쇼핑몰 확인'으로 새 창에서 눈으로 확인 → '이 주소로 확정'
 * 확정된 주소만 localStorage에 남기고 다음 접속 때 복원합니다.
 */

const STORAGE_VERSION = 1;

/** 스토어 ID 형식. 네이버는 영문·숫자·밑줄·하이픈만 허용합니다. */
const STORE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/;

/** 스토어 ID로 오해하기 쉬운 경로 조각 (상품 상세 주소를 그대로 붙인 경우) */
const RESERVED_SEGMENTS = new Set(['products', 'product', 'category', 'search', 'main']);

export type SmartstoreUrlError = 'empty' | 'protocol' | 'host' | 'path';

export const SMARTSTORE_URL_MESSAGES: Record<SmartstoreUrlError, string> = {
  empty: '스마트스토어 주소를 입력해 주세요.',
  protocol: 'https 주소만 사용할 수 있습니다. (예: https://smartstore.naver.com/tmgst)',
  host: 'smartstore.naver.com 주소만 사용할 수 있습니다.',
  path: '스토어 ID를 찾지 못했습니다. https://smartstore.naver.com/스토어ID 형식으로 입력해 주세요.',
};

/**
 * 입력값을 스토어 기본 주소로 정규화합니다.
 *
 * - 프로토콜은 https만 허용합니다. (생략하면 https를 붙입니다)
 * - 호스트는 정확히 smartstore.naver.com이어야 합니다.
 * - query·hash는 버리고, 마지막 '/'도 정리합니다.
 * - 상품 상세 주소를 넣어도 스토어 기본 주소로 줄입니다.
 */
export function normalizeSmartstoreUrl(
  raw: string
): { ok: true; url: string; storeId: string } | { ok: false; reason: SmartstoreUrlError } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  // 프로토콜을 생략한 입력만 https를 붙여 줍니다. http로 명시한 값은 거절합니다.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: 'path' };
  }

  if (url.protocol !== 'https:') return { ok: false, reason: 'protocol' };
  if (url.hostname.toLowerCase() !== 'smartstore.naver.com') return { ok: false, reason: 'host' };

  // query·hash는 버리고 경로의 첫 조각만 스토어 ID로 씁니다.
  const storeId = url.pathname.split('/').filter(Boolean)[0] ?? '';
  if (!STORE_ID_PATTERN.test(storeId)) return { ok: false, reason: 'path' };
  if (RESERVED_SEGMENTS.has(storeId.toLowerCase())) return { ok: false, reason: 'path' };

  return { ok: true, url: `https://smartstore.naver.com/${storeId}`, storeId };
}

/** 확정된 스토어 주소와 네이버 상품번호로 상품 상세 주소를 만듭니다. */
export function buildSmartstoreProductUrl(storeUrl: string, naverProductNo: string): string {
  const productNo = naverProductNo.trim();
  if (!storeUrl || !/^\d{1,20}$/.test(productNo)) return '';
  return `${storeUrl}/products/${productNo}`;
}

// ── localStorage ────────────────────────────────────────────────

interface StoredPayload {
  version: number;
  mallId: string;
  url: string;
}

function storageKey(mallId: string): string {
  return `review-migration:smartstore-url:v${STORAGE_VERSION}:${mallId || 'unknown'}`;
}

function readStoredUrl(mallId: string): string {
  if (typeof window === 'undefined') return '';

  try {
    const raw = window.localStorage.getItem(storageKey(mallId));
    if (!raw) return '';

    const parsed = JSON.parse(raw) as StoredPayload;
    if (parsed.version !== STORAGE_VERSION || parsed.mallId !== mallId) return '';
    if (typeof parsed.url !== 'string') return '';

    // 저장된 값도 다시 검증해서 통과한 것만 씁니다.
    const normalized = normalizeSmartstoreUrl(parsed.url);
    return normalized.ok ? normalized.url : '';
  } catch {
    return '';
  }
}

function writeStoredUrl(mallId: string, url: string) {
  if (typeof window === 'undefined') return;

  try {
    if (!url) {
      window.localStorage.removeItem(storageKey(mallId));
      return;
    }

    const payload: StoredPayload = { version: STORAGE_VERSION, mallId, url };
    window.localStorage.setItem(storageKey(mallId), JSON.stringify(payload));
  } catch {
    // 저장 공간이 부족해도 화면 동작은 그대로 이어 갑니다.
  }
}

// ── 본체 ────────────────────────────────────────────────────────

interface SmartstoreAddressProps {
  /**
   * 연결된 쇼핑몰 ID. localStorage 키에 포함합니다.
   * 이 값이 바뀌면 부모가 key로 다시 마운트해 저장 값을 새로 읽습니다.
   */
  mallId: string;
  /** 확정된 주소가 바뀔 때 알려 줍니다. 미확정이면 빈 문자열 */
  onConfirmedChange: (url: string) => void;
}

export default function SmartstoreAddress({ mallId, onConfirmedChange }: SmartstoreAddressProps) {
  // 저장된 확정 주소는 첫 렌더에서 한 번만 읽습니다.
  const [restored] = useState(() => readStoredUrl(mallId));

  const [draft, setDraft] = useState(restored);
  /** 새 창으로 열어 눈으로 확인한 주소 */
  const [openedUrl, setOpenedUrl] = useState(restored);
  const [confirmedUrl, setConfirmedUrl] = useState(restored);
  const [errorMessage, setErrorMessage] = useState('');

  // 확정 상태를 부모(상품번호 링크)에게 알려 줍니다.
  useEffect(() => {
    onConfirmedChange(confirmedUrl);
  }, [confirmedUrl, onConfirmedChange]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    setErrorMessage('');

    const normalized = normalizeSmartstoreUrl(value);
    const nextUrl = normalized.ok ? normalized.url : '';

    // 확정한 주소와 달라지면 다시 미확정 상태로 되돌립니다.
    if (confirmedUrl && nextUrl !== confirmedUrl) {
      setConfirmedUrl('');
      writeStoredUrl(mallId, '');
    }
    if (openedUrl && nextUrl !== openedUrl) {
      setOpenedUrl('');
    }
  };

  const handleOpen = () => {
    const normalized = normalizeSmartstoreUrl(draft);
    if (!normalized.ok) {
      setErrorMessage(SMARTSTORE_URL_MESSAGES[normalized.reason]);
      return;
    }

    setErrorMessage('');
    setOpenedUrl(normalized.url);
    window.open(normalized.url, '_blank', 'noopener,noreferrer');
  };

  const handleConfirm = () => {
    const normalized = normalizeSmartstoreUrl(draft);
    if (!normalized.ok) {
      setErrorMessage(SMARTSTORE_URL_MESSAGES[normalized.reason]);
      return;
    }

    setErrorMessage('');
    setDraft(normalized.url);
    setConfirmedUrl(normalized.url);
    writeStoredUrl(mallId, normalized.url);
  };

  const normalizedDraft = normalizeSmartstoreUrl(draft);
  const canConfirm = normalizedDraft.ok && normalizedDraft.url === openedUrl;
  const isConfirmed = normalizedDraft.ok && normalizedDraft.url === confirmedUrl;

  return (
    /*
      상단 고정 설정 영역의 오른쪽 카드(40% 너비)입니다.
      배경·테두리만 연한 초록으로 바꾸고 둥근 모서리·그림자·내부 여백은 그대로 둡니다.
      글자 크기와 줄 간격은 왼쪽 카페24 연결 단락과 같게 맞췄습니다.
    */
    <div className="min-w-0 bg-[#F3FAF6] rounded-lg border border-[#DCEFE3] shadow-sm p-5 sm:p-6">
      {/* 첫 줄: 제목 */}
      <h3 className="text-[15px] font-bold text-gray-900 mb-1">네이버 스마트스토어 주소</h3>

      {/* 둘째 줄: 설명 */}
      <p className="text-[13px] text-gray-500 mb-5 leading-relaxed">
        <b className="text-gray-700">쇼핑몰 확인</b> 후 <b className="text-gray-700">확정</b>하면 네이버
        상품번호로 상품 페이지를 열 수 있습니다.
      </p>

      {/* 셋째 줄: 주소 입력창 (카드 내부 전체 너비) */}
      <input
        type="url"
        inputMode="url"
        value={draft}
        onChange={(e) => handleDraftChange(e.target.value)}
        placeholder="https://smartstore.naver.com/tmgst"
        className="w-full px-3 h-[42px] bg-white border-2 border-gray-300 rounded-md text-[13px] font-bold text-gray-700 focus:border-[#5244e8] focus:outline-none"
      />

      {/* 넷째 줄: 버튼 두 개를 나란히 */}
      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          onClick={handleOpen}
          className="px-4 h-[42px] !bg-white hover:!bg-gray-100 border-2 border-gray-400 !text-gray-800 font-bold text-[13px] rounded-md transition-colors shadow-sm whitespace-nowrap"
        >
          쇼핑몰 확인
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm || isConfirmed}
          className="px-4 h-[42px] bg-[#5244e8] hover:bg-blue-700 !text-white font-bold text-[13px] rounded-md transition-colors shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
        >
          이 주소로 확정
        </button>
      </div>

      {/* 다섯째 줄: 확정된 주소. 길면 말줄임표로 자르고 전체 주소는 title로 확인합니다. */}
      {isConfirmed && (
        <p className="mt-3 text-[12px] font-bold text-emerald-700 truncate" title={confirmedUrl}>
          확정된 주소: {confirmedUrl}
        </p>
      )}

      {errorMessage && (
        <p className="mt-3 text-[12px] font-bold text-red-600 leading-relaxed">{errorMessage}</p>
      )}

      {/* 확정된 주소는 위 줄에서 보여 주므로 여기서는 미확정 상태만 안내합니다. */}
      {!isConfirmed &&
        (canConfirm ? (
          <p className="mt-3 text-[12px] font-bold text-[#5244e8] leading-relaxed">
            새 창에서 스토어를 확인했습니다. 맞다면 <b>이 주소로 확정</b>을 눌러 주세요.
          </p>
        ) : (
          <p className="mt-3 text-[12px] font-bold text-amber-600 leading-relaxed">
            아직 확정되지 않았습니다. 확정 전에는 네이버 상품번호가 일반 텍스트로만 표시됩니다.
          </p>
        ))}
    </div>
  );
}
