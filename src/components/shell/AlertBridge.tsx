'use client';

import { useEffect, useRef } from 'react';
import { useSettings, isPaired } from '@/lib/stores/settings';
import { useWarroom } from '@/lib/stores/warroom';
import { useAdminData, fetchEveSignals, type EveSignals } from '@/lib/api';
import { playAlertSound, fireDesktopNotification } from '@/lib/alerts';

/**
 * Makes the Settings → Notifications toggles actually do something. Watches the
 * same `eve-signals` feed Eve already polls (shared cache key → no extra API
 * load) and, when a NEW critical situation appears, fires the operator's
 * configured alerts:
 *   - `soundOnCritical`     → playAlertSound(profile, volume), unless muted
 *   - `desktopNotification` → fireDesktopNotification(...)
 *   - `mood5Instant`        → extra ping when triage_crit (mood-5 / emotional
 *                             behaviour cases) rises
 *
 * Renders nothing.
 */
export function AlertBridge() {
  const paired = useSettings((s) => isPaired(s));
  const notifications = useSettings((s) => s.notifications);
  const sound = useSettings((s) => s.sound);
  const muted = useWarroom((s) => s.muted);

  const signals = useAdminData<EveSignals | null>({
    key: 'eve-signals',
    fetcher: () => fetchEveSignals(),
    mock: null,
    intervalOverride: 30,
  });

  // Baselines so we only alert on a RISE, and never on the first live tick
  // (which would spam the operator with a beep for every already-open case).
  const lastCrit = useRef<number | null>(null);
  const lastMood5 = useRef<number | null>(null);

  useEffect(() => {
    if (!paired || signals.source !== 'live' || !signals.data) return;
    const crit = signals.data.alert?.crit ?? 0;
    const triageCrit = signals.data.fortune?.triage_crit ?? 0;

    if (lastCrit.current === null) {
      lastCrit.current = crit;
      lastMood5.current = triageCrit;
      return; // seed baseline silently
    }

    if (crit > lastCrit.current) {
      const headline = signals.data.alert?.headline || `${crit} เคสวิกฤต`;
      if (notifications.soundOnCritical && !muted) playAlertSound(sound.profile, sound.volume);
      if (notifications.desktopNotification) fireDesktopNotification('⚠ War Room — เคสวิกฤต', headline);
    }

    if (notifications.mood5Instant && triageCrit > (lastMood5.current ?? 0)) {
      if (!muted) playAlertSound(sound.profile, sound.volume);
      fireDesktopNotification('😡 เคสอารมณ์รุนแรง (mood 5)', 'มีเคสพฤติกรรมเร่งด่วนใหม่ในคิว');
    }

    lastCrit.current = crit;
    lastMood5.current = triageCrit;
  }, [paired, signals.source, signals.data, notifications, sound, muted]);

  // Reset baselines when unpaired so re-pairing re-seeds instead of alerting.
  useEffect(() => {
    if (!paired) {
      lastCrit.current = null;
      lastMood5.current = null;
    }
  }, [paired]);

  return null;
}
