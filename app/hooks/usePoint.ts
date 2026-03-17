// app/hooks/usePoint.ts
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';

// 🌟 URL 경로와 관리자 단가표(page_type) 자동 매핑표
const PATH_TO_PAGE_TYPE: Record<string, string> = {
  '/analysis': 'ANALYSIS',
  '/related-fast': 'RELATED',
  '/blog-rank-b': 'BLOG',
  '/kin-rank': 'JISIKIN',
  '/blog-rank': 'TOTAL',
  '/google-analysis': 'GOOGLE',
  '/youtube-trend': 'YOUTUBE',
  '/shopping-insight': 'SHOPPING',
  '/shopping-rank': 'SHOPPING_RANK'
};

export const usePoint = () => {
  const router = useRouter();
  const pathname = usePathname(); // 현재 유저가 접속해 있는 페이지의 URL을 알아냅니다.
  const supabase = createClient();

  // 기존 9개 페이지에 적어둔 코드(userId, 10*키워드수, 키워드수)를 건드리지 않기 위해 파라미터는 그대로 받습니다.
  // 대신 두 번째 값(10*키워드수)은 무시하고, 무조건 DB 단가를 불러와서 적용합니다!
  const deductPoints = async (userId: string | undefined, fallbackPoints: number, itemCount: number = 1) => {
    if (!userId) {
      alert("로그인이 필요한 서비스입니다. 로그인 후 이용해주세요.");
      return false;
    }

    // 1. 내가 지금 어떤 서비스 페이지에 있는지 확인
    const pageType = PATH_TO_PAGE_TYPE[pathname];

    if (!pageType) {
       console.error("포인트 정책 맵핑이 누락된 페이지입니다:", pathname);
       alert("포인트 정책을 확인할 수 없는 페이지입니다.");
       return false;
    }

    // 2. 관리자 설정 단가표와 연동된 스마트 차감 엔진 V2 호출
    const { data, error } = await supabase.rpc('deduct_points_dynamic', {
      p_user_id: userId,
      p_page_type: pageType,
      p_item_count: itemCount
    });

    // 3. 에러 발생 또는 포인트가 부족할 때 결제 모달 띄우기
    if (error || !data || data.success === false) {
      // DB에서 단가를 성공적으로 가져왔다면 진짜 단가를, 아니면 기존 10P를 알림창에 띄워줍니다.
      const costPerItem = data?.cost_per_item || (fallbackPoints / itemCount);
      const totalRequired = data?.required || fallbackPoints;
      
      const goCharge = window.confirm(
        `잔여 포인트가 부족합니다. (1건당 ${costPerItem}P 차감)\n\n현재 총 ${itemCount}건을 조회하려면 ${totalRequired}P가 필요합니다.\n포인트 충전 페이지로 이동하시겠습니까?`
      );
      if (goCharge) {
        router.push('/mypage');
      }
      return false; // 차감 실패 (검색 중단)
    }

    // 4. 결제 성공! 검색 허용!
    return true; 
  };

  return { deductPoints };
};