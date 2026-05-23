import type { CustomerCard, Rarity } from '@/lib/mock/customers';
import type { Channel } from '@/lib/mock/types';
import type { AdminUserListItem } from '@/lib/api';

/**
 * Map thaiprompt user → warroom CustomerCard.
 * Rarity is bucketed by wallet balance (LTV proxy).
 */
export function userToCustomerCard(u: AdminUserListItem): CustomerCard {
  const ltv = Math.round(u.wallet?.balance ?? 0);
  const rarity = bucketRarity(ltv);
  const level = u.rank?.level ?? clamp(Math.floor(Math.log2((ltv || 1) + 1)), 1, 30);
  const exp = Math.min(100, Math.max(10, ltv % 100));

  const channel = inferChannel(u);
  const psid = extractPsid(u) ?? u.referral_code ?? `id-${u.id}`;

  // No sentiment series — synthesize neutral string (14 chars) so the UI keeps shape.
  const sentiment = 'o'.repeat(14);

  return {
    id: u.id,
    name: u.name ?? u.email ?? `User #${u.id}`,
    psid,
    channel,
    rarity,
    level,
    exp,
    vip: ltv >= 5000 || (u.rank?.level ?? 0) >= 5,
    problem: u.is_blocked,
    ltv,
    credits: Math.floor((u.wallet?.balance ?? 0) / 99),
    readings: 0, // would need a join from /fortune/readings count per user — TODO
    sentiment,
  };
}

/**
 * Production data 2026-05-23: Fortune Bot creates users with email
 * `fb_<psid>@thaiprompt.local` (FB Messenger) or `line_<userid>@thaiprompt.local`
 * (LINE OA). The boolean *_verified flags fire only when the user OAuth-binds
 * their social account inside Juntra web — almost no Fortune Bot user does that,
 * so flags are false-by-default and shouldn't be used as the channel signal.
 *
 * Order of trust:
 *   1. email prefix (authoritative — set by Fortune Bot at user-create time)
 *   2. *_verified flags (only set for Juntra web OAuth)
 *   3. default → 'FB' (Fortune Bot is FB-first; ~99% of users)
 */
function inferChannel(u: AdminUserListItem): Channel {
  const e = (u.email ?? '').toLowerCase();
  if (e.startsWith('fb_')) return 'FB';
  if (e.startsWith('line_')) return 'LINE';
  if (u.line_verified && !u.facebook_verified) return 'LINE';
  return 'FB';
}

/**
 * Extract the platform PSID/User ID from the synthesized email so the customer
 * card shows a real Messenger PSID instead of a useless referral code.
 */
function extractPsid(u: AdminUserListItem): string | null {
  const e = u.email ?? '';
  const m = /^(fb|line)_([^@]+)@/i.exec(e);
  return m ? m[2] : null;
}

function bucketRarity(ltv: number): Rarity {
  if (ltv >= 20000) return 'LEGENDARY';
  if (ltv >= 5000) return 'EPIC';
  if (ltv >= 1000) return 'RARE';
  if (ltv >= 200) return 'UNCOMMON';
  return 'COMMON';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
