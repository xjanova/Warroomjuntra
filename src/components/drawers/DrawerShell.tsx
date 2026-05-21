'use client';

import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function DrawerShell({
  open,
  onClose,
  width = 560,
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-30 bg-void/50 backdrop-blur-sm" onClick={onClose} />
      <aside
        className={cn(
          'fixed right-0 top-0 bottom-0 z-40 bg-panel border-l border-line flex flex-col',
          'drawer-enter-active',
        )}
        style={{ width }}
      >
        {children}
      </aside>
    </>
  );
}
