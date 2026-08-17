import React, { useRef, useState } from 'react';
import {
  useBudgets,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  BudgetStatsResponse,
} from '../../services/budgets';
import BudgetProgress from './BudgetProgress';
import BudgetForm from './BudgetForm';
import { useToast } from '../../components/ui/Toast';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonCardGrid } from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Plus, AlertTriangle } from 'lucide-react';

export const BudgetList: React.FC = () => {
  const { toast } = useToast();

  /**
   * The page action, used as the focus target when a dialog closes.
   * When the trigger was the empty-state CTA, that CTA has since unmounted
   * (the list is no longer empty) and focus would otherwise drop to <body>.
   * Modal falls back to the original trigger when this one is not mounted.
   */
  const headerActionRef = useRef<HTMLButtonElement>(null);

  // Modals management
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEdit, setSelectedEdit] = useState<BudgetStatsResponse | null>(null);
  const [selectedDelete, setSelectedDelete] = useState<BudgetStatsResponse | null>(null);

  // Queries
  const { data: response, isLoading, isError, isFetching, refetch } = useBudgets();
  const budgets = response?.data?.budgets || [];

  // Mutations
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const deleteMutation = useDeleteMutation();

  const handleCreateSubmit = (values: any) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        toast('Budget created successfully!', 'success');
        setIsCreateOpen(false);
      },
      onError: (err: any) => {
        toast(err.response?.data?.message || 'Failed to create budget', 'error');
      },
    });
  };

  const handleEditSubmit = (values: any) => {
    if (!selectedEdit) return;
    updateMutation.mutate(
      { id: selectedEdit.id, data: values },
      {
        onSuccess: () => {
          toast('Budget updated successfully!', 'success');
          setSelectedEdit(null);
        },
        onError: (err: any) => {
          toast(err.response?.data?.message || 'Failed to update budget', 'error');
        },
      }
    );
  };

  const handleDeleteConfirm = () => {
    if (!selectedDelete) return;
    deleteMutation.mutate(selectedDelete.id, {
      onSuccess: () => {
        toast('Budget permanently deleted.', 'success');
        setSelectedDelete(null);
      },
      onError: (err: any) => {
        toast(err.response?.data?.message || 'Failed to delete budget', 'error');
      },
    });
  };

  // With nothing to show, the empty state owns the single call to action —
  // the header button beside it was a second, competing CTA for the same task.
  const isEmpty = !isLoading && !isError && budgets.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        subtitle="Allocate monthly spending caps globally or across specific categories."
        divider
        action={
          isEmpty ? undefined : (
            <Button ref={headerActionRef} icon={Plus} onClick={() => setIsCreateOpen(true)}>
              Setup Budget
            </Button>
          )
        }
      />

      {/* Main Budgets Grid */}
      {isLoading ? (
        <SkeletonCardGrid count={3} height="h-48" />
      ) : isError ? (
        <ErrorState
          title="Couldn’t load your budgets"
          description="We couldn’t reach the budgets service. Check your connection and try again."
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : budgets.length === 0 ? (
        // Compact band rather than a 20rem dashed card: an empty page should
        // not reserve the vertical space a populated one needs.
        <EmptyState
          size="inline"
          title="No budgets configured"
          description="Control your expenses by setting spending limits. Add a monthly overall or category cap."
          actionLabel="Create your first budget"
          onAction={() => setIsCreateOpen(true)}
          className="rounded-panel bg-black/[0.02] dark:bg-white/[0.03] px-6 py-5 animate-fade-in"
        />
      ) : (
        // Budgets Cards Grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map((b) => (
            <BudgetProgress
              key={b.id}
              budget={b}
              onEdit={setSelectedEdit}
              onDelete={setSelectedDelete}
            />
          ))}
        </div>
      )}

      {/*
        Dialogs. The shared Modal owns the overlay, focus trap, Escape,
        focus restoration, body scroll lock and the close button; the forms
        and their handlers below are unchanged.
      */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        returnFocusRef={headerActionRef}
        title="Setup Budget limit"
        size="md"
      >
        <BudgetForm
          onSubmit={handleCreateSubmit}
          onCancel={() => setIsCreateOpen(false)}
          isPending={createMutation.isPending}
        />
      </Modal>

      <Modal
        open={!!selectedEdit}
        onClose={() => setSelectedEdit(null)}
        title="Modify Budget"
        size="md"
      >
        {selectedEdit && (
          <BudgetForm
            initialData={selectedEdit}
            onSubmit={handleEditSubmit}
            onCancel={() => setSelectedEdit(null)}
            isPending={updateMutation.isPending}
          />
        )}
      </Modal>

      {/* Destructive: a stray backdrop click should not dismiss this. */}
      <Modal
        open={!!selectedDelete}
        onClose={() => setSelectedDelete(null)}
        title="Confirm Delete Budget"
        size="sm"
        closeOnBackdrop={false}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setSelectedDelete(null)}
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
            Are you sure you want to permanently delete this budget cap? Your transaction
            histories will not be affected.
          </p>
        </div>
      </Modal>
    </div>
  );
};

// Quick fix for useDeleteBudget mutation call structure
function useDeleteMutation() {
  return useDeleteBudget();
}
export default BudgetList;
