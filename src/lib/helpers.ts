import type { Followup, Severity, Tone, CaseType } from './mock/types';

export function severityColor(s: Severity | string): string {
  switch (s) {
    case 'crit':
      return '#ef4444';
    case 'warn':
      return '#f59e0b';
    case 'low':
      return '#22d3ee';
    case 'rose':
      return '#f43f5e';
    case 'info':
      return '#22d3ee';
    case 'ok':
      return '#10b981';
    case 'mystic':
      return '#8b5cf6';
    default:
      return '#6b7280';
  }
}

const TYPE_META: Record<CaseType, { label: string; tone: Tone }> = {
  payment: { label: 'ยอดโอนไม่ตรง', tone: 'crit' },
  floating: { label: 'บิลลอย', tone: 'warn' },
  reading: { label: 'คำทำนายค้าง', tone: 'warn' },
  celtic: { label: 'Celtic เกินกำหนด', tone: 'mystic' },
  sensitive: { label: 'เคสอ่อนไหว', tone: 'rose' },
  boterr: { label: 'บอท error', tone: 'warn' },
  refund: { label: 'ขอคืนเงิน', tone: 'crit' },
};

export function typeMeta(t: CaseType | string): { label: string; tone: Tone } {
  return TYPE_META[t as CaseType] ?? { label: t, tone: 'dim' };
}

export function formatSilent(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

// Follow-up heat scoring — higher = more urgent (5–15 min sweet spot)
export function followupUrgency(f: Followup): number {
  const m = f.silentMin;
  // peak urgency around 8 min, fade after 20
  let score = 0;
  if (m < 5) score = 40 + m * 6; // brand new = mildly urgent
  else if (m <= 15) score = 100 - (m - 8) * 4; // peak window
  else if (m <= 25) score = 60 - (m - 15) * 3;
  else score = 25;
  if (f.vip) score += 20;
  if (f.amount > 1000) score += 10;
  // Stuck-paid bumps the score 35 — we owe the customer a deliverable and
  // every minute past 5 min compounds. (Caps at 100 in followupHeatPct.)
  if (f.status === 'await_reading') {
    score += 35;
    if (m > 5) score += Math.min(20, m - 5);
  }
  return score;
}

export function followupHeatPct(f: Followup): number {
  return Math.max(8, Math.min(100, followupUrgency(f)));
}

export function followupHeatLabel(f: Followup): string {
  const u = followupUrgency(f);
  if (u >= 90) return 'ร้อนมาก';
  if (u >= 70) return 'ร้อน';
  if (u >= 50) return 'อุ่น';
  if (u >= 30) return 'เย็น';
  return 'เย็นจัด';
}

export function followupBorderColor(f: Followup): string {
  const u = followupUrgency(f);
  if (u >= 80) return '#ef4444';
  if (u >= 55) return '#f59e0b';
  if (u >= 35) return '#22d3ee';
  return '#6b7280';
}

export function followupBg(f: Followup): string {
  const c = followupBorderColor(f);
  return `linear-gradient(135deg, ${c}14, ${c}05 60%, rgba(13,19,32,.7))`;
}

export function followupGlow(f: Followup): string {
  const c = followupBorderColor(f);
  return `0 0 0 1px ${c}33`;
}

export function sortFollowups(list: Followup[], mode: 'heat' | 'value'): Followup[] {
  const arr = [...list];
  if (mode === 'value') return arr.sort((a, b) => b.amount - a.amount);
  return arr.sort((a, b) => followupUrgency(b) - followupUrgency(a));
}
