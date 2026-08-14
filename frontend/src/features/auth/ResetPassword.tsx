import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, ArrowRight, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { useResetPasswordMutation } from '../../services/auth';

const resetPasswordFormSchema = z.object({
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters long' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' })
    .regex(/[^a-zA-Z0-9]/, { message: 'Password must contain at least one special character' }),
  confirmPassword: z
    .string()
    .min(1, { message: 'Please confirm your password' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

export const ResetPassword: React.FC = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isSuccess, setIsSuccess] = useState(false);
  const [errorState, setErrorState] = useState<'expired' | 'used' | 'invalid' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const resetPasswordMutation = useResetPasswordMutation({
    onSuccess: () => {
      setIsSuccess(true);
      toast('Password reset successfully!', 'success');
    },
    onError: (error: any) => {
      const errMsg = error.response?.data?.message || 'Failed to reset password.';
      
      // Detect specific error states for UI rendering
      if (errMsg.toLowerCase().includes('expired')) {
        setErrorState('expired');
      } else if (errMsg.toLowerCase().includes('already been used')) {
        setErrorState('used');
      } else if (errMsg.toLowerCase().includes('invalid')) {
        setErrorState('invalid');
      }
      
      toast(errMsg, 'error');
    },
  });

  const onSubmit = (data: ResetPasswordFormValues) => {
    if (!token) return;
    resetPasswordMutation.mutate({ token, password: data.password });
  };

  // No token provided in URL
  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-finance-expense/10 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-finance-expense" />
        </div>
        <div>
          <h3 className="font-outfit text-lg font-bold tracking-tight">Invalid Reset Link</h3>
          <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-2 leading-relaxed">
            This password reset link is missing the required token. Please request a new password reset.
          </p>
        </div>
        <Link
          to="/forgot-password"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:underline transition-colors mt-4"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  // Error state (expired, used, or invalid token)
  if (errorState) {
    const errorConfig = {
      expired: {
        title: 'Link Expired',
        message: 'This password reset link has expired. Please request a new one.',
      },
      used: {
        title: 'Link Already Used',
        message: 'This password reset link has already been used. Each link can only be used once.',
      },
      invalid: {
        title: 'Invalid Link',
        message: 'This password reset link is invalid. Please request a new one.',
      },
    };

    const config = errorConfig[errorState];

    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-finance-expense/10 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-finance-expense" />
        </div>
        <div>
          <h3 className="font-outfit text-lg font-bold tracking-tight">{config.title}</h3>
          <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-2 leading-relaxed">
            {config.message}
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:underline transition-colors"
          >
            Request a new link
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs text-text-secondaryLight dark:text-text-secondaryDark hover:underline transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-finance-income/10 flex items-center justify-center">
          <CheckCircle className="w-7 h-7 text-finance-income" />
        </div>
        <div>
          <h3 className="font-outfit text-lg font-bold tracking-tight">Password Reset</h3>
          <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-2 leading-relaxed">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
        </div>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white font-medium text-sm transition-all duration-300 mt-4"
        >
          <span>Sign In</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark leading-relaxed">
        Enter your new password below. Make sure it's strong and unique.
      </p>

      {/* New Password Input */}
      <div>
        <label htmlFor="reset-password" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
          New Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
            <Lock className="w-5 h-5" />
          </div>
          <input
            id="reset-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            disabled={resetPasswordMutation.isPending}
            className={`w-full pl-11 pr-11 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
              errors.password
                ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
            }`}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-secondaryLight/50 dark:text-text-secondaryDark/40 hover:text-text-primaryLight dark:hover:text-text-primaryDark transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-finance-expense mt-1.5 font-medium leading-relaxed">{errors.password.message}</p>
        )}
      </div>

      {/* Confirm Password Input */}
      <div>
        <label htmlFor="reset-confirm-password" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
          Confirm Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
            <Lock className="w-5 h-5" />
          </div>
          <input
            id="reset-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="••••••••"
            disabled={resetPasswordMutation.isPending}
            className={`w-full pl-11 pr-11 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
              errors.confirmPassword
                ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
            }`}
            {...register('confirmPassword')}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-text-secondaryLight/50 dark:text-text-secondaryDark/40 hover:text-text-primaryLight dark:hover:text-text-primaryDark transition-colors"
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-xs text-finance-expense mt-1.5 font-medium">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={resetPasswordMutation.isPending}
        className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none mt-2"
      >
        {resetPasswordMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Resetting password...</span>
          </>
        ) : (
          <>
            <span>Reset Password</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Back to Sign In */}
      <p className="text-center text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-6">
        Remember your password?{' '}
        <Link
          to="/login"
          className="text-brand-primary hover:underline font-semibold transition-colors"
        >
          Sign In
        </Link>
      </p>
    </form>
  );
};

export default ResetPassword;
