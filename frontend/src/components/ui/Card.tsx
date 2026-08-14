import React from 'react';

/**
 * Surface primitive for the SpendSense composition.
 *
 * The design language leans on contrast between three surface tones sitting on
 * a deep charcoal canvas, rather than one repeated card style:
 *
 *   panel  — the default dark container (secondary)
 *   raised — one step lighter than panel, for the hero / focal card
 *   paper  — warm off-white card placed *inside* the dark interface
 *
 * `tier` controls corner radius and padding so hierarchy reads by size as well
 * as by colour: hero > secondary > compact.
 */
export type CardTone = 'panel' | 'raised' | 'paper' | 'bare';
export type CardTier = 'hero' | 'secondary' | 'compact';

interface CardProps {
  children: React.ReactNode;
  tone?: CardTone;
  tier?: CardTier;
  className?: string;
  /** Subtle lift on hover. Off for purely static panels. */
  interactive?: boolean;
  padded?: boolean;
  style?: React.CSSProperties;
}

const TONE_CLASSES: Record<CardTone, string> = {
  // Light mode keeps white cards; dark mode uses the charcoal panel.
  panel: 'bg-white dark:bg-card-dark border border-border-light dark:border-border-dark shadow-float dark:shadow-float-dark',
  raised:
    'bg-white dark:bg-surface-raised border border-border-light dark:border-white/[0.06] shadow-float dark:shadow-float-dark',
  // Warm paper reads as light in BOTH themes — this is the light-inside-dark moment.
  paper: 'bg-surface-paper border border-black/[0.04] shadow-float text-ink-strong',
  // No chrome at all: the section sits directly on the page. Used so that not
  // every block on the dashboard reads as a card.
  bare: '',
};

const TIER_CLASSES: Record<CardTier, string> = {
  hero: 'rounded-hero p-7 sm:p-9',
  secondary: 'rounded-card p-6 sm:p-7',
  compact: 'rounded-panel p-5 sm:p-6',
};

/** `bare` sections keep the tier's rhythm but drop its padding and radius. */
const BARE_TIER_CLASSES: Record<CardTier, string> = {
  hero: '',
  secondary: '',
  compact: '',
};

export const Card: React.FC<CardProps> = ({
  children,
  tone = 'panel',
  tier = 'secondary',
  className = '',
  interactive = false,
  padded = true,
  style,
}) => (
  <div
    style={style}
    className={[
      TONE_CLASSES[tone],
      tone === 'bare'
        ? BARE_TIER_CLASSES[tier]
        : padded
        ? TIER_CLASSES[tier]
        : TIER_CLASSES[tier].split(' ')[0],
      interactive && tone !== 'bare'
        ? 'transition-[transform,box-shadow,border-color] duration-300 motion-safe:hover:-translate-y-1 hover:shadow-float-dark'
        : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {children}
  </div>
);

/**
 * Section label. Small, muted, lightly tracked — the reference language uses
 * quiet labels above loud numbers, so this stays deliberately understated.
 */
interface SectionLabelProps {
  children: React.ReactNode;
  /** Set when the label sits on a `paper` surface, which inverts text colour. */
  onPaper?: boolean;
  className?: string;
}

export const SectionLabel: React.FC<SectionLabelProps> = ({
  children,
  onPaper = false,
  className = '',
}) => (
  <p
    className={`text-[11px] font-semibold tracking-[0.06em] uppercase ${
      onPaper ? 'text-ink-muted' : 'text-text-secondaryLight dark:text-text-secondaryDark'
    } ${className}`}
  >
    {children}
  </p>
);

/** Panel header: quiet label on the left, optional action on the right. */
interface PanelHeadProps {
  label: string;
  action?: React.ReactNode;
  onPaper?: boolean;
  className?: string;
}

export const PanelHead: React.FC<PanelHeadProps> = ({
  label,
  action,
  onPaper = false,
  className = '',
}) => (
  <div className={`flex items-center justify-between gap-3 ${className}`}>
    <SectionLabel onPaper={onPaper}>{label}</SectionLabel>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export default Card;
