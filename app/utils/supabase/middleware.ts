import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // 1. 응답 객체 미리 생성
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 2. Supabase 클라이언트 생성 (쿠키 제어권 부여)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // 요청(Request)에 쿠키 심기
            request.cookies.set(name, value)
            
            // 응답(Response) 업데이트
            supabaseResponse = NextResponse.next({
              request,
            })
            
            // 응답(Response)에 쿠키 심기 (⚠️ 여기가 핵심!)
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // 로컬 환경(127.0.0.1)에서는 보안을 해제합니다.
              sameSite: 'lax',
              secure: false, 
            })
          })
        },
      },
    }
  )

  // 3. 세션 갱신 (반드시 호출해야 함)
  // 여기서 getUser가 실행되면서 위에서 설정한 쿠키 로직이 작동합니다.
  await supabase.auth.getUser()

  return supabaseResponse
}