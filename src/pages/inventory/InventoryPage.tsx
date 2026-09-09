import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Search, Minus, Plus as PlusIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { InventoryItem } from '@/types/database';

export function InventoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterAvailable, setFilterAvailable] = useState(false);

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory', search, filterAvailable],
    queryFn: async () => {
      let q = supabase
        .from('inventory')
        .select('*, purchase:purchases(id, item_name, project_id, project:projects(name))')
        .order('item_name');

      if (search) q = q.ilike('item_name', `%${search}%`);
      if (filterAvailable) q = q.gt('quantity_available', 0);

      const { data } = await q;
      return data as (InventoryItem & {
        purchase: { id: string; item_name: string; project: { name: string } | null } | null;
      })[] ?? [];
    },
  });

  const { mutate: updateUsage } = useMutation({
    mutationFn: async ({ id, delta, current, max }: { id: string; delta: number; current: number; max: number }) => {
      const newUsed = Math.max(0, Math.min(max, current + delta));
      const { error } = await supabase.from('inventory').update({ quantity_used: newUsed }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
    onError: () => toast.error('Failed to update usage'),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Inventory"
        subtitle="Track where your components are and how many you have left"
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search components, e.g. LoRa…"
          className="flex-1 min-w-[200px]"
        />
        <button
          onClick={() => setFilterAvailable(!filterAvailable)}
          className={cn(
            'h-9 px-4 text-sm rounded-xl border transition-all font-medium',
            filterAvailable ? 'bg-accent-50 border-accent-300 text-accent-700' : 'bg-white border-surface-200 text-slate-500 hover:border-slate-300'
          )}
        >
          Has stock
        </button>
      </div>

      {isLoading ? (
        <Card padding="none">{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</Card>
      ) : !inventory?.length ? (
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title="No inventory yet"
          description="Inventory items are created automatically when you add a purchase"
        />
      ) : (
        <>
          {/* Mobile View (< md) */}
          <div className="md:hidden space-y-3">
            {inventory.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => item.purchase && navigate(`/purchases/${item.purchase.id}`)}
                      className="text-sm font-semibold text-slate-900 hover:text-accent-600 text-left line-clamp-1"
                    >
                      {item.item_name}
                    </button>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.purchase?.project?.name ? `${item.purchase.project.name} • ` : ''}
                      {item.location || 'No location set'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-bold shrink-0',
                      item.quantity_available > 0
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-slate-100 text-slate-400'
                    )}
                  >
                    {item.quantity_available} left
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-surface-100 text-xs text-slate-500">
                  <span>Purchased: {item.quantity_purchased} · Used: {item.quantity_used}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateUsage({ id: item.id, delta: 1, current: item.quantity_used, max: item.quantity_purchased })}
                      disabled={item.quantity_used >= item.quantity_purchased}
                      className="h-8 px-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 flex items-center gap-1 font-medium transition-all disabled:opacity-30"
                    >
                      <Minus className="h-3 w-3" />
                      <span>Use</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateUsage({ id: item.id, delta: -1, current: item.quantity_used, max: item.quantity_purchased })}
                      disabled={item.quantity_used <= 0}
                      className="h-8 px-2.5 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 active:scale-95 flex items-center gap-1 font-medium transition-all disabled:opacity-30"
                    >
                      <PlusIcon className="h-3 w-3" />
                      <span>Undo</span>
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop View (>= md) */}
          <div className="hidden md:block">
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-100">
                      {['Item', 'Project', 'Location', 'Purchased', 'Used', 'Available', 'Actions'].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-slate-400 px-4 py-3 first:pl-5 last:pr-5">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => (
                      <tr key={item.id} className="border-b border-surface-50 last:border-0 hover:bg-surface-50 transition-colors">
                        <td className="px-4 py-3 pl-5">
                          <button
                            onClick={() => item.purchase && navigate(`/purchases/${item.purchase.id}`)}
                            className="text-sm font-medium text-slate-800 hover:text-accent-600 transition-colors text-left"
                          >
                            {item.item_name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {item.purchase?.project?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{item.location ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.quantity_purchased}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.quantity_used}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'px-2.5 py-0.5 rounded-full text-xs font-semibold',
                            item.quantity_available > 0 ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-400'
                          )}>
                            {item.quantity_available}
                          </span>
                        </td>
                        <td className="px-4 py-3 pr-5">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => updateUsage({ id: item.id, delta: 1, current: item.quantity_used, max: item.quantity_purchased })}
                              disabled={item.quantity_used >= item.quantity_purchased}
                              className="h-6 w-6 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors disabled:opacity-30"
                              title="Log usage"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => updateUsage({ id: item.id, delta: -1, current: item.quantity_used, max: item.quantity_purchased })}
                              disabled={item.quantity_used <= 0}
                              className="h-6 w-6 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors disabled:opacity-30"
                              title="Undo usage"
                            >
                              <PlusIcon className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
