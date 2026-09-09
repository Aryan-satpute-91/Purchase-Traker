import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Trash2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import type { TimeEntry } from '@/types/database';
import { startOfWeek, startOfMonth } from 'date-fns';

const ACTIVITY_COLORS: Record<string, string> = {
  research: '#818cf8',
  price_comparison: '#a78bfa',
  ordering: '#34d399',
  testing: '#60a5fa',
  integration: '#f59e0b',
  debugging: '#f87171',
  documentation: '#94a3b8',
  other: '#e2e8f0',
};

export function TimeTrackingPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [filterProject, setFilterProject] = useState('');
  const [filterActivity, setFilterActivity] = useState('');

  // Quick log state
  const [activity, setActivity] = useState('testing');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [projectId, setProjectId] = useState('');

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').order('name');
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: ['time-entries', filterProject, filterActivity],
    queryFn: async () => {
      let q = supabase
        .from('time_entries')
        .select('*, project:projects(name), purchase:purchases(item_name)')
        .order('logged_at', { ascending: false });
      if (filterProject) q = q.eq('project_id', filterProject);
      if (filterActivity) q = q.eq('activity_type', filterActivity as never);
      const { data } = await q;
      return (data as TimeEntry[]) ?? [];
    },
  });

  const { mutate: logEntry, isPending: logging } = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('time_entries').insert({
        user_id: user.id,
        project_id: projectId || null,
        activity_type: activity as never,
        duration_minutes: duration,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Time logged!');
      setNotes('');
    },
    onError: () => toast.error('Failed to log time'),
  });

  const { mutate: deleteEntry } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-entries'] }),
    onError: () => toast.error('Failed to delete entry'),
  });

  const weekStart = startOfWeek(new Date()).toISOString();
  const monthStart = startOfMonth(new Date()).toISOString();
  const weekMinutes = entries?.filter((e) => e.logged_at >= weekStart).reduce((s, e) => s + e.duration_minutes, 0) ?? 0;
  const monthMinutes = entries?.filter((e) => e.logged_at >= monthStart).reduce((s, e) => s + e.duration_minutes, 0) ?? 0;

  const activityMap = entries?.reduce<Record<string, number>>((acc, e) => {
    acc[e.activity_type] = (acc[e.activity_type] || 0) + e.duration_minutes;
    return acc;
  }, {}) ?? {};
  const chartData = Object.entries(activityMap).map(([name, minutes]) => ({ name, minutes })).sort((a, b) => b.minutes - a.minutes);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Time Tracking" subtitle="Where is your time actually going?" />

      {/* Quick log bar */}
      <Card className="mb-6">
        <CardTitle className="mb-4"><Plus className="inline h-4 w-4 mr-1 text-slate-400" />Log time</CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-end gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <label className="text-xs font-medium text-slate-500">Activity</label>
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-surface-200 bg-surface-50 text-sm"
            >
              {Object.keys(ACTIVITY_COLORS).map((a) => (
                <option key={a} value={a}>{a.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:w-28">
            <label className="text-xs font-medium text-slate-500">Minutes</label>
            <input
              type="number" min={1} value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl border border-surface-200 bg-surface-50 text-sm"
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <label className="text-xs font-medium text-slate-500">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-surface-200 bg-surface-50 text-sm"
            >
              <option value="">— No project —</option>
              {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <label className="text-xs font-medium text-slate-500">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional…"
              className="w-full h-10 px-3 rounded-xl border border-surface-200 bg-surface-50 text-sm"
            />
          </div>
          <Button variant="primary" size="md" className="w-full sm:w-auto h-10" onClick={() => logEntry()} loading={logging}>
            Log Time
          </Button>
        </div>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-surface-100 shadow-card p-4">
          <p className="text-xs text-slate-500">This week</p>
          <p className="text-2xl font-bold text-slate-900">{Math.floor(weekMinutes / 60)}h {weekMinutes % 60}m</p>
        </div>
        <div className="bg-white rounded-2xl border border-surface-100 shadow-card p-4">
          <p className="text-xs text-slate-500">This month</p>
          <p className="text-2xl font-bold text-accent-700">{Math.floor(monthMinutes / 60)}h {monthMinutes % 60}m</p>
        </div>
        <div className="bg-white rounded-2xl border border-surface-100 shadow-card p-4">
          <p className="text-xs text-slate-500">Top activity</p>
          <p className="text-base font-bold text-slate-900 capitalize">
            {chartData[0]?.name?.replace('_', ' ') ?? '—'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Activity breakdown chart */}
        {chartData.length > 0 && (
          <Card>
            <CardTitle className="mb-4">Time by activity</CardTitle>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip formatter={(v: unknown) => [`${v as number} min`, 'Time spent']} />
                  <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                    {chartData.map(({ name }) => (
                      <Cell key={name} fill={ACTIVITY_COLORS[name] ?? '#818cf8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardTitle className="mb-4">Filter entries</CardTitle>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Project</label>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-surface-200 bg-surface-50 text-sm"
              >
                <option value="">All projects</option>
                {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Activity type</label>
              <select
                value={filterActivity}
                onChange={(e) => setFilterActivity(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-surface-200 bg-surface-50 text-sm"
              >
                <option value="">All activities</option>
                {Object.keys(ACTIVITY_COLORS).map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
        </Card>
      </div>

      {/* Log table */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-surface-100">
          <CardTitle>All time entries</CardTitle>
        </div>
        {isLoading ? (
          <div>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : !entries?.length ? (
          <EmptyState
            icon={<Clock className="h-6 w-6" />}
            title="No time entries yet"
            description="Use the log bar above to start tracking your time"
          />
        ) : (
          entries.map((e) => (
            <div key={e.id} className="flex items-center gap-4 px-5 py-3 border-b border-surface-50 last:border-0 hover:bg-surface-50 transition-colors group">
              <span
                className="px-2.5 py-1 rounded-lg text-xs font-medium capitalize shrink-0"
                style={{ backgroundColor: `${ACTIVITY_COLORS[e.activity_type]}20`, color: ACTIVITY_COLORS[e.activity_type] }}
              >
                {e.activity_type.replace('_', ' ')}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700">{e.notes ?? '—'}</p>
                <p className="text-xs text-slate-400">
                  {(e.project as { name?: string } | null)?.name ?? 'No project'} · {formatDate(e.logged_at)}
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-800 shrink-0">{e.duration_minutes}m</span>
              <button
                type="button"
                onClick={() => deleteEntry(e.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 active:text-red-700 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                title="Delete entry"
                aria-label="Delete entry"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
