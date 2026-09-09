import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { GlobalSearch } from '@/components/shared/GlobalSearch';
import { supabase } from '@/lib/supabase';
import { daysUntil, returnDeadlineDate, warrantyExpiryDate } from '@/lib/utils';

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: warningCount = 0 } = useQuery({
    queryKey: ['sidebar-warning-count'],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchases')
        .select('order_date, return_window_days, warranty_months, order_status');
      if (!data) return 0;
      let count = 0;
      for (const p of data) {
        if (!p.order_date) continue;
        if (p.return_window_days && !['returned', 'cancelled'].includes(p.order_status)) {
          const d = daysUntil(returnDeadlineDate(p.order_date, p.return_window_days));
          if (d !== null && d >= 0 && d <= 3) count++;
        }
        if (p.warranty_months) {
          const d = daysUntil(warrantyExpiryDate(p.order_date, p.warranty_months));
          if (d !== null && d >= 0 && d <= 7) count++;
        }
      }
      return count;
    },
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-surface-50 flex">
      <Sidebar warningCount={warningCount} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onSearchOpen={() => setSearchOpen(true)} />
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-[1200px] w-full mx-auto pb-24 lg:pb-8">
          <Outlet />
        </main>
      </div>
      <MobileNav warningCount={warningCount} />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
