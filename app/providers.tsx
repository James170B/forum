"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { friendlyError, getSupabaseClient, type Profile } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const profileRequest = useRef(0);

  const loadProfile = useCallback(async (userId: string) => {
    const requestId = ++profileRequest.current;
    try {
      const { data, error } = await getSupabaseClient()
        .from("profiles")
        .select("id, username, bio, avatar_url, accent_color, role, banned")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (requestId !== profileRequest.current) return;
      setProfile(data as Profile | null);
      setProfileError(null);
    } catch (error) {
      if (requestId !== profileRequest.current) return;
      setProfileError(friendlyError(error));
    } finally {
      if (requestId === profileRequest.current) setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    await loadProfile(user.id);
  }, [loadProfile, user]);

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();
    const { data } = client.auth.onAuthStateChange((_event, session: Session | null) => {
      if (!active) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        setLoading(true);
        void loadProfile(nextUser.id);
      } else {
        profileRequest.current += 1;
        setLoading(false);
        setProfile(null);
        setProfileError(null);
      }
    });

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!active) return;
        const nextUser = data.session?.user ?? null;
        setUser(nextUser);
        if (nextUser) {
          setLoading(true);
          void loadProfile(nextUser.id);
        } else {
          setLoading(false);
          setProfile(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setProfileError(friendlyError(error));
          setLoading(false);
        }
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(
    () => ({ user, profile, loading, profileError, refreshProfile }),
    [user, profile, loading, profileError, refreshProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within Providers.");
  return context;
}
