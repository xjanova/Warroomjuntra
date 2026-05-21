import { cn } from '@/lib/utils';

type Tone = 'ok' | 'warn' | 'crit' | 'info' | 'mystic' | 'mute';

export function StatusDot({ tone = 'mute', className }: { tone?: Tone; className?: string }) {
  return <span className={cn('dot', `dot-${tone}`, className)} />;
}
