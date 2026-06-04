import type { Channel, Tone } from './types';

export type ApprovalKind = 'COMM' | 'BILL' | 'REFUND' | 'CREDIT';

export type ApprovalItem = {
  id: string;
  kind: ApprovalKind;
  tone: Tone;
  title: string;
  note: string;
  party: string;
  channel?: Channel | null;
  amount: number;
  when: string;
  by: string;
  detail: string;
  evidence?: { label: string; value: string }[];
};

export const APPROVAL_TABS = [
  { k: 'all', label: 'ทั้งหมด', count: 23, tone: 'warn' as Tone },
  { k: 'comm', label: 'คอมมิชชั่น', count: 6, tone: 'mystic' as Tone },
  { k: 'bill', label: 'แก้บิล', count: 4, tone: 'warn' as Tone },
  { k: 'refund', label: 'คืนเงิน', count: 4, tone: 'crit' as Tone },
  { k: 'credit', label: 'เครดิต', count: 9, tone: 'info' as Tone },
];

// 🧹 (2026-06-04) demo data removed — live data only
export const APPROVAL_ITEMS: ApprovalItem[] = [];

// 🧹 (2026-06-04) demo data removed — live data only
export const APPROVAL_STATS: { label: string; value: string; sub: string; color: string }[] = [];
