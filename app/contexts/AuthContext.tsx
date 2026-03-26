// app/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { createClient } from "@/app/utils/supabase/client";

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 🌟 [추가됨] 언제든지 외부(사이드바 등)에서 포인트를 다시 불러올 수 있는 전용 함수
  const refreshProfile = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (data?.is_deleted) {
        alert("탈퇴한 계정입니다.");
        await supabase.auth.signOut();
        if (typeof window !== 'undefined') window.location.replace("/");
        return;
      }
      setProfile(data || null);
    } catch (err) {
      console.error("프로필 로드 실패:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // 초기 마운트 시 프로필 로드용 내부 함수
    const fetchProfileInitial = async (currentUser: any) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        
        if (data?.is_deleted) {
          alert("탈퇴한 계정입니다.");
          await supabase.auth.signOut();
          if (typeof window !== 'undefined') window.location.replace("/");
          return;
        }

        if (isMounted) setProfile(data || null);
      } catch (err) {
        console.error("프로필 로드 실패:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          if (isMounted) setUser(session.user);
          await fetchProfileInitial(session.user);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setUser(session.user);
          
          if (event === 'SIGNED_IN') {
            supabase
              .from('profiles')
              .update({ last_login_at: new Date().toISOString() })
              .eq('id', session.user.id)
              .then(); 
          }
          
          fetchProfileInitial(session.user);
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
      setIsLoading(true); 
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

  // 🌟 [수정됨] 만든 refreshProfile 함수를 외부로 내보냅니다.
  const value = { user, profile, isLoading, handleLogout, refreshProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);