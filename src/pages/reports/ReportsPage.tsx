import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatBox } from '@/components/ui/StatBox';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/lib/utils';
import type { VendorSummary, ProjectSummary, Purchase, TimeEntry } from '@/types/database';
import toast from 'react-hot-toast';

type DateRange = 'this_month' | 'last_month' | 'this_year' | 'custom';

const COLORS = ['#4f46e5', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

function getDateRange(range: DateRange, customStart?: string, customEnd?: string) {
  const now = new Date();
  switch (range) {
    case 'this_month': return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last_month': return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
    case 'this_year': return { from: startOfYear(now), to: endOfYear(now) };
    case 'custom': return { from: customStart ? new Date(customStart) : startOfMonth(now), to: customEnd ? new Date(customEnd) : endOfMonth(now) };
  }
}

export function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { from, to } = getDateRange(dateRange, customStart, customEnd);

  const { data: purchases, isLoading } = useQuery({
    queryKey: ['report-purchases', from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchases')
        .select('*')
        .gte('order_date', from.toISOString())
        .lte('order_date', to.toISOString());
      return (data as Purchase[]) ?? [];
    },
  });

  const { data: projectSummaries } = useQuery({
    queryKey: ['project-summary'],
    queryFn: async () => {
      const { data } = await supabase.from('project_summary').select('*').order('total_spent', { ascending: false });
      return (data as ProjectSummary[]) ?? [];
    },
  });

  const { data: vendorSummaries } = useQuery({
    queryKey: ['vendor-summary'],
    queryFn: async () => {
      const { data } = await supabase.from('vendor_summary').select('*').order('total_spent', { ascending: false }).limit(10);
      return (data as VendorSummary[]) ?? [];
    },
  });

  const { data: timeEntries } = useQuery({
    queryKey: ['report-time', from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from('time_entries')
        .select('*')
        .gte('logged_at', from.toISOString())
        .lte('logged_at', to.toISOString());
      return (data as TimeEntry[]) ?? [];
    },
  });

  // Compute stats
  const totalSpend = purchases?.reduce((s, p) => s + p.total_amount, 0) ?? 0;
  const totalGST = purchases?.reduce((s, p) => s + p.gst_amount, 0) ?? 0;
  const totalShipping = purchases?.reduce((s, p) => s + p.shipping_cost, 0) ?? 0;
  const totalDiscount = purchases?.reduce((s, p) => s + p.discount_amount, 0) ?? 0;

  // Category breakdown
  const categoryMap = purchases?.reduce<Record<string, number>>((acc, p) => {
    const cat = p.category || 'Other';
    acc[cat] = (acc[cat] || 0) + p.total_amount;
    return acc;
  }, {}) ?? {};
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  // Activity breakdown
  const activityMap = timeEntries?.reduce<Record<string, number>>((acc, t) => {
    acc[t.activity_type] = (acc[t.activity_type] || 0) + t.duration_minutes;
    return acc;
  }, {}) ?? {};
  const activityData = Object.entries(activityMap).map(([name, minutes]) => ({ name, minutes }));

  const exportCSV = () => {
    if (!purchases?.length) { toast.error('No data to export'); return; }
    const rows = [
      ['Date', 'Item', 'Category', 'Base', 'GST', 'Shipping', 'Discount', 'Total', 'Status'],
      ...purchases.map((p) => [
        p.order_date?.slice(0, 10) ?? '',
        p.item_name,
        p.category ?? '',
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
    a.download = `purchase-report-${format(from, 'yyyy-MM')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Understand where your money and time is going"
        actions={
          <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={exportCSV}>
            Export CSV
          </Button>
        }
      />

      {/* Date range selector */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(['this_month', 'last_month', 'this_year', 'custom'] as DateRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setDateRange(r)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              dateRange === r ? 'bg-accent-600 text-white' : 'bg-white border border-surface-200 text-slate-600 hover:border-accent-300'
            }`}
          >
            {r.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}
          </button>
        ))}
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-8 px-2 text-xs rounded-xl border border-surface-200 bg-surface-50" />
            <span className="text-slate-400 text-sm">to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-8 px-2 text-xs rounded-xl border border-surface-200 bg-surface-50" />
          </div>
        )}
      </div>

      {/* Stat boxes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? [...Array(4)].map((_, i) => <SkeletonCard key={i} />) : (
          <>
            <StatBox label="Total spend" value={formatCurrency(totalSpend)} accent />
            <StatBox label="GST paid" value={formatCurrency(totalGST)} />
            <StatBox label="Shipping paid" value={formatCurrency(totalShipping)} />
            <StatBox label="Discounts saved" value={formatCurrency(totalDiscount)} />
          </>
        )}
      </div>

      {!purchases?.length && !isLoading ? (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title="No data for this period"
          description="Add purchases with order dates in the selected range"
        />
      ) : (
        <div className="space-y-6">
          {/* Project spend */}
          {(projectSummaries?.length ?? 0) > 0 && (
            <Card>
              <CardTitle className="mb-4">Spend by project</CardTitle>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectSummaries?.slice(0, 8)}>
                    <XAxis dataKey="project_name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: unknown) => [formatCurrency(v as number), 'Spent']} />
                    <Bar dataKey="total_spent" radius={[4, 4, 0, 0]}>
                      {projectSummaries?.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category donut */}
            {categoryData.length > 0 && (
              <Card>
                <CardTitle className="mb-4">Spend by category</CardTitle>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                        {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: unknown) => [formatCurrency(v as number), 'Spent']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Activity chart */}
            {activityData.length > 0 && (
              <Card>
                <CardTitle className="mb-4">Time by activity</CardTitle>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityData} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={85} />
                      <Tooltip formatter={(v: unknown) => [`${v as number} min`, 'Time']} />
                      <Bar dataKey="minutes" fill="#818cf8" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>

          {/* Vendor table */}
          {(vendorSummaries?.length ?? 0) > 0 && (
            <Card>
              <CardTitle className="mb-4">Spend by seller</CardTitle>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-100">
                      {['Seller', 'Orders', 'Total spent', 'Avg order'].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-slate-400 py-2 first:pl-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vendorSummaries?.map((v) => (
                      <tr key={v.seller_id} className="border-b border-surface-50 last:border-0">
                        <td className="py-2.5 font-medium text-slate-800">{v.seller_name}</td>
                        <td className="py-2.5 text-slate-500">{v.order_count}</td>
                        <td className="py-2.5 font-semibold text-slate-900">{formatCurrency(v.total_spent)}</td>
                        <td className="py-2.5 text-slate-500">{v.order_count > 0 ? formatCurrency(v.total_spent / v.order_count) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Project + time combined table */}
          {(projectSummaries?.length ?? 0) > 0 && (
            <Card>
              <CardTitle className="mb-4">Project summary</CardTitle>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-100">
                      {['Project', 'Spent', 'Time logged', 'Items'].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-slate-400 py-2 first:pl-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projectSummaries?.map((p) => (
                      <tr key={p.project_id} className="border-b border-surface-50 last:border-0">
                        <td className="py-2.5 font-medium text-slate-800">{p.project_name}</td>
                        <td className="py-2.5 font-semibold text-accent-700">{formatCurrency(p.total_spent)}</td>
                        <td className="py-2.5 text-slate-500">{Math.floor(p.total_time_minutes / 60)}h {p.total_time_minutes % 60}m</td>
                        <td className="py-2.5 text-slate-500">{p.item_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
