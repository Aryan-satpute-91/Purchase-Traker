import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Scale,
  Award,
  Clock,
  ArrowUpDown,
  ExternalLink,
  Store,
  Tag,
  TrendingDown,
  DollarSign,
  Package,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Card } from '@/components/ui/Card';
import { StatBox } from '@/components/ui/StatBox';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { cn, formatCurrency, formatDate, debounce } from '@/lib/utils';
import type { Purchase } from '@/types/database';

export function PriceComparisonsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [sortBy, setSortBy] = useState<'total_asc' | 'total_desc' | 'date_desc'>('total_asc');

  const debouncedSetSearch = useMemo(
    () =>
      debounce((v: string) => {
        setDebouncedSearch(v);
        setSearchParams(v ? { q: v } : {});
      }, 250),
    [setSearchParams]
  );

  // Fetch all purchases matching search
  const { data: purchases, isLoading } = useQuery({
    queryKey: ['price-comparisons', debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from('purchases')
        .select('*, seller:sellers(id, name, website)');

      if (debouncedSearch.trim()) {
        query = query.ilike('item_name', `%${debouncedSearch.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as (Purchase & { seller?: { id: string; name: string; website?: string } | null })[]) ?? [];
    },
  });

  // Common distinct search suggestions
  const { data: suggestions } = useQuery({
    queryKey: ['price-suggestions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchases')
        .select('item_name')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!data) return [];
      const set = new Set<string>();
      data.forEach((p) => {
        const firstWord = p.item_name.split(/[\s-]+/)[0];
        if (firstWord && firstWord.length >= 3) set.add(firstWord);
      });
      return Array.from(set).slice(0, 8);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Calculate sorted items and tags
  const processed = useMemo(() => {
    if (!purchases || purchases.length === 0) {
      return {
        items: [],
        cheapestId: null,
        mostRecentId: null,
        minPrice: 0,
        maxPrice: 0,
        avgPrice: 0,
      };
    }

    const valid = purchases.filter((p) => (p.total_amount || 0) > 0);
    if (valid.length === 0) {
      return {
        items: purchases,
        cheapestId: null,
        mostRecentId: null,
        minPrice: 0,
        maxPrice: 0,
        avgPrice: 0,
      };
    }

    // Find cheapest
    const cheapest = [...valid].sort((a, b) => a.total_amount - b.total_amount)[0];

    // Find most recent
    const withDate = valid.filter((p) => p.order_date);
    const mostRecent = withDate.length > 0
      ? [...withDate].sort((a, b) => new Date(b.order_date!).getTime() - new Date(a.order_date!).getTime())[0]
      : null;

    // Sorting
    const sorted = [...purchases].sort((a, b) => {
      if (sortBy === 'total_asc') return (a.total_amount || 0) - (b.total_amount || 0);
      if (sortBy === 'total_desc') return (b.total_amount || 0) - (a.total_amount || 0);
      if (sortBy === 'date_desc') {
        const da = a.order_date ? new Date(a.order_date).getTime() : 0;
        const db = b.order_date ? new Date(b.order_date).getTime() : 0;
        return db - da;
      }
      return 0;
    });

    const prices = valid.map((p) => p.total_amount);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    return {
      items: sorted,
      cheapestId: cheapest?.id ?? null,
      mostRecentId: mostRecent?.id ?? null,
      minPrice,
      maxPrice,
      avgPrice,
    };
  }, [purchases, sortBy]);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Price Comparisons"
        subtitle="Compare historical prices across sellers, GST, and shipping costs"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs bg-white border border-surface-200 rounded-xl px-2.5 py-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-accent-500"
            >
              <option value="total_asc">Cheapest first (Default)</option>
              <option value="total_desc">Highest first</option>
              <option value="date_desc">Most recent date</option>
            </select>
          </div>
        }
      />

      {/* Search Bar & Suggestions */}
      <div className="space-y-3">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            debouncedSetSearch(v);
          }}
          placeholder="Type an item name (e.g., 'SX1262', 'ESP32', 'Arduino', 'Cable')…"
          className="w-full"
        />

        {suggestions && suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="text-slate-400">Popular items:</span>
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setSearch(tag);
                  setDebouncedSearch(tag);
                  setSearchParams({ q: tag });
                }}
                className={cn(
                  'px-2.5 py-1 rounded-lg border transition-colors',
                  debouncedSearch.toLowerCase() === tag.toLowerCase()
                    ? 'bg-accent-50 text-accent-700 border-accent-200 font-medium'
                    : 'bg-white text-slate-600 border-surface-200 hover:bg-surface-100'
                )}
              >
                {tag}
              </button>
            ))}
            {debouncedSearch && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDebouncedSearch('');
                  setSearchParams({});
                }}
                className="text-xs text-red-500 hover:text-red-700 hover:underline ml-1"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary Metrics */}
      {processed.items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatBox
            label="Lowest Price"
            value={formatCurrency(processed.minPrice)}
            icon={<Award className="h-4 w-4 text-emerald-600" />}
          />
          <StatBox
            label="Average Price"
            value={formatCurrency(processed.avgPrice)}
            icon={<Scale className="h-4 w-4 text-accent-600" />}
          />
          <StatBox
            label="Highest Price"
            value={formatCurrency(processed.maxPrice)}
            icon={<DollarSign className="h-4 w-4 text-slate-500" />}
          />
          <StatBox
            label="Purchases Compared"
            value={processed.items.length}
            icon={<Package className="h-4 w-4 text-purple-600" />}
          />
        </div>
      )}

      {/* Results Table Card */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : processed.items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Scale className="h-6 w-6 text-slate-400" />}
              title={debouncedSearch ? `No purchases found matching "${debouncedSearch}"` : 'No purchases found'}
              description={
                debouncedSearch
                  ? 'Try adjusting your search terms or view all purchases to see available items.'
                  : 'Start typing an item name above to compare prices across sellers.'
              }
              ctaLabel={debouncedSearch ? 'Clear search' : undefined}
              onCta={
                debouncedSearch
                  ? () => {
                      setSearch('');
                      setDebouncedSearch('');
                      setSearchParams({});
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile View (< md) */}
            <div className="md:hidden divide-y divide-surface-100">
              {processed.items.map((item) => {
                const isCheapest = item.id === processed.cheapestId;
                const isRecent = item.id === processed.mostRecentId;

                return (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/purchases/${item.id}`)}
                    className={cn(
                      'p-4 transition-colors active:bg-surface-50 cursor-pointer',
                      isCheapest && 'bg-emerald-50/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 line-clamp-1">{item.item_name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          <Store className="h-3 w-3 shrink-0" />
                          <span className="truncate">{item.seller?.name || 'Direct / Unknown seller'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn('text-base font-bold', isCheapest ? 'text-emerald-700' : 'text-slate-900')}>
                          {formatCurrency(item.total_amount)}
                        </p>
                        <p className="text-[11px] text-slate-400">{formatDate(item.order_date)}</p>
                      </div>
                    </div>

                    {/* Breakdown pills */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[11px] text-slate-500">
                      <span className="bg-surface-100 px-2 py-0.5 rounded-md">
                        Base: {formatCurrency(item.base_price)}
                      </span>
                      {item.gst_amount > 0 && (
                        <span className="bg-surface-100 px-2 py-0.5 rounded-md">
                          GST: {formatCurrency(item.gst_amount)}
                        </span>
                      )}
                      {item.shipping_cost > 0 && (
                        <span className="bg-surface-100 px-2 py-0.5 rounded-md">
                          Ship: {formatCurrency(item.shipping_cost)}
                        </span>
                      )}
                      {isCheapest && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800 ml-auto">
                          <Award className="h-3 w-3" /> Best price
                        </span>
                      )}
                      {isRecent && !isCheapest && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md font-medium bg-blue-50 text-blue-700 ml-auto">
                          <Clock className="h-3 w-3" /> Recent
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead className="bg-surface-100 text-slate-600 font-semibold border-b border-surface-200">
                  <tr>
                    <th className="py-3 px-4">Item & Seller</th>
                    <th className="py-3 px-4 text-right">Base Price</th>
                    <th className="py-3 px-4 text-right">GST</th>
                    <th className="py-3 px-4 text-right">Shipping</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-center">Tags</th>
                    <th className="py-3 px-4 text-center w-16">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {processed.items.map((item) => {
                    const isCheapest = item.id === processed.cheapestId;
                    const isRecent = item.id === processed.mostRecentId;

                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          'transition-colors',
                          isCheapest ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-surface-50'
                        )}
                      >
                        {/* Item & Seller */}
                        <td className="py-3 px-4">
                          <Link
                            to={`/purchases/${item.id}`}
                            className="font-medium text-slate-900 hover:text-accent-600 block truncate max-w-xs"
                          >
                            {item.item_name}
                          </Link>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                            <Store className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[180px]">
                              {item.seller?.name || 'Direct / Unknown seller'}
                            </span>
                          </div>
                        </td>

                        {/* Base Price */}
                        <td className="py-3 px-4 text-right text-slate-600 whitespace-nowrap">
                          {formatCurrency(item.base_price)}
                        </td>

                        {/* GST */}
                        <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                          {item.gst_amount ? formatCurrency(item.gst_amount) : '—'}
                        </td>

                        {/* Shipping */}
                        <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                          {item.shipping_cost ? formatCurrency(item.shipping_cost) : '—'}
                        </td>

                        {/* Total */}
                        <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                          <span className={cn(isCheapest ? 'text-emerald-700 font-extrabold' : 'text-slate-900')}>
                            {formatCurrency(item.total_amount)}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-xs">
                          {formatDate(item.order_date)}
                        </td>

                        {/* Badges */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {isCheapest && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <Award className="h-3 w-3" /> Best price
                              </span>
                            )}
                            {isRecent && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                <Clock className="h-3 w-3" /> Most recent
                              </span>
                            )}
                            {!isCheapest && !isRecent && (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-center">
                          <Link
                            to={`/purchases/${item.id}`}
                            className="inline-flex p-1.5 text-slate-400 hover:text-accent-600 hover:bg-accent-50 rounded-lg transition-colors"
                            title="View purchase details"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
