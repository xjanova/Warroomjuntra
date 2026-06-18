import type { Channel } from '@/lib/mock/types';
import type { FortuneReading } from '@/lib/api';

/**
 * Authoritative LINE-vs-FB detection for a FortuneReading.
 *
 * Trust order:
 *   1. `platform` column (backend resource, 2026-06-19) — the canonical signal,
 *      set on every reading at create time ('facebook' | 'line').
 *   2. email prefix (`fb_…@` / `line_…@`) — synthesized by Fortune Bot.
 *   3. facebook_user_id present → FB.
 *   4. default → FB: Fortune Bot is FB-first (~99% of traffic).
 *
 * The old heuristic `r.facebook_user_id ? 'FB' : 'LINE'` was wrong: the reading
 * row's facebook_user_id is null for many FB readings (and ALL LINE readings),
 * so it mislabeled ~everything LINE. `platform` removes the guessing entirely
 * once the backend ships it; the rest are fallbacks for older deploys.
 */
export function inferReadingChannel(r: FortuneReading): Channel {
  const platform = (r.platform ?? '').toLowerCase();
  if (platform === 'line') return 'LINE';
  if (platform === 'facebook') return 'FB';
  const email = (r.user?.email ?? '').toLowerCase();
  if (email.startsWith('line_')) return 'LINE';
  if (email.startsWith('fb_')) return 'FB';
  if (r.facebook_user_id) return 'FB';
  return 'FB';
}

/**
 * Extract the platform user id (FB PSID / LINE userId) for a reading, so chat
 * send/ban operations + per-customer grouping target the real platform identity
 * instead of an internal placeholder.
 *
 * Order: facebook_user_id (FB — the worker queue matches on this) →
 * platform_user_id (the ONLY id for LINE; also set for FB) → the id embedded in
 * the synthesized email (`fb_<psid>@` / `line_<userid>@`) → null when none
 * available (caller falls back to an internal per-reading id for display only).
 */
export function extractReadingPsid(r: FortuneReading): string | null {
  if (r.facebook_user_id) return r.facebook_user_id;
  if (r.platform_user_id) return r.platform_user_id;
  const m = /^(?:fb|line)_([^@]+)@/i.exec(r.user?.email ?? '');
  return m ? m[1] : null;
}
