import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { setSession, setLoading } = useAuthStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function processAuth() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error_description') || url.searchParams.get('error');

        if (error) {
          if (active) setErrorMsg(decodeURIComponent(error));
          return;
        }

        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('PKCE exchange error:', exchangeError);
            if (active) setErrorMsg(exchangeError.message);
            return;
          }
          if (data?.session && active) {
            setSession(data.session);
            setLoading(false);
            navigate('/dashboard', { replace: true });
            return;
          }
        }

        // Fallback: check getSession in case Supabase client auto-exchanged it
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          if (active) setErrorMsg(sessionError.message);
          return;
        }

        if (session && active) {
          setSession(session);
          setLoading(false);
          navigate('/dashboard', { replace: true });
          return;
        }

        // Wait briefly for onAuthStateChange
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
          if (newSession && active) {
            setSession(newSession);
            setLoading(false);
            subscription.unsubscribe();
            navigate('/dashboard', { replace: true });
          }
        });

        // Safety timeout
        const timeout = setTimeout(() => {
          if (active) {
            subscription.unsubscribe();
            navigate('/dashboard', { replace: true });
          }
        }, 3000);

        return () => {
          subscription.unsubscribe();
          clearTimeout(timeout);
        };
      } catch (err: unknown) {
        console.error('Auth callback failure:', err);
        if (active) setErrorMsg(err instanceof Error ? err.message : 'Authentication failed');
      }
    }

    processAuth();

    return () => {
      active = false;
    };
  }, [navigate, setSession, setLoading]);

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-card-lg border border-red-200 p-6 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Sign-in Failed</h2>
          <p className="text-sm text-slate-600 mb-5">{errorMsg}</p>
          <button
            onClick={() => navigate('/auth', { replace: true })}
            className="w-full py-2.5 px-4 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent-600 flex items-center justify-center animate-pulse shadow-card">
          <span className="text-white text-base font-bold">PT</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-800">Signing you in…</p>
          <p className="text-xs text-slate-400 mt-0.5">Finalizing your Google authentication</p>
        </div>
        <div className="flex gap-1.5 mt-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-accent-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
