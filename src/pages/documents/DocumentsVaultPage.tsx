import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Files, Download, FileText, Image, Archive } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/utils';
import type { Document } from '@/types/database';
import toast from 'react-hot-toast';

const DOC_TYPES = ['invoice', 'receipt', 'order_confirmation', 'warranty', 'delivery_proof', 'other'];

export function DocumentsVaultPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', search, filterType],
    queryFn: async () => {
      let q = supabase
        .from('documents')
        .select('*, purchase:purchases(id, item_name, seller_id, seller:sellers(name))')
        .order('uploaded_at', { ascending: false });

      if (filterType) q = q.eq('doc_type', filterType as never);

      const { data } = await q;
      return data as (Document & {
        purchase: { id: string; item_name: string; seller: { name: string } | null } | null;
      })[] ?? [];
    },
  });

  const filtered = documents?.filter((d) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      d.purchase?.item_name?.toLowerCase().includes(s) ||
      d.purchase?.seller?.name?.toLowerCase().includes(s) ||
      d.doc_type.includes(s)
    );
  });

  const downloadDoc = async (filePath: string, docType: string) => {
    const { data } = await supabase.storage.from('purchase-docs').download(filePath);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docType}_${Date.now()}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const exportAllZip = () => {
    toast('Export all as ZIP: connect server-side export logic for bulk downloads', { icon: 'ℹ️' });
  };

  const isImage = (path: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(path);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Documents Vault"
        subtitle="All your invoices, receipts, and warranty cards in one place"
        actions={
          <Button variant="secondary" size="sm" icon={<Archive className="h-3.5 w-3.5" />} onClick={exportAllZip}>
            Export all (.zip)
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by item or seller…" className="flex-1 min-w-[200px]" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-9 px-3 rounded-xl border border-surface-200 bg-surface-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="">All document types</option>
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : !filtered?.length ? (
        <EmptyState
          icon={<Files className="h-8 w-8" />}
          title="No documents found"
          description="Documents are uploaded when you add a purchase. They'll appear here automatically."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-2xl border border-surface-100 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
            >
              {/* Thumbnail */}
              <div className="h-28 bg-surface-50 flex items-center justify-center border-b border-surface-100 relative">
                {isImage(doc.file_path) ? (
                  <Image className="h-10 w-10 text-slate-200 group-hover:text-accent-300 transition-colors" />
                ) : (
                  <FileText className="h-10 w-10 text-slate-200 group-hover:text-accent-300 transition-colors" />
                )}
                <button
                  onClick={() => downloadDoc(doc.file_path, doc.doc_type)}
                  className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <span className="p-1.5 bg-white rounded-lg shadow-card">
                    <Download className="h-3.5 w-3.5 text-accent-600" />
                  </span>
                </button>
              </div>

              {/* Info */}
              <div className="p-3">
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-50 text-accent-700 mb-1.5 capitalize">
                  {doc.doc_type.replace('_', ' ')}
                </span>
                <p
                  className="text-xs font-medium text-slate-700 truncate hover:text-accent-600 cursor-pointer transition-colors"
                  onClick={() => doc.purchase && navigate(`/purchases/${doc.purchase.id}`)}
                >
                  {doc.purchase?.item_name ?? '—'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(doc.uploaded_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
