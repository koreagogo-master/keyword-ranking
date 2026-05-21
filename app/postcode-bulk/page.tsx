'use client';

import { useState } from 'react';
import SellerTabs from '@/components/SellerTabs';

const MAX_ADDRESSES = 20;

interface ResultItem {
  address: string;
  zipNo: string;
  success: boolean;
  editValue?: string;
  retryError?: string;
}

function PostcodeBulkContent() {
  const [inputText, setInputText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [summary, setSummary] = useState<{ total: number; successCount: number; failCount: number } | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [retryingIdx, setRetryingIdx] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const parseAddresses = (text: string): string[] =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

  const handleSearch = async () => {
    setErrorMessage('');
    const addresses = parseAddresses(inputText);

    if (addresses.length === 0) {
      setErrorMessage('주소를 한 줄에 하나씩 입력해 주세요.');
      return;
    }

    if (addresses.length > MAX_ADDRESSES) {
      setErrorMessage(`최대 ${MAX_ADDRESSES}개까지만 입력할 수 있습니다. 현재 ${addresses.length}개입니다.`);
      return;
    }

    setIsSearching(true);
    setSearchDone(false);
    setHasSearched(false);
    setResults([]);
    setSummary(null);

    try {
      const res = await fetch('/api/postcode-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses }),
      });

      const data = await res.json();

      if (!data.success) {
        setErrorMessage(data.error || '서버 오류가 발생했습니다.');
        return;
      }

      const items: ResultItem[] = data.results.map((r: { address: string; zipNo: string; success: boolean }) => ({
        ...r,
        editValue: r.address,
        retryError: '',
      }));

      setResults(items);
      setSummary(data.summary);
      setHasSearched(true);
      setSearchDone(true);
    } catch {
      setErrorMessage('서버 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRetry = async (idx: number) => {
    const addr = results[idx].editValue?.trim() || results[idx].address;

    if (!addr || addr.length < 3) {
      setResults((prev) => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], retryError: '주소를 올바르게 입력해 주세요. (3자 이상)' };
        return updated;
      });
      return;
    }

    setRetryingIdx(idx);
    setResults((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], retryError: '' };
      return updated;
    });

    try {
      const res = await fetch('/api/postcode-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: [addr] }),
      });

      const data = await res.json();

      if (!data.success) {
        setResults((prev) => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], retryError: data.error || '재검색 중 오류가 발생했습니다.' };
          return updated;
        });
        return;
      }

      const newZip: string = data.results[0]?.zipNo ?? '검색실패';
      const newSuccess: boolean = data.results[0]?.success ?? false;

      setResults((prev) => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], zipNo: newZip, success: newSuccess, address: addr, retryError: '' };
        return updated;
      });

      setSummary((prev) => {
        if (!prev) return prev;
        const wasSuccess = results[idx].success;
        if (wasSuccess === newSuccess) return prev;
        return {
          ...prev,
          successCount: prev.successCount + (newSuccess ? 1 : -1),
          failCount: prev.failCount + (newSuccess ? -1 : 1),
        };
      });
    } catch {
      setResults((prev) => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], retryError: '재검색 중 오류가 발생했습니다.' };
        return updated;
      });
    } finally {
      setRetryingIdx(null);
    }
  };

  const handleCopy = async () => {
    if (results.length === 0) return;
    setCopyError('');
    const text = results.map((r) => r.zipNo).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2500);
    } catch {
      setCopyError('복사에 실패했습니다. 직접 선택하여 복사해 주세요.');
    }
  };

  const addressCount = parseAddresses(inputText).length;
  const isOverLimit = addressCount > MAX_ADDRESSES;

  return (
    <>
      <SellerTabs />

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold !text-gray-900 mb-2">우편번호 대량 변환기</h1>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            주소를 한 줄에 하나씩 입력하면 우편번호만 빠르게 확인할 수 있습니다.
          </p>
          <p className="text-sm font-bold text-blue-600 mt-1">
            ※ 최대 {MAX_ADDRESSES}개까지 한 번에 검색할 수 있습니다. 비로그인도 사용 가능합니다.
          </p>
          <p className="text-sm text-slate-400 mt-1">
            상세주소·배송메모가 포함되어 있어도 자동 보정 후 검색합니다.
          </p>
        </div>
      </div>

      {/* 입력 카드 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
        {/* 입력창 + 버튼 가로 배치 */}
        <div className="flex gap-5 items-start">

          {/* 왼쪽: 주소 입력 영역 (약 70%) */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-[13px] font-bold text-gray-700">
                주소 입력 (한 줄에 하나씩)
              </label>
              <span className={`text-[12px] font-bold ${isOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
                {addressCount} / {MAX_ADDRESSES}
              </span>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (searchDone) setSearchDone(false);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder={`서울특별시 강남구 테헤란로 152\n경기도 성남시 분당구 판교역로 235\n부산광역시 해운대구 해운대해변로 264`}
              rows={10}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#5244e8] focus:bg-white transition-colors text-sm font-medium resize-none leading-relaxed"
            />
            {isOverLimit && (
              <p className="text-xs font-bold text-red-500 mt-1">
                ⚠ 최대 {MAX_ADDRESSES}개까지만 입력 가능합니다. 현재 {addressCount}개 입력됨.
              </p>
            )}
          </div>

          {/* 오른쪽: 버튼 영역 — label 높이만큼 pt 주어 textarea 상단에 맞춤 */}
          <div className="shrink-0 w-36 pt-7">
            {isSearching ? (
              <div className="h-[46px] flex items-center justify-center gap-2 border border-[#5244e8]/30 rounded-md bg-indigo-50">
                <div className="w-4 h-4 border-2 border-[#5244e8] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-bold !text-[#5244e8]">검색 중...</span>
              </div>
            ) : searchDone ? (
              <button
                onClick={handleSearch}
                className="w-full h-[46px] px-4 bg-emerald-500 hover:bg-emerald-600 !text-white font-bold rounded-md transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                검색 완료
              </button>
            ) : (
              <button
                onClick={handleSearch}
                disabled={isOverLimit || addressCount === 0}
                className="w-full h-[46px] px-4 bg-[#5244e8] hover:bg-blue-700 !text-white font-bold rounded-md transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                우편번호 검색
              </button>
            )}
          </div>

        </div>

        {/* 인라인 에러 메시지 박스 */}
        {errorMessage && (
          <div className="mt-4 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-sm font-bold text-red-600 leading-relaxed">{errorMessage}</p>
          </div>
        )}
      </div>

      {/* 초기 안내 */}
      {!hasSearched && !isSearching && (
        <div className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 text-center flex flex-col items-center justify-center min-h-[240px]">
          <h3 className="text-lg font-bold text-gray-700 mb-2">
            주소를 입력하고 우편번호를 검색해보세요!
          </h3>
          <p className="text-sm text-gray-500">
            도로명주소, 지번주소 모두 검색 가능합니다. 결과는 입력 순서대로 출력됩니다.
          </p>
        </div>
      )}

      {/* 결과 카드 */}
      {hasSearched && (
        <div className="animate-in fade-in duration-500">
          {/* 결과 요약 + 복사 버튼 */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              {summary && (
                <span className="text-[14px] font-bold text-gray-700">
                  총 <span className="text-[#5244e8]">{summary.total}</span>개 중{' '}
                  <span className="text-emerald-600">{summary.successCount}개 성공</span>
                  {summary.failCount > 0 && (
                    <span className="text-red-500">, {summary.failCount}개 검색실패</span>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {copyDone && (
                <span className="text-[13px] font-bold text-emerald-600 animate-in fade-in duration-300">
                  ✓ 클립보드에 복사되었습니다!
                </span>
              )}
              {copyError && (
                <span className="text-[13px] font-bold text-red-500">
                  ⚠ {copyError}
                </span>
              )}
              <button
                onClick={handleCopy}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-800 !text-white font-bold text-sm rounded-md transition-colors shadow-sm flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                우편번호 복사
              </button>
            </div>
          </div>

          {/* 결과 테이블 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#f8f9fa] border-b border-gray-200 text-gray-700 font-bold">
                <tr>
                  <th className="px-4 py-2.5 text-center w-[60px]">순번</th>
                  <th className="px-6 py-2.5 w-[120px] text-center">우편번호</th>
                  <th className="px-6 py-2.5">입력 주소</th>
                  <th className="px-4 py-2.5 text-center w-[120px]">재검색</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-gray-200 last:border-0 transition-colors ${
                      item.success ? 'hover:bg-[#5244e8]/5' : 'bg-red-50/60 hover:bg-red-50'
                    }`}
                  >
                    <td className="px-4 py-3 text-center text-gray-500 font-medium text-[13px]">
                      {idx + 1}
                    </td>

                    <td className="px-6 py-3 text-center font-bold">
                      {item.success ? (
                        <span className="text-[#5244e8] text-[16px] tracking-widest">{item.zipNo}</span>
                      ) : (
                        <span className="text-red-500 text-[13px] font-bold bg-red-100 px-2.5 py-0.5 rounded-full">
                          검색실패
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-3">
                      {item.success ? (
                        <span className="text-gray-700 font-medium">{item.address}</span>
                      ) : (
                        <input
                          type="text"
                          value={item.editValue ?? item.address}
                          onChange={(e) =>
                            setResults((prev) => {
                              const updated = [...prev];
                              updated[idx] = { ...updated[idx], editValue: e.target.value };
                              return updated;
                            })
                          }
                          className="w-full px-3 py-1.5 bg-white border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-400 text-sm font-medium text-gray-700"
                          placeholder="주소를 수정하고 재검색하세요"
                        />
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {!item.success && (
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => handleRetry(idx)}
                            disabled={retryingIdx === idx}
                            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 !text-white font-bold text-[12px] rounded-md transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            {retryingIdx === idx ? (
                              <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                검색중
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                재검색
                              </>
                            )}
                          </button>
                          {item.retryError && (
                            <span className="text-[11px] font-bold text-red-500 leading-tight max-w-[100px] text-center">
                              {item.retryError}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 복사용 안내 */}
          <p className="text-xs text-gray-400 mt-3 text-right">
            [우편번호 복사] 버튼을 누르면 우편번호만 줄 단위로 클립보드에 복사됩니다. 엑셀/메모장에 바로 붙여넣기 가능합니다.
          </p>
        </div>
      )}
    </>
  );
}

export default function PostcodeBulkPage() {
  return (
    <>
      <link
        href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css"
        rel="stylesheet"
        type="text/css"
      />
      <div
        className="flex min-h-screen bg-[#f8f9fa] !text-black antialiased tracking-tight"
        style={{ fontFamily: "'NanumSquare', sans-serif" }}
      >
        <main className="flex-1 ml-64 p-10 relative">
          <div className="max-w-7xl mx-auto">
            <PostcodeBulkContent />
          </div>
        </main>
      </div>
    </>
  );
}
