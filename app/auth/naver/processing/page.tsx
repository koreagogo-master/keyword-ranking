// app/auth/naver/processing/page.tsx
// 역할: 3중 방어 로직으로 네이버 매직링크 세션을 안전하게 처리
'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';

export default function NaverProcessingPage() {
  const [statusText, setStatusText] = useState('로그인 정보를 안전하게 저장 중입니다.\n잠시만 기다려주세요... (약 1~2초 소요)');
  const isProcessing = useRef(false); // Strict Mode 이중 실행 완전 차단

  useEffect(() => {
    // Strict Mode에서 useEffect가 2~3번 실행되는 것을 완전 차단
    if (isProcessing.current) return;
    isProcessing.current = true;

    const supabase = createClient();
    let redirectScheduled = false;

    // 중복 리디렉션 방지용 래퍼
    const scheduleRedirect = () => {
      if (redirectScheduled) return;
      redirectScheduled = true;
      setTimeout(() => {
        window.location.href = '/';
      }, 1500); // 쿠키 물리 저장 여유 1.5초
    };

    // ── 방어 1: onAuthStateChange 이벤트 리스너 ──
    // Supabase가 해시 파싱을 완료한 정확한 시점을 캐치함
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
          scheduleRedirect();
        }
      }
    );

    // ── 방어 2: 수동 해시 파싱 (플랜 B) ──
    // window.location.hash에서 직접 토큰을 추출해 강제로 세션을 구움
    const manualHashParse = async () => {
      const hash = window.location.hash;
      if (!hash) return;

      const params = new URLSearchParams(hash.replace('#', ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (data?.session && !error) {
          scheduleRedirect();
        }
      }
    };

    manualHashParse();

    // ── 방어 3: 5초 안전장치 ──
    // 5초가 지나도 처리 안 되면 경고 후 로그인 페이지로 이동
    const fallbackTimer = setTimeout(() => {
      if (!redirectScheduled) {
        alert('로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.');
        window.location.href = '/login';
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-5">
        {/* 네이버 초록색 로딩 스피너 */}
        <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-[#03C75A] animate-spin" />

        <p className="text-gray-500 font-medium text-sm text-center leading-relaxed whitespace-pre-line">
          {statusText}
        </p>
      </div>
    </div>
  );
}
