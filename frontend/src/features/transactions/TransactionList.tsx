import React, { useState } from 'react';
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useCategories,
} from '../../services/transactions';
import TransactionTable from './TransactionTable';
import TransactionCard from './TransactionCard';
import TransactionForm from './TransactionForm';
import TransactionDetails from './TransactionDetails';
import { useToast } from '../../components/ui/Toast';
import {
  Search,
  Filter,
  Plus,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Tag,
  AlertTriangle,
  Loader2,
  Calendar,
  X,
  CreditCard,
} from 'lucide-react';

export const TransactionList: React.FC = () => {
  const { toast } = useToast();

  // Filters State
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Pagination & Sorting State
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals management
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [selectedEdit, setSelectedEdit] = useState<any | null>(null);
  const [selectedDelete, setSelectedDelete] = useState<any | null>(null);

  // Queries
  const filters = {
    page,
    limit,
    sortBy,
    sortOrder,
    ...(search && { search }),
    ...(categoryId && { categoryId }),
    ...(type && { type }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  };

  const { data: response, isLoading: listLoading, isError } = useTransactions(filters);
  const { data: categoriesResponse } = useCategories();
  const transactions = response?.data?.transactions || [];
  const pagination = response?.data?.pagination || { total: 0, pages: 1 };
  const categories = categoriesResponse?.data?.categories || [];

  // Mutations
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  // Sort Toggle Handler
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // CRUD Actions
  const handleCreateSubmit = (values: any) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        toast('Transaction logged successfully!', 'success');
        setIsCreateOpen(false);
      },
      onError: (err: any) => {
        toast(err.response?.data?.message || 'Failed to log transaction', 'error');
      },
    });
  };

  const handleEditSubmit = (values: any) => {
    updateMutation.mutate(
      { id: selectedEdit.id, data: values },
      {
        onSuccess: () => {
          toast('Transaction updated successfully!', 'success');
          setSelectedEdit(null);
        },
        onError: (err: any) => {
          toast(err.response?.data?.message || 'Failed to update transaction', 'error');
        },
      }
    );
  };

  const handleDeleteConfirm = () => {
    if (!selectedDelete) return;
    deleteMutation.mutate(selectedDelete.id, {
      onSuccess: () => {
        toast('Transaction permanently deleted.', 'success');
        setSelectedDelete(null);
      },
      onError: (err: any) => {
        toast(err.response?.data?.message || 'Failed to delete transaction', 'error');
      },
    });
  };

  const clearFilters = () => {
    setSearch('');
    setCategoryId('');
    setType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Control */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-light dark:border-border-dark pb-6">
        <div>
          <h1 className="font-outfit text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-1">
            Track, filter, and audit your cash inflow and outflow transactions.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-emerald-600 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Transaction
        </button>
      </div>

      {/* Filter panel card */}
      <div className="bg-white dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark space-y-4">
        {/* Search & Mode Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search bar */}
          <div className="relative md:col-span-2">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <Search className="w-4.5 h-4.5" />
            </div>
            <input
              type="text"
              placeholder="Search by merchant or description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all"
            />
          </div>

          {/* Type Segment Filter */}
          <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-50 dark:bg-[#111622] border border-border-light dark:border-border-dark">
            <button
              onClick={() => { setType(''); setPage(1); }}
              className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                type === ''
                  ? 'bg-white dark:bg-card-dark text-text-primaryLight dark:text-text-primaryDark shadow-sm border border-border-light dark:border-border-dark'
                  : 'text-text-secondaryLight dark:text-text-secondaryDark hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => { setType('EXPENSE'); setPage(1); }}
              className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                type === 'EXPENSE'
                  ? 'bg-white dark:bg-card-dark text-text-primaryLight dark:text-text-primaryDark shadow-sm border border-border-light dark:border-border-dark'
                  : 'text-text-secondaryLight dark:text-text-secondaryDark hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
              }`}
            >
              Expense
            </button>
            <button
              onClick={() => { setType('INCOME'); setPage(1); }}
              className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                type === 'INCOME'
                  ? 'bg-white dark:bg-card-dark text-text-primaryLight dark:text-text-primaryDark shadow-sm border border-border-light dark:border-border-dark'
                  : 'text-text-secondaryLight dark:text-text-secondaryDark hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
              }`}
            >
              Income
            </button>
          </div>
        </div>

        {/* Dropdowns panel: Categories & Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-border-light/40 dark:border-border-dark/40">
          {/* Category Dropdown */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <Tag className="w-4 h-4" />
            </div>
            <select
              value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-xs focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all appearance-none"
            >
              <option value="">All Categories</option>
              {categories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.type})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-xs focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all text-text-secondaryLight dark:text-text-secondaryDark"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-xs focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all text-text-secondaryLight dark:text-text-secondaryDark"
            />
          </div>

          {/* Clear Filters Button */}
          <button
            onClick={clearFilters}
            className="w-full py-2 px-3 rounded-xl border border-border-light dark:border-border-dark text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#111622] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Clear Filters
          </button>
        </div>
      </div>

      {/* Ledger listing container */}
      <div className="bg-white dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark relative min-h-[300px]">
        {listLoading ? (
          // Skeletons list
          <div className="space-y-4 py-4 animate-pulse">
            <div className="h-6 bg-slate-100 dark:bg-[#111622] rounded-lg w-full" />
            <div className="h-12 bg-slate-100 dark:bg-[#111622] rounded-xl w-full" />
            <div className="h-12 bg-slate-100 dark:bg-[#111622] rounded-xl w-full" />
            <div className="h-12 bg-slate-100 dark:bg-[#111622] rounded-xl w-full" />
          </div>
        ) : isError ? (
          // Error State
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="w-12 h-12 text-finance-expense mb-3" />
            <h3 className="font-outfit font-bold text-lg mb-1">Failed to fetch transactions</h3>
            <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark max-w-sm">
              An error occurred while connecting to our ledger server. Please try refreshing.
            </p>
          </div>
        ) : transactions.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-[#111622] flex items-center justify-center text-text-secondaryLight dark:text-text-secondaryDark mb-4 border border-dashed border-border-light dark:border-border-dark">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-outfit font-bold text-lg mb-1 text-text-primaryLight dark:text-text-primaryDark">No transactions found</h3>
            <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark max-w-sm">
              Try adjusting your query filter conditions or create a new transaction entry.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-6 flex items-center gap-1 px-4 py-3 rounded-xl border border-brand-primary/20 bg-brand-primary/5 text-brand-primary text-xs font-semibold hover:bg-brand-primary/10 transition-colors"
            >
              Log your first transaction
            </button>
          </div>
        ) : (
          // Data List
          <div className="space-y-6">
            {/* Desktop Table View */}
            <TransactionTable
              transactions={transactions}
              onViewDetails={setSelectedDetails}
              onEdit={setSelectedEdit}
              onDelete={setSelectedDelete}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            />

            {/* Mobile Card list */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {transactions.map((tx: any) => (
                <TransactionCard
                  key={tx.id}
                  tx={tx}
                  onViewDetails={setSelectedDetails}
                  onEdit={setSelectedEdit}
                  onDelete={setSelectedDelete}
                />
              ))}
            </div>

            {/* Pagination Controls Footer */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-border-light dark:border-border-dark pt-5 text-sm">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3.5 py-2 rounded-xl border border-border-light dark:border-border-dark text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#111622] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <span className="text-xs font-medium text-text-secondaryLight dark:text-text-secondaryDark">
                  Page <strong>{page}</strong> of <strong>{pagination.pages}</strong>
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, pagination.pages))}
                  disabled={page === pagination.pages}
                  className="flex items-center gap-1 px-3.5 py-2 rounded-xl border border-border-light dark:border-border-dark text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#111622] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  Next <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* MODALS RENDER OVERLAYS */}
      {/* ========================================== */}

      {/* Create Transaction Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCreateOpen(false)} />
          <div className="bg-white dark:bg-card-dark p-8 rounded-3xl border border-border-light dark:border-border-dark shadow-premium-dark w-full max-w-lg relative animate-slide-up pointer-events-auto">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#111622] text-text-secondaryLight"
            >
              <X className="w-4.5 h-4.5" />
            </button>
            <h2 className="font-outfit text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-brand-primary" /> Log New Transaction
            </h2>
            <TransactionForm
              onSubmit={handleCreateSubmit}
              onCancel={() => setIsCreateOpen(false)}
              isPending={createMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {selectedEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedEdit(null)} />
          <div className="bg-white dark:bg-card-dark p-8 rounded-3xl border border-border-light dark:border-border-dark shadow-premium-dark w-full max-w-lg relative animate-slide-up pointer-events-auto">
            <button
              onClick={() => setSelectedEdit(null)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#111622] text-text-secondaryLight"
            >
              <X className="w-4.5 h-4.5" />
            </button>
            <h2 className="font-outfit text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-secondary" /> Modify Transaction
            </h2>
            <TransactionForm
              initialData={selectedEdit}
              onSubmit={handleEditSubmit}
              onCancel={() => setSelectedEdit(null)}
              isPending={updateMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {selectedDetails && (
        <TransactionDetails
          transaction={selectedDetails}
          onClose={() => setSelectedDetails(null)}
        />
      )}

      {/* Delete Confirmation Alert Modal */}
      {selectedDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedDelete(null)} />
          <div className="bg-white dark:bg-card-dark p-7 rounded-3xl border border-border-light dark:border-border-dark shadow-premium-dark w-full max-w-sm relative animate-slide-up pointer-events-auto text-left">
            <div className="w-12 h-12 rounded-2xl bg-finance-expense/10 text-finance-expense flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-outfit font-bold text-lg">Confirm Delete Transaction</h3>
            <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-2 leading-relaxed">
              Are you sure you want to permanently delete this transaction? This action is irreversible.
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
export default TransactionList;
