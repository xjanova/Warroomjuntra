import type {
  TriageCase,
  Followup,
  Kpi,
  Chat,
  SystemService,
  Approval,
  Bot,
  EventItem,
  EventFilter,
  TimelineItem,
} from './types';

// 🧹 (2026-06-04) Demo data removed. The warroom shows REAL data from the admin
//   API only — these arrays are the not-paired / first-load fallbacks, now empty
//   so no fabricated rows ever flash on screen. The components already render
//   honest empty states ("ยังไม่มี…"). EVENT_FILTERS stays — it's UI config
//   (the category chips), not demo content.

export const KPIS: Kpi[] = [];

export const ALL_CASES: TriageCase[] = [];

export const FOLLOWUPS: Followup[] = [];

export const CHATS: Chat[] = [];

export const SYSTEM: SystemService[] = [];

export const APPROVALS: Approval[] = [];

export const BOTS: Bot[] = [];

export const EVENT_FILTERS: EventFilter[] = [
  { k: 'payment', tone: 'ok', label: 'จ่ายเงิน' },
  { k: 'reading', tone: 'info', label: 'ดูดวง' },
  { k: 'sensitive', tone: 'rose', label: 'อ่อนไหว' },
  { k: 'system', tone: 'warn', label: 'ระบบ' },
  { k: 'audit', tone: 'mystic', label: 'audit' },
];

export const EVENTS: EventItem[] = [];

export const CASE_TIMELINE: TimelineItem[] = [];
