import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Edit2, Trash2, Download, Plus, ShieldCheck,
  RotateCcw, MapPin, CreditCard, FileText, Clock, Store, FolderKanban, Package
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { Timeline } from '@/components/shared/Timeline';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  formatCurrency, formatDate, daysUntil, urgencyColor,
  warrantyExpiryDate, returnDeadlineDate, PAYMENT_METHOD_LABELS
} from '@/lib/utils';
import type { Purchase, Document, InventoryItem, TimeEntry, LifecycleStatus, LifecycleEvent } from '@/types/database';
import { LifecyclePill } from '@/components/ui/LifecyclePill';
import { LifecycleStepper } from '@/components/purchases/LifecycleStepper';
import { PriceHistoryPanel } from '@/components/purchases/PriceHistoryPanel';
import { LIFECYCLE_STATUS_LABELS } from '@/lib/utils';
import toast from 'react-hot-toast';

function UrgencyBadge({ days }: { days: number | null }) {
  const color = urgencyColor(days);
  const label = days === null ? '—' : days < 0 ? 'Expired' : days === 0 ? 'Today!' : `${days}d left`;
  const cls = { green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-600', gray: 'bg-slate-100 text-slate-400' }[color];
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

export function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [logActivity, setLogActivity] = useState('testing');
  const [logDuration, setLogDuration] = useState(30);
  const [logNotes, setLogNotes] = useState('');

  const { data: purchase, isLoading } = useQuery({
    queryKey: ['purchase', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select(`*, seller:sellers(*), project:projects(*), documents(*), inventory(*)`)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Purchase & { seller: { name: string; website: string | null } | null; project: { id: string; name: string } | null; documents: Document[]; inventory: InventoryItem[] };
    },
    enabled: !!id,
  });

  const { data: timeEntries } = useQuery({
    queryKey: ['time-entries', 'purchase', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('time_entries')
        .select('*')
        .eq('purchase_id', id!)
        .order('logged_at', { ascending: false });
      return (data as TimeEntry[]) ?? [];
    },
    enabled: !!id,
  });

  const { data: sellerStats } = useQuery({
    queryKey: ['seller-stats', purchase?.seller_id],
    queryFn: async () => {
      if (!purchase?.seller_id) return null;
      const { data } = await supabase
        .from('vendor_summary')
        .select('*')
        .eq('seller_id', purchase.seller_id)
        .single();
      return data;
    },
    enabled: !!purchase?.seller_id,
  });

  const { data: lifecycleEvents = [] } = useQuery({
    queryKey: ['lifecycle-events', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lifecycle_events')
        .select('*')
        .eq('purchase_id', id!)
        .order('changed_at', { ascending: true });
      return (data as unknown as LifecycleEvent[]) ?? [];
    },
    enabled: !!id,
  });

  const { mutateAsync: updateLifecycle, isPending: updatingLifecycle } = useMutation({
    mutationFn: async (newStatus: LifecycleStatus) => {
      // 1. Update purchase
      const { error: pErr } = await supabase
        .from('purchases')
        .update({ lifecycle_status: newStatus })
        .eq('id', id!);
      if (pErr) throw pErr;

      // 2. Insert lifecycle event
      const { error: eErr } = await supabase
        .from('lifecycle_events')
        .insert({
          purchase_id: id!,
          status: newStatus,
          changed_at: new Date().toISOString(),
        });
      if (eErr) throw eErr;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['purchase', id] });
      queryClient.invalidateQueries({ queryKey: ['lifecycle-events', id] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast.success(`Lifecycle updated to ${LIFECYCLE_STATUS_LABELS[newStatus] || newStatus}`);
    },
    onError: () => toast.error('Failed to update lifecycle status'),
  });

  const { mutate: deletePurchase, isPending: deleting } = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('purchases').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast.success('Purchase deleted');
      navigate('/purchases');
    },
    onError: () => toast.error('Failed to delete purchase'),
  });

  const { mutate: updateInventory } = useMutation({
    mutationFn: async ({ inventoryId, delta }: { inventoryId: string; delta: number }) => {
      const inv = purchase?.inventory?.[0];
      if (!inv) return;
      const newUsed = Math.max(0, Math.min(inv.quantity_purchased, inv.quantity_used + delta));
      const { error } = await supabase.from('inventory').update({ quantity_used: newUsed }).eq('id', inventoryId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase', id] }),
  });

  const { mutate: logTime, isPending: loggingTime } = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('time_entries').insert({
        user_id: user.id,
        purchase_id: id!,
        project_id: purchase?.project_id ?? null,
        activity_type: logActivity as never,
        duration_minutes: logDuration,
        notes: logNotes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', 'purchase', id] });
      toast.success('Time logged!');
      setLogTimeOpen(false);
    },
    onError: () => toast.error('Failed to log time'),
  });

  const downloadDocument = async (filePath: string, fileName: string) => {
    const { data } = await supabase.storage.from('purchase-docs').download(filePath);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
        <div className="space-y-4">{[...Array(2)].map((_, i) => <SkeletonCard key={i} />)}</div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <EmptyState
        icon={<Package className="h-6 w-6" />}
        title="Purchase not found"
        ctaLabel="Back to purchases"
        onCta={() => navigate('/purchases')}
      />
    );
  }

  const warrantyExpiry = purchase.warranty_months && purchase.order_date
    ? warrantyExpiryDate(purchase.order_date, purchase.warranty_months)
    : null;
  const warrantyDays = daysUntil(warrantyExpiry);
  const returnDeadline = purchase.return_window_days && purchase.order_date
    ? returnDeadlineDate(purchase.order_date, purchase.return_window_days)
    : null;
  const returnDays = daysUntil(returnDeadline);
  const inv = purchase.inventory?.[0];
  const totalMinutes = timeEntries?.reduce((s, t) => s + t.duration_minutes, 0) ?? 0;

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={
          <button onClick={() => navigate('/purchases')} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" /> Purchases
          </button>
        }
        title={purchase.item_name}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Edit2 className="h-3.5 w-3.5" />} onClick={() => navigate(`/purchases/${id}/edit`)}>
              Edit
            </Button>
            <Button variant="danger" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        }
      />

      {/* Status + category row */}
      <div className="flex flex-wrap items-center gap-2 mb-6 -mt-2">
        <StatusPill status={purchase.order_status} />
        {purchase.lifecycle_status && (
          <LifecyclePill status={purchase.lifecycle_status} />
        )}
        {purchase.category && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-slate-500">
            {purchase.category}
          </span>
        )}
        {purchase.project && (
          <button
            onClick={() => navigate(`/projects/${purchase.project!.id}`)}
            className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-50 text-accent-700 hover:bg-accent-100 transition-colors"
          >
            <FolderKanban className="inline h-3 w-3 mr-1" />{purchase.project.name}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Price breakdown */}
          <Card>
            <CardTitle className="mb-4">Price breakdown</CardTitle>
            <div className="space-y-2">
              {[
                { label: 'Base price', value: purchase.base_price },
                { label: 'GST', value: purchase.gst_amount },
                { label: 'Shipping', value: purchase.shipping_cost },
                { label: 'Discount', value: -purchase.discount_amount, negative: true },
              ].map(({ label, value, negative }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className={negative && value < 0 ? 'text-green-600 font-medium' : 'text-slate-700'}>
                    {negative && value < 0 ? '-' : ''}{formatCurrency(Math.abs(value))}
                  </span>
                </div>
              ))}
              <div className="border-t border-surface-100 pt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">Total paid</span>
                <span className="text-lg font-bold text-accent-700">{formatCurrency(purchase.total_amount)}</span>
              </div>
            </div>
          </Card>

          {/* Price history panel (Option A) */}
          <PriceHistoryPanel
            currentPurchaseId={purchase.id}
            itemName={purchase.item_name}
            currentPrice={purchase.total_amount}
          />

          {/* Order Timeline */}
          <Card>
            <CardTitle className="mb-4">Order timeline</CardTitle>
            <Timeline
              currentStatus={purchase.order_status}
              dates={{
                ordered: purchase.order_date ? formatDate(purchase.order_date, 'dd MMM') : undefined,
                delivered: purchase.delivered_date ? formatDate(purchase.delivered_date, 'dd MMM') : undefined,
              }}
            />
          </Card>

          {/* Item Lifecycle Stepper */}
          <LifecycleStepper
            purchaseId={purchase.id}
            currentStatus={purchase.lifecycle_status}
            orderStatus={purchase.order_status}
            events={lifecycleEvents}
            onStatusChange={updateLifecycle}
            isUpdating={updatingLifecycle}
          />

          {/* Purpose / Notes */}
          {purchase.purpose && (
            <Card>
              <CardTitle className="mb-2">Purpose & notes</CardTitle>
              <p className="text-sm text-slate-600 leading-relaxed">{purchase.purpose}</p>
            </Card>
          )}

          {/* Payment Info */}
          <Card>
            <CardTitle className="mb-4">
              <CreditCard className="inline h-4 w-4 mr-1.5 text-slate-400" />Payment
            </CardTitle>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Method', value: purchase.payment_method ? PAYMENT_METHOD_LABELS[purchase.payment_method] : '—' },
                { label: 'Transaction ID', value: purchase.transaction_id || '—' },
                { label: 'Order date', value: formatDate(purchase.order_date) },
                { label: 'Expected delivery', value: formatDate(purchase.expected_delivery_date) },
                { label: 'Delivered on', value: formatDate(purchase.delivered_date) },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-slate-700 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Warranty & Returns */}
          <Card>
            <CardTitle className="mb-4">
              <ShieldCheck className="inline h-4 w-4 mr-1.5 text-slate-400" />Warranty & returns
            </CardTitle>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-surface-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Warranty expires</p>
                <p className="text-sm font-medium text-slate-800">{warrantyExpiry ? formatDate(warrantyExpiry) : '—'}</p>
                {warrantyDays !== null && <UrgencyBadge days={warrantyDays} />}
              </div>
              <div className="p-3 bg-surface-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Return deadline</p>
                <p className="text-sm font-medium text-slate-800">{returnDeadline ? formatDate(returnDeadline) : '—'}</p>
                {returnDays !== null && <UrgencyBadge days={returnDays} />}
              </div>
            </div>
            {purchase.storage_location && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="h-4 w-4 text-slate-400" />
                {purchase.storage_location}
              </div>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle><FileText className="inline h-4 w-4 mr-1.5 text-slate-400" />Documents</CardTitle>
              <Button variant="ghost" size="sm" icon={<Plus className="h-3.5 w-3.5" />}>Add</Button>
            </CardHeader>
            {!purchase.documents?.length ? (
              <p className="text-sm text-slate-400">No documents attached</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {purchase.documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => downloadDocument(doc.file_path, doc.doc_type)}
                    className="p-2 border border-surface-200 rounded-xl hover:border-accent-300 hover:bg-accent-50/30 transition-all text-left group"
                  >
                    <FileText className="h-8 w-8 text-slate-300 group-hover:text-accent-500 transition-colors mb-1" />
                    <p className="text-xs text-slate-600 capitalize truncate">{doc.doc_type.replace('_', ' ')}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(doc.uploaded_at)}</p>
                    <Download className="h-3 w-3 text-slate-300 group-hover:text-accent-500 mt-1 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Inventory */}
          {inv && (
            <Card>
              <CardHeader>
                <CardTitle><Package className="inline h-4 w-4 mr-1.5 text-slate-400" />Inventory</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                {[
                  { label: 'Purchased', value: inv.quantity_purchased },
                  { label: 'Used', value: inv.quantity_used },
                  { label: 'Available', value: inv.quantity_available, highlight: true },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className={`p-2 rounded-xl ${highlight ? 'bg-green-50' : 'bg-surface-50'}`}>
                    <p className={`text-xl font-bold ${highlight ? 'text-green-700' : 'text-slate-800'}`}>{value}</p>
                    <p className="text-[10px] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary" size="sm" className="flex-1"
                  onClick={() => updateInventory({ inventoryId: inv.id, delta: -1 })}
                  disabled={inv.quantity_used >= inv.quantity_purchased}
                >
                  Log usage
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => updateInventory({ inventoryId: inv.id, delta: 1 })}
                  disabled={inv.quantity_used <= 0}
                >
                  Undo
                </Button>
              </div>
            </Card>
          )}

          {/* Time Tracking */}
          <Card>
            <CardHeader>
              <CardTitle><Clock className="inline h-4 w-4 mr-1.5 text-slate-400" />Time logged</CardTitle>
              <Button variant="ghost" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setLogTimeOpen(true)}>
                Log time
              </Button>
            </CardHeader>
            <p className="text-2xl font-bold text-slate-900 mb-2">
              {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
            </p>
            {timeEntries?.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-surface-50 last:border-0 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-surface-100 text-slate-500 capitalize">{t.activity_type.replace('_', ' ')}</span>
                <span className="text-slate-700">{t.duration_minutes}m</span>
                {t.notes && <span className="text-slate-400 truncate flex-1">{t.notes}</span>}
              </div>
            ))}
            {logTimeOpen && (
              <div className="mt-4 p-3 bg-surface-50 rounded-xl space-y-2 border border-surface-200">
                <select
                  value={logActivity}
                  onChange={(e) => setLogActivity(e.target.value)}
                  className="w-full h-8 px-2 text-xs rounded-lg border border-surface-200 bg-white"
                >
                  {['research', 'testing', 'integration', 'debugging', 'documentation', 'ordering', 'other'].map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={logDuration}
                  onChange={(e) => setLogDuration(Number(e.target.value))}
                  className="w-full h-8 px-2 text-xs rounded-lg border border-surface-200 bg-white"
                  placeholder="Minutes"
                  min={1}
                />
                <input
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  className="w-full h-8 px-2 text-xs rounded-lg border border-surface-200 bg-white"
                  placeholder="Notes (optional)"
                />
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" className="flex-1" onClick={() => logTime()} loading={loggingTime}>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => setLogTimeOpen(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </Card>

          {/* Seller Info */}
          {purchase.seller && (
            <Card>
              <CardTitle className="mb-3"><Store className="inline h-4 w-4 mr-1.5 text-slate-400" />Seller</CardTitle>
              <p className="text-sm font-semibold text-slate-800">{purchase.seller.name}</p>
              {purchase.seller.website && (
                <a href={purchase.seller.website} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-600 hover:underline">
                  {purchase.seller.website}
                </a>
              )}
              {sellerStats && (
                <p className="text-xs text-slate-500 mt-2">
                  {sellerStats.order_count} orders · {formatCurrency(sellerStats.total_spent)} total spent
                </p>
              )}
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete purchase"
        description={`Are you sure you want to delete "${purchase.item_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deletePurchase()}
        loading={deleting}
      />
    </div>
  );
}
