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

  // 🌟 [수정됨] 내 브라우저만의 고유한 입장권(세션 ID) 생성 및 유지
  // sessionStorage를 확인해서 기존 입장권이 있으면 쓰고, 없으면 새로 만듭니다.
  const getOrCreateSessionId = () => {
    if (typeof window === 'undefined') return '';
    
    // 1. 브라우저 보관함에 내 입장권이 있는지 확인
    let sid = window.sessionStorage.getItem('my_session_id');
    
    // 2. 없다면 새로 발급받고 보관함에 저장
    if (!sid) {
      sid = Math.random().toString(36).substring(2, 15);
      window.sessionStorage.setItem('my_session_id', sid);
    }
    
    return sid; // 3. 입장권 반환
  };

  const localSessionId = useRef(getOrCreateSessionId());

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
  // 🌟 [업데이트] 요금제 등급별 IP 중복 접속 제어 시스템
  // =======================================================================
  useEffect(() => {
    if (!user || !profile) return;

    const enforceSingleSession = async (currentUser: any, localSessionIdStr: string) => {
      try {
        // 1. DB에서 현재 유저의 프로필 정보(등급, 세션ID, 최근 IP 등)를 가져옵니다.
        const { data: dbProfile, error } = await supabase
          .from('profiles')
          .select('grade, current_session_id, last_ip')
          .eq('id', currentUser.id)
          .single();

        if (error || !dbProfile) {
          console.error("프로필 정보를 불러오는 데 실패했습니다.", error);
          return;
        }

        const userGrade = dbProfile.grade?.toLowerCase() || 'starter';

        // ==========================================
        // [1단계] AGENCY, FREE, ADMIN 등급 -> 즉시 스킵 (다중 접속 허용)
        // ==========================================
        if (['agency', 'free', 'admin'].includes(userGrade)) {
          return; // 세션 일치 여부 검사 없이 통과
        }

        // ==========================================
        // [2단계 & 3단계] 하위 등급의 세션 ID 불일치 검사
        // ==========================================
        if (dbProfile.current_session_id && dbProfile.current_session_id !== localSessionIdStr) {

          // 현재 접속을 시도하는 클라이언트의 실제 IP 가져오기
          let currentIp = '';
          try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            currentIp = ipData.ip;
          } catch (ipError) {
            console.warn("IP 주소 가져오기 실패. 강제 검증 진행.");
          }

          // [2단계] 세션 ID는 다르지만 IP가 동일한 경우 (단순 재접속/브라우저 재실행)
          if (currentIp && dbProfile.last_ip === currentIp) {
            // 팝업 없이 조용히 현재 세션 ID 덮어쓰기
            await supabase
              .from('profiles')
              .update({
                current_session_id: localSessionIdStr,
                last_ip: currentIp
              })
              .eq('id', currentUser.id);

            // Realtime 감시 시작 후 종료
            const channel = supabase.channel('session_listener')
              .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${currentUser.id}` }, (payload: any) => {
                if (payload.new.current_session_id && payload.new.current_session_id !== localSessionIdStr) {
                  alert("⚠️ 다른 기기에서 새로운 로그인이 감지되어 현재 접속이 종료됩니다.");
                  handleLogout();
                }
              }).subscribe();
            return () => { supabase.removeChannel(channel); };
          }

          // [3단계] 세션 ID도 다르고 IP도 다른 경우 (진짜 중복 접속 시도)
          const confirmKick = window.confirm(
            "🚨 현재 다른 기기(IP)에서 사용 중인 계정입니다.\n\n기존 접속을 로그아웃 처리하고 현재 기기에서 접속하시겠습니까?\n(취소를 누르시면 현재 기기에서 로그아웃됩니다.)"
          );

          if (confirmKick) {
            // 동의 시: DB 정보를 현재 기기로 덮어씌움 (기존 기기는 다음 작업 시 튕김)
            await supabase
              .from('profiles')
              .update({
                current_session_id: localSessionIdStr,
                last_ip: currentIp
              })
              .eq('id', currentUser.id);
          } else {
            // 거절 시: 현재 기기 즉시 로그아웃
            await supabase.auth.signOut();
            window.location.href = '/login';
            return;
          }

        } else {
          // 정상 접속(세션 일치 또는 첫 접속) 시 현재 IP 저장
          try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const { ip: currentIp } = await ipResponse.json();

            if (dbProfile.last_ip !== currentIp) {
              await supabase
                .from('profiles')
                .update({ last_ip: currentIp })
                .eq('id', currentUser.id);
            }
          } catch (e) {
            // IP 수집 실패 무시
          }
        }

        // Realtime 감시: 누군가 내 세션을 뺏어가는지 실시간 감시 (Supabase Realtime)
        const channel = supabase.channel('session_listener')
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${currentUser.id}` }, (payload: any) => {
            if (payload.new.current_session_id && payload.new.current_session_id !== localSessionIdStr) {
              alert("⚠️ 다른 기기에서 새로운 로그인이 감지되어 현재 접속이 종료됩니다.");
              handleLogout();
            }
          }).subscribe();

        return () => { supabase.removeChannel(channel); };

      } catch (err) {
        console.error("단일 세션 검증 중 예기치 않은 오류가 발생했습니다.", err);
      }
    };

    enforceSingleSession(user, localSessionId.current);
  }, [user, profile?.grade, supabase]);

  const value = { user, profile, isLoading, handleLogout, refreshProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);