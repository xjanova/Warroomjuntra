'use client';

import type { SoundProfile } from '@/lib/stores/settings';

/**
 * Short AudioContext beep keyed to the operator's chosen sound profile + volume.
 * Shared by the Settings "ทดลองเสียง" preview button and the live AlertBridge so
 * the `sound.profile` / `sound.volume` settings actually drive real alert audio
 * (previously they only affected the preview).
 *
 * Best-effort: browser autoplay policy may suspend audio until the page has had
 * a user gesture — we swallow that instead of throwing.
 */
export function playAlertSound(profile: SoundProfile, volumePct: number): void {
  if (typeof window === 'undefined') return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const vol = Math.max(0, Math.min(100, volumePct)) / 100;
    const freq = profile === 'bridge' ? 880 : profile === 'submarine' ? 440 : 660;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.value = vol * 0.2;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);

    // Cathedral profile gets a soft second tone for a richer "chime".
    if (profile === 'cathedral') {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.value = 990;
      osc2.type = 'sine';
      gain2.gain.value = vol * 0.12;
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.09);
      osc2.stop(ctx.currentTime + 0.3);
    }
  } catch {
    /* audio context blocked (no gesture yet) — ignore */
  }
}

/**
 * Fire a desktop notification — only when the operator already granted
 * permission (requested from Settings → Notifications). No-op otherwise.
 */
export function fireDesktopNotification(title: string, body?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag: 'warroom-alert' });
  } catch {
    /* ignore */
  }
}
