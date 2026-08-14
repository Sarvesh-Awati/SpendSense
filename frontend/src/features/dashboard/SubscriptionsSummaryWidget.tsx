import React from 'react';
import { ShieldAlert, Repeat } from 'lucide-react';
import { useDashboardMetrics } from '../../services/dashboard';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatCurrency';
import Card, { PanelHead } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';

export const SubscriptionsSummaryWidget: React.FC = () => {
  const { data: response } = useDashboardMetrics();
  const subsData = response?.data?.subscriptions;
  const { user } = useAuth();
  const preferredCurrency = user?.preferredCurrency || 'USD';

  // The secondary row reserves four slots, so this module always renders — an
  // absent fourth column left the row visibly unbalanced. Empty state is quiet
  // and matches the other secondary modules.
  const isEmpty = !subsData || subsData.activeCount === 0;

  if (isEmpty) {
    return (
      <Card tone="bare" tier="secondary" className="flex flex-col">
        <PanelHead label="Subscriptions" />
        <div className="mt-4">
          <EmptyState
            icon={Repeat}
            title="No active subscriptions"
            description="Track recurring payments in one place."
            to="/subscriptions"
            actionLabel="Add a subscription"
            size="inline"
          />
        </div>
      </Card>
    );
  }

  return (
    <Card tone="bare" tier="secondary" className="h-full flex flex-col">
      <PanelHead
        label="Subscriptions"
        action={
          <span className="text-[11px] font-medium text-text-secondaryLight dark:text-text-secondaryDark whitespace-nowrap">
            {subsData!.activeCount} active
          </span>
        }
      />

      <div className="mt-3">
        <p className="font-outfit text-2xl font-bold tracking-tight tnum">
          {formatCurrency(subsData!.monthlyTotal, preferredCurrency)}
        </p>
        <p className="text-[11px] text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
          per month
        </p>
      </div>

      <div className="flex-grow mt-4 space-y-4">
        {subsData!.topExpensive.length > 0 && (
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-secondaryLight dark:text-text-secondaryDark mb-2.5">
              Top expenses
            </h4>
            <ul className="space-y-2.5">
              {subsData!.topExpensive.map((sub: any) => (
                <li key={sub.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 min-w-0">
                    {/* Category colour dot — the previous icon font was never loaded */}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: sub.category?.color || '#94a3b8' }}
                    />
                    <span className="font-semibold truncate text-text-primaryLight dark:text-text-primaryDark">
                      {sub.name}
                    </span>
                  </span>
                  <span className="font-bold tnum shrink-0 whitespace-nowrap">
                    {formatCurrency(sub.monthlyEquivalentCost, sub.currency || preferredCurrency)}
                    <span className="text-[10px] font-normal text-text-secondaryLight dark:text-text-secondaryDark">
                      /mo
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {subsData!.upcomingRenewals.length > 0 && (
          <div className="pt-3.5 border-t border-border-light dark:border-border-dark">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.08em] text-finance-debt mb-2.5 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" aria-hidden="true" /> Renewing within 14 days
            </h4>
            <ul className="space-y-2">
              {subsData!.upcomingRenewals.map((sub: any) => (
                <li
                  key={`renewal-${sub.id}`}
                  className="flex justify-between items-center gap-3 text-xs"
                >
                  <span className="font-semibold truncate text-text-primaryLight dark:text-text-primaryDark">
                    {sub.name}
                  </span>
                  <span className="text-text-secondaryLight dark:text-text-secondaryDark tnum shrink-0">
                    {new Date(sub.nextRenewal).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
};

export default SubscriptionsSummaryWidget;
