import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  Search,
  ShoppingBag,
  FolderKanban,
  Store,
  FileText,
  ArrowRight,
  ExternalLink,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

interface SearchResultPurchase {
  id: string;
  item_name: string;
  purpose: string | null;
  total_amount: number;
  order_date: string | null;
  seller?: { name?: string } | null;
}

interface SearchResultSeller {
  id: string;
  name: string;
  website: string | null;
}

interface SearchResultProject {
  id: string;
  name: string;
  description: string | null;
}

interface SearchResultDocument {
  id: string;
  doc_type: string;
  file_path: string;
  uploaded_at: string;
  purchase?: {
    id: string;
    item_name: string;
    project?: { name: string } | null;
  } | null;
}

interface GlobalSearchResults {
  purchases: { items: SearchResultPurchase[]; total: number };
  sellers: { items: SearchResultSeller[]; total: number };
  projects: { items: SearchResultProject[]; total: number };
  documents: { items: SearchResultDocument[]; total: number };
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResults>({
    purchases: { items: [], total: 0 },
    sellers: { items: [], total: 0 },
    projects: { items: [], total: 0 },
    documents: { items: [], total: 0 },
  });

  // Cmd/Ctrl+K global shortcut & Esc handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const searchData = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults({
        purchases: { items: [], total: 0 },
        sellers: { items: [], total: 0 },
        projects: { items: [], total: 0 },
        documents: { items: [], total: 0 },
      });
      return;
    }

    setLoading(true);
    try {
      const [purchasesRes, sellersRes, projectsRes, docsRes] = await Promise.all([
        supabase
          .from('purchases')
          .select('id, item_name, purpose, total_amount, order_date, seller:sellers(name)', { count: 'exact' })
          .or(`item_name.ilike.%${trimmed}%,purpose.ilike.%${trimmed}%`)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('sellers')
          .select('id, name, website', { count: 'exact' })
          .ilike('name', `%${trimmed}%`)
          .order('name')
          .limit(5),
        supabase
          .from('projects')
          .select('id, name, description', { count: 'exact' })
          .ilike('name', `%${trimmed}%`)
          .order('name')
          .limit(5),
        supabase
          .from('documents')
          .select('id, doc_type, file_path, uploaded_at, purchase:purchases(id, item_name, project:projects(name))', { count: 'exact' })
          .or(`doc_type.ilike.%${trimmed}%,file_path.ilike.%${trimmed}%`)
          .order('uploaded_at', { ascending: false })
          .limit(5),
      ]);

      setResults({
        purchases: {
          items: (purchasesRes.data as unknown as SearchResultPurchase[]) ?? [],
          total: purchasesRes.count ?? 0,
        },
        sellers: {
          items: (sellersRes.data as unknown as SearchResultSeller[]) ?? [],
          total: sellersRes.count ?? 0,
        },
        projects: {
          items: (projectsRes.data as unknown as SearchResultProject[]) ?? [],
          total: projectsRes.count ?? 0,
        },
        documents: {
          items: (docsRes.data as unknown as SearchResultDocument[]) ?? [],
          total: docsRes.count ?? 0,
        },
      });
    } catch (err) {
      console.error('Global search failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search trigger at ~200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      searchData(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, searchData]);

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    setQuery('');
    navigate(path);
  };

  if (!open) return null;

  const totalResultsCount =
    results.purchases.items.length +
    results.sellers.items.length +
    results.projects.items.length +
    results.documents.items.length;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-3 sm:pt-[15vh] px-2.5 sm:px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      {/* Centered Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-surface-200/80 overflow-hidden animate-scale-in">
        <Command label="Global Command Search" shouldFilter={false} className="w-full">
          {/* Header Input */}
          <div className="flex items-center gap-2.5 px-3.5 sm:px-4 border-b border-surface-100 bg-white">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search purchases, sellers, projects…"
              className="flex-1 h-12 text-sm text-slate-900 placeholder-slate-400 bg-transparent outline-none"
              autoFocus
            />
            <div className="flex items-center gap-1.5">
              <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-surface-100 text-slate-500 border border-surface-200">
                Esc
              </kbd>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="sm:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-surface-100"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Results List */}
          <Command.List className="max-h-[60vh] overflow-y-auto p-2 scroll-smooth">
            {loading && (
              <Command.Loading>
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-accent-600 border-t-transparent rounded-full animate-spin" />
                  Searching records…
                </div>
              </Command.Loading>
            )}

            {!loading && !query.trim() && (
              <div className="py-12 px-6 text-center text-sm text-slate-400">
                <Search className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                Start typing to search purchases, sellers, projects, and documents.
              </div>
            )}

            {!loading && query.trim() && totalResultsCount === 0 && (
              <Command.Empty className="py-12 px-6 text-center text-sm text-slate-500">
                No matches for &ldquo;{query}&rdquo;.
              </Command.Empty>
            )}

            {/* Group: Purchases */}
            {results.purchases.items.length > 0 && (
              <Command.Group
                heading="Purchases"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-400 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider mb-2"
              >
                {results.purchases.items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`purchase-${item.id}-${item.item_name}`}
                    onSelect={() => handleNavigate(`/purchases/${item.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm aria-selected:bg-accent-50 aria-selected:text-accent-900 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface-100 text-slate-500 flex items-center justify-center shrink-0">
                      <ShoppingBag className="h-4 w-4 text-accent-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-slate-800">{item.item_name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {item.seller?.name ? `${item.seller.name} • ` : ''}
                        {formatDate(item.order_date)}
                        {item.total_amount ? ` • ${formatCurrency(item.total_amount)}` : ''}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0 opacity-0 group-hover:opacity-100" />
                  </Command.Item>
                ))}
                {results.purchases.total > 5 && (
                  <button
                    type="button"
                    onClick={() => handleNavigate(`/purchases?search=${encodeURIComponent(query)}`)}
                    className="w-full text-left px-3 py-1.5 text-xs text-accent-600 hover:text-accent-700 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>See all {results.purchases.total} purchases for &ldquo;{query}&rdquo;</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </Command.Group>
            )}

            {/* Group: Sellers */}
            {results.sellers.items.length > 0 && (
              <Command.Group
                heading="Sellers"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-400 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider mb-2"
              >
                {results.sellers.items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`seller-${item.id}-${item.name}`}
                    onSelect={() => handleNavigate(`/sellers`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm aria-selected:bg-accent-50 aria-selected:text-accent-900 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface-100 text-slate-500 flex items-center justify-center shrink-0">
                      <Store className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {item.website ? item.website : 'Vendor / Supplier'}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                  </Command.Item>
                ))}
                {results.sellers.total > 5 && (
                  <button
                    type="button"
                    onClick={() => handleNavigate('/sellers')}
                    className="w-full text-left px-3 py-1.5 text-xs text-accent-600 hover:text-accent-700 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>See all {results.sellers.total} sellers for &ldquo;{query}&rdquo;</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </Command.Group>
            )}

            {/* Group: Projects */}
            {results.projects.items.length > 0 && (
              <Command.Group
                heading="Projects"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-400 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider mb-2"
              >
                {results.projects.items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`project-${item.id}-${item.name}`}
                    onSelect={() => handleNavigate(`/projects/${item.id}`)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm aria-selected:bg-accent-50 aria-selected:text-accent-900 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface-100 text-slate-500 flex items-center justify-center shrink-0">
                      <FolderKanban className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {item.description || 'Project workspace'}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                  </Command.Item>
                ))}
                {results.projects.total > 5 && (
                  <button
                    type="button"
                    onClick={() => handleNavigate('/projects')}
                    className="w-full text-left px-3 py-1.5 text-xs text-accent-600 hover:text-accent-700 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>See all {results.projects.total} projects for &ldquo;{query}&rdquo;</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </Command.Group>
            )}

            {/* Group: Documents */}
            {results.documents.items.length > 0 && (
              <Command.Group
                heading="Documents"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-slate-400 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider mb-2"
              >
                {results.documents.items.map((item) => {
                  const docTarget = item.purchase?.id ? `/purchases/${item.purchase.id}` : '/documents';
                  return (
                    <Command.Item
                      key={item.id}
                      value={`document-${item.id}-${item.file_path}`}
                      onSelect={() => handleNavigate(docTarget)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm aria-selected:bg-accent-50 aria-selected:text-accent-900 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-surface-100 text-slate-500 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-slate-800">
                          {item.doc_type ? item.doc_type.replace('_', ' ').toUpperCase() : 'DOCUMENT'}
                          {item.purchase?.item_name ? ` • ${item.purchase.item_name}` : ''}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {item.purchase?.project?.name ? `${item.purchase.project.name} • ` : ''}
                          Uploaded {formatDate(item.uploaded_at)}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                    </Command.Item>
                  );
                })}
                {results.documents.total > 5 && (
                  <button
                    type="button"
                    onClick={() => handleNavigate('/documents')}
                    className="w-full text-left px-3 py-1.5 text-xs text-accent-600 hover:text-accent-700 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>See all {results.documents.total} documents for &ldquo;{query}&rdquo;</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer Guide */}
          <div className="px-4 py-2 border-t border-surface-100 bg-surface-50 text-[11px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span><kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-surface-200 text-slate-500">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-surface-200 text-slate-500">↵</kbd> select</span>
              <span><kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-surface-200 text-slate-500">esc</kbd> close</span>
            </div>
            <span className="text-[10px] text-slate-400">Global Command Palette</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
