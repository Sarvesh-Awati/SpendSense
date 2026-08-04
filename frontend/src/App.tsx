import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider, useToast } from './components/ui/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AuthLayout from './features/auth/AuthLayout';
import Login from './features/auth/Login';
import Register from './features/auth/Register';
import TransactionList from './features/transactions/TransactionList';
import Dashboard from './features/dashboard/Dashboard';
import BudgetList from './features/budgets/BudgetList';
import GoalPage from './features/goals/GoalPage';
import ReceiptScanner from './features/receipts/ReceiptScanner';
import SubscriptionList from './features/subscriptions/SubscriptionList';
import Profile from './features/profile/Profile';
import AnalyticsDashboard from './features/analytics/AnalyticsDashboard';
import UserMenu from './components/common/UserMenu';
import { LogOut, LayoutDashboard, Receipt, PiggyBank, Target, Camera, Repeat, BarChart3 } from 'lucide-react';

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
  const { toast } = useToast();
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
      <header className="border-b border-border-light dark:border-border-dark backdrop-blur-md sticky top-0 z-40 bg-white/70 dark:bg-[#0b0f19]/70">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center text-white">
                <span className="font-outfit font-bold text-lg">S</span>
              </div>
              <span className="font-outfit font-bold text-xl tracking-tight text-text-primaryLight dark:text-white">
                SpendSense
              </span>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden sm:flex items-center gap-1.5">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                      isActive
                        ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
                        : 'text-text-secondaryLight dark:text-text-secondaryDark hover:bg-slate-50 dark:hover:bg-[#111622] hover:text-text-primaryLight'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
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
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Mobile Navigation bar */}
        <div className="sm:hidden grid grid-cols-2 gap-2 mb-6 p-1 rounded-xl bg-slate-100 dark:bg-[#111622] border border-border-light dark:border-border-dark">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                  isActive
                    ? 'bg-white dark:bg-card-dark text-brand-primary shadow-sm border border-border-light dark:border-border-dark'
                    : 'text-text-secondaryLight dark:text-text-secondaryDark'
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </div>

        <Outlet />
      </main>
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
