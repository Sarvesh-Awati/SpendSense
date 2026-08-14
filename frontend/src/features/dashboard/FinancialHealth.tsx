import React, { useEffect, useState } from 'react';
import Card, { SectionLabel } from '../../components/ui/Card';

interface FinancialHealthProps {
  score: number;
  status: 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';
}

const STATUS_STROKE: Record<FinancialHealthProps['status'], string> = {
  Excellent: '#10b981',
  Good: '#10b981',
  Fair: '#f59e0b',
  'Needs Attention': '#f43f5e',
};

/**
 * Factual list of the score's inputs, mirroring the weighting the backend
 * applies in dashboardService. Not personalised advice.
 */
const FACTORS = ['Savings', 'Budgets', 'Subscriptions', 'Cash flow'];

export const FinancialHealth: React.FC<FinancialHealthProps> = ({ score, status }) => {
  const stroke = STATUS_STROKE[status];

  const RADIUS = 46;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(score));
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const clamped = Math.max(0, Math.min(100, drawn));
  const offset = CIRCUMFERENCE - (CIRCUMFERENCE * clamped) / 100;

  return (
    <Card tone="bare" tier="secondary" className="h-full flex flex-col">
      <SectionLabel>Financial Health</SectionLabel>

      <div className="flex items-center gap-6 mt-5">
        <div className="relative">
          <svg
            className="w-[104px] h-[104px] -rotate-90"
            viewBox="0 0 108 108"
            role="img"
            aria-label={`Financial health score ${score} out of 100, rated ${status}`}
          >
            <circle
              className="text-black/[0.06] dark:text-white/[0.07]"
              strokeWidth="6"
              stroke="currentColor"
              fill="transparent"
              r={RADIUS}
              cx="54"
              cy="54"
            />
            <circle
              strokeWidth="6"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              strokeLinecap="round"
              stroke={stroke}
              fill="transparent"
              r={RADIUS}
              cx="54"
              cy="54"
              style={{ transition: 'stroke-dashoffset 1000ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-outfit text-[34px] font-bold tracking-tight tnum leading-none">
              {score}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <p
            className="font-outfit text-[15px] font-bold tracking-[0.04em] uppercase"
            style={{ color: stroke }}
          >
            {status}
          </p>
          <p className="text-[11px] text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">
            {score} / 100
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-5">
          {FACTORS.map((factor) => (
            <span
              key={factor}
              className="text-[11px] text-text-secondaryLight dark:text-text-secondaryDark"
            >
              {factor}
            </span>
          ))}
      </div>
    </Card>
  );
};

export default FinancialHealth;
