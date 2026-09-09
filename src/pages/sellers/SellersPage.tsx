import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Store, ChevronRight, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { VendorSummary, Purchase } from '@/types/database';
import { useAuthStore } from '@/stores/authStore';

export function SellersPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<'total_spent' | 'order_count' | 'seller_name'>('total_spent');

  const { data: sellers, isLoading } = useQuery({
    queryKey: ['vendor-summary', sort],
    queryFn: async () => {
      const { data } = await supabase
        .from('vendor_summary')
        .select('*')
        .order(sort, { ascending: sort === 'seller_name' });
      return (data as VendorSummary[]) ?? [];
    },
  });

  const { data: sellerPurchases } = useQuery({
    queryKey: ['seller-purchases', selected],
    queryFn: async () => {
      if (!selected) return [];
      const { data } = await supabase
        .from('purchases')
        .select('*')
        .eq('seller_id', selected)
        .order('order_date', { ascending: false });
      return (data as Purchase[]) ?? [];
    },
    enabled: !!selected,
  });

  const selectedSeller = sellers?.find((s) => s.seller_id === selected);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sellers"
        subtitle="Every vendor you've purchased from"
      />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{sellers?.length ?? 0} sellers</p>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-8 px-3 text-xs rounded-xl border border-surface-200 bg-surface-50 text-slate-700"
        >
          <option value="total_spent">Most spent</option>
          <option value="order_count">Most orders</option>
          <option value="seller_name">A–Z</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seller list */}
        <div className="space-y-3">
          {isLoading ? (
            [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
          ) : !sellers?.length ? (
            <EmptyState
              icon={<Store className="h-8 w-8" />}
              title="No sellers yet"
              description="Sellers appear here when you add a purchase"
            />
          ) : (
            sellers.map((s) => (
              <Card
                key={s.seller_id}
                hover
                onClick={() => setSelected(s.seller_id === selected ? null : s.seller_id)}
                className={`border-2 transition-all ${selected === s.seller_id ? 'border-accent-400' : 'border-transparent'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-100 flex items-center justify-center shrink-0">
                    <Store className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{s.seller_name}</p>
                    <p className="text-xs text-slate-400">{s.order_count} order{s.order_count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(s.total_spent)}</p>
                    <p className="text-xs text-slate-400">
                      avg {s.order_count > 0 ? formatCurrency(s.total_spent / s.order_count) : '—'}
                    </p>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-slate-300 transition-transform ${selected === s.seller_id ? 'rotate-90' : ''}`} />
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Seller detail drawer */}
        {selected && selectedSeller && (
          <div className="animate-slide-up">
            <Card padding="none">
              <div className="p-5 border-b border-surface-100">
                <h2 className="text-base font-semibold text-slate-900">{selectedSeller.seller_name}</h2>
                <div className="flex gap-4 mt-2">
                  <div>
                    <p className="text-xs text-slate-400">Orders</p>
                    <p className="text-lg font-bold text-slate-800">{selectedSeller.order_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Total spent</p>
                    <p className="text-lg font-bold text-accent-700">{formatCurrency(selectedSeller.total_spent)}</p>
                  </div>
                </div>
              </div>
              <div>
                {!sellerPurchases?.length ? (
                  <div className="py-8 text-center text-sm text-slate-400">No purchases from this seller</div>
                ) : (
                  sellerPurchases.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/purchases/${p.id}`)}
                      className="flex items-center gap-3 px-5 py-3 border-b border-surface-50 last:border-0 hover:bg-surface-50 cursor-pointer transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 group-hover:text-accent-600 transition-colors truncate">
                          {p.item_name}
                        </p>
                        <p className="text-xs text-slate-400">{formatDate(p.order_date)}</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{formatCurrency(p.total_amount)}</span>
                      <StatusPill status={p.order_status} />
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
