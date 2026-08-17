import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * The single button primitive.
 *
 * Before this existed there were 26 distinct hand-written primary-button class
 * strings. Every visual decision — height, radius, focus ring, disabled state —
 * lives here so it can be changed in one place.
 *
 * Colours come from the Tailwind tokens (`brand-primary`, `finance-expense`,
 * `border-*`, `text-*`); no hex literals.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks interaction. Implies disabled. */
  loading?: boolean;
  /** Icon rendered before the label. Pass the component, not an element. */
  icon?: React.ElementType;
  /** Icon rendered after the label. */
  iconRight?: React.ElementType;
  /** Stretches to the container width — used inside modals and mobile layouts. */
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-primary text-white hover:bg-emerald-600 ' +
    'disabled:hover:bg-brand-primary shadow-e1',
  secondary:
    'border border-border-light dark:border-border-dark ' +
    'text-text-primaryLight dark:text-text-primaryDark ' +
    'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]',
  ghost:
    'text-text-secondaryLight dark:text-text-secondaryDark ' +
    'hover:bg-black/[0.04] dark:hover:bg-white/[0.05] ' +
    'hover:text-text-primaryLight dark:hover:text-text-primaryDark',
  danger:
    'bg-finance-expense text-white hover:bg-rose-600 ' +
    'disabled:hover:bg-finance-expense shadow-e1',
};

/** Consistent control heights across the whole app. */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-xs gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-sm gap-2',
};

const ICON_SIZE: Record<ButtonSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-[18px] h-[18px]',
};

/**
 * Ref-forwarding so callers can point at the underlying <button> — used by
 * `Modal`'s `returnFocusRef` to hand focus back to a page action after a
 * dialog closes.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  fullWidth = false,
  className = '',
  children,
  disabled,
  // Default to "button": an unspecified <button> inside a <form> submits it,
  // which is how close/cancel controls end up submitting by accident.
  type = 'button',
  ...rest
}, ref) => {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center rounded-control font-semibold',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-background-light',
        'dark:focus-visible:ring-offset-background-dark',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        SIZES[size],
        VARIANTS[variant],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading ? (
        <Loader2 className={`${ICON_SIZE[size]} animate-spin shrink-0`} aria-hidden="true" />
      ) : (
        Icon && <Icon className={`${ICON_SIZE[size]} shrink-0`} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && (
        <IconRight className={`${ICON_SIZE[size]} shrink-0`} aria-hidden="true" />
      )}
    </button>
  );
});
Button.displayName = 'Button';

/**
 * Icon-only button. Separated so an accessible name is REQUIRED by the type
 * system — icon-only controls are the most common a11y gap in this codebase.
 */
interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'iconRight'> {
  icon: React.ElementType;
  /** Required: screen readers have no text to fall back on. */
  label: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={[
      'inline-flex items-center justify-center rounded-control',
      'transition-colors duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-12 h-12' : 'w-11 h-11',
      VARIANTS[variant],
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...rest}
  >
    <Icon className={ICON_SIZE[size]} aria-hidden="true" />
  </button>
);

export default Button;
