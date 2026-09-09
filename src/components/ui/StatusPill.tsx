import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types/database';

interface StatusPillProps {
  status: OrderStatus | string;
  className?: string;
}

const statusConfig: Record<string, { label: string; classes: string }> = {
  ordered: { label: 'Ordered', classes: 'bg-slate-100 text-slate-600' },
  confirmed: { label: 'Confirmed', classes: 'bg-blue-50 text-blue-700' },
  packed: { label: 'Packed', classes: 'bg-purple-50 text-purple-700' },
  shipped: { label: 'Shipped', classes: 'bg-amber-50 text-amber-700' },
  in_transit: { label: 'In Transit', classes: 'bg-orange-50 text-orange-700' },
  delivered: { label: 'Delivered', classes: 'bg-green-50 text-green-700' },
  cancelled: { label: 'Cancelled', classes: 'bg-red-50 text-red-600' },
  returned: { label: 'Returned', classes: 'bg-rose-50 text-rose-600' },
};

export function StatusPill({ status, className }: StatusPillProps) {
  const config = statusConfig[status] ?? { label: status, classes: 'bg-slate-100 text-slate-500' };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}
