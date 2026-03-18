import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: '유저 ID가 필요합니다.' }, { status: 400 });
    }

    // 🌟 최고 관리자 키(SERVICE_ROLE_KEY)를 사용하여 유저 완벽 강제 삭제
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // .env 파일에 이 키가 꼭 세팅되어 있어야 합니다!
    );

    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: '강제 탈퇴가 완료되었습니다.' });
  } catch (error: any) {
    console.error('유저 삭제 에러:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}