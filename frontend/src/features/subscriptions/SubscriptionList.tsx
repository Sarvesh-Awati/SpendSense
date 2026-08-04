import React, { useState, useMemo } from 'react';
import { Plus, Repeat, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
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
  
  // Queries & Mutations
  const { data: response, isLoading, isError, refetch } = useSubscriptions();
  const createMutation = useCreateSubscription();
  const updateMutation = useUpdateSubscription();
  const deleteMutation = useDeleteSubscription();

  const subscriptions = response?.data?.subscriptions || [];

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubscriptionRecord | null>(null);

  // Computed totals
  const { activeCount, monthlyTotal } = useMemo(() => {
    const active = subscriptions.filter(s => s.isActive);
    const monthly = active.reduce((acc, s) => acc + s.monthlyEquivalentCost, 0);
    return { activeCount: active.length, monthlyTotal: monthly };
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

  const handleDelete = async (sub: SubscriptionRecord) => {
    const confirmed = window.confirm(`Are you sure you want to delete ${sub.name}?`);
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(sub.id);
      toast('Subscription deleted', 'success');
    } catch (err: any) {
      toast('Failed to delete subscription', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse text-left">
        <div className="h-20 bg-slate-100 dark:bg-[#111622] rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-slate-100 dark:bg-[#111622] rounded-3xl" />)}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-14 h-14 text-finance-expense mb-4" />
        <h2 className="font-outfit font-bold text-xl mb-2">Failed to load Subscriptions</h2>
        <button
          onClick={() => refetch()}
          className="px-5 py-3 bg-brand-primary text-white text-xs font-semibold rounded-xl hover:bg-emerald-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const upcomingRenewals = subscriptions
    .filter(s => s.isActive && s.daysUntilRenewal <= 14)
    .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8">
        <div>
          <h1 className="font-outfit text-3xl font-bold tracking-tight flex items-center gap-2">
            Subscriptions
          </h1>
          <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-1 max-w-lg">
            Track your recurring payments, optimize fixed costs, and never miss a renewal date.
          </p>
        </div>
        
        <div className="flex items-center gap-8 w-full lg:w-auto">
          <div>
            <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mb-1">Monthly Total</p>
            <p className="text-3xl font-outfit font-bold">${monthlyTotal.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mb-1">Active</p>
            <p className="text-3xl font-outfit font-bold">{activeCount}</p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="px-5 py-3 rounded-xl bg-brand-primary text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-600 transition-all flex-shrink-0 ml-4"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden lg:inline">Add new</span>
          </button>
        </div>
      </div>

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
          <div className="text-center py-24 px-4 border border-dashed border-border-light dark:border-border-dark rounded-3xl bg-white dark:bg-card-dark">
            <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-dashed border-border-light dark:border-border-dark flex items-center justify-center mx-auto mb-4">
              <Repeat className="w-6 h-6 text-text-secondaryLight dark:text-text-secondaryDark" />
            </div>
            <h3 className="font-outfit text-xl font-bold mb-2">No Subscriptions Found</h3>
            <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark max-w-sm mx-auto mb-6">
              Start tracking your recurring payments to get insights into your monthly fixed costs.
            </p>
            <button
              onClick={handleOpenCreate}
              className="px-5 py-3 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-emerald-600 transition-all"
            >
              Add Subscription
            </button>
          </div>
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
        onSubmit={handleSubmit}
        initialData={editingSub}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

    </div>
  );
};

export default SubscriptionList;
