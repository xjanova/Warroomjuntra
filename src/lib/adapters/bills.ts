import type { Bill, BillStatus } from '@/lib/mock/bills';
import type { FortuneReading } from '@/lib/api';

/**
 * Map FortuneReading → Bill view.
 *
 * Each reading has an associated charge — paid/unpaid state is on the reading.
 * Cancelled/refunded states require a dedicated billing endpoint; for now any
 * reading with amount_paid===0 and no response is 'open'.
 */
export function readingToBill(r: FortuneReading): Bill {
  const customer = r.user?.name || r.facebook_user_name || `#${r.id}`;
  const channel = r.facebook_user_id ? 'FB' : 'LINE';
  const id = `${channel === 'FB' ? 'FB' : 'LN'}-${String(r.id).padStart(4, '0')}`;
  const service =
    r.reading_type === 'deep'
      ? 'Celtic Cross'
      : Array.isArray(r.categories) && r.categories.length
      ? r.categories[0]
      : 'ดูดวง';

  const status: BillStatus = r.is_paid
    ? 'paid'
    : r.amount_paid > 0 && !r.responded_at
    ? 'floating'
    : 'open';

  return {
    id,
    customer,
    channel,
    service: String(service),
    amount: Math.max(0, Math.round(r.amount_paid || 0)) || 0,
    status,
    when: formatTime(r.created_at),
    paidAt: r.paid_at ? formatTime(r.paid_at) : undefined,
  };
}

function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
