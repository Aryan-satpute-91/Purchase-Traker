import React from 'react';
import { cn, getLifecycleColor, LIFECYCLE_STATUS_LABELS } from '@/lib/utils';
import type { LifecycleStatus } from '@/types/database';

interface LifecyclePillProps {
  status: LifecycleStatus | string | null | undefined;
  className?: string;
  size?: 'sm' | 'md';
}

export function LifecyclePill({ status, className, size = 'sm' }: LifecyclePillProps) {
  if (!status) return null;

  const color = getLifecycleColor(status);
  const label = LIFECYCLE_STATUS_LABELS[status] || status;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border transition-colors',
        color.badge,
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        className
      )}
    >
      <span className={cn('rounded-full shrink-0', color.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      <span>{label}</span>
    </span>
  );
}
