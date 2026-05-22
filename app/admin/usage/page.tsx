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

export default function AdminUsagePage() {
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const alertShown = useRef(false);

  const [records, setRecords] = useState<FreeUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchEmail, setSearchEmail] = useState('');
  const [filterUserType, setFilterUserType] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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

  // 관리자 확인 후 데이터 로드
  useEffect(() => {
    if (profile?.role?.toLowerCase() === 'admin') {
      fetchRecords();
    }
  }, [profile?.role]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchEmail, filterUserType, startDate, endDate]);

  const fetchRecords = async () => {
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from('free_usage_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('free_usage_history 조회 실패:', error);
    } else {
      setRecords((data as FreeUsageRecord[]) || []);
    }
    setLoading(false);
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // 요약 카드 통계
  const stats = useMemo(() => {
    const total = records.length;
    const member = records.filter((r) => r.user_type === 'member').length;
    const guest = records.filter((r) => r.user_type === 'guest').length;
    return { total, member, guest };
  }, [records]);

  // 필터 적용
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchUserType =
        filterUserType === 'ALL' ||
        r.user_type === filterUserType;

      const displayEmail = r.email ?? '';
      const matchEmail = displayEmail.toLowerCase().includes(searchEmail.toLowerCase());

      const itemDate = r.created_at.split('T')[0];
      const matchStart = startDate ? itemDate >= startDate : true;
      const matchEnd = endDate ? itemDate <= endDate : true;

      return matchUserType && matchEmail && matchStart && matchEnd;
    });
  }, [records, filterUserType, searchEmail, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
  const paginated = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
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
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
                무료 사용 기록
              </h1>
              <p className="text-sm text-slate-500">
                회원 무료 검색과 비회원 체험 사용 내역을 확인합니다.
              </p>
              <div className="absolute right-0 bottom-0">
                <button
                  onClick={fetchRecords}
                  className="inline-flex items-center gap-1.5 text-[14px] font-bold !text-slate-500 hover:!text-[#5244e8] transition-colors !bg-white px-4 py-2 rounded-sm border border-gray-200 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
              <div className="flex gap-6 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-extrabold text-slate-700 w-16">기간 설정</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8]"
                  />
                  <span className="text-gray-400">~</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8]"
                  />
                </div>
                <div className="w-px h-5 bg-gray-200" />
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-extrabold text-slate-700 w-16">구분</span>
                  <select
                    value={filterUserType}
                    onChange={(e) => setFilterUserType(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:border-[#5244e8] cursor-pointer min-w-[140px]"
                  >
                    <option value="ALL">전체</option>
                    <option value="member">회원</option>
                    <option value="guest">비회원</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-6 items-center pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-[13px] font-extrabold text-slate-700 w-16 shrink-0">이메일</span>
                  <input
                    type="text"
                    placeholder="이메일로 검색"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
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
                    <th className="px-5 py-4 text-center w-20">구분</th>
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
                      const displayStatus = item.status === 'success' ? '성공' : item.status ?? '-';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4 text-slate-500 font-medium text-[13px]">
                            {formatDateTime(item.created_at)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-[12px] font-black border ${
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
                          <td className="px-5 py-4 text-slate-700 font-medium text-[13px] truncate max-w-[200px]" title={displayKeyword}>
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
