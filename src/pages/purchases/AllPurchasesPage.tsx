import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterChip } from '@/components/ui/FilterChip';
import { StatusPill } from '@/components/ui/StatusPill';
import { LifecyclePill } from '@/components/ui/LifecyclePill';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate, debounce, LIFECYCLE_STAGES, LIFECYCLE_STATUS_LABELS } from '@/lib/utils';
import type { Purchase } from '@/types/database';

const STATUSES = ['ordered', 'confirmed', 'packed', 'shipped', 'in_transit', 'delivered', 'cancelled', 'returned'];
const PAYMENT_METHODS = ['upi', 'credit_card', 'debit_card', 'netbanking', 'cash', 'wallet'];

export function AllPurchasesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [view, setView] = useState<'table' | 'card'>('table');
  const [showFilters, setShowFilters] = useState(Boolean(searchParams.get('lifecycle_status')));
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    lifecycle_status: searchParams.get('lifecycle_status') || '',
    payment_method: '',
    project_id: '',
    seller_id: '',
    category: '',
  });
  const [sort, setSort] = useState<'created_at' | 'total_amount' | 'item_name'>('created_at');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const s = searchParams.get('search');
    if (s !== null) {
      setSearch(s);
      setDebouncedSearch(s);
    }
    const ls = searchParams.get('lifecycle_status');
    if (ls !== null) {
      setFilters((f) => ({ ...f, lifecycle_status: ls }));
      setShowFilters(true);
    }
  }, [searchParams]);

  const debouncedSetSearch = useCallback(
    debounce((v: string) => setDebouncedSearch(v), 300),
    []
  );

  const { data: purchases, isLoading, isFetching } = useQuery({
    queryKey: ['purchases', debouncedSearch, filters, sort, page],
    queryFn: async () => {
      let q = supabase
        .from('purchases')
        .select('*, seller:sellers(name), project:projects(name)', { count: 'exact' })
        .order(sort, { ascending: sort === 'item_name' })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (debouncedSearch) {
        q = q.or(`item_name.ilike.%${debouncedSearch}%,purpose.ilike.%${debouncedSearch}%`);
      }
      if (filters.status) q = q.eq('order_status', filters.status as never);
      if (filters.lifecycle_status) q = q.eq('lifecycle_status', filters.lifecycle_status as never);
      if (filters.payment_method) q = q.eq('payment_method', filters.payment_method as never);
      if (filters.project_id) q = q.eq('project_id', filters.project_id);
      if (filters.seller_id) q = q.eq('seller_id', filters.seller_id);
      if (filters.category) q = q.eq('category', filters.category);

      const { data, count, error } = await q;
      if (error) throw error;
      return { data: (data as Purchase[]) ?? [], total: count ?? 0 };
    },
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').order('name');
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: sellers } = useQuery({
    queryKey: ['sellers'],
    queryFn: async () => {
      const { data } = await supabase.from('sellers').select('id, name').order('name');
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const activeFilters = Object.entries(filters).filter(([, v]) => v);
  const totalPages = Math.ceil((purchases?.total ?? 0) / PAGE_SIZE);

  const removeFilter = (key: string) => setFilters((f) => ({ ...f, [key]: '' }));
  const clearAllFilters = () => setFilters({ status: '', lifecycle_status: '', payment_method: '', project_id: '', seller_id: '', category: '' });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="All Purchases"
        subtitle={purchases ? `${purchases.total} purchase${purchases.total !== 1 ? 's' : ''}` : ''}
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/purchases/new')}>
            Add Purchase
          </Button>
        }
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); debouncedSetSearch(v); }}
          placeholder="Search item name, notes…"
          className="flex-1 min-w-[200px]"
        />
        <Button
          variant={showFilters ? 'secondary' : 'ghost'}
          size="sm"
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
        </Button>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-9 px-3 rounded-xl border border-surface-200 bg-surface-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="created_at">Latest first</option>
          <option value="total_amount">Highest price</option>
          <option value="item_name">A–Z</option>
        </select>
        <div className="hidden sm:flex items-center border border-surface-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setView('table')}
            className={`p-2 transition-colors ${view === 'table' ? 'bg-accent-50 text-accent-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('card')}
            className={`p-2 transition-colors ${view === 'card' ? 'bg-accent-50 text-accent-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <Card className="mb-4 animate-slide-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 sm:gap-3">
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="h-9 px-2.5 text-xs rounded-xl border border-surface-200 bg-surface-50 text-slate-700"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <select
              value={filters.lifecycle_status}
              onChange={(e) => setFilters((f) => ({ ...f, lifecycle_status: e.target.value }))}
              className="h-9 px-2.5 text-xs rounded-xl border border-surface-200 bg-surface-50 text-slate-700"
            >
              <option value="">All lifecycle stages</option>
              {LIFECYCLE_STAGES.map((st) => (
                <option key={st} value={st}>
                  {LIFECYCLE_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
            <select
              value={filters.payment_method}
              onChange={(e) => setFilters((f) => ({ ...f, payment_method: e.target.value }))}
              className="h-9 px-2.5 text-xs rounded-xl border border-surface-200 bg-surface-50 text-slate-700"
            >
              <option value="">All payment methods</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
            <select
              value={filters.project_id}
              onChange={(e) => setFilters((f) => ({ ...f, project_id: e.target.value }))}
              className="h-9 px-2.5 text-xs rounded-xl border border-surface-200 bg-surface-50 text-slate-700"
            >
              <option value="">All projects</option>
              {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={filters.seller_id}
              onChange={(e) => setFilters((f) => ({ ...f, seller_id: e.target.value }))}
              className="h-9 px-2.5 text-xs rounded-xl border border-surface-200 bg-surface-50 text-slate-700"
            >
              <option value="">All sellers</option>
              {sellers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              placeholder="Category…"
              className="h-9 px-2.5 text-xs rounded-xl border border-surface-200 bg-surface-50 text-slate-700"
            />
          </div>
        </Card>
      )}

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {activeFilters.map(([key, value]) => (
            <FilterChip key={key} label={`${key.replace('_id', '').replace('_', ' ')}: ${value}`} onRemove={() => removeFilter(key)} />
          ))}
          <button onClick={clearAllFilters} className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1">
            <X className="h-3 w-3" /> Clear all
          </button>
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <Card padding="none">
          {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
        </Card>
      ) : !purchases?.data.length ? (
        <EmptyState
          title={debouncedSearch || activeFilters.length ? 'No results found' : 'No purchases yet'}
          description={debouncedSearch || activeFilters.length ? 'Try clearing filters or a different search term' : 'Add your first purchase to get started'}
          ctaLabel={debouncedSearch || activeFilters.length ? 'Clear filters' : 'Add purchase'}
          onCta={debouncedSearch || activeFilters.length ? clearAllFilters : () => navigate('/purchases/new')}
        />
      ) : (
        <>
          {/* Mobile Cards (shown on screens < md) */}
          <div className="md:hidden space-y-3">
            {purchases.data.map((p) => (
              <Card key={p.id} hover onClick={() => navigate(`/purchases/${p.id}`)} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{p.item_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {(p.seller as { name?: string } | null)?.name ?? 'Unknown seller'}
                      {p.category ? ` • ${p.category}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-accent-700 shrink-0">
                    {formatCurrency(p.total_amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2.5 border-t border-surface-100 text-xs">
                  <span className="text-slate-400">{formatDate(p.order_date)}</span>
                  <div className="flex items-center gap-1.5">
                    <StatusPill status={p.order_status} />
                    {p.lifecycle_status && <LifecyclePill status={p.lifecycle_status} />}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop View (Table or Grid on screens >= md) */}
          <div className="hidden md:block">
            {view === 'table' ? (
              <Card padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface-100">
                        {['Item', 'Seller', 'Project', 'Date', 'Total', 'Status', 'Lifecycle'].map((h) => (
                          <th key={h} className="text-left text-xs font-semibold text-slate-400 px-4 py-3 first:pl-5 last:pr-5">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.data.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => navigate(`/purchases/${p.id}`)}
                          className="border-b border-surface-50 last:border-0 hover:bg-surface-50 cursor-pointer transition-colors group"
                        >
                          <td className="px-4 py-3 pl-5">
                            <p className="text-sm font-medium text-slate-800 group-hover:text-accent-600 transition-colors">{p.item_name}</p>
                            {p.category && <p className="text-xs text-slate-400">{p.category}</p>}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {(p.seller as { name?: string } | null)?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {(p.project as { name?: string } | null)?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">{formatDate(p.order_date)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-800">{formatCurrency(p.total_amount)}</td>
                          <td className="px-4 py-3"><StatusPill status={p.order_status} /></td>
                          <td className="px-4 py-3 pr-5">
                            {p.lifecycle_status ? (
                              <LifecyclePill status={p.lifecycle_status} />
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {purchases.data.map((p) => (
                  <Card key={p.id} hover onClick={() => navigate(`/purchases/${p.id}`)}>
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 line-clamp-2">{p.item_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{(p.seller as { name?: string } | null)?.name ?? 'Unknown seller'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusPill status={p.order_status} />
                        {p.lifecycle_status && <LifecyclePill status={p.lifecycle_status} />}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{formatDate(p.order_date)}</span>
                      <span className="text-sm font-bold text-accent-700">{formatCurrency(p.total_amount)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-slate-500">{page + 1} / {totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
