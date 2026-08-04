import React from 'react';
import { Sparkles } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';

interface MerchantLeaderboardProps {
  merchants: Array<{
    merchant: string;
    amount: number;
  }>;
  currency: string;
}

export const MerchantLeaderboard: React.FC<MerchantLeaderboardProps> = ({ merchants, currency }) => {
  const formatCurrencyLocal = (val: number) => {
    return formatCurrency(val, currency);
  };

  const highestAmount = merchants.length > 0 ? merchants[0].amount : 1;

  return (
    <div className="bg-white dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark text-left flex flex-col justify-between space-y-4 h-full">
      <div>
        <h3 className="font-outfit text-base font-bold tracking-tight">Top Merchants</h3>
        <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
          Merchants where you spent the most this month
        </p>
      </div>

      <div className="space-y-4 flex-grow flex flex-col justify-center">
        {merchants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-text-secondaryLight dark:text-text-secondaryDark">
            <Sparkles className="w-8 h-8 text-slate-500 mb-2 opacity-50" />
            <p className="italic">No merchant spending logged this month.</p>
          </div>
        ) : (
          merchants.slice(0, 5).map((m, idx) => {
            // Compute percentage relative to highest merchant amount to scale progress bar beautifully
            const scaleWidth = (m.amount / highestAmount) * 100;
            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-lg bg-slate-100 dark:bg-[#111622] text-[10px] font-bold text-text-secondaryLight dark:text-text-secondaryDark flex items-center justify-center border border-border-light dark:border-border-dark">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-text-primaryLight dark:text-text-primaryDark truncate max-w-[150px]">
                      {m.merchant}
                    </span>
                  </span>
                  <span className="font-bold text-text-primaryLight dark:text-text-primaryDark">
                    {formatCurrencyLocal(m.amount)}
                  </span>
                </div>
                
                {/* Custom Progress Bar */}
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#111622] border border-border-light/40 dark:border-border-dark/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-secondary to-brand-primary transition-all duration-500"
                    style={{ width: `${scaleWidth}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default MerchantLeaderboard;
