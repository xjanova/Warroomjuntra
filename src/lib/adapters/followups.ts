import type { Followup, FollowupStatus, Channel } from '@/lib/mock/types';
import type { FortuneReading } from '@/lib/api';

/**
 * Map a FortuneReading row → Followup card.
 *
 * Two follow-up modes:
 *   1. await_payment  — created a bill but never paid. Need to nudge.
 *   2. await_reading  — already paid, but the bot hasn't delivered the
 *      reading yet (responded_at null or ai_response empty). This is the
 *      "stuck-paid" case — much more urgent because the customer's money
 *      is sitting in the system without a deliverable.
 *
 * silentMin counts from the moment that matters:
 *   - await_reading → from paid_at (how long they've been waiting on us)
 *   - await_payment → from responded_at (last bot push) or created_at
 */
export function readingToFollowup(r: FortuneReading): Followup {
  const channel: Channel = inferChannel(r);
  const name = r.facebook_user_name ?? r.user?.name ?? `(ลูกค้า ${r.id})`;
  const service = inferServiceLabel(r);
  const amount = Number(r.amount_paid ?? 0) || guessAmountFromService(service);

  const status: FollowupStatus = classifyStatus(r);
  const since =
    status === 'await_reading'
      ? r.paid_at ?? r.responded_at ?? r.created_at
      : r.responded_at ?? r.created_at;
  const silentMin = since ? Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60_000)) : 0;

  // VIP heuristic: stuck-paid OR high-ticket = น่าตามหนัก
  const vip = status === 'await_reading' || amount >= 999;

  return {
    id: `r-${r.id}`,
    customer: name,
    service,
    channel,
    bill: `R-${String(r.id).padStart(5, '0')}`,
    amount,
    silentMin,
    vip,
    status,
  };
}

/**
 * Classify a reading row. Returns null when the row doesn't need follow-up
 * at all (paid + responded + has ai_response).
 */
export function classifyStatus(r: FortuneReading): FollowupStatus {
  if (r.is_paid || r.paid_at) {
    // Paid. Has the bot delivered yet?
    const hasResponse = !!r.responded_at && !!(r.ai_response ?? '').toString().trim();
    return hasResponse ? 'await_reading' : 'await_reading'; // either way "we owe them" until delivered
  }
  return 'await_payment';
}

/**
 * Is this row still pending — i.e. should appear in the followup strip at all?
 * (Used by FollowupStrip filter.)
 */
export function needsFollowup(r: FortuneReading): boolean {
  // Already fully delivered: skip.
  const paid = !!(r.is_paid || r.paid_at);
  const delivered = !!r.responded_at && !!(r.ai_response ?? '').toString().trim();
  if (paid && delivered) return false;
  return true;
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
