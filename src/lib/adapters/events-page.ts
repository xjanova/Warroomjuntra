import type { FullEvent } from '@/lib/mock/events-page';
import type { FortuneReading } from '@/lib/api';

/**
 * Synthesize a FullEvent[] from fortune readings.
 * Replace with /analytics/overview once that controller's shape is confirmed.
 */
export function readingsToFullEvents(readings: FortuneReading[]): FullEvent[] {
  return readings.map((r) => {
    const ts = r.created_at
      ? new Date(r.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '--:--:--';
    const channel = r.facebook_user_id ? 'FB' : 'LINE';
    const customer = r.user?.name ?? r.facebook_user_name ?? `#${r.id}`;

    if (r.is_paid && r.amount_paid > 0) {
      return {
        id: `pay-${r.id}`,
        ts,
        kind: 'PAY OK',
        tone: 'ok',
        category: 'payment',
        channel,
        msg: `รับชำระ ฿${r.amount_paid.toLocaleString()} · ${customer}`,
        ref: `#${r.id}`,
      };
    }
    if (r.response_type === 'admin') {
      return {
        id: `audit-${r.id}`,
        ts,
        kind: 'AUDIT',
        tone: 'mystic',
        category: 'audit',
        channel,
        msg: `Admin takeover · ${customer}`,
        actor: 'admin',
        ref: `log-${r.id}`,
      };
    }
    if (r.responded_at) {
      return {
        id: `read-${r.id}`,
        ts,
        kind: 'READ',
        tone: 'info',
        category: 'reading',
        channel,
        msg: `เสร็จคำทำนาย · ${r.ai?.provider ?? 'ai'} · ${customer}`,
        ref: `r-${r.id}`,
      };
    }
    return {
      id: `pending-${r.id}`,
      ts,
      kind: 'READ',
      tone: 'warn',
      category: 'reading',
      channel,
      msg: `รอคำทำนาย · ${customer}`,
      ref: `r-${r.id}`,
    };
  });
}
