import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      
      {/* Toast Overlay Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-premium dark:shadow-premium-dark animate-slide-up transition-all duration-300 bg-white dark:bg-card-dark ${
                isSuccess
                  ? 'border-finance-income/20 text-text-primaryLight dark:text-text-primaryDark'
                  : isError
                  ? 'border-finance-expense/20 text-text-primaryLight dark:text-text-primaryDark'
                  : 'border-brand-secondary/20 text-text-primaryLight dark:text-text-primaryDark'
              }`}
            >
              {/* Icon indicator */}
              <div className="flex-shrink-0 mt-0.5">
                {isSuccess ? (
                  <CheckCircle className="w-5 h-5 text-finance-income" />
                ) : isError ? (
                  <AlertCircle className="w-5 h-5 text-finance-expense" />
                ) : (
                  <Info className="w-5 h-5 text-brand-secondary" />
                )}
              </div>

              {/* Message text */}
              <div className="flex-grow text-sm font-medium pr-2">
                {t.message}
              </div>

              {/* Close button */}
              <button
                onClick={() => removeToast(t.id)}
                className="flex-shrink-0 text-text-secondaryLight dark:text-text-secondaryDark hover:text-text-primaryLight dark:hover:text-text-primaryDark transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
