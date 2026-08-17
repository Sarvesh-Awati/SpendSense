import React from 'react';
import { Edit2, Trash2, ShieldAlert, Repeat } from 'lucide-react';
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
          {/*
            Tinted category token, matching the dashboard feed. This used a
            `material-symbols-rounded` <span>, but that font is never loaded,
            so it rendered the raw icon name ("category") as visible text.
          */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `${subscription.category?.color || '#94a3b8'}1f`,
              color: subscription.category?.color || '#94a3b8',
            }}
          >
            <Repeat className="w-5 h-5" aria-hidden="true" />
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
              <span className="text-text-primaryLight dark:text-text-primaryDark text-sm font-medium">
                {subscription.daysUntilRenewal} {subscription.daysUntilRenewal === 1 ? 'day' : 'days'}
              </span>
            ) : (
              <span className="text-text-secondaryLight text-sm font-medium">Paused</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border-light/50 dark:border-border-dark/50">
        {/* Icon-only: named explicitly so they are not unlabelled to a screen reader. */}
        <button
          type="button"
          onClick={() => onEdit(subscription)}
          aria-label={`Edit ${subscription.name}`}
          title={`Edit ${subscription.name}`}
          className="p-2 rounded-control text-text-secondaryLight hover:text-brand-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition-colors"
        >
          <Edit2 className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(subscription)}
          aria-label={`Delete ${subscription.name}`}
          title={`Delete ${subscription.name}`}
          className="p-2 rounded-control text-text-secondaryLight hover:text-finance-expense hover:bg-black/[0.04] dark:hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finance-expense/50 transition-colors"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

    </div>
  );
};

export default SubscriptionCard;
