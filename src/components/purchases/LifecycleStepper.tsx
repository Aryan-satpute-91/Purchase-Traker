import React, { useState } from 'react';
import {
  Check,
  Lock,
  MoreHorizontal,
  Clock,
  AlertTriangle,
  History,
  Wrench,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  cn,
  formatDate,
  LIFECYCLE_STAGES,
  LIFECYCLE_STATUS_LABELS,
  getLifecycleColor,
} from '@/lib/utils';
import type { LifecycleStatus, LifecycleEvent, OrderStatus } from '@/types/database';

interface LifecycleStepperProps {
  purchaseId: string;
  currentStatus: LifecycleStatus | null;
  orderStatus: OrderStatus;
  events: LifecycleEvent[];
  onStatusChange: (status: LifecycleStatus) => Promise<void>;
  isUpdating?: boolean;
}

export function LifecycleStepper({
  currentStatus,
  orderStatus,
  events = [],
  onStatusChange,
  isUpdating = false,
}: LifecycleStepperProps) {
  const isDelivered = orderStatus === 'delivered';
  const [skipConfirmModal, setSkipConfirmModal] = useState<{
    open: boolean;
    targetStage: LifecycleStatus | null;
    skippedStages: string[];
  }>({
    open: false,
    targetStage: null,
    skippedStages: [],
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Calculate current stage index (-1 if none)
  const currentIdx = currentStatus ? LIFECYCLE_STAGES.indexOf(currentStatus) : -1;

  // Map events to stage timestamps
  const eventsByStatus = events.reduce<Record<string, LifecycleEvent>>((acc, ev) => {
    // Keep most recent event per status
    if (!acc[ev.status] || new Date(ev.changed_at) > new Date(acc[ev.status].changed_at)) {
      acc[ev.status] = ev;
    }
    return acc;
  }, {});

  const handleStepClick = async (stage: LifecycleStatus) => {
    if (!isDelivered || isUpdating) return;
    if (stage === currentStatus) return;

    const targetIdx = LIFECYCLE_STAGES.indexOf(stage);

    // If starting from none or advancing by 1 step
    if (currentIdx === -1 && targetIdx === 0) {
      await onStatusChange(stage);
      return;
    }

    // Skipping stages forward
    if (targetIdx > currentIdx + 1) {
      const skipped = LIFECYCLE_STAGES.slice(
        Math.max(0, currentIdx + 1),
        targetIdx
      ).map((s) => LIFECYCLE_STATUS_LABELS[s]);

      setSkipConfirmModal({
        open: true,
        targetStage: stage,
        skippedStages: skipped,
      });
      return;
    }

    // Direct 1-step advance or switching back
    await onStatusChange(stage);
  };

  const confirmSkipAdvance = async () => {
    if (skipConfirmModal.targetStage) {
      await onStatusChange(skipConfirmModal.targetStage);
      setSkipConfirmModal({ open: false, targetStage: null, skippedStages: [] });
    }
  };

  return (
    <Card className="relative overflow-visible">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <span>Item Lifecycle</span>
            {currentStatus && (
              <span
                className={cn(
                  'text-xs font-normal px-2.5 py-0.5 rounded-full border',
                  getLifecycleColor(currentStatus).badge
                )}
              >
                Current: {LIFECYCLE_STATUS_LABELS[currentStatus]}
              </span>
            )}
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Track hardware & item verification after delivery
          </p>
        </div>

        {/* Menu & History Actions */}
        <div className="flex items-center gap-1.5 relative">
          {events.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-surface-100 rounded-lg transition-colors flex items-center gap-1"
              title="Toggle full history"
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">History ({events.length})</span>
            </button>
          )}

          {isDelivered && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-surface-100 transition-colors"
                title="Jump to stage..."
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-card-lg border border-surface-200 py-1.5 z-30 text-xs text-slate-700 animate-scale-in">
                    <p className="px-3 py-1 font-semibold text-[10px] text-slate-400 uppercase tracking-wider">
                      Quick Jump
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handleStepClick('repaired');
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-surface-100 flex items-center gap-2"
                    >
                      <Wrench className="h-3.5 w-3.5 text-amber-500" />
                      <span>Mark as Repaired</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handleStepClick('retired');
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-surface-100 flex items-center gap-2"
                    >
                      <Archive className="h-3.5 w-3.5 text-slate-500" />
                      <span>Mark as Retired</span>
                    </button>
                    {currentStatus && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          handleStepClick('received');
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-surface-100 text-slate-500 flex items-center gap-2 border-t border-surface-100 mt-1"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Reset to Received</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Undelivered Notice */}
      {!isDelivered && (
        <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
          <Lock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-700">Lifecycle tracking is locked</p>
            <p className="text-slate-500 mt-0.5">
              This item is currently marked as <strong className="capitalize">{orderStatus.replace('_', ' ')}</strong>.
              Lifecycle progression (Received → Tested → In Use → Repaired → Retired) unlocks automatically once the item is marked as <strong>Delivered</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Horizontal Stepper */}
      <div className={cn('py-3 px-1 sm:px-2 overflow-x-auto scrollbar-none', !isDelivered && 'opacity-50 pointer-events-none select-none')}>
        <div className="flex items-center justify-between relative min-w-[320px]">
          {/* Progress Bar background line */}
          <div className="absolute left-6 right-6 top-4 -translate-y-1/2 h-0.5 bg-surface-200 -z-0" />
          
          {/* Progress Bar active line */}
          {currentIdx >= 0 && (
            <div
              className="absolute left-6 top-4 -translate-y-1/2 h-0.5 bg-accent-600 transition-all duration-300 -z-0"
              style={{
                width: `${(currentIdx / (LIFECYCLE_STAGES.length - 1)) * 100 * 0.88}%`,
              }}
            />
          )}

          {LIFECYCLE_STAGES.map((stage, idx) => {
            const isCompleted = currentIdx > idx;
            const isCurrent = currentIdx === idx;
            const isUpcoming = currentIdx < idx;
            const event = eventsByStatus[stage];
            const label = LIFECYCLE_STATUS_LABELS[stage];

            return (
              <div
                key={stage}
                className="flex flex-col items-center group relative cursor-pointer px-1"
                onClick={() => handleStepClick(stage)}
              >
                {/* Node Circle */}
                <div
                  className={cn(
                    'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all duration-200 z-10 bg-white',
                    isCurrent &&
                      'border-accent-600 bg-accent-600 text-white ring-4 ring-accent-100 scale-110 shadow-sm',
                    isCompleted &&
                      'border-accent-600 bg-accent-50 text-accent-700 hover:bg-accent-100',
                    isUpcoming &&
                      'border-surface-300 text-slate-400 hover:border-slate-400 bg-white'
                  )}
                  title={
                    event
                      ? `${label} on ${formatDate(event.changed_at, 'dd MMM yyyy')}`
                      : isDelivered
                      ? `Click to set as ${label}`
                      : label
                  }
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 text-accent-700 stroke-[2.5]" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                {/* Stage Label */}
                <div className="text-center mt-1.5 sm:mt-2">
                  <p
                    className={cn(
                      'text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap',
                      isCurrent ? 'text-accent-700 font-semibold' : 'text-slate-600 group-hover:text-slate-900'
                    )}
                  >
                    {label}
                  </p>

                  {/* Date badge if transition occurred */}
                  {event ? (
                    <span className="text-[10px] text-slate-400 block whitespace-nowrap">
                      {formatDate(event.changed_at, 'dd MMM')}
                    </span>
                  ) : isCurrent ? (
                    <span className="text-[10px] text-accent-600 font-medium block">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-300 block select-none">
                      —
                    </span>
                  )}
                </div>

                {/* Tooltip on Hover */}
                {event && (
                  <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
                    <div className="bg-slate-900 text-white text-[11px] rounded-lg px-2.5 py-1 shadow-card-lg whitespace-nowrap">
                      <p className="font-semibold">{label}</p>
                      <p className="text-slate-300 text-[10px]">
                        {formatDate(event.changed_at, 'dd MMM yyyy, HH:mm')}
                      </p>
                    </div>
                    <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded History Drawer */}
      {showHistory && events.length > 0 && (
        <div className="mt-4 pt-3 border-t border-surface-100 animate-slide-up">
          <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            Lifecycle Audit History
          </p>
          <div className="space-y-2">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-surface-50 rounded-lg border border-surface-100"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      getLifecycleColor(ev.status).dot
                    )}
                  />
                  <span className="font-medium text-slate-800">
                    {LIFECYCLE_STATUS_LABELS[ev.status] || ev.status}
                  </span>
                  {ev.notes && (
                    <span className="text-slate-500 italic">— {ev.notes}</span>
                  )}
                </div>
                <span className="text-slate-400 font-mono text-[11px]">
                  {formatDate(ev.changed_at, 'dd MMM yyyy, HH:mm')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Skip Modal */}
      <ConfirmDialog
        open={skipConfirmModal.open}
        onOpenChange={(open) =>
          setSkipConfirmModal((prev) => ({ ...prev, open }))
        }
        title={`Advance to ${skipConfirmModal.targetStage ? LIFECYCLE_STATUS_LABELS[skipConfirmModal.targetStage] : ''}?`}
        description={`You are skipping the following intermediate stage(s): ${skipConfirmModal.skippedStages.join(', ')}. Do you want to advance directly?`}
        confirmLabel="Advance"
        variant="primary"
        onConfirm={confirmSkipAdvance}
      />
    </Card>
  );
}
