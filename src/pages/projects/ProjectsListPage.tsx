import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, FolderKanban, DollarSign, Clock, Package } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import type { ProjectSummary } from '@/types/database';

const schema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
});

export function ProjectsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [modalOpen, setModalOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const { data: projects, isLoading } = useQuery({
    queryKey: ['project-summaries'],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_summary')
        .select('*')
        .order('total_spent', { ascending: false });
      return (data as ProjectSummary[]) ?? [];
    },
  });

  const { mutate: createProject, isPending } = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      if (!user) throw new Error('Not authenticated');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('projects') as any).insert({
        owner_id: user.id,
        name: data.name,
        description: data.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-summaries'] });
      toast.success('Project created!');
      setModalOpen(false);
      reset();
    },
    onError: () => toast.error('Failed to create project'),
  });

  const totalSpend = projects?.reduce((s, p) => s + p.total_spent, 0) ?? 0;
  const totalTime = projects?.reduce((s, p) => s + p.total_time_minutes, 0) ?? 0;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Projects"
        subtitle="All your electronic & engineering projects"
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
            New Project
          </Button>
        }
      />

      {/* Summary bar */}
      {(projects?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-surface-100 shadow-card p-3.5 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-slate-900">{projects?.length ?? 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Projects</p>
          </div>
          <div className="bg-white rounded-2xl border border-surface-100 shadow-card p-3.5 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-accent-700 truncate">{formatCurrency(totalSpend)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Combined spend</p>
          </div>
          <div className="bg-white rounded-2xl border border-surface-100 shadow-card p-3.5 sm:p-4 text-center">
            <p className="text-xl sm:text-2xl font-bold text-slate-900">{Math.floor(totalTime / 60)}h {totalTime % 60}m</p>
            <p className="text-xs text-slate-500 mt-0.5">Time logged</p>
          </div>
        </div>
      )}

      {/* Project grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : !projects?.length ? (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title="No projects yet"
          description="Create a project to group your purchases by goal (e.g. Bio-Sentry, College Robot)"
          ctaLabel="Create first project"
          onCta={() => setModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => (
            <Card
              key={p.project_id}
              hover
              onClick={() => navigate(`/projects/${p.project_id}`)}
              className="group"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center shrink-0">
                  <FolderKanban className="h-5 w-5 text-accent-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-accent-600 transition-colors truncate">
                    {p.project_name}
                  </h3>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-surface-50 rounded-xl">
                  <DollarSign className="h-3.5 w-3.5 text-slate-400 mx-auto mb-0.5" />
                  <p className="text-xs font-semibold text-slate-800">{formatCurrency(p.total_spent)}</p>
                  <p className="text-[10px] text-slate-400">spent</p>
                </div>
                <div className="p-2 bg-surface-50 rounded-xl">
                  <Clock className="h-3.5 w-3.5 text-slate-400 mx-auto mb-0.5" />
                  <p className="text-xs font-semibold text-slate-800">{Math.floor(p.total_time_minutes / 60)}h {p.total_time_minutes % 60}m</p>
                  <p className="text-[10px] text-slate-400">logged</p>
                </div>
                <div className="p-2 bg-surface-50 rounded-xl">
                  <Package className="h-3.5 w-3.5 text-slate-400 mx-auto mb-0.5" />
                  <p className="text-xs font-semibold text-slate-800">{p.item_count}</p>
                  <p className="text-[10px] text-slate-400">items</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-scale-in w-full max-w-sm mx-4">
            <div className="bg-white rounded-2xl shadow-card-lg border border-surface-100 p-6">
              <Dialog.Title className="text-lg font-semibold text-slate-900 mb-4">New project</Dialog.Title>
              <form onSubmit={handleSubmit((d) => createProject(d))} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Project name *</label>
                  <input
                    className="w-full h-9 px-3 rounded-xl border border-surface-200 bg-surface-50 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                    placeholder="e.g. Bio-Sentry"
                    {...register('name')}
                  />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Description</label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-surface-50 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
                    placeholder="Optional short description"
                    {...register('description')}
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button variant="primary" type="submit" loading={isPending}>Create project</Button>
                </div>
              </form>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
