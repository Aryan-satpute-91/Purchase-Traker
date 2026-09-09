import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShoppingBag, Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { isSupabaseConfigured } from '@/lib/supabase';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const forgotSchema = z.object({
  email: z.string().email('Invalid email'),
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;
type ForgotForm = z.infer<typeof forgotSchema>;

type Tab = 'login' | 'signup' | 'forgot';

function InputField({
  label,
  type = 'text',
  placeholder,
  error,
  icon,
  right,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        )}
        <input
          type={type}
          placeholder={placeholder}
          className={`w-full h-10 ${icon ? 'pl-9' : 'pl-3'} ${right ? 'pr-10' : 'pr-3'} rounded-xl border text-sm text-slate-800 placeholder-slate-400 transition-all duration-150 outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent ${error ? 'border-red-400 bg-red-50' : 'border-surface-200 bg-surface-50'}`}
          {...props}
        />
        {right && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{right}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, signInWithGoogle } = useAuth();
  const [tab, setTab] = useState<Tab>('login');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  };

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const signupForm = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });
  const forgotForm = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const handleLogin = loginForm.handleSubmit(async ({ email, password }) => {
    setLoading(true);
    const error = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate('/dashboard');
    }
  });

  const handleSignup = signupForm.handleSubmit(async ({ email, password, fullName }) => {
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Account created! Check your email to verify.');
      setTab('login');
    }
  });

  const handleForgot = forgotForm.handleSubmit(async ({ email }) => {
    setLoading(true);
    const error = await resetPassword(email);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password reset email sent!');
      setTab('login');
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-accent-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-slide-up">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-600 shadow-card-lg mb-4">
            <ShoppingBag className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">PurchaseTrack</h1>
          <p className="text-sm text-slate-500 mt-1">Your personal purchase manager</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-card-lg border border-surface-100 p-6">
          {!isSupabaseConfigured && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <p className="font-semibold text-amber-800 mb-0.5">Setup Required</p>
              <p className="text-amber-700 leading-relaxed">
                Connect your Supabase project by adding your credentials to <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono text-[11px]">.env.local</code>.
              </p>
            </div>
          )}

          {tab !== 'forgot' && (
            <div className="flex bg-surface-100 rounded-xl p-1 mb-6">
              {(['login', 'signup'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    tab === t ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t === 'login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </div>
          )}

          {tab === 'forgot' && (
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Reset password</h2>
              <p className="text-sm text-slate-500 mt-0.5">We'll email you a reset link</p>
            </div>
          )}

          {/* Login Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <InputField
                label="Email"
                type="email"
                placeholder="you@example.com"
                icon={<Mail className="h-4 w-4" />}
                error={loginForm.formState.errors.email?.message}
                {...loginForm.register('email')}
              />
              <InputField
                label="Password"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                icon={<Lock className="h-4 w-4" />}
                error={loginForm.formState.errors.password?.message}
                right={
                  <button type="button" onClick={() => setShowPass(!showPass)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                {...loginForm.register('password')}
              />
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setTab('forgot')}
                  className="text-xs text-accent-600 hover:text-accent-700 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" variant="primary" className="w-full" loading={loading} iconRight={<ArrowRight className="h-4 w-4" />}>
                Continue
              </Button>
            </form>
          )}

          {/* Sign Up Form */}
          {tab === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <InputField
                label="Full name"
                placeholder="Jane Doe"
                icon={<User className="h-4 w-4" />}
                error={signupForm.formState.errors.fullName?.message}
                {...signupForm.register('fullName')}
              />
              <InputField
                label="Email"
                type="email"
                placeholder="you@example.com"
                icon={<Mail className="h-4 w-4" />}
                error={signupForm.formState.errors.email?.message}
                {...signupForm.register('email')}
              />
              <InputField
                label="Password"
                type={showPass ? 'text' : 'password'}
                placeholder="At least 6 characters"
                icon={<Lock className="h-4 w-4" />}
                error={signupForm.formState.errors.password?.message}
                right={
                  <button type="button" onClick={() => setShowPass(!showPass)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                {...signupForm.register('password')}
              />
              <InputField
                label="Confirm password"
                type="password"
                placeholder="••••••••"
                icon={<Lock className="h-4 w-4" />}
                error={signupForm.formState.errors.confirmPassword?.message}
                {...signupForm.register('confirmPassword')}
              />
              <Button type="submit" variant="primary" className="w-full" loading={loading} iconRight={<ArrowRight className="h-4 w-4" />}>
                Create account
              </Button>
            </form>
          )}

          {/* Google OAuth Provider */}
          {tab !== 'forgot' && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-surface-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-400">or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
                className="w-full h-10 flex items-center justify-center gap-2.5 rounded-xl border border-surface-200 bg-white hover:bg-surface-50 text-sm font-medium text-slate-700 transition-colors shadow-sm disabled:opacity-60"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{googleLoading ? 'Connecting to Google…' : 'Sign in with Google'}</span>
              </button>
            </>
          )}

          {/* Forgot Password Form */}
          {tab === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <InputField
                label="Email"
                type="email"
                placeholder="you@example.com"
                icon={<Mail className="h-4 w-4" />}
                error={forgotForm.formState.errors.email?.message}
                {...forgotForm.register('email')}
              />
              <Button type="submit" variant="primary" className="w-full" loading={loading}>
                Send reset link
              </Button>
              <button
                type="button"
                onClick={() => setTab('login')}
                className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors text-center"
              >
                ← Back to log in
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4 px-2">
          Your data is private and only visible to you. We never share or sell your information.
        </p>
      </div>
    </div>
  );
}
