import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight, ChevronLeft, AlertTriangle, Plus, Package
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/PageHeader';
import { FileDropzone } from '@/components/shared/FileDropzone';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, formatDate, warrantyExpiryDate, returnDeadlineDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';

const schema = z.object({
  item_name: z.string().min(1, 'Item name is required'),
  category: z.string().optional(),
  quantity: z.coerce.number().min(1),
  seller_id: z.string().optional(),
  new_seller_name: z.string().optional(),
  project_id: z.string().optional(),
  new_project_name: z.string().optional(),
  base_price: z.coerce.number().min(0),
  gst_amount: z.coerce.number().min(0),
  shipping_cost: z.coerce.number().min(0),
  discount_amount: z.coerce.number().min(0),
  payment_method: z.string().optional(),
  transaction_id: z.string().optional(),
  order_date: z.string().optional(),
  expected_delivery_date: z.string().optional(),
  order_status: z.string(),
  warranty_months: z.coerce.number().optional(),
  return_window_days: z.coerce.number().optional(),
  purpose: z.string().optional(),
  storage_location: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const CATEGORIES = ['Hardware', 'Software', 'Accessories', 'Tools', 'Cables', 'Modules', 'Sensors', 'Books', 'Other'];
const PAYMENT_METHODS = ['upi', 'credit_card', 'debit_card', 'netbanking', 'cash', 'wallet'];
const STATUSES = ['ordered', 'confirmed', 'packed', 'shipped', 'in_transit', 'delivered'];

function FormField({ label, error, children, hint }: { label: string; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full h-10 px-3 rounded-xl border border-surface-200 bg-surface-50 text-sm text-slate-800 placeholder-slate-400',
        'focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all duration-150',
        className
      )}
      {...props}
    />
  );
}

function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full h-10 px-3 rounded-xl border border-surface-200 bg-surface-50 text-sm text-slate-800',
        'focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all duration-150',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function AddPurchasePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<{ item_name: string; order_date: string | null }[]>([]);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1, base_price: 0, gst_amount: 0, shipping_cost: 0, discount_amount: 0, order_status: 'ordered' },
  });

  const { data: sellers } = useQuery({
    queryKey: ['sellers'],
    queryFn: async () => {
      const { data } = await supabase.from('sellers').select('id, name').order('name');
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').order('name');
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const watched = watch(['base_price', 'gst_amount', 'shipping_cost', 'discount_amount', 'item_name', 'warranty_months', 'return_window_days', 'order_date']);
  const [base, gst, ship, disc, itemName, warrantyMonths, returnDays, orderDate] = watched;
  const total = (Number(base) || 0) + (Number(gst) || 0) + (Number(ship) || 0) - (Number(disc) || 0);

  const warrantyExpiry = warrantyMonths && orderDate
    ? warrantyExpiryDate(orderDate, Number(warrantyMonths))
    : null;
  const returnDeadline = returnDays && orderDate
    ? returnDeadlineDate(orderDate, Number(returnDays))
    : null;

  const checkDuplicates = useCallback(async (name: string) => {
    if (!name || name.length < 3) { setDuplicates([]); return; }
    const { data } = await supabase
      .from('purchases')
      .select('item_name, order_date')
      .ilike('item_name', `%${name}%`)
      .limit(3);
    setDuplicates(data ?? []);
  }, []);

  const handleFiles = async (files: File[]) => {
    setUploadedFiles(files);
    if (files.length === 0) return;
    setOcrLoading(true);
    try {
      const file = files[0];
      const path = `${user?.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('purchase-docs').upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: fnData, error: fnErr } = await supabase.functions.invoke('extract-document', {
        body: { filePath: path },
      });
      if (fnErr) throw fnErr;

      const extracted = fnData?.data;
      if (extracted) {
        if (extracted.item_name) setValue('item_name', extracted.item_name);
        if (extracted.base_price) setValue('base_price', extracted.base_price);
        if (extracted.gst_amount) setValue('gst_amount', extracted.gst_amount);
        if (extracted.total_amount && !extracted.base_price) setValue('base_price', extracted.total_amount);
        if (extracted.invoice_date) setValue('order_date', extracted.invoice_date?.split('T')[0]);
        if (!extracted._mock) toast.success('Details extracted from document!');
      }
      setStep(2);
    } catch (err) {
      toast.error('Upload failed — you can still fill in details manually');
      setStep(2);
    } finally {
      setOcrLoading(false);
    }
  };

  const { mutateAsync: savePurchase, isPending: saving } = useMutation({
    mutationFn: async (data: FormData) => {
      if (!user) throw new Error('Not authenticated');

      let sellerId = data.seller_id || null;
      let projectId = data.project_id || null;

      // Create new seller if needed
      if (data.new_seller_name) {
        const { data: s, error } = await supabase
          .from('sellers')
          .insert({ name: data.new_seller_name, owner_id: user.id })
          .select()
          .single();
        if (error) throw error;
        sellerId = s.id;
      }

      // Create new project if needed
      if (data.new_project_name) {
        const { data: p, error } = await supabase
          .from('projects')
          .insert({ name: data.new_project_name, owner_id: user.id })
          .select()
          .single();
        if (error) throw error;
        projectId = p.id;
      }

      // Create purchase
      const { data: purchase, error: purchaseErr } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          project_id: projectId,
          seller_id: sellerId,
          item_name: data.item_name,
          category: data.category || null,
          quantity: data.quantity,
          base_price: data.base_price,
          gst_amount: data.gst_amount,
          shipping_cost: data.shipping_cost,
          discount_amount: data.discount_amount,
          currency: 'INR',
          order_status: data.order_status as never,
          order_date: data.order_date ? new Date(data.order_date).toISOString() : null,
          expected_delivery_date: data.expected_delivery_date ? new Date(data.expected_delivery_date).toISOString() : null,
          payment_method: data.payment_method as never || null,
          transaction_id: data.transaction_id || null,
          warranty_months: data.warranty_months || null,
          return_window_days: data.return_window_days || null,
          purpose: data.purpose || null,
          storage_location: data.storage_location || null,
        })
        .select()
        .single();
      if (purchaseErr) throw purchaseErr;

      // Create inventory row
      await supabase.from('inventory').insert({
        purchase_id: purchase.id,
        item_name: data.item_name,
        quantity_purchased: data.quantity,
        quantity_used: 0,
        location: data.storage_location || null,
      });

      // Link uploaded files as documents
      for (const file of uploadedFiles) {
        const path = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('purchase-docs').upload(path, file);
        if (!uploadErr) {
          await supabase.from('documents').insert({
            purchase_id: purchase.id,
            doc_type: 'invoice',
            file_path: path,
          });
        }
      }

      return purchase.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Purchase added!');
      navigate(`/purchases/${id}`);
    },
    onError: (err) => {
      toast.error((err as Error).message || 'Failed to save purchase');
    },
  });

  const onSubmit = handleSubmit((data) => savePurchase(data));

  return (
    <div className="max-w-2xl animate-fade-in">
      <PageHeader
        title="Add Purchase"
        subtitle="Track a new purchase with all its details"
        breadcrumb={
          <button onClick={() => navigate('/purchases')} className="text-sm text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1">
            Purchases <ChevronRight className="h-3 w-3" />
          </button>
        }
      />

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
              step >= s ? 'bg-accent-600 text-white' : 'bg-surface-200 text-slate-400'
            )}>
              {s}
            </div>
            <span className={cn('text-sm', step === s ? 'font-medium text-slate-800' : 'text-slate-400')}>
              {s === 1 ? 'Upload document' : 'Complete details'}
            </span>
            {s === 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <h2 className="text-base font-semibold text-slate-800 mb-4">Upload invoice or receipt</h2>
          <FileDropzone
            onFiles={handleFiles}
            label="Drop an invoice, screenshot, or PDF here"
            sublabel="We'll try to auto-fill details — images & PDFs accepted"
          />
          {ocrLoading && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-accent-500 border-t-transparent animate-spin" />
                Extracting details…
              </div>
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-surface-100">
            <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
              Skip — enter details manually
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <form onSubmit={onSubmit} className="space-y-5">
          {/* Duplicate warning */}
          {duplicates.length > 0 && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Possible duplicate: </span>
                {duplicates.map((d) => `${d.item_name} (${formatDate(d.order_date)})`).join(', ')}
                . Continue if this is a new purchase.
              </div>
            </div>
          )}

          {/* Basic Info */}
          <Card>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Item details</h2>
            <div className="space-y-4">
              <FormField label="Item name *" error={errors.item_name?.message}>
                <Input
                  placeholder="e.g. SX1262 LoRa HAT"
                  {...register('item_name')}
                  onChange={(e) => {
                    register('item_name').onChange(e);
                    checkDuplicates(e.target.value);
                  }}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Category">
                  <Select {...register('category')}>
                    <option value="">Select category</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </FormField>
                <FormField label="Quantity">
                  <Input type="number" min={1} {...register('quantity', { valueAsNumber: true })} />
                </FormField>
              </div>
              <FormField label="Purpose / Notes">
                <textarea
                  rows={2}
                  placeholder="e.g. Used for LoRa communication between Pi 4B and Pi 3B+"
                  className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-surface-50 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none transition-all"
                  {...register('purpose')}
                />
              </FormField>
            </div>
          </Card>

          {/* Seller & Project */}
          <Card>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Seller & Project</h2>
            <div className="space-y-4">
              <FormField label="Seller">
                <Select {...register('seller_id')}>
                  <option value="">— Select seller —</option>
                  {sellers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="__new__">+ Add new seller</option>
                </Select>
              </FormField>
              {watch('seller_id') === '__new__' && (
                <FormField label="New seller name">
                  <Input placeholder="e.g. Robu.in" {...register('new_seller_name')} />
                </FormField>
              )}
              <FormField label="Project">
                <Select {...register('project_id')}>
                  <option value="">— No project —</option>
                  {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  <option value="__new__">+ Add new project</option>
                </Select>
              </FormField>
              {watch('project_id') === '__new__' && (
                <FormField label="New project name">
                  <Input placeholder="e.g. Bio-Sentry" {...register('new_project_name')} />
                </FormField>
              )}
            </div>
          </Card>

          {/* Pricing */}
          <Card>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Pricing</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Base price (₹)">
                  <Input type="number" step="0.01" min={0} {...register('base_price', { valueAsNumber: true })} />
                </FormField>
                <FormField label="GST (₹)">
                  <Input type="number" step="0.01" min={0} {...register('gst_amount', { valueAsNumber: true })} />
                </FormField>
                <FormField label="Shipping (₹)">
                  <Input type="number" step="0.01" min={0} {...register('shipping_cost', { valueAsNumber: true })} />
                </FormField>
                <FormField label="Discount (₹)">
                  <Input type="number" step="0.01" min={0} {...register('discount_amount', { valueAsNumber: true })} />
                </FormField>
              </div>
              <div className="flex items-center justify-between py-3 px-4 bg-accent-50 rounded-xl">
                <span className="text-sm font-medium text-slate-700">Total</span>
                <span className="text-lg font-bold text-accent-700">₹{total.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          {/* Payment & Dates */}
          <Card>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Payment & dates</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Payment method">
                  <Select {...register('payment_method')}>
                    <option value="">— Select —</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Transaction ID">
                  <Input placeholder="Optional" {...register('transaction_id')} />
                </FormField>
                <FormField label="Order date">
                  <Input type="date" {...register('order_date')} />
                </FormField>
                <FormField label="Expected delivery">
                  <Input type="date" {...register('expected_delivery_date')} />
                </FormField>
              </div>
              <FormField label="Order status">
                <Select {...register('order_status')}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </Select>
              </FormField>
            </div>
          </Card>

          {/* Warranty & Returns */}
          <Card>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Warranty & returns</h2>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Warranty (months)" hint={warrantyExpiry ? `Expires ${formatDate(warrantyExpiry)}` : undefined}>
                <Input type="number" min={0} placeholder="e.g. 12" {...register('warranty_months', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Return window (days)" hint={returnDeadline ? `Deadline ${formatDate(returnDeadline)}` : undefined}>
                <Input type="number" min={0} placeholder="e.g. 7" {...register('return_window_days', { valueAsNumber: true })} />
              </FormField>
            </div>
          </Card>

          {/* Storage */}
          <Card>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Physical storage</h2>
            <FormField label="Storage location" hint="Where did you put it? e.g. Shelf 2 / Box B / Compartment 4">
              <Input placeholder="e.g. Shelf 2 / Box B" {...register('storage_location')} />
            </FormField>
          </Card>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 pb-6">
            <Button
              variant="ghost"
              type="button"
              className="h-11 sm:h-10 justify-center"
              icon={<ChevronLeft className="h-4 w-4" />}
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                type="button"
                className="flex-1 sm:flex-initial h-11 sm:h-10 justify-center"
                onClick={() => navigate('/purchases')}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                loading={saving}
                className="flex-1 sm:flex-initial h-11 sm:h-10 justify-center"
                icon={<Package className="h-4 w-4" />}
              >
                Save purchase
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
