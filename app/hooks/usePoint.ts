// app/hooks/usePoint.ts
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';

const PATH_TO_PAGE_TYPE: Record<string, string> = {
  '/analysis': 'ANALYSIS',
  '/related-fast': 'RELATED',
  '/blog-rank-b': 'BLOG',
  '/kin-rank': 'JISIKIN',
  '/blog-rank': 'TOTAL',
  '/google-analysis': 'GOOGLE',
  '/youtube-trend': 'YOUTUBE',
  '/shopping-insight': 'SHOPPING',
  '/shopping-rank': 'SHOPPING_RANK',
  '/seo-title': 'SEO_TITLE',
  '/seo-check': 'SEO_CHECK',
  '/ai-blog': 'AI_BLOG'
};

export const usePoint = () => {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // 🌟 키워드(keyword)를 선택적으로 받을 수 있도록 통로 개방!
  const deductPoints = async (userId: string | undefined, fallbackPoints: number, itemCount: number = 1, keyword: string = "") => {
    if (!userId) {
      alert("로그인이 필요한 서비스입니다. 로그인 후 이용해주세요.");
      return false;
    }

    const pageType = PATH_TO_PAGE_TYPE[pathname];

    if (!pageType) {
       console.error("포인트 정책 맵핑이 누락된 페이지입니다:", pathname);
       alert("포인트 정책을 확인할 수 없는 페이지입니다.");
       return false;
    }

    // 🌟 히스토리 장부에 남길 문구 생성 (키워드가 넘어오면 키워드 포함, 아니면 N건 검색으로 통일)
    const description = keyword ? `[${keyword}] 검색 (${itemCount}건)` : `${itemCount}건 조회`;

    const { data, error } = await supabase.rpc('deduct_points_dynamic', {
      p_user_id: userId,
      p_page_type: pageType,
      p_item_count: itemCount,
      p_description: description // 새로 만든 통로로 텍스트 전달
    });

    if (error || !data || data.success === false) {
      const costPerItem = data?.cost_per_item || (fallbackPoints / itemCount);
      const totalRequired = data?.required || fallbackPoints;
      
      const goCharge = window.confirm(
        `잔여 포인트가 부족합니다. (1건당 ${costPerItem}P 차감)\n\n현재 총 ${itemCount}건을 조회하려면 ${totalRequired}P가 필요합니다.\n포인트 충전 페이지로 이동하시겠습니까?`
      );
      if (goCharge) router.push('/mypage');
      
      return false; 
    }

    return true; 
  };

  return { deductPoints };
};