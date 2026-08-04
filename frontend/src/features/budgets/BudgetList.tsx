import React, { useState } from 'react';
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
import {
  Plus,
  AlertTriangle,
  Loader2,
  Sparkles,
  PieChart as ChartIcon,
  X,
  PiggyBank,
} from 'lucide-react';

export const BudgetList: React.FC = () => {
  const { toast } = useToast();

  // Modals management
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEdit, setSelectedEdit] = useState<BudgetStatsResponse | null>(null);
  const [selectedDelete, setSelectedDelete] = useState<BudgetStatsResponse | null>(null);

  // Queries
  const { data: response, isLoading, isError, refetch } = useBudgets();
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-light dark:border-border-dark pb-6">
        <div>
          <h1 className="font-outfit text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-1">
            Allocate monthly spending caps globally or across specific categories.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-emerald-600 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Setup Budget
        </button>
      </div>

      {/* Main Budgets Grid */}
      {isLoading ? (
        // Skeleton grid loaders
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark h-48" />
          ))}
        </div>
      ) : isError ? (
        // Error state
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="w-12 h-12 text-finance-expense mb-3" />
          <h3 className="font-outfit font-bold text-lg mb-1">Failed to fetch budgets</h3>
          <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark max-w-sm mb-4">
            An error occurred while connecting to our budget server.
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-brand-primary text-white text-xs font-semibold rounded-xl"
          >
            Retry
          </button>
        </div>
      ) : budgets.length === 0 ? (
        // Empty State
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in border border-dashed border-border-light dark:border-border-dark rounded-3xl bg-white dark:bg-card-dark">
          <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#111622] flex items-center justify-center text-text-secondaryLight dark:text-text-secondaryDark mb-4 border border-dashed border-border-light dark:border-border-dark">
            <PiggyBank className="w-6 h-6" />
          </div>
          <h3 className="font-outfit font-bold text-lg mb-1">No budgets configured</h3>
          <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark max-w-sm">
            Control your expenses by setting spending limits. Add a monthly overall or category cap.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="mt-6 flex items-center gap-1 px-4 py-3 rounded-xl border border-brand-primary/20 bg-brand-primary/5 text-brand-primary text-xs font-semibold hover:bg-brand-primary/10 transition-colors"
          >
            Create your first budget
          </button>
        </div>
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

      {/* ========================================== */}
      {/* MODALS RENDER OVERLAYS */}
      {/* ========================================== */}

      {/* Create Budget Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCreateOpen(false)} />
          <div className="bg-white dark:bg-card-dark p-8 rounded-3xl border border-border-light dark:border-border-dark shadow-premium-dark w-full max-w-md relative animate-slide-up pointer-events-auto">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#111622] text-text-secondaryLight"
            >
              <X className="w-4.5 h-4.5" />
            </button>
            <h2 className="font-outfit text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-primary" /> Setup Budget limit
            </h2>
            <BudgetForm
              onSubmit={handleCreateSubmit}
              onCancel={() => setIsCreateOpen(false)}
              isPending={createMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Edit Budget Modal */}
      {selectedEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedEdit(null)} />
          <div className="bg-white dark:bg-card-dark p-8 rounded-3xl border border-border-light dark:border-border-dark shadow-premium-dark w-full max-w-md relative animate-slide-up pointer-events-auto">
            <button
              onClick={() => setSelectedEdit(null)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#111622] text-text-secondaryLight"
            >
              <X className="w-4.5 h-4.5" />
            </button>
            <h2 className="font-outfit text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
              <ChartIcon className="w-5 h-5 text-brand-secondary" /> Modify Budget
            </h2>
            <BudgetForm
              initialData={selectedEdit}
              onSubmit={handleEditSubmit}
              onCancel={() => setSelectedEdit(null)}
              isPending={updateMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert Modal */}
      {selectedDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedDelete(null)} />
          <div className="bg-white dark:bg-card-dark p-7 rounded-3xl border border-border-light dark:border-border-dark shadow-premium-dark w-full max-w-sm relative animate-slide-up pointer-events-auto text-left">
            <div className="w-12 h-12 rounded-2xl bg-finance-expense/10 text-finance-expense flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-outfit font-bold text-lg">Confirm Delete Budget</h3>
            <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-2 leading-relaxed">
              Are you sure you want to permanently delete this budget cap? Your transaction histories will not be affected.
            </p>
            <div className="flex justify-end gap-3 mt-6 border-t border-border-light/40 dark:border-border-dark/40 pt-4">
              <button
                onClick={() => setSelectedDelete(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-xl border border-border-light dark:border-border-dark text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#111622] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-xl bg-finance-expense text-white text-xs font-semibold flex items-center gap-1 shadow hover:bg-rose-600 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending && <Loader2 className="w-3 animate-spin" />}
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Quick fix for useDeleteBudget mutation call structure
function useDeleteMutation() {
  return useDeleteBudget();
}
export default BudgetList;
