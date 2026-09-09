import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  FolderKanban,
  Package,
  Clock,
  Files,
  Store,
  Scale,
  BarChart3,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/purchases', label: 'Purchases', icon: ShoppingBag },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/time-tracking', label: 'Time', icon: Clock },
  { to: '/documents', label: 'Documents', icon: Files },
  { to: '/sellers', label: 'Sellers', icon: Store },
  { to: '/price-comparisons', label: 'Price Compare', icon: Scale },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/warranty', label: 'Warranty', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  warningCount?: number;
}

export function Sidebar({ warningCount = 0 }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 h-screen sticky top-0 bg-white border-r border-surface-100 py-5">
      {/* Logo */}
      <div className="px-5 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent-600 flex items-center justify-center">
            <ShoppingBag className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">PurchaseTrack</p>
            <p className="text-[10px] text-slate-400 leading-tight">Personal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative',
                isActive
                  ? 'bg-accent-50 text-accent-700'
                  : 'text-slate-600 hover:bg-surface-100 hover:text-slate-900'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-accent-600' : 'text-slate-400 group-hover:text-slate-600')} />
                <span>{label}</span>
                {label === 'Warranty' && warningCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {warningCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer hint */}
      <div className="px-5 pt-4 border-t border-surface-100">
        <p className="text-[10px] text-slate-300">Press ⌘K to search</p>
      </div>
    </aside>
  );
}
