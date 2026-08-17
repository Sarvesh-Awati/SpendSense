import React from 'react';

/**
 * Loading placeholders.
 *
 * Every list page hand-rolled its own pulsing blocks with slightly different
 * heights, radii and surface colours. These two cover the shapes actually used
 * and keep the placeholder on the same tokens as the real surfaces, so the
 * skeleton reads as the page it is standing in for.
 */
interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-panel bg-black/[0.06] dark:bg-surface-sunk ${className}`}
  />
);

interface SkeletonCardGridProps {
  /** Number of placeholder cards. Matches the real grid's typical first page. */
  count?: number;
  /** Tailwind height class for each card. */
  height?: string;
  className?: string;
}

/**
 * The card-grid placeholder shared by Budgets, Goals and Subscriptions.
 * `aria-busy` and the status role announce the wait instead of leaving a
 * screen reader with silent empty boxes.
 */
export const SkeletonCardGrid: React.FC<SkeletonCardGridProps> = ({
  count = 3,
  height = 'h-48',
  className = '',
}) => (
  <div
    role="status"
    aria-busy="true"
    aria-label="Loading"
    className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}
  >
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className={height} />
    ))}
  </div>
);

export default Skeleton;
