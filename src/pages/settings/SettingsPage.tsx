import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Settings, User, Shield, Sliders, AlertTriangle, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const profileSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
});

const prefsSchema = z.object({
  default_gst_rate: z.number().min(0).max(100),
  default_return_days: z.number().min(0),
  default_warranty_months: z.number().min(0),
});

const passwordSchema = z.object({
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    values: { full_name: profile?.full_name ?? '' },
  });

  const prefsForm = useForm({
    resolver: zodResolver(prefsSchema),
    values: {
      default_gst_rate: profile?.default_gst_rate ?? 18,
      default_return_days: profile?.default_return_days ?? 7,
      default_warranty_months: profile?.default_warranty_months ?? 12,
    },
  });

  const passwordForm = useForm({ resolver: zodResolver(passwordSchema) });

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: async (data: { full_name: string }) => {
      const { error } = await supabase.from('profiles').update({ full_name: data.full_name }).eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated!');
    },
    onError: () => toast.error('Failed to save profile'),
  });

  const { mutate: savePrefs, isPending: savingPrefs } = useMutation({
    mutationFn: async (data: { default_gst_rate: number; default_return_days: number; default_warranty_months: number }) => {
      const { error } = await supabase.from('profiles').update(data).eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Preferences saved!');
    },
    onError: () => toast.error('Failed to save preferences'),
  });

  const { mutate: changePassword, isPending: changingPass } = useMutation({
    mutationFn: async (data: { new_password: string }) => {
      const { error } = await supabase.auth.updateUser({ password: data.new_password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Password changed!');
      passwordForm.reset();
    },
    onError: () => toast.error('Failed to change password'),
  });

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      // Note: Full account deletion requires a server-side Edge Function
      // to call supabase.auth.admin.deleteUser(userId) with service role key
      await signOut();
      toast('Account deletion requires contacting support for full data removal', { icon: 'ℹ️' });
      navigate('/auth');
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const inputCls = 'w-full h-9 px-3 rounded-xl border border-surface-200 bg-surface-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all';

  return (
    <div className="max-w-xl animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      {/* Profile */}
      <Card className="mb-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Profile</h2>
        </div>
        <form onSubmit={profileForm.handleSubmit((d) => saveProfile(d))} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Full name</label>
            <input className={inputCls} {...profileForm.register('full_name')} />
            {profileForm.formState.errors.full_name && (
              <p className="text-xs text-red-500 mt-1">{profileForm.formState.errors.full_name.message as string}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Email</label>
            <input className={`${inputCls} opacity-60 cursor-not-allowed`} value={user?.email ?? ''} readOnly />
            <p className="text-xs text-slate-400 mt-1">Email is managed by Supabase Auth and cannot be changed here</p>
          </div>
          <Button type="submit" variant="primary" size="sm" loading={savingProfile}>Save profile</Button>
        </form>
      </Card>

      {/* Security */}
      <Card className="mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Security</h2>
        </div>
        <form onSubmit={passwordForm.handleSubmit((d) => changePassword(d))} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">New password</label>
            <input type="password" className={inputCls} placeholder="At least 6 characters" {...passwordForm.register('new_password')} />
            {passwordForm.formState.errors.new_password && (
              <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.new_password.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Confirm new password</label>
            <input type="password" className={inputCls} placeholder="••••••••" {...passwordForm.register('confirm_password')} />
            {passwordForm.formState.errors.confirm_password && (
              <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.confirm_password.message}</p>
            )}
          </div>
          <Button type="submit" variant="secondary" size="sm" loading={changingPass}>Change password</Button>
        </form>
      </Card>

      {/* Preferences */}
      <Card className="mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Preferences</h2>
        </div>
        <form onSubmit={prefsForm.handleSubmit((d) => savePrefs(d))} className="space-y-4">
          {[
            { name: 'default_gst_rate' as const, label: 'Default GST rate (%)', hint: 'Pre-filled on the Add Purchase form' },
            { name: 'default_return_days' as const, label: 'Default return window (days)', hint: 'Pre-filled for new purchases' },
            { name: 'default_warranty_months' as const, label: 'Default warranty (months)', hint: 'Pre-filled for new purchases' },
          ].map(({ name, label, hint }) => (
            <div key={name}>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">{label}</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                {...prefsForm.register(name, { valueAsNumber: true })}
              />
              <p className="text-xs text-slate-400 mt-1">{hint}</p>
            </div>
          ))}
          <Button type="submit" variant="primary" size="sm" loading={savingPrefs}>Save preferences</Button>
        </form>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200 bg-red-50/30">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wider">Danger zone</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Sign out everywhere</p>
              <p className="text-xs text-slate-500">Revoke all active sessions</p>
            </div>
            <Button variant="secondary" size="sm" icon={<LogOut className="h-3.5 w-3.5" />} onClick={signOut}>
              Sign out
            </Button>
          </div>
          <div className="border-t border-red-100 pt-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Delete account</p>
              <p className="text-xs text-slate-500">Permanently removes all your data</p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
              Delete account
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete your account?"
        description="This will permanently delete all your purchases, projects, documents, and time entries. This action cannot be undone."
        confirmLabel="Delete account"
        onConfirm={handleDeleteAccount}
        loading={deleting}
      />
    </div>
  );
}
