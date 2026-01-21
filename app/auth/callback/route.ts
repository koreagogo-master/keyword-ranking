import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

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
                  // ⚠️ 로컬 개발 환경 강제 설정
                  sameSite: 'lax',
                  secure: false, 
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