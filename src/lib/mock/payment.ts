import type { Channel, Tone } from './types';

export type SmsRecord = {
  id: string;
  bank: 'KBANK' | 'SCB';
  account: string;
  amount: number;
  sender: string;
  time: string;
  ref: string;
  bestMatchDelta: number | null;
};

export type OpenBill = {
  id: string;
  customer: string;
  channel: Channel;
  amount: number;
  service: string;
  waiting: number;
  celtic?: boolean;
};

export type FloatingBill = {
  id: string;
  customer: string;
  service: string;
  amount: number;
  channel: Channel;
  waiting: number;
  slip: boolean;
  slipNote: string;
};

export type LedgerEntry = {
  time: string;
  kind: string;
  tone: Tone;
  desc: string;
  amount: number;
  balance: number;
};

// 🧹 (2026-06-04) demo data removed — live data only
export const UNMATCHED_SMS: SmsRecord[] = [];

// 🧹 (2026-06-04) demo data removed — live data only
export const OPEN_BILLS: OpenBill[] = [];

// 🧹 (2026-06-04) demo data removed — live data only
export const FLOATING_BILLS: FloatingBill[] = [];

// 🧹 (2026-06-04) demo data removed — live data only
export const LEDGER: LedgerEntry[] = [];

export const PAYMENT_TABS = [
  { k: 'match', label: 'จับคู่ SMS ↔ บิล', count: 4, tone: 'warn' as Tone },
  { k: 'floating', label: 'บิลลอย', count: 6, tone: 'crit' as Tone },
  { k: 'ledger', label: 'สมุดบัญชีวันนี้', count: 42, tone: 'info' as Tone },
];

// 🧹 (2026-06-04) demo data removed — live data only
export const PAYMENT_KPIS = [];
