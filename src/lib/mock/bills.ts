import type { Channel } from './types';

export type BillStatus = 'open' | 'paid' | 'floating' | 'cancelled' | 'refunded';

export type Bill = {
  id: string;
  customer: string;
  channel: Channel;
  service: string;
  amount: number;
  status: BillStatus;
  when: string;
  paidAt?: string;
};

// 🧹 (2026-06-04) demo data removed — live data only
export const BILLS: Bill[] = [];

const STATUS_LABEL: Record<BillStatus, string> = {
  open: 'รอจ่าย',
  paid: 'จ่ายแล้ว',
  floating: 'บิลลอย',
  cancelled: 'ยกเลิก',
  refunded: 'คืนเงิน',
};

const STATUS_TONE: Record<BillStatus, 'ok' | 'warn' | 'crit' | 'rose' | 'dim'> = {
  open: 'warn',
  paid: 'ok',
  floating: 'crit',
  cancelled: 'dim',
  refunded: 'rose',
};

export function billStatusLabel(s: BillStatus): string {
  return STATUS_LABEL[s];
}
export function billStatusTone(s: BillStatus) {
  return STATUS_TONE[s];
}
