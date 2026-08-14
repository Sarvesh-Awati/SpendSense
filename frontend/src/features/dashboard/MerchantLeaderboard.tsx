import React from 'react';
import { Store } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';
import Card, { PanelHead } from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';

interface MerchantLeaderboardProps {
  merchants: Array<{ merchant: string; amount: number }>;
  currency: string;
  onAddTransaction?: () => void;
}

export const MerchantLeaderboard: React.FC<MerchantLeaderboardProps> = ({
  merchants,
  currency,
  onAddTransaction,
}) => {
  const top = merchants.slice(0, 5);

  return (
    <Card tone="bare" tier="secondary" className="h-full flex flex-col">
      <PanelHead label="Top Merchants" />

      {top.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Store}
            title="No merchant data yet"
            description="Add transactions with merchant information to see your top merchants."
            actionLabel="Add Transaction"
            onAction={onAddTransaction}
            size="inline"
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {top.map((m, idx) => (
            <li
              key={`${m.merchant}-${idx}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate text-text-primaryLight dark:text-text-primaryDark">
                {m.merchant}
              </span>
              <span className="font-semibold tnum shrink-0">
                {formatCurrency(m.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default MerchantLeaderboard;
