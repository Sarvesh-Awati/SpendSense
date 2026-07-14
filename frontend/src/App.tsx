import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider, useToast } from './components/ui/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AuthLayout from './features/auth/AuthLayout';
import Login from './features/auth/Login';
import Register from './features/auth/Register';
import { LogOut, User, Key, ShieldCheck, Sparkles, Activity } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// A premium mockup dashboard view showing the authenticated session details
const DashboardHome: React.FC = () => {
  const { user, accessToken, logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    await logout();
    toast('Logged out successfully', 'info');
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-primaryLight dark:text-text-primaryDark transition-colors duration-300 mesh-gradient-green">
      {/* Nav header */}
      <header className="border-b border-border-light dark:border-border-dark backdrop-blur-md sticky top-0 z-40 bg-white/70 dark:bg-[#0b0f19]/70">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center text-white shadow-glow-green">
              <span className="font-outfit font-bold text-lg">S</span>
            </div>
            <span className="font-outfit font-bold text-xl tracking-tight bg-gradient-to-r from-text-primaryLight dark:from-text-primaryDark to-brand-secondary bg-clip-text text-transparent">
              SpendSense
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold px-3 py-1 rounded-full border border-brand-primary/20 bg-brand-primary/5 text-brand-primary">
              Authenticated
            </span>
            <button
              onClick={handleLogout}
              className="p-2 flex items-center gap-2 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark text-text-secondaryLight dark:text-text-secondaryDark hover:text-finance-expense dark:hover:text-finance-expense hover:border-finance-expense/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs font-medium pr-1">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white dark:bg-card-dark p-8 rounded-3xl border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-secondary/10 text-brand-secondary flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-outfit text-2xl font-bold tracking-tight">
                Welcome back, {user?.firstName} {user?.lastName}!
              </h1>
              <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
                Session Active — Secure Authentication Layer fully integrated.
              </p>
            </div>
          </div>

          {/* User profile table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {/* Box 1 */}
            <div className="p-5 rounded-2xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondaryLight dark:text-text-secondaryDark">
                  User Details
                </span>
                <p className="text-sm font-semibold">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark">{user?.email}</p>
              </div>
            </div>

            {/* Box 2 */}
            <div className="p-5 rounded-2xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-secondary/10 text-brand-secondary flex items-center justify-center flex-shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div className="space-y-1 overflow-hidden">
                <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondaryLight dark:text-text-secondaryDark">
                  Access Token (Decoded)
                </span>
                <p className="text-sm font-semibold truncate">Bearer {accessToken?.substring(0, 24)}...</p>
                <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark">Expires in 15 minutes (Auto-rotates)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Summary details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark shadow-premium dark:shadow-premium-dark">
            <div className="flex items-center gap-2 text-brand-primary mb-3">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="font-outfit font-bold text-md">Active Security Layers</h3>
            </div>
            <ul className="text-xs text-text-secondaryLight dark:text-text-secondaryDark space-y-2.5 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5 flex-shrink-0" />
                <span><strong>Bcrypt:</strong> Password hashes are stretched using Blowfish-based work factor key expansions.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5 flex-shrink-0" />
                <span><strong>JWT Rotation:</strong> Refresh tokens are single-use; rotation intercepts reuse immediately.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5 flex-shrink-0" />
                <span><strong>Rate Limiter:</strong> Auth endpoints restrict concurrent loops to 15 tries per 15 minutes.</span>
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark shadow-premium dark:shadow-premium-dark">
            <div className="flex items-center gap-2 text-brand-secondary mb-3">
              <Activity className="w-5 h-5" />
              <h3 className="font-outfit font-bold text-md">Axios Interceptor Stats</h3>
            </div>
            <ul className="text-xs text-text-secondaryLight dark:text-text-secondaryDark space-y-2.5 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-secondary mt-1.5 flex-shrink-0" />
                <span><strong>Automatic Header Injection:</strong> Bearer tokens are attached to outcoming API requests.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-secondary mt-1.5 flex-shrink-0" />
                <span><strong>Queue-Buffering:</strong> Intercepts 401s and pends concurrent requests during refresh cycles.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-secondary mt-1.5 flex-shrink-0" />
                <span><strong>Auto-Logout Redirection:</strong> Automatically redirects user to sign in if refreshing fails.</span>
              </li>
            </ul>
          </div>
        </div>
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

              {/* Secure Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<DashboardHome />} />
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
