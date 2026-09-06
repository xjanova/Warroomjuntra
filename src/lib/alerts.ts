'use client';

import type { SoundProfile } from '@/lib/stores/settings';

/**
 * ONE shared AudioContext for the whole app.
 *
 * Every alert used to `new AudioContext()` per beep and never close it —
 * Chrome hard-caps live contexts per page (a long shift with a chatty queue
 * eventually hits the cap and every later alert goes silent). One context,
 * resumed on demand, also survives the browser's autoplay policy: it is created
 * suspended before the first gesture and flips to 'running' as soon as the
 * operator clicks anywhere in the war room.
 */
let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new Ctx();
    if (sharedCtx.state === 'suspended') void sharedCtx.resume().catch(() => {});
    return sharedCtx;
  } catch {
    return null;
  }
}

/** One shaped note. The short attack/release ramp is what keeps a raw
 *  oscillator from clicking at both ends. */
function tone(
  ctx: AudioContext,
  freq: number,
  atSec: number,
  durSec: number,
  peak: number,
  type: OscillatorType = 'sine',
): void {
  const t0 = ctx.currentTime + atSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durSec + 0.02);
}

function volumeOf(volumePct: number): number {
  return Math.max(0, Math.min(100, volumePct)) / 100;
}

/**
 * Short beep keyed to the operator's chosen sound profile + volume. Used by the
 * Settings "ทดลองเสียง" preview and by AlertBridge for CRITICAL cases.
 *
 * Returns `false` when audio is still blocked by the browser's autoplay policy
 * (no user gesture on this tab yet) so the caller can fall back to a visual
 * cue instead of assuming the operator heard something.
 */
export function playAlertSound(profile: SoundProfile, volumePct: number): boolean {
  const ctx = getCtx();
  if (!ctx) return false;
  try {
    const vol = volumeOf(volumePct);
    const freq = profile === 'bridge' ? 880 : profile === 'submarine' ? 440 : 660;
    tone(ctx, freq, 0, 0.18, vol * 0.2);
    // Cathedral profile gets a soft second tone for a richer "chime".
    if (profile === 'cathedral') tone(ctx, 990, 0.09, 0.21, vol * 0.12);
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

/**
 * 🔔 The SALES alert — deliberately NOT the critical beep.
 *
 * Fires when a customer has asked for a reading and is picking a package: the
 * operator must recognise it without looking at the screen, so it is a rising
 * three-note chime (triangle wave) instead of the flat single tone used for
 * critical cases. Same volume setting, same mute rules.
 *
 * Returns `false` when the browser is still blocking audio.
 */
export function playSalesAlertSound(volumePct: number): boolean {
  const ctx = getCtx();
  if (!ctx) return false;
  try {
    const vol = volumeOf(volumePct);
    // G5 → B5 → D6, then a soft octave tap: an upward "someone's at the door"
    // motif that can't be confused with the critical alarm.
    tone(ctx, 784, 0.0, 0.14, vol * 0.16, 'triangle');
    tone(ctx, 988, 0.11, 0.14, vol * 0.16, 'triangle');
    tone(ctx, 1175, 0.22, 0.26, vol * 0.18, 'triangle');
    tone(ctx, 1568, 0.34, 0.3, vol * 0.08, 'sine');
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

/**
 * Fire a desktop notification — only when the operator already granted
 * permission (requested from Settings → Notifications). No-op otherwise.
 *
 * `tag` groups notifications: the same tag replaces the previous one instead of
 * stacking. Sales alerts use their own tag so a package-choice ping never
 * overwrites a critical-case one.
 */
export function fireDesktopNotification(title: string, body?: string, tag = 'warroom-alert'): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag });
  } catch {
    /* ignore */
  }
}
