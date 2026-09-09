import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-scale-in">
          <div className="bg-white rounded-2xl shadow-card-lg border border-surface-100 p-6 w-full max-w-sm mx-4">
            <div className="flex gap-4">
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600 shrink-0 h-fit">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <Dialog.Title className="text-base font-semibold text-slate-900 mb-1">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="text-sm text-slate-500">
                    {description}
                  </Dialog.Description>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                {cancelLabel}
              </Button>
              <Button variant={variant} size="sm" onClick={onConfirm} loading={loading}>
                {confirmLabel}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
