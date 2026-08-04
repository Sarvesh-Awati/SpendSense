import React from 'react';
import { Clock, Calendar, Edit2, Trash2, ShieldAlert } from 'lucide-react';
import { SubscriptionRecord } from '../../services/subscriptions';
import { formatCurrency } from '../../utils/formatCurrency';

interface SubscriptionCardProps {
  subscription: SubscriptionRecord;
  onEdit: (subscription: SubscriptionRecord) => void;
  onDelete: (subscription: SubscriptionRecord) => void;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({ subscription, onEdit, onDelete }) => {
  const isOverdue = subscription.daysUntilRenewal < 0;
  const isDueSoon = subscription.daysUntilRenewal <= 7 && subscription.daysUntilRenewal >= 0;

  return (
    <div className={`p-6 rounded-3xl transition-all ${
      !subscription.isActive ? 'opacity-60 bg-transparent border border-border-light dark:border-border-dark' :
      'bg-white dark:bg-card-dark border border-border-light/50 dark:border-border-dark/50 hover:shadow-lg dark:hover:shadow-premium-dark'
    }`}>
      
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm" style={{ backgroundColor: `${subscription.category?.color || '#94a3b8'}20`, color: subscription.category?.color || '#94a3b8' }}>
            <span className="material-symbols-rounded">{subscription.category?.icon || 'category'}</span>
          </div>
          <div>
            <h3 className="font-outfit font-bold text-base line-clamp-1">{subscription.name}</h3>
            <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark capitalize">
              {subscription.frequency.toLowerCase()} • {subscription.category?.name || 'Uncategorized'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-outfit font-bold text-xl">{formatCurrency(subscription.amount, subscription.currency)}</p>
          <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
            {formatCurrency(subscription.monthlyEquivalentCost, subscription.currency)}/mo
          </p>
          {!subscription.isActive && (
            <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
              Inactive
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between mt-6">
        <div>
          <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mb-1">
            Next billing
          </p>
          <p className="font-semibold text-sm">
            {new Date(subscription.nextRenewal).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mb-1">
            Status
          </p>
          <div className="flex items-center justify-end gap-1">
            {isOverdue && subscription.isActive ? (
              <span className="text-finance-expense text-sm font-bold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Overdue
              </span>
            ) : isDueSoon && subscription.isActive ? (
              <span className="text-amber-500 text-sm font-bold">Due in {subscription.daysUntilRenewal}d</span>
            ) : subscription.isActive ? (
              <span className="text-text-primaryLight dark:text-text-primaryDark text-sm font-medium">{subscription.daysUntilRenewal} days</span>
            ) : (
              <span className="text-text-secondaryLight text-sm font-medium">Paused</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border-light/50 dark:border-border-dark/50">
        <button
          onClick={() => onEdit(subscription)}
          className="p-2 rounded-xl text-text-secondaryLight hover:text-brand-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(subscription)}
          className="p-2 rounded-xl text-text-secondaryLight hover:text-finance-expense hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};

export default SubscriptionCard;
