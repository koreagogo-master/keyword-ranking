'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Google 상품평 피드 스냅샷 상태 표시 · 수동 갱신 (관리자 화면 전용).
 *
 * 갱신 실패는 사용자에게 아무 증상도 만들지 않습니다. 피드는 계속 잘 나오니까요.
 * 스냅샷이 조용히 늙는 것을 알아챌 수 있는 유일한 수단이 이 영역입니다.
 *
 * page.tsx가 이미 클라이언트 컴포넌트지만, 1,200줄짜리 파일을 더 키우지 않으려고
 * 상태 표시와 갱신 버튼만 따로 떼어 두었습니다.
 *
 * 이 컴포넌트는 카페24 게시판을 직접 부르지 않습니다.
 * 수집·검증·저장은 전부 서버의 갱신기가 합니다.
 */

interface SnapshotExclusion {
  reason: string;
  label: string;
  count: number;
}

interface SnapshotCurrent {
  generatedAt: string;
  reviewCount: number;
  excludedCount: number;
  verifiedPurchaseCount: number;
  scannedArticleCount: number;
  byteSize: number;
  boardNo: number;
  source: 'scheduled' | 'after_upload' | 'manual';
  exclusions: SnapshotExclusion[];
  ageHours: number | null;
  stale: boolean;
}

interface SnapshotRun {
  id: string;
  status: 'ready' | 'failed';
  source: 'scheduled' | 'after_upload' | 'manual';
  reviewCount: number | null;
  excludedCount: number | null;
  byteSize: number | null;
  errorKind: string | null;
  generatedAt: string;
}

interface SnapshotStatus {
  ok: true;
  maxAgeHours: number;
  current: SnapshotCurrent | null;
  recentRuns: SnapshotRun[];
}

const SOURCE_LABELS: Record<SnapshotCurrent['source'], string> = {
  scheduled: '예약 갱신',
  after_upload: '업로드 완료 후',
  manual: '수동 갱신',
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatAge(ageHours: number | null): string {
  if (ageHours === null) return '-';
  if (ageHours < 1) return `${Math.max(0, Math.round(ageHours * 60))}분 전`;
  if (ageHours < 48) return `${Math.round(ageHours)}시간 전`;
  return `${Math.round(ageHours / 24)}일 전`;
}

export default function GoogleFeedSnapshotPanel() {
  const [status, setStatus] = useState<SnapshotStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/review-migration/google-reviews/snapshot/status');

      if (res.status === 401 || res.status === 403) {
        // 관리자가 아니면 이 영역을 아예 보여 주지 않습니다.
        setStatus(null);
        setError('forbidden');
        return;
      }

      const data = (await res.json()) as SnapshotStatus | { error?: string };

      if (!res.ok || !('ok' in data)) {
        setError('스냅샷 상태를 불러오지 못했습니다.');
        return;
      }

      setStatus(data);
    } catch {
      setError('스냅샷 상태를 불러오지 못했습니다. 네트워크를 확인해 주세요.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  /**
   * 수동 갱신.
   *
   * force는 리뷰 수 급감 검사 하나만 건너뜁니다.
   * 리뷰를 의도적으로 많이 지운 것이 확실할 때만 쓰도록 따로 확인을 받습니다.
   */
  const runRefresh = useCallback(
    async (force: boolean) => {
      if (isRefreshing) return;

      if (force) {
        const confirmed = window.confirm(
          '리뷰 수가 크게 줄어도 그대로 저장합니다.\n' +
            '리뷰를 의도적으로 많이 삭제한 것이 확실할 때만 사용해 주세요.\n\n' +
            '계속하시겠습니까?'
        );
        if (!confirmed) return;
      }

      setIsRefreshing(true);
      setError('');
      setMessage('');

      try {
        const res = await fetch('/api/review-migration/google-reviews/snapshot/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger: 'manual', force }),
        });

        const data = (await res.json()) as { ok?: true; reviewCount?: number; error?: string };

        if (!res.ok || !data.ok) {
          setError(data.error ?? '스냅샷을 갱신하지 못했습니다.');
          return;
        }

        setMessage(`갱신 완료 — 리뷰 ${(data.reviewCount ?? 0).toLocaleString()}건을 피드에 담았습니다.`);
      } catch {
        setError('갱신 요청을 보내지 못했습니다. 네트워크를 확인해 주세요.');
      } finally {
        setIsRefreshing(false);
        await loadStatus();
      }
    },
    [isRefreshing, loadStatus]
  );

  // 관리자가 아니면 표시하지 않습니다.
  if (error === 'forbidden') return null;

  const current = status?.current ?? null;
  const failedRuns = (status?.recentRuns ?? []).filter((run) => run.status === 'failed');

  return (
    <section className="bg-white p-5 sm:p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Google 상품평 피드</h2>
          <p className="mt-1 text-[12px] text-gray-500 leading-relaxed">
            Google이 가져가는 XML은 미리 만들어 둔 스냅샷입니다. 매일 밤 11시 30분에 자동으로 갱신되고, 새
            리뷰를 등록하면 등록 직후에도 갱신됩니다.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={isLoading || isRefreshing}
            className="px-3 py-2 rounded-md text-[13px] font-bold border border-gray-300 bg-white !text-slate-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoading ? '확인 중…' : '상태 새로고침'}
          </button>
          <button
            type="button"
            onClick={() => void runRefresh(false)}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-md text-[13px] font-bold bg-[#5244e8] text-white hover:bg-[#4438c9] disabled:opacity-50"
          >
            {isRefreshing ? '갱신 중… (약 20초)' : '지금 갱신'}
          </button>
        </div>
      </div>

      {current ? (
        <div className="mt-4">
          <div
            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
              current.stale ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {current.stale ? `오래됨 (${status?.maxAgeHours}시간 초과)` : '최신'}
          </div>

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
            <div>
              <p className="text-gray-500">생성 시각</p>
              <p className="font-bold text-gray-900">{formatDateTime(current.generatedAt)}</p>
              <p className="text-[12px] text-gray-500">{formatAge(current.ageHours)}</p>
            </div>
            <div>
              <p className="text-gray-500">담긴 리뷰</p>
              <p className="font-bold text-gray-900">{current.reviewCount.toLocaleString()}건</p>
              <p className="text-[12px] text-gray-500">
                제외 {current.excludedCount.toLocaleString()}건
              </p>
            </div>
            <div>
              <p className="text-gray-500">구매 확인</p>
              <p className="font-bold text-gray-900">
                {current.verifiedPurchaseCount.toLocaleString()}건
              </p>
              <p className="text-[12px] text-gray-500">게시판 {current.boardNo}번</p>
            </div>
            <div>
              <p className="text-gray-500">XML 크기</p>
              <p className="font-bold text-gray-900">{formatBytes(current.byteSize)}</p>
              <p className="text-[12px] text-gray-500">{SOURCE_LABELS[current.source]}</p>
            </div>
          </div>

          {current.exclusions.length > 0 && (
            <p className="mt-3 text-[12px] text-gray-500 leading-relaxed">
              제외 사유:{' '}
              {current.exclusions.map((item) => `${item.label} ${item.count.toLocaleString()}건`).join(' / ')}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-[13px] font-bold text-amber-700 leading-relaxed">
          아직 만들어진 스냅샷이 없습니다. [지금 갱신]을 눌러 첫 스냅샷을 만들어 주세요. 그 전까지 Google
          피드 주소는 503으로 응답합니다.
        </p>
      )}

      {message && (
        <p className="mt-3 text-[13px] font-bold text-emerald-700 leading-relaxed">{message}</p>
      )}

      {error && error !== 'forbidden' && (
        <p className="mt-3 text-[13px] font-bold text-red-600 leading-relaxed">{error}</p>
      )}

      {/*
        갱신에 실패해도 직전 스냅샷이 그대로 제공되므로 피드에는 아무 증상이 없습니다.
        실패가 쌓이고 있다는 것을 여기서만 알 수 있습니다.
      */}
      {failedRuns.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[13px] font-bold text-amber-700">
            최근 갱신 실패 {failedRuns.length.toLocaleString()}건
          </p>
          <ul className="mt-1 space-y-0.5 text-[12px] text-amber-700">
            {failedRuns.slice(0, 5).map((run) => (
              <li key={run.id}>
                {formatDateTime(run.generatedAt)} · {SOURCE_LABELS[run.source]} · {run.errorKind ?? '-'}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[12px] text-amber-700 leading-relaxed">
            실패해도 위의 정상 스냅샷은 그대로 제공됩니다. 생성 시각이 오래되지 않았다면 조치하지 않아도
            됩니다.
          </p>
        </div>
      )}

      {/*
        리뷰 수 급감으로 막힌 경우에만 쓰는 버튼입니다.
        평소에는 쓸 일이 없어 눈에 띄지 않게 아래에 둡니다.
      */}
      {failedRuns.some((run) => run.errorKind === 'validate:suspicious_shrink') && (
        <button
          type="button"
          onClick={() => void runRefresh(true)}
          disabled={isRefreshing}
          className="mt-3 px-3 py-2 rounded-md text-[12px] font-bold border border-red-300 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          검사 무시하고 갱신
        </button>
      )}
    </section>
  );
}
