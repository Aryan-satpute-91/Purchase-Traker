import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatBoxProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  className?: string;
  onClick?: () => void;
}

export function StatBox({
  label,
  value,
  trend,
  trendLabel,
  icon,
  accent = false,
  className,
  onClick,
}: StatBoxProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-card border border-surface-100 p-3.5 sm:p-5 flex flex-col gap-2.5 sm:gap-3',
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5',
        accent && 'bg-accent-600 border-accent-600',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="flex items-center justify-between">
        <span className={cn('text-xs sm:text-sm font-medium', accent ? 'text-accent-100' : 'text-slate-500')}>
          {label}
        </span>
        {icon && (
          <span className={cn('p-1.5 sm:p-2 rounded-xl shrink-0', accent ? 'bg-accent-500/30' : 'bg-surface-100')}>
            <span className={cn(accent ? 'text-white' : 'text-accent-600')}>{icon}</span>
          </span>
        )}
      </div>
      <div>
        <p className={cn('text-xl sm:text-2xl font-bold tracking-tight truncate', accent ? 'text-white' : 'text-slate-900')}>
          {value}
        </p>
        {trend && trendLabel && (
          <div className="flex items-center gap-1 mt-1">
            {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
            {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
            {trend === 'neutral' && <Minus className="h-3.5 w-3.5 text-slate-400" />}
            <span className={cn('text-xs', accent ? 'text-accent-200' : 'text-slate-400')}>
              {trendLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
