'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { createClient } from '@/app/utils/supabase/client';
import AdminTabs from '@/components/AdminTabs';

interface FreeUsageRecord {
  id: string;
  created_at: string;
  user_type: string;
  user_id: string | null;
  email: string | null;
  page_type: string;
  page_name: string | null;
  keyword: string | null;
  summary: string | null;
  ip_address: string | null;
  remaining_free_count: number | null;
  status: string;
}

type PresetType = '오늘' | '최근7일' | '최근30일' | '이번달' | '지난달' | '최근90일' | '직접설정';

const PRESETS: PresetType[] = ['오늘', '최근7일', '최근30일', '이번달', '지난달', '최근90일', '직접설정'];

// KST 기준 오늘 날짜 문자열 (YYYY-MM-DD)
// Date.now()는 UTC ms이므로 +9h 해서 KST 날짜 추출
const getKSTDateString = (): string =>
  new Date(Date.now() + 9 * 3600000).toISOString().split('T')[0];

// UTC ms → KST 날짜 문자열
const msToKSTDateString = (utcMs: number): string =>
  new Date(utcMs + 9 * 3600000).toISOString().split('T')[0];

// KST 날짜 문자열 → Supabase 조회용 UTC ISO (00:00:00 KST)
const toUTCStart = (kstDate: string): string =>
  new Date(`${kstDate}T00:00:00+09:00`).toISOString();

// KST 날짜 문자열 → Supabase 조회용 UTC ISO (23:59:59 KST)
const toUTCEnd = (kstDate: string): string =>
  new Date(`${kstDate}T23:59:59+09:00`).toISOString();

// 프리셋별 KST 날짜 범위 계산
const getPresetRange = (preset: PresetType): { start: string; end: string } => {
  const today = getKSTDateString();
  const DAY = 86400000;
  const todayMidnightUTCMs = new Date(`${today}T00:00:00+09:00`).getTime();

  switch (preset) {
    case '오늘':
      return { start: today, end: today };

    case '최근7일':
      return { start: msToKSTDateString(todayMidnightUTCMs - 6 * DAY), end: today };

    case '최근30일':
      return { start: msToKSTDateString(todayMidnightUTCMs - 29 * DAY), end: today };

    case '이번달': {
      const d = new Date(`${today}T00:00:00+09:00`);
      const firstDay = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
      return { start: firstDay, end: today };
    }

    case '지난달': {
      const d = new Date(`${today}T00:00:00+09:00`);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth(); // 0-indexed 현재월
      const prevMonthNum = month === 0 ? 12 : month; // 1-indexed 이전월
      const prevYear = month === 0 ? year - 1 : year;
      const firstDay = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}-01`;
      // 이번 달 1일 KST 00:00 - 1일 = 지난달 말일
      const lastDayMs =
        new Date(`${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00+09:00`).getTime() - DAY;
      return { start: firstDay, end: msToKSTDateString(lastDayMs) };
    }

    case '최근90일':
      return { start: msToKSTDateString(todayMidnightUTCMs - 89 * DAY), end: today };

    default:
      return { start: today, end: today };
  }
};

export default function AdminUsagePage() {
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const alertShown = useRef(false);

  const [records, setRecords] = useState<FreeUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<PresetType>('오늘');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [dateError, setDateError] = useState('');
  const [activeRange, setActiveRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });

  const [searchEmail, setSearchEmail] = useState('');
  const [searchPageName, setSearchPageName] = useState('');
  const [filterUserType, setFilterUserType] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // 관리자 권한 확인
  useEffect(() => {
    if (!isAuthLoading) {
      if (!user || profile?.role?.toLowerCase() !== 'admin') {
        if (!alertShown.current) {
          alert('접근 권한이 없습니다.');
          alertShown.current = true;
          router.replace('/');
        }
      }
    }
  }, [user, profile, isAuthLoading, router]);

  // 관리자 확인 후 기본 데이터 로드 (오늘)
  useEffect(() => {
    if (profile?.role?.toLowerCase() === 'admin') {
      const range = getPresetRange('오늘');
      setActiveRange(range);
      fetchRecords(range.start, range.end);
    }
  }, [profile?.role]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchEmail, searchPageName, filterUserType, records]);

  // Supabase 기간 조건 조회 (limit 없음, 날짜 범위로 방어)
  const fetchRecords = async (startDate: string, endDate: string) => {
    setLoading(true);
    setDateError('');
    const supabase = createClient();

    const { data, error } = await supabase
      .from('free_usage_history')
      .select('*')
      .gte('created_at', toUTCStart(startDate))
      .lte('created_at', toUTCEnd(endDate))
      .order('created_at', { ascending: false });

    if (error) {
      console.error('free_usage_history 조회 실패:', error);
    } else {
      setRecords((data as FreeUsageRecord[]) || []);
    }
    setLoading(false);
  };

  // 프리셋 버튼 클릭
  const handlePresetClick = (p: PresetType) => {
    setPreset(p);
    setDateError('');
    if (p !== '직접설정') {
      const range = getPresetRange(p);
      setActiveRange(range);
      fetchRecords(range.start, range.end);
    }
  };

  // 직접 설정 [조회] 버튼
  const handleCustomSearch = () => {
    if (!customStart || !customEnd) {
      setDateError('시작일과 종료일을 모두 선택해 주세요.');
      return;
    }
    if (customStart > customEnd) {
      setDateError('시작일이 종료일보다 늦을 수 없습니다.');
      return;
    }
    const diffDays =
      (new Date(`${customEnd}T23:59:59+09:00`).getTime() -
        new Date(`${customStart}T00:00:00+09:00`).getTime()) /
      86400000;
    if (diffDays > 365) {
      setDateError('최대 1년 범위까지만 조회할 수 있습니다.');
      return;
    }
    const range = { start: customStart, end: customEnd };
    setActiveRange(range);
    fetchRecords(range.start, range.end);
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // 요약 카드: 현재 조회된 기간 기준 (records 전체 기준)
  const stats = useMemo(() => {
    const total = records.length;
    const member = records.filter((r) => r.user_type === 'member').length;
    const guest = records.filter((r) => r.user_type === 'guest').length;
    return { total, member, guest };
  }, [records]);

  // 클라이언트 필터: 이메일/사용처/구분 (날짜는 Supabase에서 처리)
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchUserType = filterUserType === 'ALL' || r.user_type === filterUserType;
      const displayEmail = r.email ?? '';
      const matchEmail = displayEmail.toLowerCase().includes(searchEmail.toLowerCase());
      // 사용처: page_name 우선, 없으면 page_type으로 검색 (화면 표시 기준과 동일)
      const displayPageName = (r.page_name ?? r.page_type ?? '').toLowerCase();
      const matchPageName = searchPageName
        ? displayPageName.includes(searchPageName.toLowerCase())
        : true;
      return matchUserType && matchEmail && matchPageName;
    });
  }, [records, filterUserType, searchEmail, searchPageName]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
  const paginated = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const getPageNumbers = () => {
    const maxPages = 5;
    let start = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let end = Math.min(totalPages, start + maxPages - 1);
    if (end - start + 1 < maxPages) start = Math.max(1, end - maxPages + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center font-bold text-slate-500">
        권한 확인 중...
      </div>
    );
  }
  if (!user || profile?.role?.toLowerCase() !== 'admin') {
    return null;
  }

  return (
    <>
      <link
        href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css"
        rel="stylesheet"
        type="text/css"
      />

      <div
        className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight"
        style={{ fontFamily: "'NanumSquare', sans-serif" }}
      >
        <main className="flex-1 ml-64 p-10 relative">
          <div className="max-w-[1200px] mx-auto">
            <AdminTabs />

            {/* 페이지 헤더 */}
            <div className="mb-8 text-center relative">
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">무료 사용 기록</h1>
              <p className="text-sm text-slate-500">
                회원 무료 검색과 비회원 체험 사용 내역을 확인합니다.
              </p>
              <div className="absolute right-0 bottom-0">
                <button
                  onClick={() => {
                    if (activeRange.start && activeRange.end) {
                      fetchRecords(activeRange.start, activeRange.end);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-[14px] font-bold !text-slate-500 hover:!text-[#5244e8] transition-colors !bg-white px-4 py-2 rounded-sm border border-gray-200 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  새로고침
                </button>
              </div>
            </div>

            {/* 요약 카드 */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 bg-white border border-slate-200 rounded-lg p-5 shadow-sm text-center">
                <p className="text-[13px] font-bold text-slate-500 mb-1">전체 기록</p>
                <p className="text-[24px] font-black text-slate-800">
                  {stats.total.toLocaleString()}
                  <span className="text-[13px] font-bold text-slate-400 ml-1">건</span>
                </p>
              </div>
              <div className="flex-1 bg-white border border-slate-200 rounded-lg p-5 shadow-sm text-center">
                <p className="text-[13px] font-bold text-slate-500 mb-1">회원 무료 사용</p>
                <p className="text-[24px] font-black text-indigo-600">
                  {stats.member.toLocaleString()}
                  <span className="text-[13px] font-bold text-indigo-300 ml-1">건</span>
                </p>
              </div>
              <div className="flex-1 bg-white border border-slate-200 rounded-lg p-5 shadow-sm text-center">
                <p className="text-[13px] font-bold text-slate-500 mb-1">비회원 체험</p>
                <p className="text-[24px] font-black text-emerald-600">
                  {stats.guest.toLocaleString()}
                  <span className="text-[13px] font-bold text-emerald-300 ml-1">건</span>
                </p>
              </div>
            </div>

            {/* 필터 */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 shadow-sm space-y-4">

              {/* 기간 프리셋 + 직접설정 입력 (같은 줄) */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-extrabold text-slate-700 w-16 shrink-0">기간 설정</span>
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePresetClick(p)}
                    className={`px-3 py-1.5 rounded-md text-[13px] font-bold border transition-colors shrink-0 ${
                      preset === p
                        ? 'bg-[#5244e8] !text-white border-[#5244e8]'
                        : 'bg-white !text-slate-600 border-gray-300 hover:border-[#5244e8] hover:!text-[#5244e8]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                {preset === '직접설정' && (
                  <>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8]"
                    />
                    <span className="text-gray-400 shrink-0">~</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8]"
                    />
                    <button
                      onClick={handleCustomSearch}
                      className="px-4 py-1.5 bg-[#5244e8] !text-white rounded-md text-[13px] font-bold hover:bg-[#3d31c4] transition-colors shrink-0"
                    >
                      조회
                    </button>
                    {dateError && (
                      <span className="text-[13px] text-red-500 font-bold shrink-0">{dateError}</span>
                    )}
                  </>
                )}
                {preset !== '직접설정' && (
                  <span className="text-[12px] text-slate-400">
                    최근 7일·30일·90일은 오늘을 포함합니다.
                  </span>
                )}
              </div>

              {/* 구분 + 이메일 + 사용처 필터 */}
              <div className="flex gap-4 items-center flex-wrap pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[13px] font-extrabold text-slate-700 w-16 shrink-0">구분</span>
                  <select
                    value={filterUserType}
                    onChange={(e) => setFilterUserType(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8] cursor-pointer min-w-[120px]"
                  >
                    <option value="ALL">전체</option>
                    <option value="member">회원</option>
                    <option value="guest">비회원</option>
                  </select>
                </div>
                <div className="w-px h-5 bg-gray-200 shrink-0" />
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <span className="text-[13px] font-extrabold text-slate-700 w-16 shrink-0">이메일</span>
                  <input
                    type="text"
                    placeholder="이메일로 검색"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8]"
                  />
                </div>
                <div className="w-px h-5 bg-gray-200 shrink-0" />
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <span className="text-[13px] font-extrabold text-slate-700 w-16 shrink-0">사용처</span>
                  <input
                    type="text"
                    placeholder="사용처로 검색"
                    value={searchPageName}
                    onChange={(e) => setSearchPageName(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8] focus:ring-1 focus:ring-[#5244e8]"
                  />
                </div>
              </div>
            </div>

            {/* 건수 */}
            <div className="text-sm font-bold text-slate-500 mb-3 ml-1">
              총{' '}
              <span className="text-[#5244e8]">{filteredRecords.length.toLocaleString()}</span>
              건의 내역이 조회되었습니다.
            </div>

            {/* 테이블 */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm mb-6">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 text-[13px] uppercase tracking-wider font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-4 w-40">사용일시</th>
                    <th className="px-5 py-4 text-center w-28">구분</th>
                    <th className="px-5 py-4 w-48">사용자</th>
                    <th className="px-5 py-4 w-36 text-center">사용처</th>
                    <th className="px-5 py-4">검색어</th>
                    <th className="px-5 py-4 w-32">IP</th>
                    <th className="px-5 py-4 text-center w-28">남은 횟수</th>
                    <th className="px-5 py-4 text-center w-20">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[14px]">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-500 font-bold">
                        데이터를 불러오는 중입니다...
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-500 font-bold">
                        해당하는 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((item) => {
                      const isMember = item.user_type === 'member';
                      const displayEmail = item.email ?? '비회원';
                      const displayPage = item.page_name ?? item.page_type ?? '-';
                      const displayKeyword = item.keyword ?? '-';
                      const displayIp = item.ip_address ?? '-';
                      const displayRemaining =
                        item.remaining_free_count !== null
                          ? `${item.remaining_free_count}회`
                          : '-';
                      const displayStatus = item.status === 'success' ? '성공' : (item.status ?? '-');

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4 text-slate-500 font-medium text-[13px]">
                            {formatDateTime(item.created_at)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-[12px] font-black border whitespace-nowrap ${
                                isMember
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {isMember ? '회원' : '비회원'}
                            </span>
                          </td>
                          <td
                            className="px-5 py-4 font-bold text-slate-800 truncate max-w-[180px]"
                            title={displayEmail}
                          >
                            {displayEmail}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className="font-bold text-slate-600 bg-slate-100 text-[13px] px-2 py-1.5 rounded-sm whitespace-nowrap">
                              {displayPage}
                            </span>
                          </td>
                          <td
                            className="px-5 py-4 text-slate-700 font-medium text-[13px] truncate max-w-[200px]"
                            title={displayKeyword}
                          >
                            {displayKeyword}
                          </td>
                          <td className="px-5 py-4 text-slate-400 font-medium text-[12px] tracking-tight">
                            {displayIp}
                          </td>
                          <td className="px-5 py-4 text-center font-bold text-[13px] text-slate-600">
                            {displayRemaining}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded-md text-[12px] font-black bg-teal-50 text-teal-700 border border-teal-200">
                              {displayStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {!loading && filteredRecords.length > 0 && (
              <div className="flex justify-center items-center gap-2 pb-10">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-md border border-gray-200 bg-white !text-slate-600 font-bold disabled:opacity-30 hover:bg-slate-50 transition-colors"
                >
                  이전
                </button>
                {getPageNumbers().map((num) => (
                  <button
                    key={num}
                    onClick={() => setCurrentPage(num)}
                    className={`w-9 h-9 rounded-md flex items-center justify-center font-bold transition-colors ${
                      currentPage === num
                        ? 'bg-[#5244e8] !text-white border border-[#5244e8]'
                        : 'bg-white !text-slate-600 border border-gray-200 hover:bg-slate-50'
                    }`}
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-md border border-gray-200 bg-white !text-slate-600 font-bold disabled:opacity-30 hover:bg-slate-50 transition-colors"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
