import React, { useCallback, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * The single modal primitive.
 *
 * Six modals were previously hand-rolled; only one had `role="dialog"`, none
 * trapped focus, and their close buttons defaulted to `type="submit"` — which
 * silently submitted the surrounding form. This owns all of that.
 */
export type ModalSize = 'sm' | 'md' | 'lg';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Rendered as the dialog's accessible name and wired via aria-labelledby. */
  title: string;
  description?: string;
  size?: ModalSize;
  children: React.ReactNode;
  /** Pinned to the bottom, above the safe area on mobile. */
  footer?: React.ReactNode;
  /** Set false for destructive flows where a stray backdrop click is costly. */
  closeOnBackdrop?: boolean;
  /**
   * Where to send focus on close. Defaults to whatever was focused when the
   * dialog opened. Pass this when the trigger unmounts while the dialog is
   * open (e.g. an item inside a menu that closes), otherwise focus would be
   * dropped to <body> and keyboard position lost.
   */
  returnFocusRef?: React.RefObject<HTMLElement>;
}

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true,
  returnFocusRef,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  /** The element focused before opening, so focus can be handed back. */
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !panelRef.current) return;

      // Focus trap: cycle within the dialog rather than escaping to the page.
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;

    // Stop the page behind the dialog from scrolling.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first control, falling back to the panel itself.
    const raf = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    });

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = prevOverflow;

      // Hand focus back. An explicit target wins; otherwise return to whatever
      // was focused on open — but only if it is still in the document. A
      // trigger inside a menu that has since closed is detached, and calling
      // focus() on it silently drops focus to <body>.
      const explicit = returnFocusRef?.current;
      const original = restoreRef.current;
      const target =
        explicit && explicit.isConnected
          ? explicit
          : original && original.isConnected
          ? original
          : null;
      target?.focus?.();
    };
  }, [open, handleKeyDown, returnFocusRef]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-[#080B0F]/75 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={[
          'relative w-full',
          SIZES[size],
          // Mobile: full-width sheet flush to the bottom, respecting the safe
          // area. Desktop: centred, fully rounded card.
          'rounded-t-card sm:rounded-card',
          'max-h-[92vh] sm:max-h-[90vh] overflow-y-auto',
          'bg-white dark:bg-surface-raised',
          'border border-border-light dark:border-white/[0.06]',
          'shadow-e3 dark:shadow-e3-dark',
          'motion-safe:animate-slide-up focus:outline-none',
        ].join(' ')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-start justify-between gap-4 p-6 sm:p-7 pb-0">
          <div className="min-w-0">
            <h2 id={titleId} className="font-outfit text-xl font-bold tracking-tight truncate">
              {title}
            </h2>
            {description && (
              <p
                id={descId}
                className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-1"
              >
                {description}
              </p>
            )}
          </div>

          {/* type="button" is load-bearing: a bare <button> in a form submits it. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 p-2 rounded-control text-text-secondaryLight dark:text-text-secondaryDark hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primaryLight dark:hover:text-text-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 sm:p-7 pt-5">{children}</div>

        {footer && (
          <div className="px-6 sm:px-7 pb-6 sm:pb-7 pt-0 flex justify-end gap-3">{footer}</div>
        )}
      </div>
    </div>
  );
};

export default Modal;
