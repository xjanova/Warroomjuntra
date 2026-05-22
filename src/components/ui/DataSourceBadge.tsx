'use client';

import type { DataSource } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Tiny chip shown in panel headers so the operator can tell at a glance
 * whether a section is rendering live data or mock fallback.
 */
export function DataSourceBadge({
  source,
  isLoading,
  error,
  className,
  title,
}: {
  source: DataSource;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  title?: string;
}) {
  const tone =
    error || source === 'error'
      ? 'crit'
      : source === 'live'
      ? 'ok'
      : source === 'mock'
      ? 'dim'
      : 'info'; // loading
  const label =
    error || source === 'error'
      ? 'offline'
      : isLoading && source !== 'live'
      ? '…'
      : source === 'live'
      ? 'live'
      : source === 'loading'
      ? '…'
      : 'mock';

  return (
    <span
      title={title ?? (error ? `error: ${error}` : `data source: ${source}`)}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] tracking-widest uppercase font-semibold mono border',
        tone === 'ok' && 'border-ok/40 bg-ok/10 text-ok',
        tone === 'crit' && 'border-crit/40 bg-crit/10 text-crit',
        tone === 'info' && 'border-info/40 bg-info/10 text-info',
        tone === 'dim' && 'border-line bg-panel2 text-mute',
        className
      )}
    >
      <span
        className={cn(
          'w-1 h-1 rounded-full',
          tone === 'ok' && 'bg-ok',
          tone === 'crit' && 'bg-crit',
          tone === 'info' && 'bg-info animate-pulse',
          tone === 'dim' && 'bg-mute'
        )}
      />
      {label}
    </span>
  );
}
