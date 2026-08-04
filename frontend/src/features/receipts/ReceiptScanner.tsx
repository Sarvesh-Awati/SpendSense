import React, { useState, useRef, useCallback } from 'react';
import { useUploadReceipt, ReceiptExtractionResult } from '../../services/receipts';
import { useCreateTransaction, useCategories } from '../../services/transactions';
import { useToast } from '../../components/ui/Toast';
import TransactionForm from '../transactions/TransactionForm';
import {
  Upload,
  Camera,
  X,
  Loader2,
  AlertTriangle,
  Sparkles,
  FileImage,
  CheckCircle,
  Zap,
} from 'lucide-react';

type ScannerStep = 'upload' | 'scanning' | 'review' | 'error';

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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setExtraction(result.data.extraction);
      setStep('review');
      toast('Receipt scanned successfully!', 'success');
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
      await createTransaction.mutateAsync(values);
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
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-outfit text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-brand-secondary" />
            AI Receipt Scanner
          </h1>
          <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-1">
            Upload a receipt image and let AI extract transaction details automatically
          </p>
        </div>
      </div>

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
                : 'border-border-light dark:border-border-dark hover:border-brand-secondary/50 hover:bg-slate-50/50 dark:hover:bg-[#111622]/50'
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

      {/* Step: Review — show the TransactionForm prefilled with extraction data */}
      {step === 'review' && extraction && (
        <div className="space-y-5">
          {/* Extraction Confidence Banner */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-brand-primary/10 border border-brand-primary/15 text-sm">
            <CheckCircle className="w-5 h-5 text-brand-primary flex-shrink-0" />
            <div className="flex-grow">
              <p className="font-semibold text-brand-primary">
                Receipt Scanned Successfully
              </p>
              <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
                Review the extracted details below and make any corrections before saving.
                {extraction.confidence !== null && (
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
                date: extraction.date || new Date().toISOString().split('T')[0],
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
