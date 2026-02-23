'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react'; 
import { createClient } from "@/app/utils/supabase/client";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter(); 
  
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    // 🛡️ [추가됨] 절대 무한 로딩에 빠지지 않도록 3초 뒤 강제로 로딩을 해제하는 타이머
    const fallbackTimer = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 3000);

    const loadSession = async () => {
      try {
        // 🌟 [수정됨] Header.tsx와 동일하게 가장 안정적인 getUser() 방식으로 통일
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
           if (userError.name === 'AbortError' || userError.message?.includes('aborted')) return;
           throw userError;
        }
        
        if (currentUser) {
          if (isMounted) setUser(currentUser);
          
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
          
          if (profileError && profileError.code !== 'PGRST116') {
            console.warn("Sidebar 프로필 로드 알림:", profileError.message);
          }
          
          if (isMounted) setProfile(data || null);
        } else {
          if (isMounted) setUser(null);
        }
      } catch (error) {
        console.error("세션 로드 실패", error);
        if (isMounted) setUser(null);
      } finally {
        clearTimeout(fallbackTimer); // 통신이 정상적으로 끝나면 강제 해제 타이머를 취소합니다.
        if (isMounted) setIsLoading(false); 
      }
    };
    
    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setUser(session.user);
          const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          if (isMounted) setProfile(data || null);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
        window.sessionStorage.clear();
      }

      alert("로그아웃 되었습니다.");
      window.location.replace("/"); 
    } catch (err) {
      console.error("로그아웃 실행 중 오류:", err);
      window.location.replace("/");
    }
  };

  const menuGroups = [
    {
      title: "Naver 분석",
      items: [
        { name: "키워드 정밀 분석", href: "/analysis" },
        { name: "연관 키워드 조회", href: "/related-fast" },
        { name: "통검 순위", href: "/blog-rank" },
        { name: "블로그 순위", href: "/blog-rank-b" },
        { name: "지식인 순위", href: "/kin-rank" },
      ]
    },
    {
      title: "Google & YouTube",
      items: [
        { name: "구글 키워드 분석", href: "/google-analysis" },
        { name: "유튜브 트렌드", href: "/youtube-trend" },
      ]
    },
    {
      title: "Seller Tools",
      items: [
        { name: "쇼핑 경쟁강도", href: "/shopping-insight" },
        { name: "수익률 계산기", href: "/calculator" },
      ]
    },
    {
      title: "System",
      items: [
        { name: "분석 히스토리", href: "/history" },
        { name: "사용자 설정", href: "/settings" },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-50">
      
      {/* 1. 회원 정보 영역 */}
      {isLoading ? (
        <div className="px-6 py-7 border-b border-gray-100 bg-gray-50/30 flex items-center justify-center h-[130px]">
          <span className="text-xs text-gray-400 font-bold">정보 불러오는 중...</span>
        </div>
      ) : user ? (
        <div className="px-6 py-7 border-b border-gray-100 bg-gray-50/30">
          <div className="mb-4">
            <p className="text-gray-400 font-medium text-[11px] mb-1">Signed in as</p>
            <p className="text-gray-800 font-bold text-[13px] break-all leading-snug">
              {user.email}
            </p>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Grade</span>
            <span className="text-[11px] font-extrabold text-[#ff8533] px-2 py-0.5 bg-orange-50 rounded border border-orange-100">
              {profile?.grade?.toUpperCase() || 'STANDARD'}
            </span>
          </div>

          <div className="flex gap-2 w-full mt-2">
            <Link 
              href="/mypage" 
              className="flex-1 flex items-center justify-center border border-gray-200 bg-white hover:border-[#ff8533] hover:text-[#ff8533] text-gray-600 text-[12px] font-bold py-2 rounded-lg transition-all shadow-sm"
            >
              My page
            </Link>
            <button 
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center border border-gray-200 bg-white hover:border-red-500 transition-all shadow-sm group rounded-lg"
            >
              <span className="text-gray-600 group-hover:text-red-500 text-[12px] font-bold">
                Log out
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="px-6 py-7 border-b border-gray-100 bg-gray-50/30 flex items-center justify-center h-[130px]">
          <Link href="/login" className="text-[13px] font-bold text-[#ff8533] hover:underline">
            로그인이 필요합니다
          </Link>
        </div>
      )}

      {/* 2. 메뉴 목록 */}
      <nav className="flex-1 py-6 overflow-y-auto">
        <ul>
          {menuGroups.map((group, groupIdx) => (
            <li key={groupIdx} className="mb-6">
              <div 
                className="px-6 py-2 text-[13px] font-semibold text-gray-500 tracking-tight"
                style={{ fontFamily: "'NanumSquare', sans-serif" }}
              >
                {group.title}
              </div>
              <ul className="mt-1">
                {group.items.map((item, itemIdx) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={itemIdx}>
                      <Link href={item.href} className={`
                        px-6 py-2.5 flex items-center gap-3 transition-all text-[14px]
                        ${isActive 
                          ? 'bg-blue-50 text-[#1a73e8] border-r-[3px] border-[#1a73e8] font-semibold' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                      `}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#1a73e8]' : 'bg-gray-200'}`}></span>
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="p-3 rounded-lg border border-gray-200 bg-white">
          <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Enterprise Mode</p>
          <p className="text-[12px] text-gray-600 font-medium">실시간 API 분석 활성화</p>
        </div>
      </div>
    </aside>
  );
}