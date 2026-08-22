import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { useLoginMutation } from '../../services/auth';

const loginFormSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email address is required' })
    .email({ message: 'Must be a valid email address' })
    .toLowerCase(),
  password: z
    .string()
    .min(1, { message: 'Password is required' }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useLoginMutation({
    onSuccess: (response) => {
      const { tokens, user } = response.data;
      login(tokens, user);
      toast(`Welcome back, ${user.firstName}!`, 'success');
      navigate('/');
    },
    onError: (error: any) => {
      const errMsg = error.response?.data?.message || 'Login failed. Please check your credentials.';
      toast(errMsg, 'error');
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data);
  };

  /*
   * noValidate: zod is the single source of validation truth.
   *
   * Without it, `<input type="email">` triggers the browser's own constraint
   * validation, which aborts submission BEFORE react-hook-form runs. The app's
   * styled, aria-linked error messages then never appeared for the most common
   * mistake of all — a malformed email — and the user got an unstyled native
   * bubble instead, with none of the aria-invalid/aria-describedby wiring that
   * assistive technology relies on.
   */
  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Email Input */}
      <div>
        <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
          Email Address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
            <Mail className="w-5 h-5" />
          </div>
          <input
            id="email"
            type="email"
            placeholder="john.doe@example.com"
            disabled={loginMutation.isPending}
            className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-slate-50 dark:bg-surface-sunk text-sm focus:outline-none focus:ring-1 transition-all ${
              errors.email
                ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
            }`}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p id="email-error" role="alert" className="text-xs text-finance-expense mt-1.5 font-medium">{errors.email.message}</p>
        )}
      </div>

      {/* Password Input */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark">
            Password
          </label>
          <Link
            to="/forgot-password"
            className="text-xs font-semibold text-brand-primary hover:underline transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
            <Lock className="w-5 h-5" />
          </div>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            disabled={loginMutation.isPending}
            className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-slate-50 dark:bg-surface-sunk text-sm focus:outline-none focus:ring-1 transition-all ${
              errors.password
                ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
            }`}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
          />
        </div>
        {errors.password && (
          <p id="password-error" role="alert" className="text-xs text-finance-expense mt-1.5 font-medium">{errors.password.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loginMutation.isPending}
        className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none mt-2"
      >
        {loginMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <span>Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Footer redirection link */}
      <p className="text-center text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-6">
        Don't have an account?{' '}
        <Link
          to="/register"
          className="text-brand-primary hover:underline font-semibold transition-colors"
        >
          Create one now
        </Link>
      </p>
    </form>
  );
};

export default Login;
