'use client';

import { useEffect } from 'react';
import { useWarroom } from '@/lib/stores/warroom';
import { cn } from '@/lib/utils';

const ACCENT: Record<string, string> = {
  ok: '#10b981',
  warn: '#f59e0b',
  crit: '#ef4444',
  info: '#22d3ee',
  mystic: '#8b5cf6',
};

export function ToastStack() {
  const { toasts, dismissToast } = useWarroom();

  useEffect(() => {
    const timers = toasts.map((t) => {
      const remaining = Math.max(0, 6000 - (Date.now() - t.createdAt));
      return setTimeout(() => dismissToast(t.id), remaining);
    });
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  return (
    <div className="fixed top-14 right-3 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn('toast pointer-events-auto')}
          style={{ borderLeftColor: ACCENT[t.kind] }}
        >
          <div className="flex items-start gap-2">
            <span className={cn('dot', `dot-${t.kind}`, 'mt-1.5')} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-fg">{t.title}</div>
              {t.body ? <div className="text-2xs text-dim mt-0.5">{t.body}</div> : null}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-mute hover:text-fg text-xs leading-none"
              aria-label="ปิด"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
