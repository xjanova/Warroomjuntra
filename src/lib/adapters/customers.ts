import type { CustomerCard, Rarity } from '@/lib/mock/customers';
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

  // No FB/LINE channel from /users; infer from verification flags
  const channel = u.facebook_verified ? 'FB' : 'LINE';

  // No sentiment series — synthesize neutral string (14 chars) so the UI keeps shape.
  const sentiment = 'o'.repeat(14);

  return {
    id: u.id,
    name: u.name ?? u.email ?? `User #${u.id}`,
    psid: u.referral_code ?? `id-${u.id}`,
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
