// ─────────────────────────────────────────────────────────────────────────────
// AI Provider Usage page mocks
//
// แสดง realtime ของ AI provider แต่ละราย: requests/min, tokens/min, $/hr,
// error rate, latency. มี chart 60 นาทีต่อราย, alert rule แบบกำหนดเอง, และ
// kill switch ต่อ provider/key สำหรับปิดการใช้งานทันที.
//
// Mock-first — เมื่อ thaiprompt.online เปิด endpoint per-provider timeseries
// แล้วค่อย swap ผ่าน useAdminData (เหมือนหน้า bots/payment/moderation).
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'gemini'
  | 'deepseek'
  | 'qwen';

export type ProviderState = 'live' | 'degraded' | 'disabled' | 'error';

export type ProviderKey = {
  id: string;
  label: string;            // เช่น "openai-main", "openai-fallback"
  masked: string;           // "sk-...XYZ9"
  enabled: boolean;
  monthlyQuotaUSD: number | null;
  spentUSD: number;
  lastUsedAt: string;       // 'HH:mm:ss'
};

export type ProviderUsage = {
  id: ProviderId;
  name: string;
  color: string;            // brand color เพื่อ chart line
  state: ProviderState;
  models: string[];
  enabled: boolean;
  reqPerMin: number;
  tokensPerMin: number;
  costUsdPerHr: number;
  errorRatePct: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  uptime24hPct: number;
  series60min: number[];    // tokens/min ย้อนหลัง 60 จุด
  keys: ProviderKey[];
};

export type AlertOperator = '>' | '>=' | '<' | '<=';
export type AlertMetric =
  | 'cost_per_hour_usd'
  | 'tokens_per_min'
  | 'error_rate_pct'
  | 'latency_p95_ms';

export type AlertRule = {
  id: string;
  name: string;
  providerId: ProviderId | 'any';
  metric: AlertMetric;
  op: AlertOperator;
  threshold: number;
  enabled: boolean;
  notifyChannels: Array<'toast' | 'desktop' | 'sound'>;
  state: 'idle' | 'triggered';
  lastTriggeredAt?: string;
  notes?: string;
};

export const METRIC_LABEL: Record<AlertMetric, string> = {
  cost_per_hour_usd: 'ค่าใช้จ่าย / ชั่วโมง (USD)',
  tokens_per_min:    'Tokens / นาที',
  error_rate_pct:    'อัตราล้มเหลว (%)',
  latency_p95_ms:    'Latency p95 (ms)',
};

// ─── seed: 6 providers ────────────────────────────────────────────────────────

// 60-point seed สำหรับ chart — ขึ้นๆลงๆ พอให้เห็นรูปทรง
function seedSeries(amp: number, base: number, period = 8, jitter = 0.2): number[] {
  return Array.from({ length: 60 }, (_, i) => {
    const wave = Math.sin((i / period) * Math.PI * 2) * amp;
    const noise = (Math.random() - 0.5) * 2 * amp * jitter;
    return Math.max(0, Math.round(base + wave + noise));
  });
}

export const INITIAL_PROVIDERS: ProviderUsage[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10b981',
    state: 'live',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    enabled: true,
    reqPerMin: 38,
    tokensPerMin: 18_400,
    costUsdPerHr: 4.82,
    errorRatePct: 0.8,
    avgLatencyMs: 920,
    p95LatencyMs: 2_140,
    uptime24hPct: 99.9,
    series60min: seedSeries(4_500, 16_000, 9),
    keys: [
      { id: 'k-oai-1', label: 'openai-main',     masked: 'sk-proj-...K2J9', enabled: true,  monthlyQuotaUSD: 500, spentUSD: 318.72, lastUsedAt: '14:32:01' },
      { id: 'k-oai-2', label: 'openai-fallback', masked: 'sk-...8Q1A',      enabled: true,  monthlyQuotaUSD: 200, spentUSD: 87.40,  lastUsedAt: '14:18:55' },
      { id: 'k-oai-3', label: 'openai-legacy',   masked: 'sk-...0042',      enabled: false, monthlyQuotaUSD: 100, spentUSD: 100.00, lastUsedAt: '11:02:14' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#d4a747',
    state: 'live',
    models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    enabled: true,
    reqPerMin: 22,
    tokensPerMin: 11_200,
    costUsdPerHr: 6.10,
    errorRatePct: 0.2,
    avgLatencyMs: 1_180,
    p95LatencyMs: 2_640,
    uptime24hPct: 100.0,
    series60min: seedSeries(2_800, 10_000, 10),
    keys: [
      { id: 'k-ant-1', label: 'anthropic-main', masked: 'sk-ant-...Q9F2', enabled: true, monthlyQuotaUSD: 800, spentUSD: 542.11, lastUsedAt: '14:31:42' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    color: '#22d3ee',
    state: 'live',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b'],
    enabled: true,
    reqPerMin: 64,
    tokensPerMin: 31_800,
    costUsdPerHr: 0.94,
    errorRatePct: 2.4,
    avgLatencyMs: 410,
    p95LatencyMs: 880,
    uptime24hPct: 99.4,
    series60min: seedSeries(8_000, 28_000, 6, 0.3),
    keys: [
      { id: 'k-grq-1', label: 'groq-main',  masked: 'gsk_...PR23', enabled: true, monthlyQuotaUSD: null, spentUSD: 14.20, lastUsedAt: '14:32:02' },
      { id: 'k-grq-2', label: 'groq-batch', masked: 'gsk_...HJ41', enabled: true, monthlyQuotaUSD: 50,   spentUSD: 8.40,  lastUsedAt: '14:30:09' },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    color: '#8b5cf6',
    state: 'degraded',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    enabled: true,
    reqPerMin: 12,
    tokensPerMin: 4_800,
    costUsdPerHr: 0.62,
    errorRatePct: 8.3,
    avgLatencyMs: 1_840,
    p95LatencyMs: 4_120,
    uptime24hPct: 96.8,
    series60min: seedSeries(2_200, 5_000, 7, 0.45),
    keys: [
      { id: 'k-gem-1', label: 'gemini-main', masked: 'AIza...8X7Q', enabled: true, monthlyQuotaUSD: 200, spentUSD: 42.18, lastUsedAt: '14:31:11' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#f59e0b',
    state: 'live',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    enabled: true,
    reqPerMin: 8,
    tokensPerMin: 3_100,
    costUsdPerHr: 0.18,
    errorRatePct: 1.1,
    avgLatencyMs: 1_320,
    p95LatencyMs: 2_980,
    uptime24hPct: 99.7,
    series60min: seedSeries(1_400, 3_200, 11),
    keys: [
      { id: 'k-ds-1', label: 'deepseek-main', masked: 'sk-...DS92', enabled: true, monthlyQuotaUSD: 100, spentUSD: 9.40, lastUsedAt: '14:24:38' },
    ],
  },
  {
    id: 'qwen',
    name: 'Qwen (DashScope)',
    color: '#f43f5e',
    state: 'error',
    models: ['qwen-max', 'qwen-72b-instruct'],
    enabled: false,
    reqPerMin: 0,
    tokensPerMin: 0,
    costUsdPerHr: 0,
    errorRatePct: 100,
    avgLatencyMs: 0,
    p95LatencyMs: 0,
    uptime24hPct: 78.4,
    series60min: seedSeries(800, 1_400, 5).map((v, i) => (i > 50 ? 0 : v)),
    keys: [
      { id: 'k-qwn-1', label: 'qwen-main', masked: 'sk-...Q8WN', enabled: false, monthlyQuotaUSD: 80, spentUSD: 4.20, lastUsedAt: '13:58:01' },
    ],
  },
];

export const INITIAL_ALERTS: AlertRule[] = [
  {
    id: 'al-1',
    name: 'OpenAI ราคาพุ่ง > $8/ชม',
    providerId: 'openai',
    metric: 'cost_per_hour_usd',
    op: '>',
    threshold: 8,
    enabled: true,
    notifyChannels: ['toast', 'desktop', 'sound'],
    state: 'idle',
    notes: 'เกินงบ pilot — ขึ้นทันที',
  },
  {
    id: 'al-2',
    name: 'Provider ไหนก็ตาม latency p95 > 3s',
    providerId: 'any',
    metric: 'latency_p95_ms',
    op: '>',
    threshold: 3_000,
    enabled: true,
    notifyChannels: ['toast'],
    state: 'idle',
  },
  {
    id: 'al-3',
    name: 'Error rate > 5% (ใดๆ)',
    providerId: 'any',
    metric: 'error_rate_pct',
    op: '>',
    threshold: 5,
    enabled: true,
    notifyChannels: ['toast', 'sound'],
    state: 'triggered',
    lastTriggeredAt: '14:18:32',
    notes: 'กระตุ้นจาก Gemini 8.3%',
  },
  {
    id: 'al-4',
    name: 'Groq tokens/min > 40k',
    providerId: 'groq',
    metric: 'tokens_per_min',
    op: '>',
    threshold: 40_000,
    enabled: false,
    notifyChannels: ['toast'],
    state: 'idle',
    notes: 'เปิดเมื่อ tier อัป — ตอนนี้ free tier limit',
  },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

export function providerStateTone(s: ProviderState): 'ok' | 'warn' | 'crit' | 'dim' {
  return { live: 'ok', degraded: 'warn', error: 'crit', disabled: 'dim' }[s] as
    'ok' | 'warn' | 'crit' | 'dim';
}

export function providerStateLabel(s: ProviderState): string {
  return { live: 'พร้อมใช้', degraded: 'ช้า/มี error', error: 'ออฟไลน์', disabled: 'ปิดอยู่' }[s];
}

export function metricValue(p: ProviderUsage, m: AlertMetric): number {
  switch (m) {
    case 'cost_per_hour_usd': return p.costUsdPerHr;
    case 'tokens_per_min':    return p.tokensPerMin;
    case 'error_rate_pct':    return p.errorRatePct;
    case 'latency_p95_ms':    return p.p95LatencyMs;
  }
}

export function metricFormat(m: AlertMetric, v: number): string {
  switch (m) {
    case 'cost_per_hour_usd': return '$' + v.toFixed(2);
    case 'tokens_per_min':    return v.toLocaleString();
    case 'error_rate_pct':    return v.toFixed(1) + '%';
    case 'latency_p95_ms':    return v.toFixed(0) + 'ms';
  }
}

export function evalRule(rule: AlertRule, v: number): boolean {
  switch (rule.op) {
    case '>':  return v >  rule.threshold;
    case '>=': return v >= rule.threshold;
    case '<':  return v <  rule.threshold;
    case '<=': return v <= rule.threshold;
  }
}
