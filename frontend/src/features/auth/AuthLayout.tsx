import React from 'react';
import { DollarSign } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-primaryLight dark:text-text-primaryDark transition-colors duration-300 mesh-gradient-indigo flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo/Branding Block */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center text-white mb-3">
            <DollarSign className="w-6 h-6" />
          </div>
          <h2 className="font-outfit font-bold text-2xl tracking-tight text-text-primaryLight dark:text-white">
            SpendSense
          </h2>
          <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-1">
            AI-Powered Personal Finance Assistant
          </p>
        </div>

        {/* Form Container Card */}
        <div className="p-8 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark shadow-premium dark:shadow-premium-dark relative overflow-hidden backdrop-blur-md">
          <div className="mb-6">
            <h1 className="font-outfit text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-1">{subtitle}</p>
          </div>
          
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
