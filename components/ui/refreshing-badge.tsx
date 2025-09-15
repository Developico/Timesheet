"use client";
import React from 'react';
import clsx from 'clsx';

/**
 * Small unobtrusive indicator for background refresh state.
 * Usage:
 *   <RefreshingBadge refreshing={refreshing} />
 */
export interface RefreshingBadgeProps {
  refreshing: boolean;
  className?: string;
  label?: string;          // Custom text (default: Aktualizuję…)
  showDotOnly?: boolean;   // If true only the animated dot is shown (no text)
  delayMs?: number;        // Optional delay before showing (avoid flicker on ultra-fast refresh)
}

export const RefreshingBadge: React.FC<RefreshingBadgeProps> = ({
  refreshing,
  className,
  label = 'Aktualizuję…',
  showDotOnly = false,
  delayMs = 150
}) => {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    if (refreshing) {
      const t = setTimeout(() => setVisible(true), delayMs);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [refreshing, delayMs]);

  if (!refreshing || !visible) return null;

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border border-border/50 bg-muted px-2 py-[2px] text-[10px] font-medium text-muted-foreground gap-1 select-none',
        'animate-in fade-in zoom-in-95',
        className
      )}
      aria-live="polite"
      aria-label={label}
      title={label}
    >
      <span className={clsx(
        'h-2 w-2 rounded-full bg-emerald-500',
        'relative',
        'before:content-[""] before:absolute before:inset-0 before:rounded-full before:bg-emerald-500/60 before:animate-ping'
      )} />
      {!showDotOnly && <span>{label}</span>}
    </span>
  );
};
