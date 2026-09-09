import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  breadcrumb?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions, className, breadcrumb }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-1 mb-5 sm:mb-6', className)}>
      {breadcrumb && <div className="mb-1">{breadcrumb}</div>}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
