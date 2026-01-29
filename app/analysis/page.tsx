'use client';

import { useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import RankTabs from "@/components/RankTabs";

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group ml-2">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-gray-200 text-gray-400 text-[11px] font-bold cursor-help select-none" title={text}>?</span>
      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-80 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-gray-600 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">{text}</span>
    </span>
  );
}

function safeNumber(v: any) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export default function AnalysisPage() {
  const [keyword, setKeyword] = useState("");
  const [data, setData] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const nanumSquare = { fontFamily: "'NanumSquare', sans-serif" };

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/keyword?keyword=${encodeURIComponent(keyword)}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "데이터 로드 실패");
      setData(result);
    } catch (e: any) {
      alert(e?.message || "데이터를 가져오는 중 오류가 발생했습니다.");
      setData(null);
    } finally {
      setIsSearching(false);
    }
  };

  const stats = useMemo(() => {
    if (!data) return null;

    const calcShares = (total: number, blog: number, cafe: number, kin: number, news: number) => {
      const t = total > 0 ? total : 1;
      return {
        blog: Math.round((blog / t) * 100),
        cafe: Math.round((cafe / t) * 100),
        kin: Math.round((kin / t) * 100),
        news: Math.round((news / t) * 100),
      };
    };

    const cTotal = safeNumber(data.contentCount?.total);

    return {
      search: {
        total: safeNumber(data.searchCount?.total),
        pc: safeNumber(data.searchCount?.pc),
        mobile: safeNumber(data.searchCount?.mobile),
      },
      content: {
        total: cTotal,
        blog: safeNumber(data.contentCount?.blog),
        cafe: safeNumber(data.contentCount?.cafe),
        kin: safeNumber(data.contentCount?.kin),
        news: safeNumber(data.contentCount?.news),
        shares: calcShares(cTotal, safeNumber(data.contentCount?.blog), safeNumber(data.contentCount?.cafe), safeNumber(data.contentCount?.kin), safeNumber(data.contentCount?.news))
      },
      content30: {
        blog: safeNumber(data.content30?.blog),
        blogLimit: !!data.content30?.blogLimit,
        cafe: safeNumber(data.content30?.cafe),
        cafeLimit: !!data.content30?.cafeLimit,
        kin: safeNumber(data.content30?.kin),
        news: safeNumber(data.content30?.news),
      },
      ratios: {
        devicePc: safeNumber(data.ratios?.device?.pc),
        deviceMobile: safeNumber(data.ratios?.device?.mobile),
        genderMale: safeNumber(data.ratios?.gender?.male),
        genderFemale: safeNumber(data.ratios?.gender?.female),
      },
      weeklyTrend: Array.isArray(data.weeklyTrend) ? data.weeklyTrend : [0,0,0,0,0,0,0],
      monthlyTrend: Array.isArray(data.monthlyTrend) ? data.monthlyTrend : [],
    };
  }, [data]);

  const StatCell = ({ title, value, percent, highlight = false, showPercent = true, isLimit = false }: any) => {
    const v = typeof value === "number" ? value : null;
    return (
      <div className="border border-gray-100 p-5 bg-white">
        <div className="flex justify-between items-center mb-2">
            <div className="text-[11px] font-bold text-gray-500">{title}</div>
            {showPercent && <div className="text-[12px] font-bold text-gray-400 ml-2">{percent}%</div>}
        </div>
        {v === null ? (
          <div className="h-[34px] flex items-center justify-center border border-dashed border-gray-100"><span className="text-[11px] font-bold text-gray-300 uppercase">준비중</span></div>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <div className={highlight ? "text-2xl font-bold text-blue-700" : "text-2xl font-light text-gray-900"}>
              {v.toLocaleString()}{isLimit ? " +" : ""}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043]" style={nanumSquare}>
      <Sidebar />
      <main className="flex-1 ml-64 p-10">
        <div className="max-w-7xl mx-auto">
          <RankTabs />
          <div className="mb-10"><h1 className="text-2xl font-normal text-gray-900">키워드 정밀 분석</h1></div>

          <div className="bg-white border border-gray-300 flex items-center mb-12 shadow-sm focus-within:border-blue-500 transition-all rounded-none">
            <div className="px-5 text-gray-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
            <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="flex-1 py-4 text-lg outline-none placeholder:text-gray-300" placeholder="분석할 키워드를 입력하세요" />
            <button onClick={handleSearch} disabled={isSearching} className="bg-[#1a73e8] text-white px-12 py-5 font-bold hover:bg-blue-700 disabled:opacity-60">{isSearching ? "분석 중..." : "데이터 분석 실행"}</button>
          </div>

          {stats && (
            <div className="space-y-10">
              {/* 월간 검색량 */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">월간 검색량</h2>
                <div className="grid grid-cols-3 gap-0 border border-gray-200 bg-white rounded-none">
                  <div className="p-8 border-r border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center">월간 검색량<InfoTip text="네이버 검색광고 기준입니다." /></h3>
                    <p className="text-4xl font-light text-gray-900">{stats.search.total.toLocaleString()}</p>
                    <div className="mt-4 text-[11px] font-bold text-gray-500 flex gap-4"><span>PC {stats.search.pc.toLocaleString()}</span><span>Mobile {stats.search.mobile.toLocaleString()}</span></div>
                  </div>
                  <div className="p-8 border-r border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center">PC / Mobile 비중</h3>
                    <div className="mt-6"><div className="flex h-10 items-center"><div className="bg-gray-800 h-full" style={{ width: `${stats.ratios.devicePc}%` }} /><div className="bg-blue-400 h-full" style={{ width: `${stats.ratios.deviceMobile}%` }} /></div><div className="flex justify-between text-[11px] mt-3 font-bold text-gray-500"><span>PC {stats.ratios.devicePc}%</span><span>Mobile {stats.ratios.deviceMobile}%</span></div></div>
                  </div>
                  <div className="p-8">
                    <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center">성별 검색 비중</h3>
                    <div className="flex h-10 items-center mt-6"><div className="bg-blue-500 h-full" style={{ width: `${stats.ratios.genderMale}%` }} /><div className="bg-pink-400 h-full" style={{ width: `${stats.ratios.genderFemale}%` }} /></div><div className="flex justify-between text-[11px] mt-3 font-bold text-gray-500"><span>남성 {stats.ratios.genderMale}%</span><span>여성 {stats.ratios.genderFemale}%</span></div>
                  </div>
                </div>
              </div>

              {/* 누적 콘텐츠 수 */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">누적 콘텐츠 수</h2>
                <div className="bg-white border border-gray-200 p-8 rounded-none">
                  <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center">전체(누적) & 플랫폼별 구성</h3>
                  <div className="grid grid-cols-5 gap-4 mt-6">
                    <StatCell title="전체(누적)" value={stats.content.total} highlight showPercent={false} />
                    <StatCell title="블로그" value={stats.content.blog} percent={stats.content.shares.blog} />
                    <StatCell title="카페" value={stats.content.cafe} percent={stats.content.shares.cafe} />
                    <StatCell title="지식인" value={stats.content.kin} percent={stats.content.shares.kin} />
                    <StatCell title="뉴스" value={stats.content.news} percent={stats.content.shares.news} />
                  </div>
                </div>

                {/* 최근 30일 추정 신규 콘텐츠 */}
                <div className="bg-white border border-gray-200 p-8 rounded-none mt-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center">최근 30일 추정 신규 콘텐츠</h3>
                  <p className="text-[11px] text-gray-400 font-bold mb-6">최근 30일 기준 신규 발행량 (추정 및 리얼)</p>
                  <div className="grid grid-cols-4 gap-4">
                    <StatCell title="블로그(추정)" value={stats.content30.blog} isLimit={stats.content30.blogLimit} showPercent={false} />
                    <StatCell title="카페(추정)" value={stats.content30.cafe} isLimit={stats.content30.cafeLimit} showPercent={false} />
                    <StatCell title="지식인(리얼)" value={stats.content30.kin} showPercent={false} />
                    <StatCell title="뉴스(리얼)" value={stats.content30.news} showPercent={false} />
                  </div>
                </div>
              </div>

              {/* 검색 관심도 */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">검색 관심도(트렌드)</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 p-8 rounded-none">
                    <h3 className="text-sm font-bold text-gray-900 mb-2">월별 분포</h3>
                    <div className="flex items-end justify-between h-32 gap-1 mt-8">
                      {stats.monthlyTrend.map((item: any, i: number) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                          <div className="relative w-full bg-blue-50" style={{ height: "100%" }}><div className="absolute bottom-0 w-full bg-[#1a73e8]" style={{ height: `${item.value}%` }} /></div>
                          <span className="text-[9px] font-bold text-gray-400">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 p-8 rounded-none">
                    <h3 className="text-sm font-bold text-gray-900 mb-2">요일별 분포</h3>
                    <div className="flex items-end justify-between h-32 gap-3 mt-8">
                      {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                          <div className="relative w-full bg-gray-50" style={{ height: "100%" }}><div className="absolute bottom-0 w-full bg-gray-800" style={{ height: `${stats.weeklyTrend[i]}%` }} /></div>
                          <span className="text-[10px] font-bold text-gray-400">{day}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 연관 키워드 */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">연관 키워드</h2>
                <div className="bg-white border border-gray-200 rounded-none overflow-hidden">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                      <tr><th className="px-8 py-5 font-bold">순위</th><th className="px-8 py-5 font-bold">키워드</th><th className="px-8 py-5 font-bold text-right">월간 검색량</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.relatedKeywords?.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-8 py-4 text-gray-400 font-bold">{i + 1}</td>
                          <td className="px-8 py-4 font-bold text-gray-800">{item.relKeyword}</td>
                          <td className="px-8 py-4 text-right font-medium text-blue-600">{(safeNumber(Number(item.monthlyPcQcCnt)) + safeNumber(Number(item.monthlyMobileQcCnt))).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}