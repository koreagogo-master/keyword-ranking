'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { createClient } from "@/app/utils/supabase/client";

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // 1. 프로필 정보 불러오기
    const fetchProfile = async (currentUser: any) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        
        if (isMounted) setProfile(data || null);
      } catch (err) {
        console.error("프로필 로드 실패:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    // 🌟 2. 새로고침 시 세션을 "꽉 잡는" 강력한 초기화 로직
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          if (isMounted) setUser(session.user);
          await fetchProfile(session.user);
        } else {
          if (isMounted) {
            setUser(null);
            setProfile(null);
            setIsLoading(false);
          }
        }
      } catch (error) {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeAuth();

    // 🌟 3. 로그인 상태 감지 (접속일 기록 시 화면 지연 방지)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      // INITIAL_SESSION 이벤트 추가로 새로고침 캐치 강화
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setUser(session.user);
          
          if (event === 'SIGNED_IN') {
            // await을 빼서 DB 저장이 화면 로딩을 방해하지 않도록 백그라운드 처리
            supabase
              .from('profiles')
              .update({ last_login_at: new Date().toISOString() })
              .eq('id', session.user.id)
              .then(); 
          }
          
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

  const handleLogout = async () => {
    try {
      setIsLoading(true); // 로그아웃 시에도 UI 깜빡임 방지
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
        window.sessionStorage.clear();
      }
      window.location.replace("/"); 
    } catch (err) {
      console.error("로그아웃 오류:", err);
      window.location.replace("/");
    }
  };

  const value = { user, profile, isLoading, handleLogout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);