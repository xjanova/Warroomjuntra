'use client';

import { useAdminData, fetchEveSignals, type EveSignals } from '@/lib/api';
import { useEve } from '@/lib/stores/eve';
import { useSettings, isPaired as isPairedFn } from '@/lib/stores/settings';

export type EveHealth = 'offline' | 'ai-down' | 'online';

export type EveHealthState = {
  paired: boolean;
  connStatus: ReturnType<typeof useSettings.getState>['connection']['status'];
  signals: EveSignals | null;
  signalsSource: 'live' | 'mock' | 'loading' | 'error';
  health: EveHealth;
  healthDot: string;
  healthText: string;
};

/**
 * Shared honest-connectivity derivation for Eve — used by BOTH the floating
 * dock (Eve.tsx) and the full /eve page so they can never disagree. Eve must
 * NOT claim "online" while she can't actually reach the AI. Priority:
 *   not paired                            → 'offline' (no backend at all)
 *   last chat failed, or AI pool drained  → 'ai-down'
 *   confirmed chat / healthy pool          → 'online'
 *
 * useAdminData dedupes by key, so multiple subscribers share one 'eve-signals'
 * cache slot + in-flight request.
 */
export function useEveHealth(): EveHealthState {
  const paired = useSettings((s) => isPairedFn(s));
  const connStatus = useSettings((s) => s.connection.status);
  const aiStatus = useEve((s) => s.aiStatus);

  const signalsFeed = useAdminData({
    key: 'eve-signals',
    fetcher: () => fetchEveSignals(),
    mock: null as unknown as EveSignals,
    intervalOverride: 30,
  });
  const signals = signalsFeed.source === 'live' ? signalsFeed.data : null;

  // keys_active === 0 means zero usable AI keys → always AI-down (a stale prior
  // 'online' can't mask it); the providers-offline heuristic only fills in the gap
  // before the first real chat attempt sets aiStatus.
  const noKeys = signals != null && signals.ai_pool.keys_active === 0;
  const poolDrained =
    signals != null &&
    signals.ai_pool.keys_active > 0 &&
    signals.ai_pool.providers_offline >= signals.ai_pool.keys_active;
  // Paired but the signals feed itself is erroring (network/500/timeout — NOT a
  // 401, which already flips `paired` false). Eve's backend is unreachable, so
  // don't claim online. A confirmed chat (aiStatus==='online') still wins.
  const signalsErrored = signalsFeed.source === 'error';
  const health: EveHealth = !paired
    ? 'offline'
    : noKeys || aiStatus === 'offline' || (aiStatus !== 'online' && (poolDrained || signalsErrored))
    ? 'ai-down'
    : 'online';
  const healthDot = health === 'online' ? '#10b981' : health === 'ai-down' ? '#f59e0b' : '#6b7280';
  // 'error' = was paired then the token died / call failed → nudge re-pair.
  // 'idle'  = never connected this session.
  const offlineText = connStatus === 'error' ? 'เชื่อมต่อหลุด · ต่อใหม่ใน Settings' : 'ออฟไลน์ · ยังไม่เชื่อมต่อ';
  const healthText =
    health === 'offline'
      ? offlineText
      : health === 'ai-down'
      ? 'AI ออฟไลน์ · เชื่อมต่อไม่ได้'
      : signals
      ? signals.alert.headline
      : 'ออนไลน์ · เฝ้าระบบ';

  return { paired, connStatus, signals, signalsSource: signalsFeed.source, health, healthDot, healthText };
}
