import React from 'react';
import { HeartPulse, Zap } from 'lucide-react';

interface FinancialHealthProps {
  score: number;
  status: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';
  insights: string[];
}

export const FinancialHealth: React.FC<FinancialHealthProps> = ({ score, status, insights }) => {
  // Determine color based on status
  let colorClass = 'text-brand-primary bg-brand-primary/10 border-brand-primary/20';
  let gradientClass = 'from-brand-primary to-brand-secondary';
  
  if (status === 'Excellent') {
    colorClass = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    gradientClass = 'from-emerald-400 to-emerald-600';
  } else if (status === 'Good') {
    colorClass = 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    gradientClass = 'from-blue-400 to-blue-600';
  } else if (status === 'Fair') {
    colorClass = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    gradientClass = 'from-amber-400 to-amber-600';
  } else if (status === 'Needs Attention') {
    colorClass = 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    gradientClass = 'from-rose-400 to-rose-600';
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Health Score Card */}
      <div className="p-6 rounded-3xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark flex flex-col justify-center items-center relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-secondary/5 rounded-full -ml-10 -mb-10 blur-xl"></div>
        
        <h2 className="text-sm font-bold text-text-secondaryLight dark:text-text-secondaryDark uppercase tracking-wider mb-4 flex items-center gap-2">
          <HeartPulse className="w-4 h-4" /> Financial Health
        </h2>
        
        <div className="relative mb-2">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              className="text-slate-100 dark:text-slate-800"
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
              r="58"
              cx="64"
              cy="64"
            />
            <circle
              className={`text-transparent bg-clip-text drop-shadow-sm transition-all duration-1000 ease-out`}
              strokeWidth="8"
              strokeDasharray={364}
              strokeDashoffset={364 - (364 * score) / 100}
              strokeLinecap="round"
              stroke={`url(#gradient-${status.replace(' ', '')})`}
              fill="transparent"
              r="58"
              cx="64"
              cy="64"
            />
            <defs>
              <linearGradient id={`gradient-${status.replace(' ', '')}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={status === 'Excellent' ? '#10b981' : status === 'Good' ? '#3b82f6' : status === 'Fair' ? '#f59e0b' : '#f43f5e'} />
                <stop offset="100%" stopColor={status === 'Excellent' ? '#059669' : status === 'Good' ? '#2563eb' : status === 'Fair' ? '#d97706' : '#e11d48'} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
            <span className="text-3xl font-black font-outfit">{score}</span>
          </div>
        </div>
        
        <div className={`mt-2 px-3 py-1 rounded-full text-xs font-bold border ${colorClass}`}>
          {status}
        </div>
      </div>

      {/* Quick Insights Masonry Layout */}
      <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {insights.map((insight, idx) => (
          <div 
            key={idx} 
            className="p-5 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark flex items-start gap-4 hover:border-brand-primary/30 transition-colors shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-brand-primary" />
            </div>
            <p className="text-sm font-medium text-text-primaryLight dark:text-text-primaryDark leading-relaxed">
              {insight}
            </p>
          </div>
        ))}
        {insights.length === 0 && (
          <div className="sm:col-span-2 p-5 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark flex items-center justify-center h-full">
            <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark">Not enough data to generate insights yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialHealth;
