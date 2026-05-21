import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function Panel({
  children,
  className,
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <section className={cn('panel', className)}>
      <div className={cn('flex flex-col h-full min-h-0', innerClassName)}>{children}</div>
    </section>
  );
}

export function PanelHeader({
  title,
  meta,
  actions,
  tone = 'info',
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  tone?: 'ok' | 'warn' | 'crit' | 'info' | 'mystic' | 'mute';
}) {
  return (
    <header className="panel-h">
      <div className="title">
        <span className={`dot dot-${tone}`} />
        <span className="t-h">{title}</span>
        {meta ? <span className="text-2xs text-mute">{meta}</span> : null}
      </div>
      {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
    </header>
  );
}
