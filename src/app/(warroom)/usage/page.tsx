'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import {
  useAdminData,
  fetchPerProviderUsage,
  describeError,
  type ProviderUsageRow,
} from '@/lib/api';
import { useWarroom } from '@/lib/stores/warroom';

// Alert rules stay client-side — there's no backend endpoint yet, so the
// operator's edits persist in localStorage. The eval pass runs every refresh
// against the live data.
const ALERTS_KEY = 'warroom.usage.alerts.v1';

type AlertMetric = 'tokens_per_hour' | 'error_rate_pct' | 'latency_p95_ms';
type AlertOp = '>' | '>=' | '<' | '<=';
type AlertRule = {
  id: string;
  name: string;
  providerName: string | 'any';
  metric: AlertMetric;
  op: AlertOp;
  threshold: number;
  enabled: boolean;
  state: 'idle' | 'triggered';
  lastTriggeredAt?: string;
};

const METRIC_LABEL: Record<AlertMetric, string> = {
  tokens_per_hour: 'Tokens / ชั่วโมง (window)',
  error_rate_pct: 'อัตราล้มเหลว (%)',
  latency_p95_ms: 'Latency p95 (ms)',
};

const DEFAULT_ALERTS: AlertRule[] = [
  { id: 'al-err-5', name: 'Error rate > 5% (any)', providerName: 'any', metric: 'error_rate_pct', op: '>', threshold: 5, enabled: true, state: 'idle' },
  { id: 'al-p95-3s', name: 'Latency p95 > 3s (any)', providerName: 'any', metric: 'latency_p95_ms', op: '>', threshold: 3000, enabled: true, state: 'idle' },
];

function metricValue(p: ProviderUsageRow, m: AlertMetric): number {
  switch (m) {
    case 'tokens_per_hour': return p.tokens;
    case 'error_rate_pct':  return p.error_rate_pct;
    case 'latency_p95_ms':  return p.p95_latency_ms;
  }
}

function metricFormat(m: AlertMetric, v: number): string {
  switch (m) {
    case 'tokens_per_hour': return v.toLocaleString();
    case 'error_rate_pct':  return v.toFixed(1) + '%';
    case 'latency_p95_ms':  return v.toFixed(0) + 'ms';
  }
}

function evalRule(rule: AlertRule, v: number): boolean {
  switch (rule.op) {
    case '>':  return v >  rule.threshold;
    case '>=': return v >= rule.threshold;
    case '<':  return v <  rule.threshold;
    case '<=': return v <= rule.threshold;
  }
}

export default function UsagePage() {
  const pushToast = useWarroom((s) => s.pushToast);
  const [hours, setHours] = useState<1 | 6 | 24 | 168>(1);
  const [tab, setTab] = useState<'overview' | 'alerts' | 'keys'>('overview');
  const [selectedProvider, setSelectedProvider] = useState<string | 'all'>('all');

  // Refresh interval — 5s for 1h window (most "real-time"), slower for wider.
  const intervalSec = hours === 1 ? 5 : hours === 6 ? 15 : 30;

  const live = useAdminData({
    key: `usage-per-provider-${hours}`,
    fetcher: () => fetchPerProviderUsage(hours),
    mock: null as unknown as Awaited<ReturnType<typeof fetchPerProviderUsage>>,
    intervalOverride: intervalSec,
  });

  const providers: ProviderUsageRow[] = useMemo(() => {
    if (live.source === 'live' && live.data) {
      return (live.data.providers ?? []) as ProviderUsageRow[];
    }
    return [];
  }, [live.source, live.data]);

  // ── Alert rules — persisted locally ────────────────────────────────────────
  const [alerts, setAlerts] = useState<AlertRule[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_ALERTS;
    try {
      const raw = localStorage.getItem(ALERTS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as AlertRule[];
        if (Array.isArray(arr)) return arr;
      }
    } catch {}
    return DEFAULT_ALERTS;
  });
  useEffect(() => {
    try { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)); } catch {}
  }, [alerts]);

  // Toast debounce per rule.
  const lastToastedRef = useRef<Record<string, number>>({});

  // Re-eval whenever providers refresh.
  useEffect(() => {
    if (providers.length === 0) return;
    setAlerts((prev) =>
      prev.map((r) => {
        if (!r.enabled) {
          return r.state === 'triggered' ? { ...r, state: 'idle' as const } : r;
        }
        const targets =
          r.providerName === 'any'
            ? providers.filter((p) => p.is_active)
            : providers.filter((p) => p.name === r.providerName);
        const fired = targets.find((p) => evalRule(r, metricValue(p, r.metric)));
        if (fired && r.state !== 'triggered') {
          const now = Date.now();
          if (now - (lastToastedRef.current[r.id] ?? 0) > 30_000) {
            lastToastedRef.current[r.id] = now;
            pushToast({
              kind: 'crit',
              title: '🚨 ' + r.name,
              body: fired.display_name + ' = ' + metricFormat(r.metric, metricValue(fired, r.metric)),
            });
          }
          return { ...r, state: 'triggered' as const, lastTriggeredAt: new Date().toTimeString().slice(0, 8) };
        }
        if (!fired && r.state === 'triggered') {
          return { ...r, state: 'idle' as const };
        }
        return r;
      }),
    );
  }, [providers, pushToast]);

  // ── Aggregates ─────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const tokens = providers.reduce((s, p) => s + p.tokens, 0);
    const reqs = providers.reduce((s, p) => s + p.requests, 0);
    const tokensToday = providers.reduce((s, p) => s + p.tokens_today, 0);
    const tokensMonth = providers.reduce((s, p) => s + p.tokens_month, 0);
    const activeKeys = providers.reduce((s, p) => s + p.active_keys, 0);
    const totalKeys = providers.reduce((s, p) => s + p.total_keys, 0);
    const liveProviders = providers.filter((p) => p.is_active && p.requests > 0).length;
    return { tokens, reqs, tokensToday, tokensMonth, activeKeys, totalKeys, liveProviders };
  }, [providers]);

  const triggeredCount = alerts.filter((a) => a.state === 'triggered').length;

  // ── Render ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(
    () => [
      { label: `Providers ใช้งานในช่วง ${hours}h`, value: `${totals.liveProviders}/${providers.length}`, sub: `${totals.activeKeys}/${totals.totalKeys} keys เปิด`, color: '#10b981' },
      { label: `Requests · ${hours}h`, value: totals.reqs.toLocaleString(), sub: 'รวมทุก provider', color: '#22d3ee' },
      { label: `Tokens · ${hours}h`, value: totals.tokens.toLocaleString(), sub: 'รวม input+output', color: '#8b5cf6' },
      { label: 'Tokens / วันนี้', value: totals.tokensToday.toLocaleString(), sub: '(สะสมจาก ai_api_keys)', color: '#f59e0b' },
      { label: 'Tokens / เดือนนี้', value: totals.tokensMonth.toLocaleString(), sub: '(สะสมจาก ai_api_keys)', color: '#d4a747' },
      { label: 'Alert ติด', value: String(triggeredCount), sub: triggeredCount ? 'รีบเช็ค' : 'ปกติ', color: triggeredCount ? '#ef4444' : '#6b7280', glow: triggeredCount > 0 },
    ],
    [hours, totals, providers.length, triggeredCount],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className={`dot ${triggeredCount ? 'dot-crit' : 'dot-info'}`} />
        <span className="t-h">API USAGE · การใช้งาน AI provider</span>
        <DataSourceBadge source={live.source} isLoading={live.isLoading} error={live.error} />
        {triggeredCount > 0 && <Pill tone="crit">🚨 {triggeredCount} alert ติด</Pill>}
        <div className="flex-1" />
        <div className="flex gap-1 text-2xs">
          {([1, 6, 24, 168] as const).map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`pill ${hours === h ? 'pill-info' : 'pill-dim'}`}
              title={h === 168 ? 'ย้อน 7 วัน' : h === 1 ? 'realtime 5s' : `ย้อน ${h} ชั่วโมง`}
            >
              {h === 168 ? '7d' : h + 'h'}
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => void live.refetch()}>
          ↻ refresh
        </button>
      </header>

      <section className="px-3 py-2 border-b border-line shrink-0">
        <div className="grid grid-cols-6 gap-2">
          {kpis.map((k) => (
            <Kpi key={k.label} {...k} />
          ))}
        </div>
      </section>

      <div className="px-3 border-b border-line flex items-center gap-1 shrink-0">
        {[
          { k: 'overview', label: 'ภาพรวม + กราฟ', count: providers.length, tone: 'info' as const },
          { k: 'alerts',   label: 'กฎเตือน',       count: alerts.length,    tone: triggeredCount > 0 ? 'crit' as const : 'warn' as const },
          { k: 'keys',     label: 'API keys',      count: totals.totalKeys, tone: 'mystic' as const },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as typeof tab)}
            className={`px-4 py-2 border-b-2 text-sm flex items-center gap-2 ${
              tab === t.k ? 'text-fg border-info' : 'text-mute border-transparent hover:text-fg'
            }`}
          >
            <span>{t.label}</span>
            <Pill tone={t.tone}>{t.count}</Pill>
          </button>
        ))}
        <div className="flex-1" />
        {live.error && (
          <span className="text-2xs text-crit mono mr-2" title={live.error}>
            ‼ {describeError(live.error).slice(0, 60)}
          </span>
        )}
      </div>

      {tab === 'overview' && (
        <main className="flex-1 grid min-h-0 overflow-hidden" style={{ gridTemplateColumns: '1fr 380px' }}>
          <section className="overflow-y-auto p-3 space-y-3">
            {providers.length > 0 && (
              <UsageChart
                providers={
                  selectedProvider === 'all'
                    ? providers
                    : providers.filter((p) => p.name === selectedProvider)
                }
                allProviders={providers}
                selectedProvider={selectedProvider}
                onSelectProvider={setSelectedProvider}
                hours={hours}
              />
            )}
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
            >
              {providers.length === 0 && (
                <div className="col-span-full text-center text-2xs text-mute p-12">
                  {live.isLoading ? 'กำลังโหลด...' : 'ไม่มีข้อมูล provider'}
                </div>
              )}
              {providers.map((p) => (
                <ProviderCard key={p.name} p={p} onSelect={() => setSelectedProvider(p.name)} />
              ))}
            </div>
          </section>

          <aside className="border-l border-line bg-panel2/30 flex flex-col min-h-0 overflow-y-auto">
            <div className="px-3 py-2 border-b border-line">
              <span className="t-h">ALERT ที่ติดอยู่</span>
            </div>
            {alerts.filter((a) => a.state === 'triggered').length === 0 ? (
              <div className="text-center text-2xs text-mute p-6">ไม่มี alert ติด — ทุก provider อยู่ในขีด</div>
            ) : (
              alerts.filter((a) => a.state === 'triggered').map((a) => (
                <div key={a.id} className="px-3 py-2 border-b border-line/60">
                  <div className="flex items-start gap-1.5">
                    <span className="dot dot-crit mt-1.5" />
                    <div className="flex-1">
                      <div className="text-xs text-fg font-semibold">{a.name}</div>
                      <div className="text-2xs text-mute mono mt-0.5">
                        {METRIC_LABEL[a.metric]} {a.op} {metricFormat(a.metric, a.threshold)}
                      </div>
                      <div className="text-2xs text-mute mono mt-0.5">ล่าสุด: {a.lastTriggeredAt}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </aside>
        </main>
      )}

      {tab === 'alerts' && (
        <main className="flex-1 overflow-y-auto p-3">
          <div className="max-w-5xl mx-auto space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="t-h">กฎเตือน · เก็บใน localStorage (rules ทำงานเฉพาะ tab เปิด)</span>
              <button
                className="btn btn-primary"
                onClick={() =>
                  setAlerts((prev) => [
                    ...prev,
                    {
                      id: 'al-' + Math.random().toString(36).slice(2, 7),
                      name: 'กฎใหม่',
                      providerName: 'any',
                      metric: 'tokens_per_hour',
                      op: '>',
                      threshold: 10_000,
                      enabled: true,
                      state: 'idle',
                    },
                  ])
                }
              >
                + เพิ่มกฎ
              </button>
            </div>
            {alerts.map((a) => (
              <AlertRuleCard
                key={a.id}
                rule={a}
                providers={providers}
                onUpdate={(patch) => setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...patch } : x)))}
                onDelete={() => {
                  if (window.confirm('ลบกฎนี้?')) setAlerts((prev) => prev.filter((x) => x.id !== a.id));
                }}
              />
            ))}
          </div>
        </main>
      )}

      {tab === 'keys' && (
        <main className="flex-1 overflow-y-auto p-3">
          <div className="max-w-5xl mx-auto space-y-3">
            <div className="panel p-3 text-2xs text-mute">
              <div className="t-h mb-1 text-info">หมายเหตุ</div>
              จัดการ key (เปิด/ปิด, เพิ่ม key ใหม่) ยังต้องทำผ่าน{' '}
              <a
                href="https://main.thaiprompt.online/admin/ai/api-keys"
                target="_blank"
                rel="noopener"
                className="text-info underline"
              >
                admin web /admin/ai/api-keys
              </a>{' '}
              เพราะ warroom ยังไม่มี endpoint จัดการ key. หน้านี้แสดงสถิติ key รวมต่อ provider ที่อ่านจาก
              <code className="mono text-mute"> ai_api_keys</code>.
            </div>
            <table className="dense w-full">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th className="text-right">Keys (active / total)</th>
                  <th className="text-right">Tokens วันนี้</th>
                  <th className="text-right">Tokens เดือนนี้</th>
                  <th className="text-right">Requests (window)</th>
                  <th className="text-right">Error rate</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.name}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                        <span className="text-fg">{p.display_name}</span>
                        <span className="text-2xs text-mute mono">({p.name})</span>
                      </div>
                    </td>
                    <td className="text-right mono">
                      <span className={p.active_keys > 0 ? 'text-ok' : 'text-mute'}>{p.active_keys}</span>
                      <span className="text-mute"> / {p.total_keys}</span>
                    </td>
                    <td className="text-right mono text-fg">{p.tokens_today.toLocaleString()}</td>
                    <td className="text-right mono text-fg">{p.tokens_month.toLocaleString()}</td>
                    <td className="text-right mono">{p.requests.toLocaleString()}</td>
                    <td className={`text-right mono ${p.error_rate_pct > 10 ? 'text-crit' : p.error_rate_pct > 3 ? 'text-warn' : 'text-ok'}`}>
                      {p.error_rate_pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  color,
  glow,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  glow?: boolean;
}) {
  return (
    <div
      className="panel px-3 py-2"
      style={glow ? { boxShadow: '0 0 0 1px rgba(239,68,68,.35), 0 0 24px rgba(239,68,68,.15)' } : undefined}
    >
      <div className="t-h">{label}</div>
      <div className="mono text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
      <div className="text-2xs text-mute mt-0.5">{sub}</div>
    </div>
  );
}

function ProviderCard({ p, onSelect }: { p: ProviderUsageRow; onSelect: () => void }) {
  const tone = p.error_rate_pct > 20 ? 'crit' : p.error_rate_pct > 5 ? 'warn' : p.requests > 0 ? 'ok' : 'dim';
  return (
    <div
      className="panel relative overflow-hidden cursor-pointer hover:border-info/40 transition-colors"
      onClick={onSelect}
      style={p.error_rate_pct > 20 ? { boxShadow: '0 0 0 1px rgba(239,68,68,.35)' } : undefined}
    >
      <div className="severity-stripe" style={{ background: p.color }} />
      <div className="px-3 py-2 border-b border-line flex items-center gap-2">
        <span className={`dot dot-${tone}`} />
        <span className="font-semibold text-fg text-sm">{p.display_name}</span>
        <Pill tone={tone === 'dim' ? 'dim' : tone}>{p.active_keys}/{p.total_keys} keys</Pill>
        <div className="flex-1" />
        <span className="text-2xs text-mute mono">{p.name}</span>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-2xs text-mute">Tokens (window)</div>
          <div className="mono text-fg text-base font-semibold">{p.tokens.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-2xs text-mute">Requests</div>
          <div className="mono text-fg text-base font-semibold">{p.requests.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-2xs text-mute">Tokens วันนี้</div>
          <div className="mono text-info text-base font-semibold">{p.tokens_today.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-2xs text-mute">Error rate</div>
          <div className={`mono text-base font-semibold ${p.error_rate_pct > 20 ? 'text-crit' : p.error_rate_pct > 5 ? 'text-warn' : 'text-ok'}`}>
            {p.error_rate_pct.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-2xs text-mute">Latency avg / p95</div>
          <div className="mono text-fg">
            {p.avg_latency_ms}ms <span className="text-mute">/ {p.p95_latency_ms}ms</span>
          </div>
        </div>
        <div>
          <div className="text-2xs text-mute">Tokens เดือนนี้</div>
          <div className="mono text-fg">{p.tokens_month.toLocaleString()}</div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <MiniSpark series={p.series} color={p.color} buckets={p.series_buckets} />
      </div>
    </div>
  );
}

function MiniSpark({ series, color, buckets }: { series: ProviderUsageRow['series']; color: string; buckets: number }) {
  const w = 280;
  const h = 36;
  if (series.length === 0) {
    return (
      <div className="text-2xs text-mute text-center py-2 italic">— ไม่มีกิจกรรมในช่วงนี้ —</div>
    );
  }
  const vals = series.map((s) => s.tokens);
  const min = Math.min(0, ...vals);
  const max = Math.max(1, ...vals);
  const range = max - min || 1;
  const step = w / Math.max(1, buckets - 1);
  // Pad sparse series so the line still spans the full width.
  const points = series.map((s, i) => {
    const x = (i / Math.max(1, series.length - 1)) * w;
    const y = h - ((s.tokens - min) / range) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <polyline points={`${points} ${w},${h} 0,${h}`} fill={color} opacity={0.1} />
    </svg>
  );
}

function UsageChart({
  providers,
  allProviders,
  selectedProvider,
  onSelectProvider,
  hours,
}: {
  providers: ProviderUsageRow[];
  allProviders: ProviderUsageRow[];
  selectedProvider: string | 'all';
  onSelectProvider: (id: string | 'all') => void;
  hours: number;
}) {
  const W = 1000;
  const H = 240;
  const PAD = { l: 50, r: 12, t: 14, b: 24 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const allValues = providers.flatMap((p) => p.series.map((s) => s.tokens));
  const maxY = Math.max(1, ...allValues);
  const yTicks = 4;

  return (
    <div className="panel">
      <div className="px-3 py-2 border-b border-line flex items-center gap-2 flex-wrap">
        <span className="t-h">TOKENS · {hours === 1 ? '1 ชั่วโมงล่าสุด (per minute)' : `${hours} ชั่วโมงล่าสุด (per hour)`}</span>
        <div className="flex-1" />
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => onSelectProvider('all')}
            className={`pill ${selectedProvider === 'all' ? 'pill-info' : 'pill-dim'}`}
          >
            ทั้งหมด
          </button>
          {allProviders.map((p) => (
            <button
              key={p.name}
              onClick={() => onSelectProvider(p.name)}
              className={`pill ${selectedProvider === p.name ? 'pill-info' : 'pill-dim'}`}
              style={selectedProvider === p.name ? { borderColor: p.color, color: p.color } : undefined}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              {p.display_name}
            </button>
          ))}
        </div>
      </div>
      <div className="p-2">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
          {Array.from({ length: yTicks + 1 }, (_, i) => {
            const y = PAD.t + (innerH * i) / yTicks;
            const val = Math.round(maxY - (maxY * i) / yTicks);
            return (
              <g key={i}>
                <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#1f2937" strokeWidth={0.5} strokeDasharray="2 4" />
                <text x={PAD.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#6b7280" fontFamily="monospace">
                  {val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}
                </text>
              </g>
            );
          })}
          {providers.map((p) => {
            if (p.series.length === 0) return null;
            const pts = p.series
              .map((s, i) => {
                const x = PAD.l + (i / Math.max(1, p.series.length - 1)) * innerW;
                const y = PAD.t + innerH - (s.tokens / maxY) * innerH;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(' ');
            return (
              <g key={p.name}>
                <polyline
                  points={pts}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={p.is_active ? 1 : 0.3}
                />
                <polyline
                  points={`${pts} ${PAD.l + innerW},${PAD.t + innerH} ${PAD.l},${PAD.t + innerH}`}
                  fill={p.color}
                  opacity={0.07}
                />
                {(() => {
                  const last = p.series[p.series.length - 1];
                  const x = PAD.l + innerW;
                  const y = PAD.t + innerH - (last.tokens / maxY) * innerH;
                  return (
                    <>
                      <circle cx={x} cy={y} r={3.2} fill={p.color} opacity={0.4}>
                        <animate attributeName="r" values="3.2;6;3.2" dur="1.6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.4;0;0.4" dur="1.6s" repeatCount="indefinite" />
                      </circle>
                      <circle cx={x} cy={y} r={2.4} fill={p.color} />
                    </>
                  );
                })()}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function AlertRuleCard({
  rule,
  providers,
  onUpdate,
  onDelete,
}: {
  rule: AlertRule;
  providers: ProviderUsageRow[];
  onUpdate: (patch: Partial<AlertRule>) => void;
  onDelete: () => void;
}) {
  const isFired = rule.state === 'triggered';
  return (
    <div
      className="panel p-3"
      style={isFired ? { boxShadow: '0 0 0 1px rgba(239,68,68,.5), 0 0 24px rgba(239,68,68,.18)' } : undefined}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`dot dot-${isFired ? 'crit' : rule.enabled ? 'ok' : 'mute'}`} />
        <input
          value={rule.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="text-sm font-semibold text-fg bg-transparent border-0 px-1 py-0.5 flex-1 focus:outline focus:outline-1 focus:outline-info"
        />
        {isFired && <Pill tone="crit">🚨 ติด · {rule.lastTriggeredAt}</Pill>}
        <label className="flex items-center gap-1 text-2xs">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => onUpdate({ enabled: e.target.checked })}
          />
          <span className="text-fg">เปิด</span>
        </label>
        <button className="btn btn-ghost text-2xs" onClick={onDelete} title="ลบกฎ">×</button>
      </div>
      <div className="grid grid-cols-12 gap-2 text-xs">
        <label className="col-span-3">
          <div className="text-2xs text-mute mb-0.5">Provider</div>
          <select
            value={rule.providerName}
            onChange={(e) => onUpdate({ providerName: e.target.value })}
            className="w-full px-2 py-1"
          >
            <option value="any">ทุกราย (any)</option>
            {providers.map((p) => (
              <option key={p.name} value={p.name}>{p.display_name}</option>
            ))}
          </select>
        </label>
        <label className="col-span-4">
          <div className="text-2xs text-mute mb-0.5">Metric</div>
          <select
            value={rule.metric}
            onChange={(e) => onUpdate({ metric: e.target.value as AlertMetric })}
            className="w-full px-2 py-1"
          >
            {Object.entries(METRIC_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="col-span-2">
          <div className="text-2xs text-mute mb-0.5">เงื่อนไข</div>
          <select
            value={rule.op}
            onChange={(e) => onUpdate({ op: e.target.value as AlertOp })}
            className="w-full px-2 py-1 mono"
          >
            <option value=">">&gt;</option>
            <option value=">=">&ge;</option>
            <option value="<">&lt;</option>
            <option value="<=">&le;</option>
          </select>
        </label>
        <label className="col-span-3">
          <div className="text-2xs text-mute mb-0.5">เกณฑ์</div>
          <input
            type="number"
            value={rule.threshold}
            onChange={(e) => onUpdate({ threshold: Number(e.target.value) })}
            className="w-full px-2 py-1 mono"
          />
        </label>
      </div>
    </div>
  );
}
