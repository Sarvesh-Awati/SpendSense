import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AuthLayout from './features/auth/AuthLayout';
import Login from './features/auth/Login';
import Register from './features/auth/Register';
import ForgotPassword from './features/auth/ForgotPassword';
import ResetPassword from './features/auth/ResetPassword';
import UserMenu from './components/common/UserMenu';
import { Skeleton } from './components/ui/Skeleton';

/**
 * Authenticated pages are code-split; the auth screens above are not.
 *
 * Everything used to live in one chunk, so a visitor landing on the login page
 * downloaded the entire application — Recharts included, ~940 kB — before they
 * could type a password. Splitting at the route boundary means the login path
 * carries only what it needs, and the chart-heavy Dashboard and Analytics
 * bundles load when someone actually navigates to them.
 */
const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));
const TransactionList = lazy(() => import('./features/transactions/TransactionList'));
const BudgetList = lazy(() => import('./features/budgets/BudgetList'));
const GoalPage = lazy(() => import('./features/goals/GoalPage'));
const ReceiptScanner = lazy(() => import('./features/receipts/ReceiptScanner'));
const SubscriptionList = lazy(() => import('./features/subscriptions/SubscriptionList'));
const Profile = lazy(() => import('./features/profile/Profile'));
const AnalyticsDashboard = lazy(() => import('./features/analytics/AnalyticsDashboard'));
import { LayoutDashboard, Receipt, PiggyBank, Target, Camera, Repeat, BarChart3 } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes before refetching
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    },
  },
});

// Sidebar/Header layout wrapper for secured dashboard viewports
const DashboardLayout: React.FC = () => {
  const location = useLocation();

  const links = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/transactions', label: 'Transactions', icon: Receipt },
    { path: '/budgets', label: 'Budgets', icon: PiggyBank },
    { path: '/goals', label: 'Savings', icon: Target },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/subscriptions', label: 'Subs', icon: Repeat },
    { path: '/receipts', label: 'Scan', icon: Camera },
  ];

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-primaryLight dark:text-text-primaryDark transition-colors duration-300">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background-light/80 dark:bg-background-dark/80">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-[72px] flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-4 lg:gap-10 min-w-0">
            <Link
              to="/"
              className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 rounded-full"
            >
              <span className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white">
                <span className="font-outfit font-bold text-sm">S</span>
              </span>
              <span className="font-outfit font-semibold text-[17px] tracking-tight text-text-primaryLight dark:text-white">
                SpendSense
              </span>
            </Link>

            {/* Borderless nav — the active item is a soft tinted pill, nothing else */}
            <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
              {links.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    aria-current={isActive ? 'page' : undefined}
                    className={`px-3.5 py-2 rounded-full text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 ${
                      isActive
                        ? 'bg-brand-primary/12 text-brand-primary font-semibold'
                        : 'text-text-secondaryLight dark:text-text-secondaryDark font-medium hover:text-text-primaryLight dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Profile Menu */}
          <UserMenu />
        </div>
      </header>

      {/* Page Content viewport container */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-8 pt-4 pb-10 sm:pb-14">
        {/* Tablet: scrollable rail. Mobile: replaced by the bottom bar below. */}
        <nav
          className="hidden sm:block lg:hidden -mx-4 sm:-mx-8 px-4 sm:px-8 mb-6 overflow-x-auto"
          aria-label="Primary"
        >
          <div className="flex items-center gap-1.5 w-max pb-1">
            {links.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-3.5 py-2 rounded-full text-[13px] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 ${
                    isActive
                      ? 'bg-brand-primary/12 text-brand-primary font-semibold'
                      : 'text-text-secondaryLight dark:text-text-secondaryDark font-medium hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/*
          The fallback sits INSIDE the layout so the header and navigation stay
          rendered while a route chunk loads — the page fills in, it does not
          blink away and return.
        */}
        <Suspense
          fallback={
            <div className="space-y-4 py-6" role="status" aria-busy="true" aria-live="polite">
              <span className="sr-only">Loading page…</span>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile: app-style bottom navigation, icons only, safe-area aware */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl bg-background-light/90 dark:bg-background-dark/90 border-t border-border-light dark:border-border-dark"
        aria-label="Primary"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch justify-around px-1 py-1.5">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                aria-current={isActive ? 'page' : undefined}
                aria-label={link.label}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 ${
                  isActive
                    ? 'text-brand-primary'
                    : 'text-text-secondaryLight dark:text-text-secondaryDark'
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                <span className="text-[9px] font-medium leading-none truncate max-w-[3.5rem]">
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Guest / Auth Routes */}
              <Route
                path="/login"
                element={
                  <AuthLayout title="Welcome Back" subtitle="Log in to manage your money with SpendSense">
                    <Login />
                  </AuthLayout>
                }
              />
              <Route
                path="/register"
                element={
                  <AuthLayout title="Get Started" subtitle="Create your free account and supercharge your budget">
                    <Register />
                  </AuthLayout>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <AuthLayout title="Reset Password" subtitle="We'll send you a link to reset your password">
                    <ForgotPassword />
                  </AuthLayout>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <AuthLayout title="Set New Password" subtitle="Choose a strong password for your account">
                    <ResetPassword />
                  </AuthLayout>
                }
              />

              {/* Secure Routes wrapped in DashboardLayout navigation */}
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/transactions" element={<TransactionList />} />
                  <Route path="/budgets" element={<BudgetList />} />
                  <Route path="/goals" element={<GoalPage />} />
                  <Route path="/analytics" element={<AnalyticsDashboard />} />
                  <Route path="/subscriptions" element={<SubscriptionList />} />
                  <Route path="/receipts" element={<ReceiptScanner />} />
                  <Route path="/profile" element={<Profile />} />
                </Route>
              </Route>

              {/* Fallback Catch */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
