import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, RotateCcw } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/Skeleton';
import {
  formatDate, daysUntil, urgencyColor,
  warrantyExpiryDate, returnDeadlineDate
} from '@/lib/utils';
import type { Purchase } from '@/types/database';

function UrgencyPill({ days }: { days: number | null }) {
  const color = urgencyColor(days);
  const label =
    days === null ? '—' :
    days < 0 ? `Expired ${Math.abs(days)}d ago` :
    days === 0 ? 'Expires today!' :
    `${days}d left`;
  const cls = {
    green: 'bg-green-50 text-green-700 border border-green-200',
    amber: 'bg-amber-50 text-amber-700 border border-amber-200',
    red: 'bg-red-50 text-red-600 border border-red-200',
    gray: 'bg-slate-100 text-slate-400',
  }[color];
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

interface WarrantyItem {
  id: string;
  item_name: string;
  order_date: string | null;
  expiry: Date;
  daysLeft: number | null;
}

export function WarrantyPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('warranty');

  const { data: purchases, isLoading } = useQuery({
    queryKey: ['warranty-purchases'],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchases')
        .select('id, item_name, order_date, warranty_months, return_window_days, order_status')
        .or('warranty_months.not.is.null,return_window_days.not.is.null');
      return (data as Purchase[]) ?? [];
    },
  });

  const warrantyItems: WarrantyItem[] = (purchases ?? [])
    .filter((p) => p.warranty_months && p.order_date)
    .map((p) => {
      const expiry = warrantyExpiryDate(p.order_date!, p.warranty_months!);
      return { id: p.id, item_name: p.item_name, order_date: p.order_date, expiry, daysLeft: daysUntil(expiry) };
    })
    .sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));

  const returnItems: WarrantyItem[] = (purchases ?? [])
    .filter((p) => p.return_window_days && p.order_date && !['returned', 'cancelled'].includes(p.order_status))
    .map((p) => {
      const expiry = returnDeadlineDate(p.order_date!, p.return_window_days!);
      return { id: p.id, item_name: p.item_name, order_date: p.order_date, expiry, daysLeft: daysUntil(expiry) };
    })
    .sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));

  const renderList = (items: WarrantyItem[], emptyTitle: string, emptyIcon: React.ReactNode) => {
    if (isLoading) return <Card padding="none">{[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}</Card>;
    if (!items.length) return <EmptyState icon={emptyIcon} title={emptyTitle} />;

    return (
      <div className="space-y-3">
        {/* Mobile View (< sm) */}
        <div className="sm:hidden space-y-2.5">
          {items.map((item) => (
            <Card
              key={item.id}
              hover
              onClick={() => navigate(`/purchases/${item.id}`)}
              className="p-3.5"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-slate-800 line-clamp-1">{item.item_name}</p>
                <UrgencyPill days={item.daysLeft} />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-surface-100">
                <span>Ordered: {formatDate(item.order_date)}</span>
                <span className="font-medium text-slate-700">Expires: {formatDate(item.expiry)}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* Desktop View (>= sm) */}
        <div className="hidden sm:block">
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-100">
                    {['Item', 'Purchase date', 'Expiry date', 'Time left'].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 px-4 py-3 first:pl-5 last:pr-5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/purchases/${item.id}`)}
                      className="border-b border-surface-50 last:border-0 hover:bg-surface-50 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3 pl-5">
                        <p className="text-sm font-medium text-slate-800 group-hover:text-accent-600 transition-colors">{item.item_name}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(item.order_date)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(item.expiry)}</td>
                      <td className="px-4 py-3 pr-5"><UrgencyPill days={item.daysLeft} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Warranty & Returns"
        subtitle="Track deadlines before they sneak up on you"
      />

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="flex bg-surface-100 rounded-xl p-1 mb-6 w-full sm:w-fit">
          <Tabs.Trigger
            value="warranty"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-card data-[state=active]:text-slate-900 text-slate-500"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Warranty</span>
            {warrantyItems.filter((i) => (i.daysLeft ?? 99) <= 30).length > 0 && (
              <span className="ml-0.5 text-[10px] font-bold bg-amber-400 text-white rounded-full px-1.5 py-0.5">
                {warrantyItems.filter((i) => (i.daysLeft ?? 99) <= 30).length}
              </span>
            )}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="returns"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:shadow-card data-[state=active]:text-slate-900 text-slate-500"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Returns</span>
            {returnItems.filter((i) => (i.daysLeft ?? 99) <= 3).length > 0 && (
              <span className="ml-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">
                {returnItems.filter((i) => (i.daysLeft ?? 99) <= 3).length}
              </span>
            )}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="warranty">
          {renderList(warrantyItems, 'No warranty tracking set up', <ShieldCheck className="h-6 w-6" />)}
        </Tabs.Content>
        <Tabs.Content value="returns">
          {renderList(returnItems, 'No return deadlines tracked', <RotateCcw className="h-6 w-6" />)}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
