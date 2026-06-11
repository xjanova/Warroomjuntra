import type { ApprovalItem } from '@/lib/mock/approvals-page';
import type { WithdrawalRequest } from '@/lib/api';

/**
 * Map withdrawal request → ApprovalItem (full-page version).
 * Withdrawals are money flowing OUT, so they render in 'REFUND' tone (red).
 */
export function withdrawalToApprovalItem(w: WithdrawalRequest): ApprovalItem {
  const name = w.user?.name ?? `User #${w.user_id}`;
  const bankLine = w.bank_account
    ? `${w.bank_account.bank} ${w.bank_account.account_no} (${w.bank_account.account_name})`
    : 'ไม่ระบุบัญชี';

  const when = formatTime(w.requested_at ?? w.created_at);

  return {
    id: `wd-${w.id}`,
    userId: w.user_id ?? w.user?.id ?? null,
    kind: 'REFUND',
    tone: w.amount >= 10000 ? 'crit' : 'warn',
    title: `ถอนเงิน — ${name}`,
    note: bankLine,
    party: name,
    channel: null,
    amount: -Math.abs(w.amount),
    when,
    by: 'user',
    detail: `${name} ขอถอนเงิน ฿${w.amount.toLocaleString()} เข้าบัญชี ${bankLine}${w.fee ? ` · ค่าธรรมเนียม ฿${w.fee.toLocaleString()}` : ''}${w.net_amount ? ` · สุทธิ ฿${w.net_amount.toLocaleString()}` : ''}`,
    evidence: [
      ...(w.bank_account
        ? [{ label: 'บัญชีรับโอน', value: bankLine }]
        : []),
      ...(w.fee !== undefined ? [{ label: 'ค่าธรรมเนียม', value: `฿${w.fee.toLocaleString()}` }] : []),
      ...(w.net_amount !== undefined ? [{ label: 'สุทธิ', value: `฿${w.net_amount.toLocaleString()}` }] : []),
      { label: 'สถานะ', value: w.status },
      { label: 'ขอเมื่อ', value: formatFullDate(w.requested_at ?? w.created_at) },
    ],
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

function formatFullDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
