import { type NextRequest } from 'next/server'
import { updateSession } from '@/app/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // 터미널에서 이 로그가 뜨는지 꼭 확인해주세요!
  console.log("👮‍♂️ 문지기(Middleware) 작동 중! 체크하는 경로:", request.nextUrl.pathname);
  
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * 이미지나 정적 파일을 제외한 모든 경로에서 실행
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}