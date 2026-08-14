import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, TrendingUp, TrendingDown, PiggyBank, Target } from 'lucide-react';

interface QuickAddProps {
  onAddExpense: () => void;
  onAddIncome: () => void;
}

/**
 * Floating quick-action launcher.
 *
 * Every action maps to functionality that already exists: the two transaction
 * actions open the existing TransactionForm (owned by Dashboard), and the other
 * two navigate to the existing /budgets and /goals routes.
 */
export const QuickAdd: React.FC<QuickAddProps> = ({ onAddExpense, onAddIncome }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on Escape and on outside click, so the menu never traps the user.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const actions = [
    { label: 'Add Expense', icon: TrendingDown, tone: 'text-finance-expense', run: onAddExpense },
    { label: 'Add Income', icon: TrendingUp, tone: 'text-finance-income', run: onAddIncome },
    { label: 'Create Budget', icon: PiggyBank, tone: 'text-brand-primary', run: () => navigate('/budgets') },
    { label: 'Create Savings Goal', icon: Target, tone: 'text-finance-savings', run: () => navigate('/goals') },
  ];

  const handle = (run: () => void) => {
    setOpen(false);
    run();
  };

  return (
    <div
      ref={containerRef}
      // Sits above the mobile bottom bar; clears the toast stack on desktop.
      className="fixed bottom-20 sm:bottom-7 right-5 sm:right-7 z-40 flex flex-col items-end gap-2.5"
    >
      {open && (
        <div
          role="menu"
          aria-label="Quick actions"
          className="w-52 rounded-card bg-white dark:bg-surface-raised border border-border-light dark:border-white/[0.06] shadow-float dark:shadow-float-dark overflow-hidden p-1.5 motion-safe:animate-slide-up"
        >
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                role="menuitem"
                onClick={() => handle(action.run)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] focus-visible:outline-none focus-visible:bg-black/[0.04] dark:focus-visible:bg-white/[0.05] transition-colors"
              >
                <Icon className={`w-4 h-4 shrink-0 ${action.tone}`} aria-hidden="true" />
                {action.label}
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={open ? 'Close quick actions' : 'Open quick actions'}
        className="w-14 h-14 rounded-full bg-brand-primary text-white flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(16,185,129,0.5)] hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background-light dark:focus-visible:ring-offset-background-dark transition-[background-color,transform] motion-safe:active:scale-95"
      >
        <span
          className={`transition-transform duration-300 ${open ? 'rotate-45' : ''}`}
          aria-hidden="true"
        >
          {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </span>
      </button>
    </div>
  );
};

export default QuickAdd;
