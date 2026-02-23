'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { createClient } from "@/app/utils/supabase/client";

// 1. 통제실(Context) 만들기
const AuthContext = createContext<any>(null);

// 2. 통제실 관리자(Provider) 만들기: 모든 통신은 여기서 딱 한 번만 일어납니다.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // 프로필 정보만 따로 안전하게 불러오는 함수
    const fetchProfile = async (currentUser: any) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.warn("프로필 로드 알림:", error.message);
        }
        if (isMounted) setProfile(data || null);
      } catch (err) {
        console.error("프로필 데이터 호출 실패:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    // 가장 빠르고 안정적인 방식(getSession)으로 통신
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    });

    // 로그인 상태 변화 감지 (로그아웃 하거나 토큰이 갱신될 때)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // 로그아웃 기능도 통제실에서 통합 관리합니다.
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

  // 3. 하위 컴포넌트(Header, Sidebar 등)에게 공유할 정보들
  const value = {
    user,
    profile,
    isLoading,
    handleLogout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// 4. 스위치(Custom Hook) 만들기: 다른 파일에서 단 한 줄로 정보를 꺼내 쓸 수 있습니다.
export const useAuth = () => {
  return useContext(AuthContext);
};