import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import Card, { SectionLabel } from '../../components/ui/Card';

interface InsightCardProps {
  /** `quickInsights` exactly as returned by the API. Never synthesised. */
  insights: string[];
  onAddTransaction?: () => void;
}

/**
 * SpendSense Insight.
 *
 * Sized to its content rather than stretched to fill its grid cell — an empty
 * insight panel should be a small, deliberate module, not a large blank
 * rectangle. Content is always backend-generated; nothing here is invented.
 */
export const InsightCard: React.FC<InsightCardProps> = ({ insights, onAddTransaction }) => {
  const [lead, ...rest] = insights;

  return (
    <Card tone="bare" tier="secondary">
      <div className="flex items-start gap-5">
        {/* Icon token anchors the module and gives it identity at small size */}
        <span className="w-11 h-11 rounded-2xl bg-brand-secondary/12 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-brand-secondary" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <SectionLabel>SpendSense Insight</SectionLabel>

          {lead ? (
            <>
              <p className="font-outfit text-lg sm:text-xl leading-snug font-semibold tracking-tight mt-2.5">
                {lead}
              </p>

              {rest.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {rest.map((insight) => (
                    <li
                      key={insight}
                      className="text-[13px] leading-relaxed text-text-secondaryLight dark:text-text-secondaryDark flex gap-2"
                    >
                      <span
                        className="mt-[7px] w-1 h-1 rounded-full bg-brand-secondary/60 shrink-0"
                        aria-hidden="true"
                      />
                      {insight}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <p className="font-outfit text-lg sm:text-xl leading-snug font-semibold tracking-tight mt-2.5 max-w-[38ch]">
                Add a few transactions to unlock personalised insights.
              </p>
              <p className="text-[13px] text-text-secondaryLight dark:text-text-secondaryDark mt-2 leading-relaxed max-w-[46ch]">
                SpendSense will analyse your spending patterns once enough history is available.
              </p>

              <button
                type="button"
                onClick={onAddTransaction}
                className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-primary hover:gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 rounded transition-all"
              >
                Add Transaction
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

export default InsightCard;
