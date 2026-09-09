import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingBag, TrendingUp, Clock, ShieldCheck, RotateCcw, AlertTriangle, Plus, ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatBox } from '@/components/ui/StatBox';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard, SkeletonRow } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import {
  formatCurrency, formatDate, daysUntil, urgencyColor, warrantyExpiryDate, returnDeadlineDate
} from '@/lib/utils';
import type { Purchase, ProjectSummary } from '@/types/database';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';

function UrgencyBadge({ days }: { days: number | null }) {
  const color = urgencyColor(days);
  const label =
    days === null ? '—' :
    days < 0 ? `Expired ${Math.abs(days)}d ago` :
    days === 0 ? 'Today!' :
    `${days}d left`;

  const cls = {
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-slate-100 text-slate-400',
  }[color];

  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  // Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [thisMonth, pending, warrantyExpiring, returnExpiring] = await Promise.all([
        supabase
          .from('purchases')
          .select('total_amount')
          .gte('order_date', monthStart)
          .lte('order_date', monthEnd),
        supabase
          .from('purchases')
          .select('id', { count: 'exact' })
          .not('order_status', 'in', '(delivered,cancelled,returned)'),
        supabase
          .from('purchases')
          .select('id, order_date, warranty_months')
          .not('warranty_months', 'is', null),
        supabase
          .from('purchases')
          .select('id, order_date, return_window_days')
          .not('return_window_days', 'is', null)
          .not('order_status', 'in', '(returned,cancelled)'),
      ]);

      const monthPurchases = thisMonth.data ?? [];
      const monthCount = monthPurchases.length;
      const monthSpend = monthPurchases.reduce((s, p) => s + (p.total_amount ?? 0), 0);

      const warrantyCount = (warrantyExpiring.data ?? []).filter((p) => {
        if (!p.order_date || !p.warranty_months) return false;
        const expiry = warrantyExpiryDate(p.order_date, p.warranty_months);
        const d = daysUntil(expiry);
        return d !== null && d >= 0 && d <= 30;
      }).length;

      const returnCount = (returnExpiring.data ?? []).filter((p) => {
        if (!p.order_date || !p.return_window_days) return false;
        const deadline = returnDeadlineDate(p.order_date, p.return_window_days);
        const d = daysUntil(deadline);
        return d !== null && d >= 0 && d <= 3;
      }).length;

      return {
        monthCount,
        monthSpend,
        pendingCount: pending.count ?? 0,
        warrantyCount,
        returnCount,
      };
    },
  });

  // Project spending
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['dashboard-projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_summary')
        .select('*')
        .order('total_spent', { ascending: false })
        .limit(5);
      return (data as ProjectSummary[]) ?? [];
    },
  });

  // Recent purchases
  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchases')
        .select('id, item_name, total_amount, order_status, order_date, seller:sellers(name)')
        .order('created_at', { ascending: false })
        .limit(8);
      return (data as unknown as Purchase[]) ?? [];
    },
  });

  // Attention items
  const { data: attentionItems, isLoading: attentionLoading } = useQuery({
    queryKey: ['dashboard-attention'],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchases')
        .select('id, item_name, order_date, warranty_months, return_window_days, order_status');

      const items: { type: 'warranty' | 'return'; id: string; name: string; days: number }[] = [];

      for (const p of data ?? []) {
        if (p.warranty_months && p.order_date) {
          const d = daysUntil(warrantyExpiryDate(p.order_date, p.warranty_months));
          if (d !== null && d >= 0 && d <= 30) items.push({ type: 'warranty', id: p.id, name: p.item_name, days: d });
        }
        if (p.return_window_days && p.order_date && !['returned', 'cancelled'].includes(p.order_status)) {
          const d = daysUntil(returnDeadlineDate(p.order_date, p.return_window_days));
          if (d !== null && d >= 0 && d <= 7) items.push({ type: 'return', id: p.id, name: p.item_name, days: d });
        }
      }

      return items.sort((a, b) => a.days - b.days).slice(0, 6);
    },
  });

  const maxSpend = projects && projects.length > 0 ? Math.max(...projects.map((p) => p.total_spent)) : 1;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Dashboard"
        subtitle={`Good to see you — here's what's happening this month`}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/purchases/new')}
          >
            Add Purchase
          </Button>
        }
      />

      {/* Stat Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatBox
              label="Orders this month"
              value={stats?.monthCount ?? 0}
              icon={<ShoppingBag className="h-4 w-4" />}
              onClick={() => navigate('/purchases')}
            />
            <StatBox
              label="Spent this month"
              value={formatCurrency(stats?.monthSpend ?? 0)}
              icon={<TrendingUp className="h-4 w-4" />}
              accent
              onClick={() => navigate('/reports')}
            />
            <StatBox
              label="Pending deliveries"
              value={stats?.pendingCount ?? 0}
              icon={<Clock className="h-4 w-4" />}
              onClick={() => navigate('/purchases?status=in_transit')}
            />
            <StatBox
              label="Warranty expiring"
              value={stats?.warrantyCount ?? 0}
              icon={<ShieldCheck className="h-4 w-4" />}
              onClick={() => navigate('/warranty')}
            />
            <div className="col-span-2 sm:col-span-1 lg:col-span-1">
              <StatBox
                label="Return deadlines"
                value={stats?.returnCount ?? 0}
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={() => navigate('/warranty?tab=returns')}
              />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Spending */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Project spending</CardTitle>
            <button onClick={() => navigate('/projects')} className="text-xs text-accent-600 hover:text-accent-700 transition-colors flex items-center gap-0.5">
              All <ChevronRight className="h-3 w-3" />
            </button>
          </CardHeader>
          {projectsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : !projects?.length ? (
            <EmptyState icon={<ShoppingBag className="h-5 w-5" />} title="No projects yet" ctaLabel="New Project" onCta={() => navigate('/projects')} />
          ) : (
            <div className="space-y-3">
              {projects.map((p) => (
                <div
                  key={p.project_id}
                  className="cursor-pointer group"
                  onClick={() => navigate(`/projects/${p.project_id}`)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 group-hover:text-accent-600 transition-colors truncate max-w-[120px]">
                      {p.project_name}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(p.total_spent)}</span>
                  </div>
                  <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-500 rounded-full transition-all duration-500"
                      style={{ width: `${(p.total_spent / maxSpend) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Purchases */}
        <Card className="lg:col-span-2" padding="none">
          <div className="px-5 pt-5 pb-4 flex items-center justify-between">
            <CardTitle>Recent purchases</CardTitle>
            <button onClick={() => navigate('/purchases')} className="text-xs text-accent-600 hover:text-accent-700 transition-colors flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {recentLoading ? (
            <div>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : !recent?.length ? (
            <EmptyState
              icon={<ShoppingBag className="h-5 w-5" />}
              title="No purchases yet"
              description="Start by adding your first purchase"
              ctaLabel="Add your first purchase"
              onCta={() => navigate('/purchases/new')}
            />
          ) : (
            <div>
              {recent.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-4 px-5 py-3 border-b border-surface-50 last:border-0 hover:bg-surface-50 cursor-pointer transition-colors group"
                  onClick={() => navigate(`/purchases/${p.id}`)}
                >
                  <div className="w-9 h-9 rounded-xl bg-accent-50 flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-4 w-4 text-accent-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-accent-600 transition-colors">
                      {p.item_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {(p.seller as { name?: string } | null)?.name ?? 'Unknown seller'} · {formatDate(p.order_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(p.total_amount)}</span>
                    <StatusPill status={p.order_status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Attention Needed */}
      {(attentionItems?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle>Attention needed</CardTitle>
            </div>
          </CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {attentionItems?.map((item, i) => (
              <div
                key={`${item.type}-${item.id}-${i}`}
                onClick={() => navigate(`/purchases/${item.id}`)}
                className="flex items-center justify-between p-3 rounded-xl border border-surface-100 hover:border-accent-200 hover:bg-accent-50/30 cursor-pointer transition-all duration-150"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.type === 'warranty' ? (
                    <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
                  ) : (
                    <RotateCcw className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">
                      {item.type === 'warranty' ? 'Warranty' : 'Return window'} expiring
                    </p>
                  </div>
                </div>
                <UrgencyBadge days={item.days} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
