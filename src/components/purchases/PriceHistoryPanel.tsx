import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  TrendingDown,
  TrendingUp,
  ExternalLink,
  Award,
  Store,
  Calendar,
} from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { Purchase } from '@/types/database';

interface PriceHistoryPanelProps {
  currentPurchaseId: string;
  itemName: string;
  currentPrice: number;
}

export function PriceHistoryPanel({
  currentPurchaseId,
  itemName,
  currentPrice,
}: PriceHistoryPanelProps) {
  // Extract a sensible search term (e.g. first 2-3 words or prefix if longer than 3 chars)
  const searchTerm = itemName.trim().split(/\s+/).slice(0, 3).join(' ') || itemName.trim();

  const { data: matches, isLoading } = useQuery({
    queryKey: ['price-history-matches', currentPurchaseId, searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await supabase
        .from('purchases')
        .select('id, item_name, total_amount, base_price, order_date, seller:sellers(name)')
        .ilike('item_name', `%${searchTerm}%`);

      if (error) throw error;

      return ((data as unknown as (Purchase & { seller?: { name?: string } | null })[]) ?? [])
        .filter((p) => p.total_amount > 0)
        .sort((a, b) => (a.total_amount || 0) - (b.total_amount || 0));
    },
    enabled: !!searchTerm && searchTerm.length >= 2,
    staleTime: 60_000,
  });

  if (isLoading) return null;

  // "If no other matches exist, hide the panel entirely."
  const otherMatches = (matches ?? []).filter((p) => p.id !== currentPurchaseId);
  if (!matches || otherMatches.length === 0) {
    return null;
  }

  const bestMatch = matches[0];
  const isCurrentBest = bestMatch.id === currentPurchaseId;
  const lowestPrice = bestMatch.total_amount;
  const priceDifference = currentPrice - lowestPrice;

  return (
    <Card className="animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div>
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span>Price history</span>
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-surface-100 text-slate-500">
              {matches.length} recorded purchases
            </span>
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranked comparison for similar items across your sellers
          </p>
        </div>

        {isCurrentBest ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Award className="h-3 w-3" /> Best price paid
          </span>
        ) : priceDifference > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <TrendingUp className="h-3 w-3" /> +{formatCurrency(priceDifference)} vs best
          </span>
        ) : null}
      </div>

      {/* Comparison Table */}
      <div className="overflow-hidden rounded-xl border border-surface-200 text-xs">
        <table className="w-full text-left">
          <thead className="bg-surface-100 text-slate-600 font-semibold border-b border-surface-200">
            <tr>
              <th className="py-2 px-3 w-10">Rank</th>
              <th className="py-2 px-3">Seller</th>
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3 text-right">Price Paid</th>
              <th className="py-2 px-3 w-16 text-center">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {matches.map((item, idx) => {
              const isCurrent = item.id === currentPurchaseId;
              const isCheapest = idx === 0;

              return (
                <tr
                  key={item.id}
                  className={cn(
                    'transition-colors',
                    isCurrent
                      ? 'bg-accent-50/80 font-medium text-accent-950'
                      : 'hover:bg-surface-50 text-slate-700'
                  )}
                >
                  <td className="py-2.5 px-3">
                    <span
                      className={cn(
                        'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
                        isCheapest
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-surface-200 text-slate-600'
                      )}
                    >
                      #{idx + 1}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[130px] sm:max-w-[200px]">
                        {item.seller?.name || 'Unknown seller'}
                      </span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-accent-200 text-accent-800 font-semibold shrink-0">
                          Current
                        </span>
                      )}
                      {isCheapest && !isCurrent && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 font-medium shrink-0">
                          Best
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {formatDate(item.order_date, 'dd MMM yyyy')}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">
                    <span className={cn(isCheapest ? 'text-emerald-700' : 'text-slate-800')}>
                      {formatCurrency(item.total_amount)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {isCurrent ? (
                      <span className="text-slate-400 text-[10px]">—</span>
                    ) : (
                      <Link
                        to={`/purchases/${item.id}`}
                        className="inline-flex p-1 text-accent-600 hover:text-accent-800 hover:bg-accent-100 rounded transition-colors"
                        title="View purchase details"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
