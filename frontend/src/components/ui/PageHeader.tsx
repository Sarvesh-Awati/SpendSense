import React from 'react';

/**
 * Page title block, duplicated on all seven feature pages with slightly
 * different type sizes and spacing. One definition keeps the hierarchy honest.
 */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-hand action, typically the page's primary Button. */
  action?: React.ReactNode;
  /** Adds a hairline beneath the header, matching the dashboard's rhythm. */
  divider?: boolean;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  action,
  divider = false,
  className = '',
}) => (
  <header
    className={[
      // Action drops beneath the title on mobile rather than squeezing it.
      'flex flex-col sm:flex-row sm:items-center justify-between gap-4',
      divider ? 'pb-6 border-b border-border-light dark:border-border-dark' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <div className="min-w-0">
      <h1 className="font-outfit text-[28px] sm:text-[32px] leading-tight font-bold tracking-[-0.02em] truncate">
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-1.5">
          {subtitle}
        </p>
      )}
    </div>

    {action && <div className="shrink-0">{action}</div>}
  </header>
);

export default PageHeader;
