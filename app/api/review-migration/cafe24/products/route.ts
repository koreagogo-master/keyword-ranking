import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/requireAdmin';
import { fetchAllProducts } from '@/app/lib/cafe24/products';
import { CAFE24_NO_STORE_HEADERS, cafe24FailureResponse } from '@/app/lib/cafe24/failureResponse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 카페24 상품 목록 조회 (상품 매칭 3단계용).
 *
 * - 관리자만 호출할 수 있습니다.
 * - 응답에는 상품 정보만 담고 토큰·암호문·설정값은 절대 포함하지 않습니다.
 *
 * 성공 응답: { products, totalCount, fetchedAt, truncated }
 * products[] 항목: productNo, productCode, customProductCode, productName,
 *                  thumbnailUrl, productUrl, display, selling, soldOut,
 *                  hasOption, updatedDate
 * thumbnailUrl·productUrl은 서버가 고정 mallId를 기준으로 만들어 내려주므로
 * 클라이언트가 호스트를 직접 조합할 필요가 없습니다.
 */

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.message },
      { status: admin.status, headers: CAFE24_NO_STORE_HEADERS }
    );
  }

  const result = await fetchAllProducts();
  if (!result.ok) {
    return cafe24FailureResponse(result, '상품 목록');
  }

  return NextResponse.json(
    {
      products: result.products,
      totalCount: result.products.length,
      fetchedAt: new Date().toISOString(),
      // 안전장치에 걸려 일부만 가져온 경우 화면에서 경고할 수 있도록 알려 줍니다.
      truncated: result.reachedPageLimit,
    },
    { headers: CAFE24_NO_STORE_HEADERS }
  );
}
