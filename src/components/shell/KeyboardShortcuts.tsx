'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWarroom } from '@/lib/stores/warroom';

const PANEL_ROUTES = ['/', '/chat', '/predict', '/bills', '/payment', '/approvals', '/moderation', '/bots', '/customers', '/events'];

export function KeyboardShortcuts() {
  const router = useRouter();
  const {
    setCmdkOpen,
    setFocusMode,
    setFrozen,
    setMuted,
    closeCaseDrawer,
    closeCustomerDrawer,
    setSettingsOpen,
  } = useWarroom();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdkOpen(true);
        return;
      }

      if (isInput) return;

      switch (e.key) {
        case 'Escape': {
          // Let drawers/modals handle their own ESC via their own listeners.
          // Here we close global ones as a fallback.
          closeCaseDrawer();
          closeCustomerDrawer();
          setSettingsOpen(false);
          setCmdkOpen(false);
          break;
        }
        case 'f':
        case 'F':
          setFocusMode(!useWarroom.getState().focusMode);
          break;
        case ' ': // space → freeze toggle
          e.preventDefault();
          setFrozen(!useWarroom.getState().frozen);
          break;
        case 'm':
        case 'M':
          setMuted(!useWarroom.getState().muted);
          break;
        case '?':
          // open settings as a hint surface
          setSettingsOpen(true);
          break;
        default: {
          if (/^[1-9]$/.test(e.key)) {
            const idx = Number(e.key) - 1;
            const target = PANEL_ROUTES[idx];
            if (target) router.push(target);
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, setCmdkOpen, setFocusMode, setFrozen, setMuted, closeCaseDrawer, closeCustomerDrawer, setSettingsOpen]);

  return null;
}
