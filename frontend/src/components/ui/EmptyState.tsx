import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Compact, consistent empty state used across the dashboard and feature pages.
 *
 * Deliberately small: an empty panel should not occupy the same vertical space
 * as a populated one. Icon, one-line title, one-line explanation, at most one
 * call to action — and the CTA only ever points at a route that already exists.
 */
interface EmptyStateProps {
  /** Optional: `inline` and dense contexts often read better without one. */
  icon?: React.ElementType;
  title: string;
  description?: string;
  /** Internal route for the CTA. Use either `to` or `onAction`, not both. */
  to?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** `compact` for sidebar widgets, `default` for full-width panels. */
  size?: 'compact' | 'default' | 'inline';
  /** Optional lower-emphasis action rendered beside the primary CTA. */
  secondaryLabel?: string;
  secondaryTo?: string;
  onSecondary?: () => void;
  /** Set when rendered on the warm paper surface, which inverts text colour. */
  onPaper?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  to,
  actionLabel,
  onAction,
  secondaryLabel,
  secondaryTo,
  onSecondary,
  size = 'default',
  onPaper = false,
  className = '',
}) => {
  const isInline = size === 'inline';
  const isCompact = size === 'compact';

  const actionClasses =
    'inline-flex items-center gap-1.5 mt-3.5 px-3.5 py-2 rounded-full text-xs font-semibold ' +
    'bg-brand-primary/12 text-brand-primary ' +
    'hover:bg-brand-primary/20 focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-brand-primary/50 transition-colors';

  const secondaryClasses =
    'inline-flex items-center gap-1.5 mt-3.5 px-3.5 py-2 rounded-control text-xs font-semibold ' +
    'text-text-secondaryLight dark:text-text-secondaryDark ' +
    'hover:bg-black/[0.04] dark:hover:bg-white/[0.05] focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-brand-primary/50 transition-colors';

  const titleClass = onPaper ? 'text-ink-strong' : 'text-text-primaryLight dark:text-text-primaryDark';
  const bodyClass = onPaper ? 'text-ink-muted' : 'text-text-secondaryLight dark:text-text-secondaryDark';

  return (
    <div
      className={`flex flex-col ${
        isInline ? 'items-start text-left py-0' : 'items-center justify-center text-center'
      } ${isInline ? '' : isCompact ? 'py-4' : 'py-6'} ${className}`}
    >
      {!isInline && Icon && <div
        className={`${
          isCompact ? 'w-9 h-9' : 'w-11 h-11'
        } rounded-full flex items-center justify-center mb-3 ${
          onPaper ? 'bg-black/[0.04]' : 'bg-black/5 dark:bg-white/[0.05]'
        }`}
      >
        <Icon className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} ${bodyClass}`} aria-hidden="true" />
      </div>}

      <p className={`text-sm font-semibold ${titleClass}`}>{title}</p>

      {description && (
        <p className={`text-xs mt-1 max-w-[32ch] leading-relaxed ${bodyClass}`}>{description}</p>
      )}

      <div className={`flex items-center gap-2 ${isInline ? '' : 'justify-center'}`}>
        {to && actionLabel && (
          <Link to={to} className={actionClasses}>
            {actionLabel}
          </Link>
        )}

        {!to && onAction && actionLabel && (
          <button type="button" onClick={onAction} className={actionClasses}>
            {actionLabel}
          </button>
        )}

        {secondaryTo && secondaryLabel && (
          <Link to={secondaryTo} className={secondaryClasses}>
            {secondaryLabel}
          </Link>
        )}

        {!secondaryTo && onSecondary && secondaryLabel && (
          <button type="button" onClick={onSecondary} className={secondaryClasses}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
