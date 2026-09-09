import { Search, Plus, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  onSearchOpen: () => void;
}

export function TopBar({ onSearchOpen }: TopBarProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-white/80 backdrop-blur-md border-b border-surface-100 flex items-center px-3 sm:px-4 gap-2 sm:gap-3 safe-area-pt">
      {/* Mobile logo */}
      <div
        onClick={() => navigate('/dashboard')}
        className="flex lg:hidden items-center gap-2 cursor-pointer active:scale-95 transition-transform shrink-0"
      >
        <div className="w-8 h-8 rounded-xl bg-accent-600 flex items-center justify-center shadow-sm">
          <span className="text-white text-xs font-bold">PT</span>
        </div>
      </div>

      {/* Search trigger */}
      <button
        onClick={onSearchOpen}
        type="button"
        className={cn(
          'flex items-center gap-2 flex-1 max-w-sm h-10 px-3 rounded-xl',
          'bg-surface-50 border border-surface-200 text-sm text-slate-400',
          'hover:border-accent-300 hover:bg-accent-50/30 active:bg-accent-50/50 transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500'
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="flex-1 text-left text-xs sm:text-sm truncate">Search records…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-200 text-slate-400">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">
        <Button
          variant="primary"
          size="sm"
          className="h-10 px-3 sm:px-3.5"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => navigate('/purchases/new')}
        >
          <span className="hidden sm:inline">Add Purchase</span>
        </Button>
        <button
          onClick={handleSignOut}
          className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-surface-100 active:bg-surface-200 transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
