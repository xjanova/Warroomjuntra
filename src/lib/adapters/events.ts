import type { EventItem } from '@/lib/mock/types';
import type { FortuneReading } from '@/lib/api';

/**
 * Build a synthetic event stream from latest fortune readings.
 * Until /analytics/overview ships proper event rows, this gives the panel
 * something live to display.
 */
export function readingsToEvents(readings: FortuneReading[]): EventItem[] {
  return readings.map((r, idx) => {
    const ts = r.created_at ? new Date(r.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';

    if (r.is_paid && r.amount_paid > 0) {
      return {
        id: `pay-${r.id}`,
        ts,
        kind: 'PAY OK',
        tone: 'ok',
        msg: `รับชำระ ฿${r.amount_paid.toLocaleString()} · ${r.user?.name ?? r.facebook_user_name ?? '#' + r.id}`,
        ref: `#${r.id}`,
      };
    }
    if (r.response_type === 'admin') {
      return {
        id: `audit-${r.id}`,
        ts,
        kind: 'AUDIT',
        tone: 'mystic',
        msg: `Admin takeover · ${r.user?.name ?? r.facebook_user_name ?? '#' + r.id}`,
        ref: `log-${idx}`,
      };
    }
    if (r.responded_at) {
      return {
        id: `read-done-${r.id}`,
        ts,
        kind: 'READ',
        tone: 'info',
        msg: `เสร็จคำทำนาย · ${r.ai?.provider ?? 'ai'} · ${r.user?.name ?? r.facebook_user_name ?? '#' + r.id}`,
        ref: `r-${r.id}`,
      };
    }
    return {
      id: `read-pending-${r.id}`,
      ts,
      kind: 'READ',
      tone: 'warn',
      msg: `รอคำทำนาย · ${r.user?.name ?? r.facebook_user_name ?? '#' + r.id}`,
      ref: `r-${r.id}`,
    };
  });
}
