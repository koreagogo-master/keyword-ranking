// app/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { createClient } from "@/app/utils/supabase/client";

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 🌟 [추가됨] 내 브라우저만의 고유한 입장권(세션 ID) 랜덤 생성
  const localSessionId = useRef(typeof window !== 'undefined' ? Math.random().toString(36).substring(2, 15) : '');

  // 언제든지 외부(사이드바 등)에서 포인트를 다시 불러올 수 있는 전용 함수
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

  // =======================================================================
  // 🌟 [신규 추가] 중복 로그인 밀어내기 수문장 시스템
  // =======================================================================
  useEffect(() => {
    if (!user || !profile) return;

    // 기획 원칙: 에이전시(VIP)와 무료 회원은 다중 접속을 허용하므로 검사하지 않고 통과!
    if (profile?.role?.toLowerCase() === 'admin' || profile.grade === 'agency' || profile.grade === 'free') return;

    const enforceSingleSession = async () => {
      // 1. 현재 DB에 기록된 입장권(세션) 확인
      const { data } = await supabase.from('profiles').select('current_session_id').eq('id', user.id).single();

      // 2. 누군가 다른 입장권으로 접속 중이라면 '밀어내기 팝업' 노출
      if (data?.current_session_id && data.current_session_id !== localSessionId.current) {
        const confirmKick = window.confirm("🚨 현재 다른 기기에서 사용 중인 계정입니다.\n기존 접속을 끊고 이 기기에서 로그인하시겠습니까?");
        if (!confirmKick) {
          // 취소하면 내가 물러납니다. (기존에 잘 만들어두신 handleLogout 재활용)
          await handleLogout();
          return;
        }
      }

      // 3. 확인을 눌렀거나, 내가 첫 접속이라면 내 입장권 번호와 IP로 DB 덮어쓰기
      let currentIp = '알 수 없음';
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const ipData = await res.json();
        currentIp = ipData.ip;
      } catch (e) {}

      await supabase.from('profiles').update({
        current_session_id: localSessionId.current,
        last_ip: currentIp
      }).eq('id', user.id);

      // 4. 누군가 내 자리를 뺏어가는지 실시간 감시 (Supabase Realtime)
      const channel = supabase.channel('session_listener')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload: any) => {
          // DB의 입장권 번호가 내 번호와 다르게 바뀌었다면? (누군가 나를 밀어냈다!)
          if (payload.new.current_session_id && payload.new.current_session_id !== localSessionId.current) {
            alert("⚠️ 다른 기기에서 새로운 로그인이 감지되어 현재 접속이 종료됩니다.");
            handleLogout(); 
          }
        }).subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    enforceSingleSession();
  }, [user, profile?.grade, supabase]);

  const value = { user, profile, isLoading, handleLogout, refreshProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);