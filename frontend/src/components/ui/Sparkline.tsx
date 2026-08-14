import React, { useId } from 'react';

interface SparklineProps {
  /** Real series values, oldest first. */
  values: number[];
  stroke?: string;
  /** Adds a soft gradient fill beneath the line. */
  filled?: boolean;
  className?: string;
  height?: number;
}

/**
 * Minimal, dependency-free sparkline.
 *
 * Recharts is already in the bundle for the main charts, but it is far too
 * heavy for a decorative inline trace — this renders a single path from the
 * same real series the dashboard already fetched.
 */
export const Sparkline: React.FC<SparklineProps> = ({
  values,
  stroke = '#10b981',
  filled = true,
  className = '',
  height = 48,
}) => {
  const gradientId = useId();

  if (values.length < 2) return null;

  const WIDTH = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Flat series would divide by zero — pin them to the vertical centre instead.
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * WIDTH;
    const y = height - ((v - min) / range) * (height * 0.82) - height * 0.09;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${WIDTH},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {filled && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export default Sparkline;
