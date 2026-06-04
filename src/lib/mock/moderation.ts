import type { Channel, Tone } from './types';

export type Suspect = {
  id: string;
  name: string;
  psid: string;
  channel: Channel;
  level: number; // 0 ปกติ - 4 แบน
  score: number;
  aliases: number;
  reasons: string[];
  lastActive: string;
  signals?: { k: string; label: string; tone: Tone; value: string }[];
  evidence?: { ts: string; tag: string; severity: 'crit' | 'warn'; text: string }[];
  audit?: { ts: string; action: string; by: string }[];
  aliasList?: { name: string; channel: Channel; match: number }[];
};

export type BannedUser = {
  id: string;
  name: string;
  psid: string;
  channel: Channel;
  reason: string;
  by: string;
  bannedAt: string;
  endsAt: string;
  permanent: boolean;
};

export const MOD_TABS = [
  { k: 'list', label: 'รายการเฝ้าระวัง', count: 42, tone: 'warn' as Tone },
  { k: 'banned', label: 'แบนแล้ว', count: 147, tone: 'crit' as Tone },
  { k: 'rules', label: 'กฎอัตโนมัติ', count: 6, tone: 'info' as Tone },
];

// 🧹 (2026-06-04) demo data removed — live data only
export const SUSPECTS: Suspect[] = [];

// 🧹 (2026-06-04) demo data removed — live data only
export const BANNED: BannedUser[] = [];

// 🧹 (2026-06-04) demo data removed — live data only
export const SPAM_WORDS = [];

export function levelLabel(l: number) {
  return ['ปกติ', 'สงสัย', 'เฝ้าระวัง', 'ใกล้แบน', 'แบนแล้ว', 'วิกฤต'][l] ?? '—';
}
export function levelTone(l: number): Tone {
  return (['ok', 'info', 'warn', 'rose', 'crit', 'crit'][l] as Tone) ?? 'dim';
}
export function levelColor(l: number) {
  return ['#10b981', '#22d3ee', '#f59e0b', '#f43f5e', '#ef4444', '#ef4444'][l] ?? '#6b7280';
}
export function threatClass(score: number) {
  if (score >= 80) return 'linear-gradient(90deg, #ef4444, #6b21a8)';
  if (score >= 60) return 'linear-gradient(90deg, #f59e0b, #ef4444)';
  if (score >= 35) return 'linear-gradient(90deg, #22d3ee, #f59e0b)';
  return 'linear-gradient(90deg, #10b981, #22d3ee)';
}
