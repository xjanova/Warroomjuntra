export type Channel = 'FB' | 'LINE';
export type Severity = 'crit' | 'warn' | 'low';

export type Tone = 'ok' | 'warn' | 'crit' | 'info' | 'mystic' | 'rose' | 'dim';

export type CaseType =
  | 'payment'
  | 'floating'
  | 'reading'
  | 'celtic'
  | 'sensitive'
  | 'boterr'
  | 'refund';

export type ClaimedBy = {
  initial: string;
  color: string;
};

export type TriageCase = {
  id: string;
  customer: string;
  channel: Channel;
  type: CaseType;
  severity: Severity;
  detail: string;
  slaDisplay: string;
  slaPct: number;
  amount?: number;
  meta?: string;
  tags?: string[];
  claimedBy?: ClaimedBy;
};

export type Followup = {
  id: string;
  customer: string;
  service: string;
  channel: Channel;
  bill: string;
  amount: number;
  silentMin: number;
  vip: boolean;
};

export type Kpi = {
  label: string;
  value: string;
  delta: number;
  tone: Tone;
  color: string;
  sub: string;
  spark: number[];
};

export type Chat = {
  id: string;
  name: string;
  channel: Channel;
  bot: boolean;
  takenBy?: ClaimedBy;
  sentiment: 'happy' | 'neutral' | 'angry';
  last: string;
  silentSec: number;
};

export type SystemService = {
  name: string;
  status: 'ok' | 'warn' | 'crit';
  metric: string;
};

export type Approval = {
  id: string;
  kind: string;
  tone: Tone;
  title: string;
  meta: string;
  amount: number;
};

export type Bot = {
  id: string;
  name: string;
  state: 'ok' | 'warn' | 'crit';
  enabled: boolean;
  next: string;
  last: string;
};

export type EventItem = {
  id: number | string;
  ts: string;
  kind: string;
  tone: Tone;
  msg: string;
  ref: string;
};

export type EventFilter = {
  k: string;
  tone: Tone;
  label: string;
};

export type TimelineItem = {
  ts: string;
  icon: string;
  tone: Severity | 'info' | 'rose';
  title: string;
  desc: string;
};
