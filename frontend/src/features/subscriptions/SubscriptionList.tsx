import React, { useMemo, useRef, useState } from 'react';
import { Plus, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Skeleton, { SkeletonCardGrid } from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { formatCurrency, toFiniteNumber } from '../../utils/formatCurrency';
import { useAuth } from '../../context/AuthContext';
import { 
  useSubscriptions, 
  useCreateSubscription, 
  useUpdateSubscription, 
  useDeleteSubscription,
  SubscriptionRecord 
} from '../../services/subscriptions';
import SubscriptionCard from './SubscriptionCard';
import SubscriptionFormModal from './SubscriptionFormModal';

export const SubscriptionList: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  // Same reporting-currency model as the rest of the app; no local fallback.
  const reportingCurrency = user?.preferredCurrency || 'INR';
  
  // Queries & Mutations
  const { data: response, isLoading, isError, isFetching, refetch } = useSubscriptions();
  const createMutation = useCreateSubscription();
  const updateMutation = useUpdateSubscription();
  const deleteMutation = useDeleteSubscription();

  const subscriptions = response?.data?.subscriptions || [];

  /**
   * The page action, used as the focus target when a dialog closes. When the
   * trigger was the empty-state CTA, that CTA has since unmounted and focus
   * would otherwise drop to <body>. Modal falls back to the original trigger
   * when this one is not mounted.
   */
  const headerActionRef = useRef<HTMLButtonElement>(null);

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubscriptionRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SubscriptionRecord | null>(null);

  /**
   * Monthly total, in the reporting currency.
   *
   * This previously summed `monthlyEquivalentCost` — each row's cost in its
   * OWN currency — and rendered it behind a hardcoded "$". A ₹ and a € row
   * were added together and labelled dollars. `monthlyEquivalentInBase` is the
   * value the API already converts for exactly this purpose; a null means no
   * rate was available, and summing those as zero would understate the total,
   * so the figure is withheld instead.
   */
  const { activeCount, monthlyTotal, totalIsComplete } = useMemo(() => {
    const active = subscriptions.filter((s) => s.isActive);
    const unconvertible = active.some((s) => s.monthlyEquivalentInBase == null);
    const monthly = active.reduce(
      (acc, s) => acc + toFiniteNumber(s.monthlyEquivalentInBase),
      0
    );
    return {
      activeCount: active.length,
      monthlyTotal: monthly,
      totalIsComplete: !unconvertible,
    };
  }, [subscriptions]);

  const handleOpenCreate = () => {
    setEditingSub(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (sub: SubscriptionRecord) => {
    setEditingSub(sub);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingSub(null);
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingSub) {
        await updateMutation.mutateAsync({ id: editingSub.id, data });
        toast('Subscription updated successfully', 'success');
      } else {
        await createMutation.mutateAsync(data);
        toast('Subscription added successfully', 'success');
      }
      handleCloseForm();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Failed to save subscription', 'error');
    }
  };

  /**
   * Opens the confirmation dialog. This was a native `window.confirm`, which
   * could not be styled, trapped focus, or matched the Budget/Goal delete
   * flows. The card's `onDelete` contract is unchanged.
   */
  const handleDelete = (sub: SubscriptionRecord) => {
    setPendingDelete(sub);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;

    try {
      await deleteMutation.mutateAsync(pendingDelete.id);
      toast('Subscription deleted', 'success');
      setPendingDelete(null);
    } catch (err: any) {
      toast('Failed to delete subscription', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 text-left">
        <Skeleton className="h-20" />
        <SkeletonCardGrid count={3} height="h-48" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn’t load your subscriptions"
        description="We couldn’t reach the subscriptions service. Check your connection and try again."
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    );
  }

  const upcomingRenewals = subscriptions
    .filter(s => s.isActive && s.daysUntilRenewal <= 14)
    .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

  // Loading and error return early above, so this is the loaded-and-empty case.
  const isEmpty = subscriptions.length === 0;

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto animate-fade-in">
      
      {/* Shared PageHeader; the stats cluster and CTA ride in its action slot. */}
      <PageHeader
        title="Subscriptions"
        subtitle="Track your recurring payments, optimize fixed costs, and never miss a renewal date."
        divider
        className="mb-8"
        action={
          <div className="flex items-center gap-6 sm:gap-8">
            <div>
            <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mb-1">
              Monthly Total
              <span className="ml-1 font-medium">· {reportingCurrency}</span>
            </p>
            {totalIsComplete ? (
              <p className="text-3xl font-outfit font-bold tnum">
                {formatCurrency(monthlyTotal, reportingCurrency)}
              </p>
            ) : (
              <p
                className="text-3xl font-outfit font-bold text-text-secondaryLight dark:text-text-secondaryDark"
                title="Some subscriptions could not be converted into your reporting currency, so the total would be incomplete."
              >
                —
              </p>
            )}
          </div>
            <div>
              <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mb-1">
                Active
              </p>
              <p className="text-3xl font-outfit font-bold tnum">{activeCount}</p>
            </div>

            {/* Hidden while empty: the empty state below owns the single CTA.
                The label is hidden below lg, so the control is named explicitly. */}
            {!isEmpty && (
              <Button
                ref={headerActionRef}
                icon={Plus}
                onClick={handleOpenCreate}
                aria-label="Add subscription"
                className="shrink-0"
              >
                <span className="hidden lg:inline">Add new</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Upcoming Renewals Alert */}
      {upcomingRenewals.length > 0 && (
        <div className="mb-8 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 flex items-center gap-4">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-xl text-amber-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-500">
              You have <span className="font-bold">{upcomingRenewals.length}</span> subscription{upcomingRenewals.length > 1 ? 's' : ''} renewing soon.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-600 mt-0.5">
              {upcomingRenewals.map(s => s.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div>
        {subscriptions.length === 0 ? (
          // Compact band rather than a 24rem dashed card: an empty page should
          // not reserve the vertical space a populated one needs.
          <EmptyState
            size="inline"
            title="No subscriptions tracked"
            description="Start tracking your recurring payments to get insights into your monthly fixed costs."
            actionLabel="Add subscription"
            onAction={handleOpenCreate}
            className="rounded-panel bg-black/[0.02] dark:bg-white/[0.03] px-6 py-5"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subscriptions.map(sub => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <SubscriptionFormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        returnFocusRef={headerActionRef}
        onSubmit={handleSubmit}
        initialData={editingSub}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Destructive: a stray backdrop click should not dismiss this. */}
      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Confirm Delete Subscription"
        size="sm"
        closeOnBackdrop={false}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPendingDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              loading={deleteMutation.isPending}
            >
              Yes, Delete
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 text-left">
          <span className="w-10 h-10 shrink-0 rounded-control bg-finance-expense/10 text-finance-expense flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark leading-relaxed">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-text-primaryLight dark:text-text-primaryDark">
              {pendingDelete?.name}
            </span>
            ? This stops tracking the recurring payment.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default SubscriptionList;
