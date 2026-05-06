import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // Cloud Run 환경에서는 request.url의 origin이 localhost:8080으로 잡히는 문제 방지
  // X-Forwarded-Host 헤더를 우선 사용하여 실제 외부 도메인(tmgad.com)을 가져옴
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : new URL(request.url).origin

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                // 👇 [디버깅] 실제로 쿠키 설정이 실행되는지 터미널에서 확인
                console.log(`[Cookies] Setting cookie: ${name}, Secure: false`)
                
                cookieStore.set(name, value, {
                  ...options,
                  sameSite: 'lax',
                  // 라이브(HTTPS) 환경에서는 secure: true, 로컬(HTTP)에서는 false
                  secure: process.env.NODE_ENV === 'production',
                  httpOnly: true,
                })
              })
            } catch (error) {
              console.error('[Cookies] Error setting cookie:', error)
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      console.log('[Auth] Session exchange successful')
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error('[Auth] Session exchange failed:', error)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}