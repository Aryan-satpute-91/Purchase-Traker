import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const { user, session, loading, setSession, setLoading, reset } = useAuthStore();

  useEffect(() => {
    const hasAuthParams =
      typeof window !== 'undefined' &&
      (window.location.search.includes('code=') ||
        window.location.hash.includes('access_token=') ||
        window.location.search.includes('error='));

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // If we are currently handling an OAuth exchange, let onAuthStateChange finish it
      if (!hasAuthParams || session) {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    // Safety fallback: ensure loading never hangs if exchange fails silently
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (hasAuthParams) {
      timeout = setTimeout(() => {
        setLoading(false);
      }, 5000);
    }

    return () => {
      subscription.unsubscribe();
      if (timeout) clearTimeout(timeout);
    };
  }, [setSession, setLoading]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    reset();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return error;
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data, error };
  };

  return { user, session, loading, signIn, signUp, signOut, resetPassword, signInWithGoogle };
}
