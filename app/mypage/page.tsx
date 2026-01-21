'use client';

import { createClient } from "@/app/utils/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function MyPage() {
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/"); // 로그인 안 했으면 쫓아냄
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(data);
    };
    getProfile();
  }, []);

  if (!profile) return <div className="p-10">로딩 중...</div>;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white p-10">
      <h1 className="text-3xl font-bold mb-6 text-blue-400">👋 마이페이지</h1>
      
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <div className="mb-4">
          <label className="text-gray-400 text-sm">이메일</label>
          <p className="text-xl font-semibold">{profile.email}</p>
        </div>
        
        <div className="mb-4">
          <label className="text-gray-400 text-sm">내 등급</label>
          <div className="mt-1">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              profile.grade === 'premium' 
                ? 'bg-yellow-500 text-black' 
                : 'bg-green-600 text-white'
            }`}>
              {profile.grade.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="mt-8 p-4 bg-gray-700 rounded-lg text-sm text-gray-300">
          <p>💡 프리미엄 등급으로 업그레이드 하시면 더 많은 키워드를 조회할 수 있습니다.</p>
        </div>
      </div>
    </div>
  );
}