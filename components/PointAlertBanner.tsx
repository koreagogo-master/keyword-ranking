'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { createClient } from '@/app/utils/supabase/client';

interface AlertInfo {
  level: number;
  remaining: number;
  required?: number;
  type?: 'low' | 'mid';
}

export default function PointAlertBanner() {
  const [alert, setAlert] = useState<AlertInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const { profile } = useAuth();

  // 1. 이벤트 리스너 (포인트 차감 시 즉각 반응)
  useEffect(() => {
    const handleAlert = (e: Event) => {
      const detail = (e as CustomEvent<AlertInfo>).detail;
      setAlert(detail);
      setVisible(true);
    };

    window.addEventListener('show-point-alert', handleAlert);
    return () => window.removeEventListener('show-point-alert', handleAlert);
  }, []);

  // 2. 페이지 새로고침/이동 시 잔액을 체크하여 안 닫은 알림창 다시 띄우기
  useEffect(() => {
    const checkPersistentAlert = async () => {
      if (!profile) return;
      const remaining = (profile.purchased_points || 0) + (profile.bonus_points || 0);

      const supabase = createClient();
      const { data: alertData } = await supabase
        .from('system_settings')
        .select('*')
        .in('setting_key', ['alert_threshold_low', 'alert_threshold_mid']);
        
      let lowThreshold = 500;
      let midThreshold = 1000;
      
      if (alertData) {
        const lowStr = alertData.find(d => d.setting_key === 'alert_threshold_low')?.setting_value;
        const midStr = alertData.find(d => d.setting_key === 'alert_threshold_mid')?.setting_value;
        if (lowStr) lowThreshold = parseInt(lowStr, 10);
        if (midStr) midThreshold = parseInt(midStr, 10);
      }

      const thresholds = [
        { value: lowThreshold, type: 'low' as const },
        { value: midThreshold, type: 'mid' as const }
      ].sort((a, b) => a.value - b.value);

      // 가장 낮은 미표시 알림 하나 찾기
      for (const threshold of thresholds) {
        if (remaining <= threshold.value) {
          const key = `point_alert_shown_${threshold.value}`;
          // 사용자가 'X'를 눌러서 강제로 닫은 기록이 없으면 알림 띄움
          if (!localStorage.getItem(key)) {
            setAlert({ level: threshold.value, remaining, type: threshold.type });
            setVisible(true);
            break;
          }
        }
      }
    };

    // 만약 현재 알림창이 안 떠있다면 체크해본다. (이미 떠있으면 무시)
    if (!visible && !alert) {
      checkPersistentAlert();
    }
  }, [profile]); // 프로필(잔액)이 업데이트 될 때마다 체크

  const handleClose = () => {
    setVisible(false);
    
    // 수동으로 닫았으므로 영구적으로(충전 전까지) 안 뜨게 기록
    if (alert) {
      localStorage.setItem(`point_alert_shown_${alert.level}`, 'true');
    }

    setTimeout(() => setAlert(null), 300);
  };

  const handleCharge = () => {
    handleClose();
    router.push('/charge');
  };

  if (!alert) return null;

  const isZero = alert.level === 0;
  const isLow = alert.type === 'low';

  const config = isZero
    ? {
        border: 'border-red-200',
        bg: 'bg-red-50',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        titleColor: 'text-red-800',
        msgColor: 'text-red-600',
        closeColor: '!text-red-800 hover:!text-red-900',
        btnBg: 'bg-red-600 hover:bg-red-700',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
        title: '포인트가 부족합니다',
        message: alert.required 
          ? `해당 작업을 위해 ${alert.required.toLocaleString()}P 가 필요합니다.` 
          : `결제를 위한 잔여 포인트가 부족합니다.`,
      }
    : isLow
    ? {
        border: 'border-orange-200',
        bg: 'bg-orange-50',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600',
        titleColor: 'text-orange-800',
        msgColor: 'text-orange-600',
        closeColor: '!text-orange-800 hover:!text-orange-900',
        btnBg: 'bg-orange-500 hover:bg-orange-600',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        title: '포인트가 부족합니다',
        message: `잔여 ${alert.remaining.toLocaleString()}P — 충전을 고려해 주세요.`,
      }
    : {
        border: 'border-yellow-200',
        bg: 'bg-yellow-50',
        iconBg: 'bg-yellow-100',
        iconColor: 'text-yellow-700',
        titleColor: 'text-yellow-800',
        msgColor: 'text-yellow-700',
        closeColor: '!text-yellow-800 hover:!text-yellow-900',
        btnBg: 'bg-yellow-500 hover:bg-yellow-600',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        title: '포인트 잔액 안내',
        message: `잔여 ${alert.remaining.toLocaleString()}P — 충전을 고려해 주세요.`,
      };

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9999] w-[320px] rounded-2xl border shadow-2xl
        transition-all duration-300
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        ${config.bg} ${config.border}`}
    >
      {/* 헤더 */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${config.iconBg} ${config.iconColor}`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-[13.5px] ${config.titleColor}`}>{config.title}</p>
          <p className={`text-[12px] mt-0.5 ${config.msgColor}`}>{config.message}</p>
        </div>
        <button
          onClick={handleClose}
          className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5 ${config.closeColor}`}
          title="닫기"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 충전 버튼 */}
      <div className="px-4 pb-4">
        <button
          onClick={handleCharge}
          className={`w-full py-2.5 rounded-xl text-white text-[13px] font-bold transition-colors flex items-center justify-center gap-1.5 ${config.btnBg}`}
        >
          포인트 충전하기
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
