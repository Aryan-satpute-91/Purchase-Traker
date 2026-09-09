import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Plus, Download } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Purchase, TimeEntry } from '@/types/database';

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

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ['project-purchases', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchases')
        .select('*, seller:sellers(name)')
        .eq('project_id', id!)
        .order('order_date', { ascending: false });
      return (data as Purchase[]) ?? [];
    },
    enabled: !!id,
  });

  const { data: timeEntries } = useQuery({
    queryKey: ['project-time', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('time_entries')
        .select('*')
        .eq('project_id', id!);
      return (data as TimeEntry[]) ?? [];
    },
    enabled: !!id,
  });

  if (projectLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>;
  if (!project) return <EmptyState title="Project not found" ctaLabel="Back to projects" onCta={() => navigate('/projects')} />;

  const totalSpent = purchases?.reduce((s, p) => s + p.total_amount, 0) ?? 0;
  const totalTime = timeEntries?.reduce((s, t) => s + t.duration_minutes, 0) ?? 0;

  // Category breakdown
  const categoryMap = purchases?.reduce<Record<string, number>>((acc, p) => {
    const cat = p.category || 'Other';
    acc[cat] = (acc[cat] || 0) + p.total_amount;
    return acc;
  }, {}) ?? {};
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Activity breakdown
  const activityMap = timeEntries?.reduce<Record<string, number>>((acc, t) => {
    acc[t.activity_type] = (acc[t.activity_type] || 0) + t.duration_minutes;
    return acc;
  }, {}) ?? {};
  const activityData = Object.entries(activityMap).map(([name, minutes]) => ({ name, minutes })).sort((a, b) => b.minutes - a.minutes);

  const exportCSV = () => {
    const rows = [
      ['Item', 'Seller', 'Date', 'Qty', 'Base', 'GST', 'Shipping', 'Discount', 'Total', 'Status'],
      ...(purchases ?? []).map((p) => [
        p.item_name,
        (p.seller as { name?: string } | null)?.name ?? '',
        formatDate(p.order_date),
        p.quantity,
        p.base_price,
        p.gst_amount,
        p.shipping_cost,
        p.discount_amount,
        p.total_amount,
        p.order_status,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={
          <button onClick={() => navigate('/projects')} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" /> Projects
          </button>
        }
        title={project.name}
        subtitle={project.description ?? undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={exportCSV}>
              Export CSV
            </Button>
            <Button
              variant="primary" size="sm" icon={<Plus className="h-4 w-4" />}
              onClick={() => navigate(`/purchases/new?project=${id}`)}
            >
              Add purchase
            </Button>
          </div>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total spent', value: formatCurrency(totalSpent) },
          { label: 'Items', value: purchases?.length ?? 0 },
          { label: 'Time logged', value: `${Math.floor(totalTime / 60)}h ${totalTime % 60}m` },
          { label: 'Avg. item cost', value: purchases?.length ? formatCurrency(totalSpent / purchases.length) : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl border border-surface-100 shadow-card p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className="text-xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Category spending */}
        {categoryData.length > 0 && (
          <Card>
            <CardTitle className="mb-4">Spending by category</CardTitle>
            <div className="space-y-2">
              {categoryData.map(({ name, value }) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-24 shrink-0 truncate">{name}</span>
                  <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-500 rounded-full"
                      style={{ width: `${(value / totalSpent) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-700 w-20 text-right">{formatCurrency(value)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Activity time breakdown */}
        {activityData.length > 0 && (
          <Card>
            <CardTitle className="mb-4">Time by activity</CardTitle>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip formatter={(v: unknown) => [`${v as number} min`, 'Duration']} />
                  <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                    {activityData.map(({ name }) => (
                      <Cell key={name} fill={ACTIVITY_COLORS[name] ?? '#818cf8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      {/* Purchases list */}
      <Card padding="none">
        <div className="px-5 py-4 flex items-center justify-between border-b border-surface-100">
          <CardTitle>Components & purchases</CardTitle>
          <span className="text-xs text-slate-400">{purchases?.length} items</span>
        </div>
        {!purchases?.length ? (
          <EmptyState title="No purchases in this project" ctaLabel="Add purchase" onCta={() => navigate(`/purchases/new?project=${id}`)} />
        ) : (
          purchases.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/purchases/${p.id}`)}
              className="flex items-center gap-4 px-5 py-3 border-b border-surface-50 last:border-0 hover:bg-surface-50 cursor-pointer group transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 group-hover:text-accent-600 transition-colors truncate">{p.item_name}</p>
                <p className="text-xs text-slate-400">{(p.seller as { name?: string } | null)?.name ?? '—'} · {formatDate(p.order_date)}</p>
              </div>
              <span className="text-sm font-semibold text-slate-900">{formatCurrency(p.total_amount)}</span>
              <StatusPill status={p.order_status} />
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
