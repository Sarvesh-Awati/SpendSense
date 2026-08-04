import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { useRegisterMutation } from '../../services/auth';

const registerFormSchema = z.object({
  firstName: z
    .string()
    .min(1, { message: 'First name is required' })
    .trim(),
  lastName: z
    .string()
    .min(1, { message: 'Last name is required' })
    .trim(),
  email: z
    .string()
    .min(1, { message: 'Email address is required' })
    .email({ message: 'Must be a valid email address' })
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters long' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' })
    .regex(/[^a-zA-Z0-9]/, { message: 'Password must contain at least one special character' }),
});

type RegisterFormValues = z.infer<typeof registerFormSchema>;

export const Register: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
  });

  const registerMutation = useRegisterMutation({
    onSuccess: (response) => {
      toast('Registration successful! Please sign in with your credentials.', 'success');
      navigate('/login');
    },
    onError: (error: any) => {
      const errMsg = error.response?.data?.message || 'Registration failed. Please try again.';
      toast(errMsg, 'error');
    },
  });

  const onSubmit = (data: RegisterFormValues) => {
    registerMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* First Name & Last Name Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
            First Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <User className="w-4 h-4" />
            </div>
            <input
              id="firstName"
              type="text"
              placeholder="Jane"
              disabled={registerMutation.isPending}
              className={`w-full pl-9 pr-3 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
                errors.firstName
                  ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                  : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
              }`}
              {...register('firstName')}
            />
          </div>
          {errors.firstName && (
            <p className="text-[11px] text-finance-expense mt-1.5 font-medium">{errors.firstName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="lastName" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
            Last Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
              <User className="w-4 h-4" />
            </div>
            <input
              id="lastName"
              type="text"
              placeholder="Doe"
              disabled={registerMutation.isPending}
              className={`w-full pl-9 pr-3 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
                errors.lastName
                  ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                  : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
              }`}
              {...register('lastName')}
            />
          </div>
          {errors.lastName && (
            <p className="text-[11px] text-finance-expense mt-1.5 font-medium">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      {/* Email Input */}
      <div>
        <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
          Email Address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
            <Mail className="w-4 h-4" />
          </div>
          <input
            id="email"
            type="email"
            placeholder="jane.doe@example.com"
            disabled={registerMutation.isPending}
            className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
              errors.email
                ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
            }`}
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="text-[11px] text-finance-expense mt-1.5 font-medium">{errors.email.message}</p>
        )}
      </div>

      {/* Password Input */}
      <div>
        <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">
          Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
            <Lock className="w-4 h-4" />
          </div>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            disabled={registerMutation.isPending}
            className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:ring-1 transition-all ${
              errors.password
                ? 'border-finance-expense/30 focus:border-finance-expense focus:ring-finance-expense'
                : 'border-border-light dark:border-border-dark focus:border-brand-primary focus:ring-brand-primary'
            }`}
            {...register('password')}
          />
        </div>
        {errors.password && (
          <p className="text-[11px] text-finance-expense mt-1.5 font-medium leading-relaxed">{errors.password.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={registerMutation.isPending}
        className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none mt-4"
      >
        {registerMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Creating account...</span>
          </>
        ) : (
          <>
            <span>Create Account</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Redirect link */}
      <p className="text-center text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-6">
        Already have an account?{' '}
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

export default Register;
