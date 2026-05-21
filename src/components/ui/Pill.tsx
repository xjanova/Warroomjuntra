import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type Tone = 'ok' | 'warn' | 'crit' | 'info' | 'mystic' | 'rose' | 'dim';

export function Pill({
  tone = 'dim',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn('pill', `pill-${tone}`, className)}>{children}</span>;
}

export function ChannelChip({
  channel,
  size = 'sm',
}: {
  channel: 'fb' | 'line';
  size?: 'sm' | 'lg';
}) {
  const label = channel === 'fb' ? 'FB' : 'LINE';
  const ico = channel === 'fb' ? 'f' : 'L';
  return (
    <span className={cn('chan', `chan-${channel}`, size === 'lg' && 'chan-big')}>
      <span className={cn('chan-ico', channel)}>{ico}</span>
      <span>{label}</span>
    </span>
  );
}
