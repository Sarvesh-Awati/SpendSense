import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useUploadReceipt, ReceiptExtractionResult } from '../../services/receipts';
import { useCreateTransaction, useCategories } from '../../services/transactions';
import { useToast } from '../../components/ui/Toast';
import TransactionForm from '../transactions/TransactionForm';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import {
  Upload,
  Camera,
  X,
  Loader2,
  AlertTriangle,
  Sparkles,
  FileImage,
  CheckCircle,
  Check,
} from 'lucide-react';

/**
 * `confirm` sits between scanning and review: a compact row to accept or
 * reject the scan, and to correct the extracted date, before the full
 * transaction form is opened.
 */
type ScannerStep = 'upload' | 'scanning' | 'confirm' | 'review' | 'error';

const today = () => new Date().toISOString().split('T')[0];

/**
 * `<input type="date">` only accepts yyyy-MM-dd. The extractor returns that
 * shape for most receipts; anything else is parsed, and an unusable value
 * falls back to today — the same fallback the form already applied.
 */
const toDateInputValue = (raw: string | null | undefined): string => {
  if (typeof raw === 'string' && raw.trim() !== '') {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  }
  return today();
};

/** Human-readable form of a yyyy-MM-dd value, without shifting the day. */
const displayDate = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const ReceiptScanner: React.FC = () => {
  const { toast } = useToast();
  const uploadMutation = useUploadReceipt();
  const createTransaction = useCreateTransaction();
  const { data: categoriesResponse } = useCategories();
  const categories = categoriesResponse?.data?.categories || [];

  const [step, setStep] = useState<ScannerStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ReceiptExtractionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  /**
   * The date carried from the confirm row into the transaction form. Seeded
   * from the extraction and editable before accepting.
   */
  const [receiptDate, setReceiptDate] = useState<string>('');
  /**
   * Id of the receipt row created by the upload.
   *
   * This was previously dropped on the floor, so every scanned receipt and the
   * transaction it produced stayed unrelated records — the original image could
   * never be pulled up from the transaction, which is the entire point of
   * keeping it.
   */
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Object URLs hold their Blob alive until explicitly revoked. Scanning a
   * dozen receipts in one session leaked every image; revoking on replacement
   * and on unmount releases them.
   */
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Find the best matching categoryId from the AI's suggested category name
  const findCategoryId = useCallback(
    (suggestedName: string | null): string => {
      if (!suggestedName || categories.length === 0) return '';
      const match = categories.find(
        (c: any) =>
          c.name.toLowerCase() === suggestedName.toLowerCase() &&
          c.type === 'EXPENSE'
      );
      return match?.id || '';
    },
    [categories]
  );

  const handleFileSelect = (file: File) => {
    // Validate client-side before uploading
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast('Unsupported file type. Use JPG, PNG, or WEBP.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('File too large. Maximum size is 5 MB.', 'error');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setStep('upload');
    setErrorMessage('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleScan = async () => {
    if (!selectedFile) return;

    setStep('scanning');
    setErrorMessage('');

    try {
      const result = await uploadMutation.mutateAsync(selectedFile);
      const extracted = result.data.extraction;

      /**
       * A failed extraction is not a successful scan.
       *
       * The upload itself returns 201 whether or not the model answered, so
       * reporting success here told the user their receipt had been read when
       * the AI service was actually unreachable. The image is stored either
       * way, so the form is still offered — but honestly labelled.
       */
      if (extracted.extractionStatus === 'FAILED') {
        setExtraction(extracted);
        setReceiptId(result.data.receipt.id);
        setReceiptDate(today());
        setStep('confirm');
        toast('Could not read this receipt automatically. Enter the details manually.', 'error');
        return;
      }

      setExtraction(extracted);
      setReceiptId(result.data.receipt.id);
      // Default to the OCR date; the confirm row lets it be corrected.
      setReceiptDate(toDateInputValue(extracted.date));
      setStep('confirm');
      toast(
        extracted.extractionStatus === 'EMPTY'
          ? 'Receipt uploaded, but no details were found. Fill them in below.'
          : 'Receipt scanned successfully!',
        extracted.extractionStatus === 'EMPTY' ? 'info' : 'success'
      );
    } catch (error: any) {
      const msg =
        error.response?.data?.message || 'Failed to scan receipt. Please try again.';
      setErrorMessage(msg);
      setStep('error');
      toast(msg, 'error');
    }
  };

  const handleTransactionSave = async (values: any) => {
    try {
      // Carry the receipt through, so the stored image stays reachable from
      // the transaction it produced.
      await createTransaction.mutateAsync({ ...values, receiptId });
      toast('Transaction created from receipt!', 'success');
      handleReset();
    } catch (error: any) {
      toast(error.response?.data?.message || 'Failed to save transaction', 'error');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtraction(null);
    setReceiptId(null);
    setReceiptDate('');
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /** Accept: carry the chosen date into the existing transaction form. */
  const handleAcceptReceipt = () => {
    if (!receiptDate) return;
    setStep('review');
  };

  /** Decline: discard the scan and return to the empty upload state. */
  const handleDeclineReceipt = () => {
    handleReset();
    toast('Receipt discarded', 'info');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left">
      <PageHeader
        title="AI Receipt Scanner"
        subtitle="Upload a receipt image and let AI extract transaction details automatically"
        divider
      />

      {/* Step: Upload */}
      {(step === 'upload' || step === 'error') && (
        <div className="space-y-5">
          {/* Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer group ${
              isDragging
                ? 'border-brand-primary bg-brand-primary/5 scale-[1.01]'
                : selectedFile
                ? 'border-brand-primary/30 bg-emerald-50/5 dark:bg-emerald-950/5'
                : 'border-border-light dark:border-border-dark hover:border-brand-secondary/50 hover:bg-slate-50/50 dark:hover:bg-surface-sunk/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleInputChange}
              className="hidden"
            />

            {selectedFile && previewUrl ? (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <img
                    src={previewUrl}
                    alt="Receipt preview"
                    className="max-h-56 rounded-2xl border border-border-light dark:border-border-dark shadow-premium object-contain mx-auto"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    className="absolute -top-2 -right-2 p-1.5 rounded-full bg-finance-expense text-white shadow-lg hover:scale-110 transition-transform cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold flex items-center justify-center gap-1.5">
                    <FileImage className="w-4 h-4 text-brand-secondary" />
                    {selectedFile.name}
                  </p>
                  <p className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark">
                    {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type.split('/')[1].toUpperCase()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/15 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                  <Camera className="w-8 h-8 text-brand-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold">
                    Drop your receipt image here
                  </p>
                  <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-1">
                    or click to browse · JPG, PNG, WEBP · Max 5 MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {step === 'error' && errorMessage && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-finance-expense/10 border border-finance-expense/20 text-sm">
              <AlertTriangle className="w-5 h-5 text-finance-expense flex-shrink-0" />
              <div>
                <p className="font-semibold text-finance-expense">Scan Failed</p>
                <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* Scan Button */}
          {selectedFile && (
            <button
              onClick={handleScan}
              disabled={uploadMutation.isPending}
              className="w-full py-3.5 rounded-xl bg-brand-primary text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              Scan with AI
            </button>
          )}
        </div>
      )}

      {/* Step: Scanning */}
      {step === 'scanning' && (
        <div className="bg-white dark:bg-card-dark p-12 rounded-3xl border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark text-center space-y-5">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-2xl bg-brand-primary/10 animate-ping" />
            <div className="relative w-20 h-20 rounded-2xl bg-brand-primary/15 border border-brand-primary/25 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
            </div>
          </div>
          <div>
            <p className="text-base font-bold font-outfit">Analyzing Receipt...</p>
            <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-1">
              AI is extracting merchant, amount, and date from your receipt
            </p>
          </div>
        </div>
      )}

      {/*
        Step: Confirm — one compact row, not a second full-height card.
        Thumbnail, what was extracted, an editable date, accept/decline.

        No "apply date to all" control here: the scanner handles exactly one
        receipt per run (single file input, single upload request), so there is
        nothing to apply a date across.
      */}
      {step === 'confirm' && extraction && (
        <div className="rounded-panel border border-border-light dark:border-border-dark p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5">
            {/* Thumbnail + what was read */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Scanned receipt"
                  className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-control object-cover border border-border-light dark:border-border-dark"
                />
              )}

              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {extraction.merchant ||
                    (extraction.extractionStatus === 'FAILED'
                      ? 'Could not read receipt'
                      : 'Receipt scanned')}
                </p>
                <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5 truncate">
                  {extraction.extractionStatus === 'FAILED' ? (
                    'The scanner was unavailable — the image was saved, enter the details yourself.'
                  ) : (
                    <>
                      Extracted date:{' '}
                      {extraction.date ? displayDate(toDateInputValue(extraction.date)) : 'not found'}
                      {extraction.confidence !== null && (
                        <span> · {(extraction.confidence * 100).toFixed(0)}% confidence</span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Editable date, defaulted to the extraction */}
            <div className="w-full sm:w-44 shrink-0">
              <Field label="Date">
                {(ids) => (
                  <Input
                    {...ids}
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                  />
                )}
              </Field>
            </div>

            {/* Accept is primary; decline stays quiet until hovered */}
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" icon={Check} onClick={handleAcceptReceipt} disabled={!receiptDate}>
                Accept
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={X}
                onClick={handleDeclineReceipt}
                className="hover:text-finance-expense hover:border-finance-expense/40"
              >
                Decline
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Review — show the TransactionForm prefilled with extraction data */}
      {step === 'review' && extraction && (
        <div className="space-y-5">
          {/*
            Banner reflects what actually happened. Announcing "Scanned
            Successfully" over an all-null result — because the model was down —
            was actively misleading.
          */}
          {/*
            Class names are written out in full rather than interpolated:
            Tailwind's JIT scans source text for complete class strings, so a
            template like `bg-${accent}/10` compiles to no styles at all.
          */}
          <div
            className={
              extraction.extractionStatus === 'FAILED'
                ? 'flex items-center gap-3 p-4 rounded-2xl text-sm bg-finance-expense/10 border border-finance-expense/20'
                : 'flex items-center gap-3 p-4 rounded-2xl text-sm bg-brand-primary/10 border border-brand-primary/15'
            }
            role={extraction.extractionStatus === 'FAILED' ? 'alert' : undefined}
          >
            {extraction.extractionStatus === 'FAILED' ? (
              <AlertTriangle className="w-5 h-5 text-finance-expense flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-brand-primary flex-shrink-0" />
            )}
            <div className="flex-grow">
              <p
                className={
                  extraction.extractionStatus === 'FAILED'
                    ? 'font-semibold text-finance-expense'
                    : 'font-semibold text-brand-primary'
                }
              >
                {extraction.extractionStatus === 'FAILED'
                  ? 'Automatic Scanning Unavailable'
                  : extraction.extractionStatus === 'EMPTY'
                  ? 'No Details Found'
                  : 'Receipt Scanned Successfully'}
              </p>
              <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
                {extraction.extractionStatus === 'FAILED'
                  ? 'Your receipt image was saved. Enter the details below and save as normal.'
                  : extraction.extractionStatus === 'EMPTY'
                  ? 'The image was readable but nothing could be extracted. Fill in the details below.'
                  : 'Review the extracted details below and make any corrections before saving.'}
                {extraction.extractionStatus !== 'FAILED' && extraction.confidence !== null && (
                  <span className="ml-1 font-semibold">
                    AI Confidence: {(extraction.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="p-2 rounded-xl border border-border-light dark:border-border-dark text-text-secondaryLight hover:text-finance-expense hover:border-finance-expense/30 transition-colors cursor-pointer"
              title="Cancel and start over"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Receipt Preview Thumbnail */}
          {previewUrl && (
            <div className="flex justify-center">
              <img
                src={previewUrl}
                alt="Scanned receipt"
                className="max-h-32 rounded-xl border border-border-light dark:border-border-dark shadow-sm object-contain opacity-70"
              />
            </div>
          )}

          {/* Transaction Form — prefilled with AI extraction data */}
          <div className="bg-white dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark">
            <div className="flex items-center gap-2 mb-5">
              <Upload className="w-4 h-4 text-brand-secondary" />
              <h3 className="font-outfit text-sm font-bold uppercase tracking-wider">
                Confirm Transaction Details
              </h3>
            </div>

            <TransactionForm
              initialData={{
                amount: extraction.amount || undefined,
                merchant: extraction.merchant || '',
                description: extraction.description || '',
                // Confirmed on the row above; falls back exactly as before.
                date: receiptDate || extraction.date || today(),
                type: 'EXPENSE',
                categoryId: findCategoryId(extraction.suggestedCategory),
                paymentMethod: 'Card',
                isSubscription: false,
              }}
              onSubmit={handleTransactionSave}
              isPending={createTransaction.isPending}
              onCancel={handleReset}
            />
          </div>
        </div>
      )}

      {/* How It Works Section */}
      {step === 'upload' && !selectedFile && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: Upload,
              title: 'Upload',
              desc: 'Take a photo or select an image of your receipt',
            },
            {
              icon: Sparkles,
              title: 'AI Extracts',
              desc: 'Gemini AI reads and parses the receipt details',
            },
            {
              icon: CheckCircle,
              title: 'Confirm',
              desc: 'Review, edit, and save as a transaction',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark text-center space-y-2"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center mx-auto">
                <item.icon className="w-5 h-5 text-brand-primary" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider">{item.title}</p>
              <p className="text-[10px] text-text-secondaryLight dark:text-text-secondaryDark">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReceiptScanner;
