import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  Plus,
  Menu,
  X,
  LogOut,
  ChevronRight,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface MobileNavProps {
  warningCount?: number;
}

export function MobileNav({ warningCount = 0 }: MobileNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, reset } = useAuthStore();

  const handleSignOut = async () => {
    setDrawerOpen(false);
    await supabase.auth.signOut();
    reset();
    navigate('/auth');
  };

  const handleNavigate = (to: string) => {
    setDrawerOpen(false);
    navigate(to);
  };

  // Remaining pages inside the "More" drawer
  const moreItems = [
    { to: '/inventory', label: 'Inventory', icon: Package, desc: 'Hardware & components' },
    { to: '/time-tracking', label: 'Time Tracking', icon: Clock, desc: 'Hours logged per item' },
    { to: '/documents', label: 'Documents Vault', icon: Files, desc: 'Invoices & warranty cards' },
    { to: '/sellers', label: 'Sellers', icon: Store, desc: 'Vendors & websites' },
    { to: '/price-comparisons', label: 'Price Compare', icon: Scale, desc: 'Vendor cost benchmarks' },
    {
      to: '/warranty',
      label: 'Warranty & Returns',
      icon: ShieldCheck,
      desc: 'Deadlines & expirations',
      badge: warningCount > 0 ? warningCount : undefined,
    },
    { to: '/reports', label: 'Reports', icon: BarChart3, desc: 'Expense analytics' },
    { to: '/settings', label: 'Settings', icon: Settings, desc: 'Currencies & preferences' },
  ];

  const isMoreActive = moreItems.some((item) => location.pathname.startsWith(item.to));

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. Bottom Navigation Bar (Phone & Tablet < lg)
      ───────────────────────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-surface-200/80 px-2 h-16 safe-area-pb flex items-center justify-around shadow-lg">
        {/* 1. Home */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 py-1.5 flex-1 text-[10px] font-medium transition-colors',
              isActive ? 'text-accent-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
            )
          }
        >
          {({ isActive }) => (
            <>
              <LayoutDashboard className={cn('h-5 w-5', isActive ? 'text-accent-600 stroke-[2.2]' : 'text-slate-400')} />
              <span>Home</span>
            </>
          )}
        </NavLink>

        {/* 2. Purchases */}
        <NavLink
          to="/purchases"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 py-1.5 flex-1 text-[10px] font-medium transition-colors',
              isActive ? 'text-accent-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
            )
          }
        >
          {({ isActive }) => (
            <>
              <ShoppingBag className={cn('h-5 w-5', isActive ? 'text-accent-600 stroke-[2.2]' : 'text-slate-400')} />
              <span>Purchases</span>
            </>
          )}
        </NavLink>

        {/* 3. Center Floating Action Button (New Purchase) */}
        <div className="flex-1 flex justify-center -mt-5">
          <button
            type="button"
            onClick={() => navigate('/purchases/new')}
            className="w-12 h-12 rounded-2xl bg-accent-600 hover:bg-accent-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-accent-500/30 transition-transform border-2 border-white"
            title="Add Purchase"
            aria-label="Add new purchase"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
        </div>

        {/* 4. Projects */}
        <NavLink
          to="/projects"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 py-1.5 flex-1 text-[10px] font-medium transition-colors',
              isActive ? 'text-accent-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
            )
          }
        >
          {({ isActive }) => (
            <>
              <FolderKanban className={cn('h-5 w-5', isActive ? 'text-accent-600 stroke-[2.2]' : 'text-slate-400')} />
              <span>Projects</span>
            </>
          )}
        </NavLink>

        {/* 5. More Menu Trigger */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 flex-1 text-[10px] font-medium transition-colors relative',
            drawerOpen || isMoreActive ? 'text-accent-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
          )}
          aria-label="Open menu"
        >
          <div className="relative">
            <Menu className={cn('h-5 w-5', drawerOpen || isMoreActive ? 'text-accent-600 stroke-[2.2]' : 'text-slate-400')} />
            {warningCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />
            )}
          </div>
          <span>More</span>
        </button>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          2. "More" Slide-up Mobile Drawer Sheet
      ───────────────────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Sheet Body */}
          <div className="relative w-full max-h-[85vh] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up pb-8 safe-area-pb">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-surface-300 rounded-full mx-auto mt-3 mb-2" />

            {/* Header */}
            <div className="px-5 py-3 border-b border-surface-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent-600 flex items-center justify-center text-white font-bold text-xs">
                  PT
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">All Modules</h2>
                  <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                    {user?.email || 'Personal Purchase Tracker'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-surface-100 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Module Links List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {moreItems.map(({ to, label, icon: Icon, desc, badge }) => {
                const active = location.pathname.startsWith(to);
                return (
                  <button
                    key={to}
                    type="button"
                    onClick={() => handleNavigate(to)}
                    className={cn(
                      'w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-left transition-all',
                      active
                        ? 'bg-accent-50 text-accent-900 font-semibold'
                        : 'hover:bg-surface-50 text-slate-700 active:bg-surface-100'
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                        active
                          ? 'bg-accent-600 text-white shadow-sm'
                          : 'bg-surface-100 text-slate-600'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{label}</span>
                        {badge !== undefined && (
                          <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-2 py-0.5">
                            {badge} alert{badge !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Drawer Footer Actions */}
            <div className="px-5 pt-3 border-t border-surface-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <User className="h-4 w-4 text-slate-400" />
                <span className="truncate max-w-[150px]">{user?.email || 'Logged in'}</span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
