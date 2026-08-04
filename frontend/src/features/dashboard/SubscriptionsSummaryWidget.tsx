import React from 'react';
import { useDashboardMetrics } from '../../services/dashboard';
import { Repeat, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatCurrency';

export const SubscriptionsSummaryWidget: React.FC = () => {
  const { data: response } = useDashboardMetrics();
  const subsData = response?.data?.subscriptions;
  const { user } = useAuth();
  const preferredCurrency = user?.preferredCurrency || 'USD';

  if (!subsData || subsData.activeCount === 0) return null;

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-card-dark border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark h-full flex flex-col transition-all hover:shadow-lg">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-outfit font-bold text-lg flex items-center gap-2">
          <Repeat className="w-5 h-5 text-brand-primary" />
          Subscriptions
        </h3>
        <span className="text-xs font-bold text-text-secondaryLight dark:text-text-secondaryDark bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
          {subsData.activeCount} Active
        </span>
      </div>

      <div className="mb-5">
        <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark uppercase tracking-widest font-bold mb-1">
          Monthly Cost
        </p>
        <p className="font-outfit text-2xl font-bold text-text-primaryLight dark:text-text-primaryDark">
          {formatCurrency(subsData.monthlyTotal, preferredCurrency)}
        </p>
      </div>

      <div className="flex-grow space-y-4">
        {/* Top Expensive */}
        <div>
          <h4 className="text-xs font-bold text-text-secondaryLight dark:text-text-secondaryDark uppercase tracking-widest mb-3">
            Top Expenses
          </h4>
          <div className="space-y-3">
            {subsData.topExpensive.map((sub: any) => (
              <div key={sub.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center text-[10px]" style={{ backgroundColor: `${sub.category?.color || '#94a3b8'}20`, color: sub.category?.color || '#94a3b8' }}>
                    <span className="material-symbols-rounded text-sm">{sub.category?.icon || 'category'}</span>
                  </div>
                  <span className="text-sm font-semibold line-clamp-1 max-w-[120px]">{sub.name}</span>
                </div>
                <span className="text-sm font-bold">{formatCurrency(sub.monthlyEquivalentCost, sub.currency || preferredCurrency)}<span className="text-[10px] text-text-secondaryLight font-normal">/mo</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Renewals */}
        {subsData.upcomingRenewals.length > 0 && (
          <div className="pt-4 border-t border-border-light dark:border-border-dark">
             <h4 className="text-xs font-bold text-finance-expense uppercase tracking-widest mb-3 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Upcoming (14d)
            </h4>
            <div className="space-y-2">
              {subsData.upcomingRenewals.map((sub: any) => (
                <div key={`renewal-${sub.id}`} className="flex justify-between items-center text-xs">
                  <span className="font-semibold line-clamp-1">{sub.name}</span>
                  <span className="text-text-secondaryLight dark:text-text-secondaryDark">
                    {new Date(sub.nextRenewal).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionsSummaryWidget;
