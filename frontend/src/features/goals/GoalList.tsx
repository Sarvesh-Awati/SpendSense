import React, { useRef, useState } from 'react';
import {
  useGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useContributeGoal,
  GoalResponse,
} from '../../services/goals';
import GoalCard from './GoalCard';
import GoalForm from './GoalForm';
import GoalContributionModal from './GoalContributionModal';
import { useToast } from '../../components/ui/Toast';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonCardGrid } from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Plus, AlertTriangle } from 'lucide-react';

export const GoalList: React.FC = () => {
  const { toast } = useToast();

  /**
   * The page action, used as the focus target when a dialog closes.
   * When the trigger was the empty-state CTA, that CTA has since unmounted
   * (the list is no longer empty) and focus would otherwise drop to <body>.
   * Modal falls back to the original trigger when this one is not mounted.
   */
  const headerActionRef = useRef<HTMLButtonElement>(null);

  // Modals status overrides
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEdit, setSelectedEdit] = useState<GoalResponse | null>(null);
  const [selectedDelete, setSelectedDelete] = useState<GoalResponse | null>(null);
  const [selectedContribute, setSelectedContribute] = useState<GoalResponse | null>(null);

  // API Queries
  const { data: response, isLoading, isError, isFetching, refetch } = useGoals();
  const goals = response?.data?.goals || [];

  // Mutations
  const createMutation = useCreateGoal();
  const updateMutation = useUpdateGoal();
  const deleteMutation = useDeleteMutation();
  const contributeMutation = useContributeGoal();

  const handleCreateSubmit = (values: any) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        toast('Savings Goal configured successfully!', 'success');
        setIsCreateOpen(false);
      },
      onError: (err: any) => {
        toast(err.response?.data?.message || 'Failed to setup savings goal', 'error');
      },
    });
  };

  const handleEditSubmit = (values: any) => {
    if (!selectedEdit) return;
    updateMutation.mutate(
      { id: selectedEdit.id, data: values },
      {
        onSuccess: () => {
          toast('Goal modified successfully!', 'success');
          setSelectedEdit(null);
        },
        onError: (err: any) => {
          toast(err.response?.data?.message || 'Failed to update goal', 'error');
        },
      }
    );
  };

  const handleDeleteConfirm = () => {
    if (!selectedDelete) return;
    deleteMutation.mutate(selectedDelete.id, {
      onSuccess: () => {
        toast('Savings Goal permanently deleted.', 'success');
        setSelectedDelete(null);
      },
      onError: (err: any) => {
        toast(err.response?.data?.message || 'Failed to delete goal', 'error');
      },
    });
  };

  const handleContributeSubmit = (values: any) => {
    if (!selectedContribute) return;
    contributeMutation.mutate(
      { id: selectedContribute.id, amount: Number(values.amount) },
      {
        onSuccess: () => {
          toast('Contribution logged successfully!', 'success');
          setSelectedContribute(null);
        },
        onError: (err: any) => {
          toast(err.response?.data?.message || 'Failed to log contribution', 'error');
        },
      }
    );
  };

  // With nothing to show, the empty state owns the single call to action —
  // the header button beside it was a second, competing CTA for the same task.
  const isEmpty = !isLoading && !isError && goals.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Savings Goals"
        subtitle="Build financial security milestones and track projected completion velocity."
        divider
        action={
          isEmpty ? undefined : (
            <Button ref={headerActionRef} icon={Plus} onClick={() => setIsCreateOpen(true)}>
              Setup Goal
            </Button>
          )
        }
      />

      {/* Grid Dashboard list */}
      {isLoading ? (
        <SkeletonCardGrid count={3} height="h-56" />
      ) : isError ? (
        <ErrorState
          title="Couldn’t load your savings goals"
          description="We couldn’t reach the goals service. Check your connection and try again."
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : goals.length === 0 ? (
        // Compact band rather than a 20rem dashed card: an empty page should
        // not reserve the vertical space a populated one needs.
        <EmptyState
          size="inline"
          title="No savings goals created"
          description="Configure savings goals to stay motivated and track your milestones."
          actionLabel="Configure savings target"
          onAction={() => setIsCreateOpen(true)}
          className="rounded-panel bg-black/[0.02] dark:bg-white/[0.03] px-6 py-5 animate-fade-in"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onEdit={setSelectedEdit}
              onDelete={setSelectedDelete}
              onContribute={setSelectedContribute}
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
        title="Setup Savings Milestone"
        size="md"
      >
        <GoalForm
          onSubmit={handleCreateSubmit}
          onCancel={() => setIsCreateOpen(false)}
          isPending={createMutation.isPending}
        />
      </Modal>

      <Modal
        open={!!selectedEdit}
        onClose={() => setSelectedEdit(null)}
        title="Modify savings Target"
        size="md"
      >
        {selectedEdit && (
          <GoalForm
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
        title="Confirm Delete Savings Goal"
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
            Are you sure you want to permanently delete this savings goal milestone?
          </p>
        </div>
      </Modal>

      <Modal
        open={!!selectedContribute}
        onClose={() => setSelectedContribute(null)}
        title={
          selectedContribute ? `Save Funds: ${selectedContribute.name}` : 'Save Funds'
        }
        size="md"
      >
        {selectedContribute && (
          <GoalContributionModal
            currency={selectedContribute.currency}
            onSubmit={handleContributeSubmit}
            onCancel={() => setSelectedContribute(null)}
            isPending={contributeMutation.isPending}
          />
        )}
      </Modal>
    </div>
  );
};

function useDeleteMutation() {
  return useDeleteGoal();
}
export default GoalList;
