'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getVoices } from '@/lib/eve/voice';

/**
 * Mount-once bridge for Eve's action layer.
 *
 *  • Listens for `warroom:navigate` CustomEvents (dispatched by
 *    executeAction(GOTO)) and turns them into `router.push(path)` — actions.ts
 *    can't call useRouter directly because it runs from arbitrary code.
 *
 *  • Pre-warms the SpeechSynthesis voice list. Some browsers populate it
 *    asynchronously on first use, so calling getVoices() at app boot means the
 *    Settings → Eve AI tab and the first TTS call don't see an empty list.
 */
export function EveBridge() {
  const router = useRouter();

  useEffect(() => {
    const onNavigate = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { path?: string } | undefined;
      if (!detail?.path) return;
      try {
        router.push(detail.path);
      } catch (err) {
        console.warn('[EveBridge] navigate failed:', err);
      }
    };
    document.addEventListener('warroom:navigate', onNavigate);

    // Pre-warm voices (no-op if SpeechSynthesis unsupported)
    void getVoices().catch(() => {/* ignore */});

    return () => document.removeEventListener('warroom:navigate', onNavigate);
  }, [router]);

  return null;
}
