import React, { useId } from 'react';

/**
 * Form field primitive: label + control + description + error.
 *
 * There were 85 distinct input class strings across the app. `Field` owns the
 * layout and accessibility wiring; `Input`, `Select` and `Textarea` own the
 * control styling. They can be used together or separately, so existing forms
 * can migrate incrementally without a rewrite.
 */

/** Shared control chrome — one height, one radius, one focus ring. */
export const controlClasses = (hasError = false, hasLeadingIcon = false) =>
  [
    'w-full h-11 rounded-control text-sm',
    hasLeadingIcon ? 'pl-11 pr-4' : 'px-4',
    'bg-slate-50 dark:bg-surface-sunk',
    'text-text-primaryLight dark:text-text-primaryDark',
    'placeholder:text-text-secondaryLight/60 dark:placeholder:text-text-secondaryDark/50',
    'border transition-colors duration-150',
    hasError
      ? 'border-finance-expense/60 focus:border-finance-expense'
      : 'border-border-light dark:border-border-dark focus:border-brand-primary',
    'focus:outline-none focus-visible:ring-2',
    hasError ? 'focus-visible:ring-finance-expense/40' : 'focus-visible:ring-brand-primary/40',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' ');

interface FieldProps {
  label?: string;
  /** Helper text shown under the label. */
  description?: string;
  /** Validation message. Presence switches the control to its error styling. */
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /**
   * Receives the ids to wire onto the control so label/description/error are
   * announced correctly. Use this when rendering a custom control.
   */
  children: (ids: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
    'aria-required'?: boolean;
    disabled?: boolean;
  }) => React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  description,
  error,
  required = false,
  disabled = false,
  className = '',
  children,
}) => {
  const id = useId();
  const descId = `${id}-desc`;
  const errId = `${id}-err`;

  const describedBy = [description ? descId : null, error ? errId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`min-w-0 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-[11px] font-semibold tracking-[0.06em] uppercase text-text-secondaryLight dark:text-text-secondaryDark mb-2"
        >
          {label}
          {required && (
            <span className="text-finance-expense ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {description && (
        <p id={descId} className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mb-2">
          {description}
        </p>
      )}

      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
        'aria-required': required || undefined,
        disabled,
      })}

      {/* role="alert" so validation is announced when it appears */}
      {error && (
        <p id={errId} role="alert" className="text-xs text-finance-expense mt-1.5">
          {error}
        </p>
      )}
    </div>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  /** Optional leading icon; adds the left padding the control needs. */
  icon?: React.ElementType;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ hasError = false, icon: Icon, className = '', ...rest }, ref) => (
    <div className="relative">
      {Icon && (
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/60 dark:text-text-secondaryDark/50">
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
      )}
      <input ref={ref} className={`${controlClasses(hasError, !!Icon)} ${className}`} {...rest} />
    </div>
  )
);
Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ hasError = false, className = '', children, ...rest }, ref) => (
    <select ref={ref} className={`${controlClasses(hasError)} ${className}`} {...rest}>
      {children}
    </select>
  )
);
Select.displayName = 'Select';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ hasError = false, className = '', ...rest }, ref) => (
    <textarea
      ref={ref}
      // Height is content-driven here, so the fixed control height is dropped.
      className={`${controlClasses(hasError)} h-auto py-3 resize-y ${className}`}
      {...rest}
    />
  )
);
Textarea.displayName = 'Textarea';

export default Field;
