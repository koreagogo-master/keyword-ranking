// hooks/usePoint.ts
'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';

export const usePoint = () => {
  const router = useRouter();
  const supabase = createClient();

  // 🌟 마법의 함수: 유저ID, 필요한 총 포인트, 검색할 키워드 개수를 넘겨주면 알아서 다 처리합니다!
  const deductPoints = async (userId: string | undefined, requiredPoints: number, keywordCount: number = 1) => {
    if (!userId) {
      alert("로그인이 필요한 서비스입니다. 로그인 후 이용해주세요.");
      return false; // 차감 실패 (검색 중단)
    }

    // DB의 스마트 차감 엔진 호출
    const { data: isSuccess, error } = await supabase.rpc('deduct_points', {
      user_id_param: userId,
      deduct_amount: requiredPoints
    });

    // 포인트 부족 시 결제 유도 모달 띄우기
    if (error || !isSuccess) {
      const goCharge = window.confirm(
        `잔여 포인트가 부족합니다. (키워드 1개당 10P 차감)\n\n현재 총 ${keywordCount}개의 키워드를 조회하려면 ${requiredPoints}P가 필요합니다.\n포인트 충전 페이지로 이동하시겠습니까?`
      );
      if (goCharge) {
        router.push('/mypage');
      }
      return false; // 차감 실패 (검색 중단)
    }

    return true; // 차감 성공 (검색 진행)
  };

  return { deductPoints };
};