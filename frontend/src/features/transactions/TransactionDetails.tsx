import React from 'react';
import { Calendar, CreditCard, Tag, RefreshCw, FileText, CheckCircle2, User } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

interface TransactionDetailsProps {
  /** Null closes the dialog; the parent no longer conditionally mounts this. */
  transaction: any | null;
  onClose: () => void;
}

/** One labelled row of the details list. */
const DetailRow: React.FC<{
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}> = ({ icon: Icon, label, children }) => (
  <div className="flex gap-3">
    <div className="w-9 h-9 rounded-control bg-slate-100 dark:bg-surface-sunk flex items-center justify-center text-text-secondaryLight dark:text-text-secondaryDark shrink-0">
      <Icon className="w-4 h-4" aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] uppercase font-bold tracking-wider text-text-secondaryLight dark:text-text-secondaryDark">
        {label}
      </p>
      {children}
    </div>
  </div>
);

export const TransactionDetails: React.FC<TransactionDetailsProps> = ({
  transaction,
  onClose,
}) => {
  // Guarded so the fields below can be read unconditionally.
  const isIncome = transaction?.type === 'INCOME';
  const categoryName = transaction?.category?.name || 'Uncategorized';
  const categoryColor = transaction?.category?.color || '#cbd5e1';

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    // The shared Modal owns the overlay, focus trap, Escape, focus restoration,
    // scroll lock and the close button.
    <Modal
      open={!!transaction}
      onClose={onClose}
      title="Transaction Details"
      size="sm"
      footer={
        <Button variant="secondary" fullWidth onClick={onClose}>
          Done
        </Button>
      }
    >
      {transaction && (
        <div className="text-left">
          {/* Amount */}
          <div className="text-center mb-7">
            <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondaryLight dark:text-text-secondaryDark block mb-1">
              Transaction Amount
            </span>
            <p
              className={`font-outfit text-3xl font-extrabold tracking-tight tnum ${
                isIncome ? 'text-finance-income' : 'text-text-primaryLight dark:text-text-primaryDark'
              }`}
            >
              {isIncome ? '+' : '-'} {formatCurrency(transaction.amount, transaction.currency)}
            </p>
          </div>

          <div className="space-y-4">
            <DetailRow icon={User} label="Merchant / Payee">
              <p className="text-sm font-semibold mt-0.5 break-words">
                {transaction.merchant || 'Unknown'}
              </p>
            </DetailRow>

            <DetailRow icon={Tag} label="Category">
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: `${categoryColor}15`,
                    color: categoryColor,
                    border: `1px solid ${categoryColor}25`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: categoryColor }}
                  />
                  {categoryName}
                </span>
              </div>
            </DetailRow>

            <DetailRow icon={Calendar} label="Date & Time">
              <p className="text-sm font-semibold mt-0.5">{formatDate(transaction.date)}</p>
            </DetailRow>

            <DetailRow icon={CreditCard} label="Payment Method">
              <p className="text-sm font-semibold mt-0.5">
                {transaction.paymentMethod || 'Card'}
              </p>
            </DetailRow>

            {transaction.description && (
              <DetailRow icon={FileText} label="Description / Notes">
                <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark leading-relaxed mt-1 bg-slate-50 dark:bg-surface-sunk/50 p-2.5 rounded-control border border-border-light/40 dark:border-border-dark/40 break-words">
                  {transaction.description}
                </p>
              </DetailRow>
            )}

            {(transaction.isSubscription || transaction.receiptId) && (
              <div className="p-4 rounded-panel border border-border-light dark:border-border-dark bg-slate-50/50 dark:bg-surface-sunk/20 flex flex-col gap-2 mt-2">
                {transaction.isSubscription && (
                  <div className="flex items-center gap-2 text-brand-secondary">
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                    <span className="text-xs font-semibold">Active Recurring Subscription</span>
                  </div>
                )}
                {transaction.receiptId && (
                  <div className="flex items-center gap-2 text-brand-primary">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span className="text-xs font-semibold">Matched with Uploaded Receipt</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default TransactionDetails;
