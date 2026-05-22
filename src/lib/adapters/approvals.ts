import type { Approval } from '@/lib/mock/types';
import type { WithdrawalRequest } from '@/lib/api';

/**
 * Map withdrawal request → Approval card.
 */
export function withdrawalToApproval(w: WithdrawalRequest): Approval {
  const name = w.user?.name ?? `User #${w.user_id}`;
  const bank = w.bank_account ? `${w.bank_account.bank} ${w.bank_account.account_no.slice(-4)}` : 'ไม่ระบุบัญชี';
  return {
    id: `wd-${w.id}`,
    kind: 'WITHDRAW',
    tone: w.amount >= 10000 ? 'warn' : 'info',
    title: `ถอนเงิน — ${name}`,
    meta: `${bank} · ขอเมื่อ ${formatRequested(w.requested_at ?? w.created_at)}`,
    amount: w.amount,
  };
}

function formatRequested(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return iso;
  }
}
