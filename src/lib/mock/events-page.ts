import type { Channel, Tone } from './types';

export type FullEvent = {
  id: number | string;
  ts: string;
  kind: string;
  tone: Tone;
  category: 'payment' | 'reading' | 'sensitive' | 'system' | 'bot' | 'audit' | 'moderation';
  channel?: Channel;
  msg: string;
  actor?: string;
  ref: string;
};

export const EVENT_TOGGLES: Array<{ k: FullEvent['category']; tone: Tone; label: string }> = [
  { k: 'payment', tone: 'ok', label: 'จ่ายเงิน' },
  { k: 'reading', tone: 'info', label: 'ดูดวง' },
  { k: 'sensitive', tone: 'rose', label: 'อ่อนไหว' },
  { k: 'system', tone: 'warn', label: 'ระบบ' },
  { k: 'bot', tone: 'mystic', label: 'บอท' },
  { k: 'audit', tone: 'mystic', label: 'audit' },
  { k: 'moderation', tone: 'crit', label: 'เฝ้าระวัง' },
];

// 🧹 (2026-06-04) demo data removed — live data only
export const FULL_EVENTS: FullEvent[] = [];
