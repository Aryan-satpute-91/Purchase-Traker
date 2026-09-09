import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types/database';

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'ordered', label: 'Ordered' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
];

const TERMINAL_STEPS: OrderStatus[] = ['cancelled', 'returned'];

interface TimelineProps {
  currentStatus: OrderStatus;
  dates?: Partial<Record<OrderStatus, string | null>>;
}

export function Timeline({ currentStatus, dates = {} }: TimelineProps) {
  if (TERMINAL_STEPS.includes(currentStatus)) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl">
        <span className="text-sm font-medium text-red-600 capitalize">{currentStatus}</span>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.key === currentStatus);

  return (
    <div className="relative">
      <div className="flex items-start gap-0 overflow-x-auto pb-2">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const date = dates[step.key];

          return (
            <div key={step.key} className="flex items-start flex-1 min-w-[80px]">
              <div className="flex flex-col items-center flex-1">
                <div className="flex items-center w-full">
                  {idx > 0 && (
                    <div className={cn('h-0.5 flex-1', isDone || isCurrent ? 'bg-accent-500' : 'bg-surface-200')} />
                  )}
                  <div
                    className={cn(
                      'rounded-full flex items-center justify-center shrink-0 transition-all duration-200',
                      isDone ? 'text-accent-600' : isCurrent ? 'text-accent-600' : 'text-surface-300',
                      idx === 0 ? 'ml-0' : ''
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 fill-accent-100" />
                    ) : (
                      <Circle
                        className={cn('h-5 w-5', isCurrent ? 'fill-accent-100 stroke-accent-600' : 'fill-white stroke-surface-300')}
                      />
                    )}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={cn('h-0.5 flex-1', isDone ? 'bg-accent-500' : 'bg-surface-200')} />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] mt-1 text-center leading-tight',
                    isCurrent ? 'font-semibold text-accent-600' : isDone ? 'text-slate-500' : 'text-slate-300'
                  )}
                >
                  {step.label}
                </span>
                {date && (
                  <span className="text-[9px] text-slate-400 mt-0.5">{date}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
