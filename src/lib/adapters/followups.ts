import type { Followup, Channel } from '@/lib/mock/types';
import type { FortuneReading } from '@/lib/api';

/**
 * Map a FortuneReading row (paid_at = null, bill exists) → Followup card.
 *
 * Followups are customers who CREATED a reading (FB Messenger flow triggers a
 * row in fortune_readings as soon as the customer asks for a paid service)
 * but never paid. The bot+admin job is to tap them before they go cold.
 *
 * silentMin: minutes since the row was created. If we have `responded_at`
 * (the bot pushed a QR/info message) we count from that — that's the actual
 * "silent since" the customer-facing timer.
 */
export function readingToFollowup(r: FortuneReading): Followup {
  const channel: Channel = inferChannel(r);
  const name = r.facebook_user_name ?? r.user?.name ?? `(ลูกค้า ${r.id})`;
  const service = inferServiceLabel(r);
  const amount = Number(r.amount_paid ?? 0) || guessAmountFromService(service);
  const since = r.responded_at ?? r.created_at ?? null;
  const silentMin = since ? Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60_000)) : 0;
  // VIP heuristic: ราคา > 999 = น่าตามหนัก
  const vip = amount >= 999;

  return {
    id: `r-${r.id}`,
    customer: name,
    service,
    channel,
    bill: `R-${String(r.id).padStart(5, '0')}`,
    amount,
    silentMin,
    vip,
  };
}

function inferChannel(r: FortuneReading): Channel {
  // FortuneReading carries facebook_user_id when the message came from FB.
  // No explicit LINE flag on the reading row itself, so default FB unless
  // the user record clearly says LINE via the email prefix.
  const e = (r.user?.email ?? '').toLowerCase();
  if (e.startsWith('line_')) return 'LINE';
  if (r.facebook_user_id) return 'FB';
  return 'FB';
}

function inferServiceLabel(r: FortuneReading): string {
  const t = (r.reading_type ?? '').toLowerCase();
  // Production uses 'celtic_cross' / 'basic' / 'deep' as reading_type.
  if (t === 'celtic_cross' || t === 'celtic' || t === 'deep') return 'Celtic Cross';
  if (t === 'basic') return 'ดูดวง 3 ใบ';
  // Fall back to first category / question.
  if (Array.isArray(r.categories) && r.categories.length > 0) return String(r.categories[0]);
  if (typeof r.categories === 'string' && r.categories) return r.categories;
  if (Array.isArray(r.questions) && r.questions.length > 0) {
    const q = String(r.questions[0]);
    return q.length > 32 ? q.slice(0, 32) + '…' : q;
  }
  return 'ดูดวง';
}

function guessAmountFromService(service: string): number {
  // For rows where amount_paid is 0 (because they never paid), use a price
  // guess from the service label so the card still shows something
  // meaningful instead of "฿0". Numbers match the Fortune Bot price book.
  const s = service.toLowerCase();
  if (s.includes('celtic')) return 99; // Celtic 99 promo (active campaign)
  if (s.includes('3 ใบ') || s.includes('basic')) return 99;
  return 99;
}
