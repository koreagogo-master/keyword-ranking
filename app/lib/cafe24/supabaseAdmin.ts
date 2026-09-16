import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * cafe24_oauth_tokens 테이블은 RLS가 켜져 있고 정책이 하나도 없어서
 * service role 키로만 접근할 수 있습니다. 이 헬퍼는 서버 라우트에서만 사용합니다.
 *
 * 환경변수는 호출 시점(요청 처리 중)에 읽습니다.
 */
export function createCafe24SupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
