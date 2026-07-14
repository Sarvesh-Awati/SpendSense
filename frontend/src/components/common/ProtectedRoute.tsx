import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 transition-colors duration-300">
        <div className="w-full max-w-sm space-y-4">
          {/* Skeleton Logo Loader */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
          
          {/* Skeleton Body Cards */}
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse w-3/4 mx-auto" />
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  // Redirect to login if user is unauthenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Render nested child routing components
  return <Outlet />;
};

export default ProtectedRoute;
