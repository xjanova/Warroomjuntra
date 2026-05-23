import type { SmsInboxItem } from '@/lib/api/endpoints';
import type { SmsRecord } from '@/lib/mock/payment';

/**
 * Map a thaiprompt SmsPaymentNotification → the mock SmsRecord shape the
 * /payment page UI already renders against. Keeps the JSX untouched.
 */
export function smsInboxToRecord(s: SmsInboxItem): SmsRecord {
  const fullAcct = s.account_number ?? '';
  const last3 = fullAcct ? fullAcct.slice(-3) : '???';

  // Best-match delta = distance to the matched bill if any. Pending SMS get
  // null (UI shows "ไม่พบบิลใกล้"). Matched SMS get 0 (UI shows "มีบิลตรงเป๊ะ").
  let delta: number | null = null;
  if (s.matched_bill) {
    delta = Math.round((s.amount - s.matched_bill.amount) * 100) / 100;
  }

  // Bank → KBANK | SCB | KTB | … the UI styles green for KBANK, mystic for SCB.
  const bank = (s.bank || 'KBANK').toUpperCase() as SmsRecord['bank'];

  return {
    id: `sms-${s.id}`,
    bank: bank as SmsRecord['bank'],
    amount: Number(s.amount),
    sender: s.sender_or_receiver ?? '—',
    account: last3,
    time: s.sms_timestamp
      ? new Date(s.sms_timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      : '—',
    ref: s.reference_number ?? '—',
    bestMatchDelta: delta,
    // Carry the raw id so callers can hit /match and /reject endpoints
    _serverId: s.id,
  } as SmsRecord & { _serverId: number };
}

/**
 * Convert recon stats into the 5 KPI tiles the UI renders. Adapter ensures
 * the mock-shaped tiles get populated with real numbers.
 */
export function reconStatsToKpis(stats: {
  today: { total: number; matched: number; pending: number; match_rate_pct: number };
  week_by_status: Record<string, { count: number; amount_sum_thb: number }>;
}) {
  const matchedAmount = stats.week_by_status['matched']?.amount_sum_thb ?? 0;
  const pendingAmount = stats.week_by_status['pending']?.amount_sum_thb ?? 0;
  return [
    {
      label: 'SMS วันนี้',
      value: stats.today.total.toLocaleString(),
      sub: 'รายการเข้า',
      color: '#22d3ee',
      subColor: '#6b7280',
    },
    {
      label: 'จับคู่แล้ว',
      value: stats.today.matched.toLocaleString(),
      sub: `${stats.today.match_rate_pct}% match rate`,
      color: '#10b981',
      subColor: '#10b981',
    },
    {
      label: 'รอจับคู่',
      value: stats.today.pending.toLocaleString(),
      sub: 'ต้องดูเอง',
      color: '#f59e0b',
      subColor: '#f59e0b',
    },
    {
      label: 'ยอดจับคู่ (7 วัน)',
      value: '฿' + Math.round(matchedAmount).toLocaleString(),
      sub: 'รวมยอดผ่านระบบ',
      color: '#a78bfa',
      subColor: '#6b7280',
    },
    {
      label: 'ยอดค้าง (7 วัน)',
      value: '฿' + Math.round(pendingAmount).toLocaleString(),
      sub: 'รอ admin',
      color: '#ef4444',
      subColor: '#6b7280',
    },
  ];
}
