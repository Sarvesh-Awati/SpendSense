import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { useForgotPasswordMutation } from '../../services/auth';

const forgotPasswordFormSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email address is required' })
    .email({ message: 'Must be a valid email address' })
    .toLowerCase(),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;

export const ForgotPassword: React.FC = () => {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: {
      email: '',
    },
  });

  const forgotPasswordMutation = useForgotPasswordMutation({
    onSuccess: () => {
      setIsSubmitted(true);
    },
    onError: (error: any) => {
      const errMsg = error.response?.data?.message || 'Something went wrong. Please try again.';
      toast(errMsg, 'error');
    },
  });

  const onSubmit = (data: ForgotPasswordFormValues) => {
    forgotPasswordMutation.mutate(data);
  };

  // Success state after submission
  if (isSubmitted) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-finance-income/10 flex items-center justify-center">
          <CheckCircle className="w-7 h-7 text-finance-income" />
        </div>
        <div>
          <h3 className="font-outfit text-lg font-bold tracking-tight">Check your email</h3>
          <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-2 leading-relaxed">
            If an account exists for this email, we've sent a password reset link.
          </p>
          <p className="text-xs text-text-secondaryLight/80 dark:text-text-secondaryDark/80 mt-3 italic">
            Didn't receive it? Check your spam folder or try again.
          </p>
        </div>

        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:underline transition-colors mt-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark leading-relaxed">
        Enter the email address associated with your account, and we'll send you a link to reset your password.
      </p>

      {/* Email Input */}
      <div>
        <label htmlFor="forgot-email" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
          Email Address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
            <Mail className="w-5 h-5" />
          </div>
          <input
            id="forgot-email"
            type="email"
            placeholder="john.doe@example.com"
            disabled={forgotPasswordMutation.isPending}
            className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-slate-50 dark:bg-surface-sunk text-sm focus:outline-none focus:ring-1 transition-all ${
              errors.email
                ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
            }`}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'forgot-email-error' : undefined}
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p id="forgot-email-error" role="alert" className="text-xs text-finance-expense mt-1.5 font-medium">{errors.email.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={forgotPasswordMutation.isPending}
        className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none mt-2"
      >
        {forgotPasswordMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Sending reset link...</span>
          </>
        ) : (
          <>
            <span>Send Reset Link</span>
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

export default ForgotPassword;
