// app/hooks/usePoint.ts
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';

const PATH_TO_PAGE_TYPE: Record<string, string> = {
  '/analysis': 'ANALYSIS',
  '/related-fast': 'RELATED',
  '/blog-rank-b': 'BLOG',
  '/index-check': 'INDEX_CHECK',
  '/kin-rank': 'JISIKIN',
  '/blog-rank': 'TOTAL',
  '/google-analysis': 'GOOGLE',
  '/youtube-trend': 'YOUTUBE',
  '/shopping-insight': 'SHOPPING',
  '/shopping-rank': 'SHOPPING_RANK',
  '/seo-title': 'SEO_TITLE',
  '/seo-check': 'SEO_CHECK',
  '/ai-blog': 'AI_BLOG',
  '/ai-press': 'AI_PRESS',
  '/review-ai': 'REVIEW_AI',
  '/keyword-volume': 'KEYWORD_VOLUME',
  '/place-rank': 'PLACE_RANK',
  '/post-xray': 'POST_XRAY',
  '/ai-insight': 'AI_INSIGHT',
};

// 무료 횟수를 절대 쓸 수 없는 유료 전용 기능 목록
const PAID_ONLY_PAGES = ['AI_BLOG', 'AI_PRESS', 'POST_XRAY', 'AI_INSIGHT'];

const getKSTDateString = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (9 * 3600000));
  return kst.toISOString().split('T')[0];
};

export const usePoint = () => {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const deductPoints = async (userId: string | undefined, fallbackPoints: number, itemCount: number = 1, keyword: string = "") => {
    const pageType = PATH_TO_PAGE_TYPE[pathname];

    if (!pageType) {
       console.error("포인트 정책 맵핑이 누락된 페이지입니다:", pathname);
       return false;
    }

    // ====================================================================
    // 🌟 1. 비로그인 사용자 처리 (IP 기반 1일 1회 무료 검색)
    // ====================================================================
    if (!userId) {
      // ⚠️ 유료 전용 기능은 비로그인 시 즉시 차단
      if (PAID_ONLY_PAGES.includes(pageType)) {
        alert("해당 기능은 회원가입 및 로그인 후 이용하실 수 있습니다.");
        router.push('/login');
        return false;
      }

      try {
        // 접속자 IP 가져오기
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        const clientIp = ipData.ip;

        if (!clientIp) throw new Error("IP 주소를 확인할 수 없습니다.");

        // DB에 해당 IP가 오늘 검색했는지 확인
        const { data: isAllowed, error } = await supabase.rpc('check_guest_limit', { user_ip: clientIp });

        if (isAllowed) {
          console.log(`✅ 비회원 1일 1회 무료 검색 통과 (IP: ${clientIp})`);
          return true; // 1회 무료 통과!
        } else {
          // 이미 1회를 사용했다면 가입 유도 팝업
          const goSignup = window.confirm("비로그인 사용자는 하루 1회만 검색 가능합니다.\n\n회원가입 시 매일 5회의 무료 검색 혜택이 제공됩니다! 지금 가입하시겠습니까?");
          if (goSignup) router.push('/signup');
          return false;
        }
      } catch (err) {
        console.error("비로그인 사용자 IP 체크 중 에러:", err);
        alert("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        return false;
      }
    }

    // ====================================================================
    // 🌟 2. 로그인 사용자 처리 (매일 5회 무료 검색)
    // ====================================================================
    if (!PAID_ONLY_PAGES.includes(pageType)) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('free_search_count, last_free_reset_date')
          .eq('id', userId)
          .single();

        if (!profileError && profile) {
          const today = getKSTDateString();
          let currentFreeCount = profile.free_search_count ?? 0;
          let lastResetDate = profile.last_free_reset_date;

          if (lastResetDate !== today) {
            currentFreeCount = 5;
            lastResetDate = today;
          }

          if (currentFreeCount >= itemCount) {
            const newFreeCount = currentFreeCount - itemCount;
            await supabase
              .from('profiles')
              .update({
                free_search_count: newFreeCount,
                last_free_reset_date: lastResetDate
              })
              .eq('id', userId);

            console.log(`✅ 회원 무료 검색 통과! (남은 횟수: ${newFreeCount}회)`);
            return true; // 회원 5회 무료 통과!
          } else if (profile.last_free_reset_date !== today) {
            await supabase
              .from('profiles')
              .update({
                free_search_count: 5,
                last_free_reset_date: today
              })
              .eq('id', userId);
          }
        }
      } catch (error) {
        console.error("회원 무료 횟수 체크 중 오류 발생:", error);
      }
    }

    // ====================================================================
    // 🌟 3. 유료 결제 로직 (무료 횟수를 다 썼거나 유료 전용 페이지인 경우)
    // ====================================================================
    const description = keyword ? `[${keyword}] 검색 (${itemCount}건)` : `${itemCount}건 조회`;

    const { data, error } = await supabase.rpc('deduct_points_dynamic', {
      p_user_id: userId,
      p_page_type: pageType,
      p_item_count: itemCount,
      p_description: description
    });

    if (error || !data || data.success === false) {
      const totalRequired = data?.required || fallbackPoints;

      // 🌟 window.confirm 대신 커스텀 알림창 (0P 소진)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('show-point-alert', {
          detail: { level: 0, remaining: 0, required: totalRequired }
        }));
      }

      return false;
    }

    // ====================================================================
    // 🌟 4. [수정됨] 철벽 보안을 뚫고 안전한 RPC 통로로 IP 기록하기
    // ====================================================================
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      const currentIp = ipData.ip;

      if (currentIp) {
        // 보안이 뚫려있는 전용 통로(RPC)를 통해 안전하게 IP만 쏙 집어넣습니다.
        await supabase.rpc('update_latest_history_ip', {
          p_user_id: userId,
          p_ip: currentIp
        });
        console.log(`✅ 포인트 차감 완료 (IP 기록 완료: ${currentIp})`);
      }
    } catch (ipErr) {
      console.warn("IP 기록 업데이트 실패:", ipErr);
    }

    // ====================================================================
    // 🌟 5. 잔액 임계값 알림 체크 (시스템 설정 기반)
    // ====================================================================
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('purchased_points, bonus_points')
        .eq('id', userId)
        .single();

      if (profile && typeof window !== 'undefined') {
        const remaining = (profile.purchased_points || 0) + (profile.bonus_points || 0);
        
        // 시스템 설정에서 임계값 가져오기
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

        const thresholds = [lowThreshold, midThreshold].sort((a, b) => a - b); // 낮은 것부터 확인

        // 가장 낮은 미표시 알림 하나 찾기
        for (const threshold of thresholds) {
          if (remaining <= threshold) {
            const key = `point_alert_shown_${threshold}`;
            // 사용자가 'X'를 눌러서 강제로 닫은 기록이 없으면 알림 띄움
            if (!localStorage.getItem(key)) {
              window.dispatchEvent(new CustomEvent('show-point-alert', {
                detail: { level: threshold, remaining }
              }));
              break;
            }
          }
        }
      }
    } catch (err) {
      console.warn('포인트 잔액 알림 체크 실패:', err);
    }

    return true;
  };

  return { deductPoints };
};