// app/admin/points/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';


import { createClient } from '@/app/utils/supabase/client';
import AdminTabs from '@/components/AdminTabs'; 

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
  'INDEX_CHECK': { name: '블로그 노출 진단', url: '/index-check' }, // 🌟 새로 추가됨
  'JISIKIN': { name: '지식인 순위 확인', url: '/kin-rank' },
  'TOTAL': { name: '통검 노출/순위 확인', url: '/blog-rank' },
  'GOOGLE': { name: '구글 키워드 분석', url: '/google-analysis' },
  'YOUTUBE': { name: '유튜브 트렌드', url: '/youtube-trend' },
  'SHOPPING': { name: '쇼핑 키워드 인사이트', url: '/shopping-insight' }, 
  'SEO_TITLE': { name: '쇼핑 상품명 최적화', url: '/seo-title' },
  'SEO_CHECK': { name: '내 상품명 진단', url: '/diagnosis' },      
  'SHOPPING_RANK': { name: '상품 노출 순위 분석', url: '/shopping-rank' },
  'AI_BLOG': { name: '+ Dual AI 포스팅', url: '/ai-blog' },           
  'AI_PRESS': { name: '+ AI 언론 보도자료', url: '/ai-press' },
  'REVIEW_AI': { name: '+ 리뷰 답글 AI', url: '/review-ai' },
  'POST_XRAY': { name: '+ 포스팅 X-Ray', url: '/post-xray' },
  'AI_INSIGHT': { name: '+ AI 포스팅 인사이트', url: '/ai-insight' },
  'KEYWORD_VOLUME': { name: '키워드별 조회수', url: '/keyword-volume' },
  'KEYWORD_GENERATOR': { name: '키워드 생성기', url: '/keyword-generator' },
  'PLACE_RANK': { name: '플레이스 순위', url: '/place-rank' }
};

const MENU_GROUPS = [
  {
    title: 'NAVER TOOLS',
    items: ['ANALYSIS', 'RELATED', 'BLOG', 'INDEX_CHECK', 'JISIKIN', 'TOTAL', 'KEYWORD_VOLUME', 'KEYWORD_GENERATOR', 'PLACE_RANK']
  },
  {
    title: 'AI TOOLS',     
    items: ['AI_BLOG', 'AI_PRESS', 'REVIEW_AI', 'POST_XRAY', 'AI_INSIGHT'] 
  },
  {
    title: 'SELLER TOOLS',
    items: ['SHOPPING', 'SEO_TITLE', 'SEO_CHECK', 'SHOPPING_RANK'] 
  },
  {
    title: 'GOOGLE & YOUTUBE',
    items: ['GOOGLE', 'YOUTUBE']
  }
];

export default function AdminPointsPage() {
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const alertShown = useRef(false);

  const [policies, setPolicies] = useState<PointPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // 🌟 시스템 설정 (알림 임계값) 상태
  const [alertSettings, setAlertSettings] = useState({ low: '500', mid: '1000' });
  const [originalAlert, setOriginalAlert] = useState({ low: '500', mid: '1000' });
  const [isSavingAlert, setIsSavingAlert] = useState(false);

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

  useEffect(() => {
    if (profile?.role?.toLowerCase() === 'admin') {
      fetchPolicies();
    }
  }, [profile?.role]);

  const fetchPolicies = async () => {
    const supabase = createClient();
    
    // 1. 단가표 로드
    const { data: policyData } = await supabase.from('point_policies').select('*');
    if (policyData) {
      setPolicies(policyData.map(p => ({ ...p, original_cost: p.point_cost })));
    }

    // 2. 알림 설정 로드
    const { data: alertData } = await supabase.from('system_settings').select('*').in('setting_key', ['alert_threshold_low', 'alert_threshold_mid']);
    if (alertData && alertData.length > 0) {
      const low = alertData.find(d => d.setting_key === 'alert_threshold_low')?.setting_value || '500';
      const mid = alertData.find(d => d.setting_key === 'alert_threshold_mid')?.setting_value || '1000';
      setAlertSettings({ low, mid });
      setOriginalAlert({ low, mid });
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

    const res = await fetch('/api/admin/update-point-policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_type: policy.page_type, point_cost: policy.point_cost }),
    });

    setSavingId(null);

    if (res.ok) {
      const metaName = PAGE_META[policy.page_type]?.name || policy.page_name;
      alert(`[${metaName}] 포인트가 ${policy.point_cost}P로 저장되었습니다.`);
      setPolicies(prev => prev.map(p => p.page_type === policy.page_type ? { ...p, original_cost: policy.point_cost } : p));

      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`저장에 실패했습니다. 관리자에게 문의하세요. (${data.error ?? res.statusText})`);
    }
  };

  const handleSaveAlerts = async () => {
    setIsSavingAlert(true);

    const res = await fetch('/api/admin/update-system-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert_threshold_low: alertSettings.low,
        alert_threshold_mid: alertSettings.mid,
      }),
    });

    setIsSavingAlert(false);

    if (res.ok) {
      alert('포인트 알림 기준이 저장되었습니다.');
      setOriginalAlert(alertSettings);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`저장에 실패했습니다. (${data.error ?? res.statusText})`);
    }
  };

  if (isAuthLoading) {
    return <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center font-bold text-slate-500">권한 확인 중...</div>;
  }
  if (!user || profile?.role?.toLowerCase() !== 'admin') {
    return null; 
  }

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
        
        
        <main className="flex-1 ml-64 p-10 relative">
          <div className="max-w-[1200px] mx-auto">
            
            <AdminTabs />

            <div className="mb-8 text-center">
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2 flex items-center justify-center gap-2">
                서비스 포인트 설정
              </h1>
              <p className="text-sm text-slate-500">
                각 분석 페이지에서 1건(또는 1회) 검색 시 차감될 포인트를 개별적으로 설정할 수 있습니다.<br/>
                수정 후 [저장] 버튼을 누르면 유저들의 검색 환경에 즉시 반영됩니다.
              </p>
            </div>

            {/* 🌟 시스템 설정: 포인트 알림 기준 */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-4 bg-orange-400 rounded-full"></div>
                  <h2 className="font-extrabold text-gray-800 text-[16px] tracking-wide">사용자 포인트 부족 알림 기준</h2>
                </div>
                <p className="text-[13px] text-slate-500">잔여 포인트가 아래 설정된 금액 이하로 내려가면 화면 우측 하단에 알림창이 뜹니다.</p>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-bold text-yellow-600 mb-1">1단계 알림 (주의)</span>
                  <div className="flex items-center">
                    <input 
                      type="text" 
                      pattern="[0-9]*"
                      value={alertSettings.mid}
                      onChange={(e) => setAlertSettings(p => ({ ...p, mid: e.target.value.replace(/[^0-9]/g, '') }))}
                      className="w-24 px-3 py-2 text-right border border-gray-300 rounded-md focus:border-yellow-500 focus:ring-yellow-500 font-extrabold text-[15px] bg-yellow-50/30"
                    />
                    <span className="ml-1.5 font-bold text-slate-500">P 이하</span>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-bold text-orange-600 mb-1">2단계 알림 (긴급)</span>
                  <div className="flex items-center">
                    <input 
                      type="text" 
                      pattern="[0-9]*"
                      value={alertSettings.low}
                      onChange={(e) => setAlertSettings(p => ({ ...p, low: e.target.value.replace(/[^0-9]/g, '') }))}
                      className="w-24 px-3 py-2 text-right border border-gray-300 rounded-md focus:border-orange-500 focus:ring-orange-500 font-extrabold text-[15px] bg-orange-50/30"
                    />
                    <span className="ml-1.5 font-bold text-slate-500">P 이하</span>
                  </div>
                </div>

                <button 
                  onClick={handleSaveAlerts}
                  disabled={isSavingAlert || (alertSettings.low === originalAlert.low && alertSettings.mid === originalAlert.mid)}
                  className={`px-5 py-2 mt-4 font-bold text-[13px] rounded-md transition-all whitespace-nowrap shadow-sm h-10 flex items-center justify-center ${
                    isSavingAlert ? 'bg-slate-400 text-white cursor-wait' :
                    (alertSettings.low !== originalAlert.low || alertSettings.mid !== originalAlert.mid) ? 'bg-gray-800 hover:bg-gray-900 text-white' : 
                    'bg-slate-600 text-white opacity-40 cursor-not-allowed hover:opacity-40'
                  }`}
                >
                  {isSavingAlert ? '...' : '알림 설정 저장'}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20 text-gray-500 font-bold">단가표를 불러오는 중입니다...</div>
            ) : (
              <div className="space-y-10 animate-in fade-in duration-500">
                {MENU_GROUPS.map((group, groupIndex) => (
                  <div key={groupIndex} className="mb-4">
                    
                    <div className="flex items-center gap-2 mb-3 ml-1">
                      <div className="w-1.5 h-4 bg-[#5244e8] rounded-full"></div>
                      <h2 className="font-extrabold text-gray-800 text-[16px] tracking-wide">{group.title}</h2>
                    </div>

                    <div className="bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
                      <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-slate-50 border-b border-gray-200 text-slate-600 font-bold text-[13px]">
                          <tr>
                            <th className="px-6 py-3 w-[50%]">페이지 이름 및 경로</th>
                            <th className="px-6 py-3 w-[20%] text-center">기존 포인트</th>
                            <th className="px-6 py-3 w-[30%] text-right pr-28">수정 포인트</th>
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
                                
                                <td className="px-6 py-4 text-center">
                                  <span className="font-extrabold text-slate-500 text-[15px]">{policy.original_cost}P</span>
                                </td>

                                <td className="px-6 py-4 flex justify-end items-center gap-3">
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