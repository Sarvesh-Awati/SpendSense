import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';

/**
 * Failure state for a page or a section.
 *
 * Deliberately distinct from `EmptyState`: "nothing here yet" and "we could not
 * load this" are different situations and must not look the same. This one owns
 * the warning colour and the retry affordance; `EmptyState` owns the create CTA.
 *
 * Kept as compact as the empty states — a failed fetch should not reserve more
 * vertical space than a populated view.
 */
interface ErrorStateProps {
  title: string;
  description?: string;
  /** Retry handler. Omit when there is nothing sensible to retry. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Shows a spinner on the retry button while a refetch is in flight. */
  retrying?: boolean;
  /** `inline` sits under a page header; `page` centres for a whole-page failure. */
  size?: 'inline' | 'page';
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  description,
  onRetry,
  retryLabel = 'Retry',
  retrying = false,
  size = 'inline',
  className = '',
}) => {
  const isPage = size === 'page';

  return (
    <div
      role="alert"
      className={[
        isPage
          ? 'flex flex-col items-center justify-center py-24 text-center'
          : 'flex flex-col items-start text-left rounded-panel bg-finance-expense/[0.04] border border-finance-expense/15 px-6 py-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={`${
          isPage ? 'w-11 h-11 mb-4' : 'w-9 h-9 mb-3'
        } rounded-full bg-finance-expense/10 text-finance-expense flex items-center justify-center shrink-0`}
      >
        <AlertTriangle className={isPage ? 'w-5 h-5' : 'w-4 h-4'} aria-hidden="true" />
      </span>

      <p
        className={`font-semibold text-text-primaryLight dark:text-text-primaryDark ${
          isPage ? 'font-outfit text-xl' : 'text-sm'
        }`}
      >
        {title}
      </p>

      {description && (
        <p
          className={`text-xs mt-1 leading-relaxed text-text-secondaryLight dark:text-text-secondaryDark ${
            isPage ? 'max-w-sm' : 'max-w-[60ch]'
          }`}
        >
          {description}
        </p>
      )}

      {onRetry && (
        <Button
          size="sm"
          variant="secondary"
          onClick={onRetry}
          loading={retrying}
          className="mt-4"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
