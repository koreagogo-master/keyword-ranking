'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link'; // 🌟 추가: 링크 이동을 위한 컴포넌트
import Sidebar from '@/components/Sidebar';
import { createClient } from '@/app/utils/supabase/client';

interface PointPolicy {
  page_type: string;
  page_name: string;
  point_cost: number;
  original_cost?: number;
}

const PAGE_META: Record<string, { name: string; url: string }> = {
  'ANALYSIS': { name: '키워드 정밀 분석', url: '/analysis' },
  'RELATED': { name: '연관 키워드 조회', url: '/related-fast' },
  'BLOG': { name: '블로그 순위 확인', url: '/blog-rank-b' },
  'JISIKIN': { name: '지식인 순위 확인', url: '/kin-rank' },
  'TOTAL': { name: '통검 노출/순위 확인', url: '/blog-rank' },
  'GOOGLE': { name: '구글 키워드 분석', url: '/google-analysis' },
  'YOUTUBE': { name: '유튜브 트렌드', url: '/youtube-trend' },
  'SHOPPING': { name: '쇼핑 인사이트', url: '/shopping-insight' },
  'SHOPPING_RANK': { name: '상품 노출 순위 분석', url: '/shopping-rank' }
};

const MENU_GROUPS = [
  {
    title: 'NAVER 분석',
    items: ['ANALYSIS', 'RELATED', 'BLOG', 'JISIKIN', 'TOTAL']
  },
  {
    title: 'GOOGLE & YOUTUBE',
    items: ['GOOGLE', 'YOUTUBE']
  },
  {
    title: 'SELLER TOOLS',
    items: ['SHOPPING', 'SHOPPING_RANK']
  }
];

export default function AdminPointsPage() {
  const [policies, setPolicies] = useState<PointPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from('point_policies').select('*');

    if (data) {
      setPolicies(data.map(p => ({ ...p, original_cost: p.point_cost })));
    }
    setLoading(false);
  };

  const handleCostChange = (page_type: string, newCost: string) => {
    const numericValue = newCost.replace(/[^0-9]/g, ''); 
    const cost = numericValue === '' ? 0 : parseInt(numericValue, 10);
    setPolicies(prev => prev.map(p => p.page_type === page_type ? { ...p, point_cost: cost } : p));
  };

  const handleSaveSingle = async (policy: PointPolicy) => {
    if (policy.point_cost === policy.original_cost) return;

    setSavingId(policy.page_type);
    const supabase = createClient();
    
    const { error } = await supabase
      .from('point_policies')
      .update({ point_cost: policy.point_cost })
      .eq('page_type', policy.page_type);

    setSavingId(null);

    if (!error) {
      const metaName = PAGE_META[policy.page_type]?.name || policy.page_name;
      alert(`[${metaName}] 포인트가 ${policy.point_cost}P로 저장되었습니다.`);
      setPolicies(prev => prev.map(p => p.page_type === policy.page_type ? { ...p, original_cost: policy.point_cost } : p));
    } else {
      alert('저장에 실패했습니다. 관리자에게 문의하세요.');
    }
  };

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css" rel="stylesheet" type="text/css" />
      <style jsx global>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="flex min-h-screen bg-[#f8f9fa] text-[#3c4043] antialiased tracking-tight" style={{ fontFamily: "'NanumSquare', sans-serif" }}>
        <Sidebar />
        
        <main className="flex-1 ml-64 p-10 relative">
          <div className="max-w-5xl mx-auto">
            
            {/* 🌟 추가: 관리자 홈으로 돌아가기 버튼 */}
            <Link 
              href="/admin" 
              className="inline-flex items-center gap-1 text-[13px] font-bold text-slate-500 hover:text-[#5244e8] mb-6 transition-colors bg-white px-3 py-1.5 rounded-sm border border-gray-200 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              관리자 홈으로 돌아가기
            </Link>

            <div className="mb-8 border-b border-gray-200 pb-4">
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2 flex items-center gap-2">
                ⚙️ 서비스 포인트 설정
              </h1>
              <p className="text-sm text-slate-500">
                각 분석 페이지에서 1건(또는 1회) 검색 시 차감될 포인트를 개별적으로 설정할 수 있습니다.<br/>
                수정 후 [저장] 버튼을 누르면 유저들의 검색 환경에 즉시 반영됩니다.
              </p>
            </div>

            {loading ? (
              <div className="text-center py-20 text-gray-500 font-bold">단가표를 불러오는 중입니다...</div>
            ) : (
              <div className="space-y-8 animate-in fade-in duration-500">
                {MENU_GROUPS.map((group, groupIndex) => (
                  <div key={groupIndex} className="bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
                    
                    <div className="bg-slate-100/80 px-6 py-3 border-b border-gray-200 flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-[#5244e8] rounded-full"></div>
                      <h2 className="font-extrabold text-gray-800 text-[15px] tracking-wide">{group.title}</h2>
                    </div>

                    <table className="w-full text-left border-collapse table-fixed">
                      <thead className="bg-slate-50 border-b border-gray-200 text-slate-600 font-bold text-[13px]">
                        <tr>
                          <th className="px-6 py-3 w-[45%]">페이지 이름 및 경로</th>
                          <th className="px-6 py-3 w-[55%] text-right">설정 포인트</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {group.items.map((pageType) => {
                          const policy = policies.find(p => p.page_type === pageType);
                          if (!policy) return null;

                          const meta = PAGE_META[policy.page_type];
                          const displayName = meta?.name || policy.page_name;
                          const displayUrl = meta?.url || '';

                          const isChanged = policy.point_cost !== policy.original_cost;
                          const isSavingThis = savingId === policy.page_type;

                          return (
                            <tr key={policy.page_type} className={`transition-colors ${isChanged ? 'bg-orange-50/30' : 'hover:bg-slate-50'}`}>
                              <td className="px-6 py-4">
                                <div className="flex items-baseline gap-2">
                                  <span className="font-bold text-gray-800 text-[14px]">
                                    {displayName}
                                  </span>
                                  <span className="text-slate-400 font-medium text-[12px]">
                                    {displayUrl}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 flex justify-end items-center gap-3">
                                
                                <div className="flex items-center gap-1.5 text-slate-400">
                                  <span className="text-[11px] font-medium border border-slate-200 bg-white px-1.5 py-0.5 rounded-sm shadow-sm">기존</span>
                                  <span className="font-extrabold text-slate-500">{policy.original_cost}P</span>
                                  <svg className={`w-3.5 h-3.5 ml-1 transition-colors ${isChanged ? 'text-orange-400' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                </div>

                                <div className="flex items-center">
                                  <input 
                                    type="text"
                                    pattern="[0-9]*"
                                    value={policy.point_cost}
                                    onChange={(e) => handleCostChange(policy.page_type, e.target.value)}
                                    className={`w-24 px-3 py-2 text-right border rounded-md focus:outline-none focus:ring-1 font-extrabold text-[15px] transition-colors ${
                                      isChanged 
                                      ? 'border-orange-400 focus:border-orange-500 focus:ring-orange-500 text-orange-600 bg-white shadow-inner' 
                                      : 'border-gray-300 focus:border-[#5244e8] focus:ring-[#5244e8] text-[#5244e8] bg-gray-50'
                                    }`}
                                  />
                                  <span className={`ml-1.5 font-bold ${isChanged ? 'text-orange-500' : 'text-slate-500'}`}>P</span>
                                </div>

                                <button 
                                  onClick={() => handleSaveSingle(policy)}
                                  disabled={!isChanged || isSavingThis}
                                  className={`ml-2 w-16 py-2 font-bold text-[13px] rounded-md transition-all whitespace-nowrap shadow-sm flex items-center justify-center ${
                                    isSavingThis ? 'bg-slate-400 text-white cursor-wait' :
                                    isChanged ? 'bg-[#5244e8] hover:bg-[#4336c9] text-white ring-2 ring-[#5244e8]/30' : 
                                    'bg-slate-600 text-white opacity-40 cursor-not-allowed hover:opacity-40' 
                                  }`}
                                >
                                  {isSavingThis ? '...' : '저장'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  );
}