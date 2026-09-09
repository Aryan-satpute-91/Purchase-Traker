import { format, formatDistanceToNow, differenceInDays, addDays, addMonths } from 'date-fns';

// --- Currency ---
export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// --- Dates ---
export function formatDate(date: string | Date | null, fmt = 'dd MMM yyyy'): string {
  if (!date) return '—';
  return format(new Date(date), fmt);
}

export function formatRelative(date: string | Date | null): string {
  if (!date) return '—';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function daysUntil(date: string | Date | null): number | null {
  if (!date) return null;
  return differenceInDays(new Date(date), new Date());
}

export function warrantyExpiryDate(purchaseDate: string | Date, warrantyMonths: number): Date {
  return addMonths(new Date(purchaseDate), warrantyMonths);
}

export function returnDeadlineDate(orderDate: string | Date, returnWindowDays: number): Date {
  return addDays(new Date(orderDate), returnWindowDays);
}

// --- Urgency colour ---
export function urgencyColor(daysLeft: number | null): 'green' | 'amber' | 'red' | 'gray' {
  if (daysLeft === null) return 'gray';
  if (daysLeft < 0) return 'red';
  if (daysLeft <= 7) return 'red';
  if (daysLeft <= 30) return 'amber';
  return 'green';
}

// --- Order status label ---
export const ORDER_STATUS_LABELS: Record<string, string> = {
  ordered: 'Ordered',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  upi: 'UPI',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  netbanking: 'Net Banking',
  cash: 'Cash',
  wallet: 'Wallet',
};

// --- String helpers ---
export function truncate(str: string, n = 40): string {
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

// --- Clsx-lite (no dep needed) ---
export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// --- Debounce ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(fn: T, delay = 300): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// --- Lifecycle status ---
export const LIFECYCLE_STAGES = ['received', 'tested', 'in_use', 'repaired', 'retired'] as const;

export const LIFECYCLE_STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  tested: 'Tested',
  in_use: 'In Use',
  repaired: 'Repaired',
  retired: 'Retired',
};

export function getLifecycleColor(status: string | null | undefined): {
  badge: string;
  dot: string;
  border: string;
  bg: string;
  text: string;
} {
  switch (status) {
    case 'received':
      return {
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500',
        border: 'border-blue-400',
        bg: 'bg-blue-500',
        text: 'text-blue-700',
      };
    case 'tested':
      return {
        badge: 'bg-purple-50 text-purple-700 border-purple-200',
        dot: 'bg-purple-500',
        border: 'border-purple-400',
        bg: 'bg-purple-500',
        text: 'text-purple-700',
      };
    case 'in_use':
      return {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
        border: 'border-emerald-400',
        bg: 'bg-emerald-500',
        text: 'text-emerald-700',
      };
    case 'repaired':
      return {
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
        border: 'border-amber-400',
        bg: 'bg-amber-500',
        text: 'text-amber-700',
      };
    case 'retired':
      return {
        badge: 'bg-slate-100 text-slate-600 border-slate-200',
        dot: 'bg-slate-400',
        border: 'border-slate-400',
        bg: 'bg-slate-400',
        text: 'text-slate-600',
      };
    default:
      return {
        badge: 'bg-slate-50 text-slate-400 border-slate-200',
        dot: 'bg-slate-300',
        border: 'border-slate-200',
        bg: 'bg-slate-300',
        text: 'text-slate-400',
      };
  }
}
