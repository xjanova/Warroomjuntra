import type { Channel } from '@/lib/mock/types';
import type { FortuneReading } from '@/lib/api';

/**
 * Authoritative LINE-vs-FB detection for a FortuneReading.
 *
 * Production (verified 2026-05-23): Fortune Bot synthesizes user emails as
 *   fb_<psid>@thaiprompt.local      (FB Messenger)
 *   line_<userid>@thaiprompt.local  (LINE OA)
 * The email prefix is the AUTHORITATIVE signal — set at user-create time.
 *
 * The old heuristic `r.facebook_user_id ? 'FB' : 'LINE'` was wrong: the reading
 * row's facebook_user_id is null for many FB readings (identity lives in the
 * synthesized email, not the reading row), so it mislabeled ~all of them LINE.
 * facebook_user_id is kept only as a positive FB fallback. Default → FB:
 * Fortune Bot is FB-first (~99% of traffic), so an unknown row is FB, not LINE.
 *
 * Mirrors the trust order documented in `customers.ts` (inferChannel) so every
 * page agrees on a customer's channel.
 */
export function inferReadingChannel(r: FortuneReading): Channel {
  const email = (r.user?.email ?? '').toLowerCase();
  if (email.startsWith('line_')) return 'LINE';
  if (email.startsWith('fb_')) return 'FB';
  if (r.facebook_user_id) return 'FB';
  return 'FB';
}

/**
 * Extract the platform user id (FB PSID / LINE userId) for a reading, so chat
 * send/ban operations target the real platform identity instead of an internal
 * `U-{id}` placeholder.
 *
 * Order: the reading row's facebook_user_id (FB) → the id embedded in the
 * synthesized email (`fb_<psid>@` / `line_<userid>@`) → null when neither is
 * available (caller falls back to an internal id for display only).
 */
export function extractReadingPsid(r: FortuneReading): string | null {
  if (r.facebook_user_id) return r.facebook_user_id;
  const m = /^(?:fb|line)_([^@]+)@/i.exec(r.user?.email ?? '');
  return m ? m[1] : null;
}
