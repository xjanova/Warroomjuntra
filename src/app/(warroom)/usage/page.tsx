'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { Switch } from '@/components/ui/Switch';
import { useWarroom } from '@/lib/stores/warroom';
import {
  INITIAL_ALERTS,
  INITIAL_PROVIDERS,
  METRIC_LABEL,
  evalRule,
  metricFormat,
  metricValue,
  providerStateLabel,
  providerStateTone,
  type AlertMetric,
  type AlertOperator,
  type AlertRule,
  type ProviderUsage,
} from '@/lib/mock/usage-page';

const TICK_MS = 2_000;

export default function UsagePage() {
  const pushToast = useWarroom((s) => s.pushToast);

  const [providers, setProviders] = useState<ProviderUsage[]>(INITIAL_PROVIDERS);
  const [alerts, setAlerts] = useState<AlertRule[]>(INITIAL_ALERTS);
  const [tab, setTab] = useState<'overview' | 'alerts' | 'keys'>('overview');
  const [selectedProvider, setSelectedProvider] = useState<string | 'all'>('all');
  const [paused, setPaused] = useState(false);

  // Track which rules just fired so we can toast once instead of every tick.
  const lastTriggeredRef = useRef<Record<string, number>>({});

  // ── Realtime tick: jitter metrics, push to chart, re-eval alerts ────────────
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setProviders((prev) => {
        const next = prev.map((p) => {
          if (!p.enabled || p.state === 'disabled') return p;
          // Jitter each metric ±10% so the chart actually moves.
          const j = (base: number, amp = 0.1) => Math.max(0, base * (1 + (Math.random() - 0.5) * 2 * amp));
          const tokens = Math.round(j(p.tokensPerMin, p.state === 'degraded' ? 0.3 : 0.12));
          const reqs = Math.round(j(p.reqPerMin, 0.15));
          const cost = +(j(p.costUsdPerHr, 0.08)).toFixed(2);
          // Error rate drifts with a damped random walk so it doesn't spike too hard.
          const err = Math.max(0, Math.min(100, p.errorRatePct + (Math.random() - 0.5) * (p.state === 'degraded' ? 2 : 0.6)));
          const lat = Math.round(j(p.avgLatencyMs, 0.1));
          const p95 = Math.round(j(p.p95LatencyMs, 0.12));
          return {
            ...p,
            tokensPerMin: tokens,
            reqPerMin: reqs,
            costUsdPerHr: cost,
            errorRatePct: +err.toFixed(1),
            avgLatencyMs: lat,
            p95LatencyMs: p95,
            series60min: [...p.series60min.slice(1), tokens],
          };
        });

        // Alert evaluation pass.
        setAlerts((rules) =>
          rules.map((r) => {
            if (!r.enabled) return r.state === 'triggered' ? { ...r, state: 'idle' } : r;
            const targets =
              r.providerId === 'any'
                ? next.filter((p) => p.enabled)
                : next.filter((p) => p.id === r.providerId && p.enabled);
            const fired = targets.find((p) => evalRule(r, metricValue(p, r.metric)));
            const triggered = !!fired;
            if (triggered && r.state !== 'triggered') {
              // Edge: idle → triggered. Push a toast.
              const now = Date.now();
              if (now - (lastTriggeredRef.current[r.id] ?? 0) > 30_000) {
                lastTriggeredRef.current[r.id] = now;
                pushToast({
                  kind: 'crit',
                  title: '🚨 ' + r.name,
                  body: fired ? fired.name + ' = ' + metricFormat(r.metric, metricValue(fired, r.metric)) : '',
                });
              }
              return { ...r, state: 'triggered', lastTriggeredAt: new Date().toTimeString().slice(0, 8) };
            }
            if (!triggered && r.state === 'triggered') {
              return { ...r, state: 'idle' };
            }
            return r;
          }),
        );

        return next;
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, [paused, pushToast]);

  // ── Aggregates ──────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const tokens = providers.reduce((s, p) => s + p.tokensPerMin, 0);
    const reqs = providers.reduce((s, p) => s + p.reqPerMin, 0);
    const cost = providers.reduce((s, p) => s + p.costUsdPerHr, 0);
    const liveCnt = providers.filter((p) => p.state === 'live').length;
    const degraded = providers.filter((p) => p.state === 'degraded').length;
    const errCnt = providers.filter((p) => p.state === 'error').length;
    const monthSpent = providers.reduce((s, p) => s + p.keys.reduce((a, k) => a + k.spentUSD, 0), 0);
    return { tokens, reqs, cost, liveCnt, degraded, errCnt, monthSpent };
  }, [providers]);

  const triggeredCount = alerts.filter((a) => a.state === 'triggered').length;

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleProvider = useCallback(
    (id: string, off: boolean) => {
      if (off && !window.confirm('ปิด provider นี้ทันที? คำขอที่ค้างจะ fallback ไป provider ถัดไป')) return;
      setProviders((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                enabled: !off,
                state: off ? 'disabled' : 'live',
                tokensPerMin: off ? 0 : p.tokensPerMin,
                reqPerMin: off ? 0 : p.reqPerMin,
                costUsdPerHr: off ? 0 : p.costUsdPerHr,
              }
            : p,
        ),
      );
      pushToast({
        kind: off ? 'crit' : 'ok',
        title: (off ? '🔌 ปิด ' : '✓ เปิด ') + id,
        body: off ? 'fallback ไป provider อื่น' : 'พร้อมรับ request',
      });
    },
    [pushToast],
  );

  const toggleKey = useCallback(
    (providerId: string, keyId: string, off: boolean) => {
      if (off && !window.confirm('ปิด key นี้ทันที?')) return;
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? { ...p, keys: p.keys.map((k) => (k.id === keyId ? { ...k, enabled: !off } : k)) }
            : p,
        ),
      );
      pushToast({
        kind: off ? 'crit' : 'ok',
        title: (off ? '🔒 ปิด key ' : '✓ เปิด key ') + keyId,
        body: providerId,
      });
    },
    [pushToast],
  );

  const killAll = useCallback(() => {
    if (!window.confirm('ปิดทุก provider พร้อมกัน? ระบบทำนายจะหยุดส่งคำขอจริง ๆ')) return;
    setProviders((prev) =>
      prev.map((p) => ({ ...p, enabled: false, state: 'disabled' as const, tokensPerMin: 0, reqPerMin: 0, costUsdPerHr: 0 })),
    );
    pushToast({ kind: 'crit', title: '🛑 หยุดทุก provider', body: 'AI ทั้งระบบหยุดรับคำขอ' });
  }, [pushToast]);

  const toggleAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  }, []);

  const addAlert = useCallback(() => {
    const id = 'al-' + (alerts.length + 1) + '-' + Math.random().toString(36).slice(2, 6);
    setAlerts((prev) => [
      ...prev,
      {
        id,
        name: 'กฎใหม่',
        providerId: 'any',
        metric: 'cost_per_hour_usd',
        op: '>',
        threshold: 10,
        enabled: true,
        notifyChannels: ['toast'],
        state: 'idle',
      },
    ]);
  }, [alerts.length]);

  const updateAlert = useCallback((id: string, patch: Partial<AlertRule>) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const deleteAlert = useCallback((id: string) => {
    if (!window.confirm('ลบกฎนี้?')) return;
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className={`dot ${triggeredCount ? 'dot-crit' : 'dot-info'}`} />
        <span className="t-h">API USAGE · การใช้งาน AI provider</span>
        <DataSourceBadge source="mock" title="mock-first — ยังไม่มี endpoint per-provider timeseries" />
        {triggeredCount > 0 && <Pill tone="crit">🚨 {triggeredCount} alert ติด</Pill>}
        <div className="flex-1" />
        <Pill tone="info">{totals.liveCnt} live</Pill>
        {totals.degraded > 0 && <Pill tone="warn">{totals.degraded} ช้า</Pill>}
        {totals.errCnt > 0 && <Pill tone="crit">{totals.errCnt} offline</Pill>}
        <button className={`btn ${paused ? 'btn-ok' : 'btn-warn'}`} onClick={() => setPaused((p) => !p)}>
          {paused ? '▶ เดินต่อ' : '⏸ หยุด tick'}
        </button>
        <button className="btn btn-crit" onClick={killAll}>🛑 ปิดทุก provider</button>
      </header>

      {/* KPI strip */}
      <section className="px-3 py-2 border-b border-line shrink-0">
        <div className="grid grid-cols-6 gap-2">
          <Kpi label="Providers พร้อมใช้" value={`${totals.liveCnt}/${providers.length}`} sub={`${totals.degraded} degraded · ${totals.errCnt} offline`} color="#10b981" />
          <Kpi label="Tokens / นาที" value={totals.tokens.toLocaleString()} sub="รวมทุก provider" color="#22d3ee" />
          <Kpi label="Requests / นาที" value={totals.reqs.toLocaleString()} sub="rate ปัจจุบัน" color="#8b5cf6" />
          <Kpi label="ค่าใช้จ่าย / ชม" value={'$' + totals.cost.toFixed(2)} sub={'≈ $' + (totals.cost * 24).toFixed(0) + ' / วัน'} color="#f59e0b" />
          <Kpi label="ใช้จริงเดือนนี้" value={'$' + totals.monthSpent.toFixed(0)} sub="รวมทุก key" color="#d4a747" />
          <Kpi label="Alert ติด" value={String(triggeredCount)} sub={triggeredCount ? 'รีบเช็ค' : 'ปกติ'} color={triggeredCount ? '#ef4444' : '#6b7280'} glow={triggeredCount > 0} />
        </div>
      </section>

      {/* Tabs */}
      <div className="px-3 border-b border-line flex items-center gap-1 shrink-0">
        {[
          { k: 'overview', label: 'ภาพรวม + กราฟ', count: providers.length, tone: 'info' as const },
          { k: 'alerts',   label: 'กฎเตือน',       count: alerts.length,    tone: triggeredCount > 0 ? 'crit' as const : 'warn' as const },
          { k: 'keys',     label: 'API keys',      count: providers.reduce((s, p) => s + p.keys.length, 0), tone: 'mystic' as const },
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
      </div>

      {tab === 'overview' && (
        <main className="flex-1 grid min-h-0 overflow-hidden" style={{ gridTemplateColumns: '1fr 420px' }}>
          {/* Big chart + provider cards */}
          <section className="overflow-y-auto p-3 space-y-3">
            <UsageChart
              providers={providers.filter((p) => selectedProvider === 'all' || p.id === selectedProvider)}
              onSelectProvider={setSelectedProvider}
              selectedProvider={selectedProvider}
              allProviders={providers}
            />
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
            >
              {providers.map((p) => (
                <ProviderCard
                  key={p.id}
                  p={p}
                  onToggle={(off) => toggleProvider(p.id, off)}
                  onSelect={() => setSelectedProvider(p.id)}
                />
              ))}
            </div>
          </section>

          {/* Right rail: triggered alerts + spend pace */}
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
                        เกณฑ์ {METRIC_LABEL[a.metric]} {a.op} {metricFormat(a.metric, a.threshold)}
                      </div>
                      <div className="text-2xs text-mute mono mt-0.5">เด้งครั้งล่าสุด: {a.lastTriggeredAt}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div className="px-3 py-2 border-b border-line mt-2">
              <span className="t-h">SPEND THIS MONTH</span>
            </div>
            {providers.map((p) => {
              const spent = p.keys.reduce((s, k) => s + k.spentUSD, 0);
              const quota = p.keys.reduce((s, k) => s + (k.monthlyQuotaUSD ?? 0), 0);
              const pct = quota ? Math.min(100, (spent / quota) * 100) : 0;
              return (
                <div key={p.id} className="px-3 py-2 border-b border-line/60">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-fg font-medium">{p.name}</span>
                    <span className="mono text-2xs text-mute">
                      ${spent.toFixed(0)}{quota ? ` / $${quota}` : ''}
                    </span>
                  </div>
                  <div className="quota-bar">
                    <div
                      className="quota-fill"
                      style={{
                        width: `${pct}%`,
                        background: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : p.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </aside>
        </main>
      )}

      {tab === 'alerts' && (
        <main className="flex-1 overflow-y-auto p-3">
          <div className="max-w-5xl mx-auto space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="t-h">กฎเตือน · มาเด้ง toast / desktop / เสียงเมื่อเข้าเกณฑ์</span>
              <button className="btn btn-primary" onClick={addAlert}>+ เพิ่มกฎ</button>
            </div>
            {alerts.length === 0 && (
              <div className="text-center text-2xs text-mute p-8">ยังไม่มีกฎ — กด + เพิ่มกฎ</div>
            )}
            {alerts.map((a) => (
              <AlertRuleCard
                key={a.id}
                rule={a}
                providers={providers}
                onToggle={() => toggleAlert(a.id)}
                onUpdate={(patch) => updateAlert(a.id, patch)}
                onDelete={() => deleteAlert(a.id)}
              />
            ))}
          </div>
        </main>
      )}

      {tab === 'keys' && (
        <main className="flex-1 overflow-y-auto p-3">
          <div className="space-y-3">
            {providers.map((p) => (
              <div key={p.id} className="panel">
                <div className="px-3 py-2 border-b border-line flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                  <span className="font-semibold text-fg text-sm">{p.name}</span>
                  <Pill tone={providerStateTone(p.state)}>{providerStateLabel(p.state)}</Pill>
                  <div className="flex-1" />
                  <span className="text-2xs text-mute mono">{p.keys.length} keys</span>
                </div>
                <table className="dense w-full">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Key</th>
                      <th>ใช้แล้ว / โควต้า</th>
                      <th>ใช้ล่าสุด</th>
                      <th className="text-right">การกระทำ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.keys.map((k) => {
                      const pct = k.monthlyQuotaUSD ? (k.spentUSD / k.monthlyQuotaUSD) * 100 : 0;
                      return (
                        <tr key={k.id} className={k.enabled ? '' : 'opacity-50'}>
                          <td className="text-fg">{k.label}</td>
                          <td className="mono text-2xs text-mute">{k.masked}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-32 h-1.5 rounded bg-line overflow-hidden">
                                <div
                                  className="h-full"
                                  style={{
                                    width: `${Math.min(100, pct)}%`,
                                    background: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : p.color,
                                  }}
                                />
                              </div>
                              <span className="mono text-2xs text-fg">
                                ${k.spentUSD.toFixed(0)}{k.monthlyQuotaUSD ? ` / $${k.monthlyQuotaUSD}` : ''}
                              </span>
                            </div>
                          </td>
                          <td className="mono text-2xs text-mute">{k.lastUsedAt}</td>
                          <td className="text-right space-x-1">
                            <button
                              className={`btn ${k.enabled ? 'btn-crit' : 'btn-ok'}`}
                              onClick={() => toggleKey(p.id, k.id, k.enabled)}
                            >
                              {k.enabled ? '🔒 ปิดทันที' : '✓ เปิด'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </main>
      )}

      <style jsx>{`
        .quota-bar {
          height: 5px;
          background: #0d1320;
          border: 1px solid var(--border, #1f2937);
          border-radius: 3px;
          overflow: hidden;
        }
        .quota-fill {
          height: 100%;
          transition: width 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Provider summary card — current numbers + kill switch + sparkline
// ─────────────────────────────────────────────────────────────────────────────
function ProviderCard({
  p,
  onToggle,
  onSelect,
}: {
  p: ProviderUsage;
  onToggle: (off: boolean) => void;
  onSelect: () => void;
}) {
  const tone = providerStateTone(p.state);
  return (
    <div
      className="panel relative overflow-hidden cursor-pointer hover:border-info/40 transition-colors"
      onClick={onSelect}
      style={{
        boxShadow: p.state === 'error' ? '0 0 0 1px rgba(239,68,68,.35)' : undefined,
      }}
    >
      <div className="severity-stripe" style={{ background: p.color }} />
      <div className="px-3 py-2 border-b border-line flex items-center gap-2">
        <span className={`dot dot-${tone}`} />
        <span className="font-semibold text-fg text-sm">{p.name}</span>
        <Pill tone={tone}>{providerStateLabel(p.state)}</Pill>
        <div className="flex-1" />
        <Switch
          checked={p.enabled}
          onChange={(v) => onToggle(!v)}
        />
      </div>
      <div className="p-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-2xs text-mute">Tokens/min</div>
          <div className="mono text-fg text-base font-semibold">{p.tokensPerMin.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-2xs text-mute">Req/min</div>
          <div className="mono text-fg text-base font-semibold">{p.reqPerMin}</div>
        </div>
        <div>
          <div className="text-2xs text-mute">$/ชม</div>
          <div className="mono text-warn text-base font-semibold">${p.costUsdPerHr.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-2xs text-mute">Error rate</div>
          <div className={`mono text-base font-semibold ${p.errorRatePct > 5 ? 'text-crit' : p.errorRatePct > 2 ? 'text-warn' : 'text-ok'}`}>
            {p.errorRatePct.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-2xs text-mute">Latency avg / p95</div>
          <div className="mono text-fg">
            {p.avgLatencyMs}ms <span className="text-mute">/ {p.p95LatencyMs}ms</span>
          </div>
        </div>
        <div>
          <div className="text-2xs text-mute">Uptime 24h</div>
          <div className={`mono font-semibold ${p.uptime24hPct < 98 ? 'text-warn' : 'text-ok'}`}>
            {p.uptime24hPct.toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <MiniSpark data={p.series60min} color={p.color} />
        <div className="flex justify-between text-2xs text-mute mt-1 mono">
          <span>{p.models.length} models</span>
          <span>{p.keys.filter((k) => k.enabled).length}/{p.keys.length} keys ใช้งาน</span>
        </div>
      </div>
    </div>
  );
}

function MiniSpark({ data, color }: { data: number[]; color: string }) {
  const w = 280;
  const h = 36;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * (h - 2) - 1).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <polyline points={`${points} ${w},${h} 0,${h}`} fill={color} opacity={0.1} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Big multi-provider line chart — 60-min window, all providers overlaid.
// Click a legend chip to focus, "all" to reset.
// ─────────────────────────────────────────────────────────────────────────────
function UsageChart({
  providers,
  allProviders,
  selectedProvider,
  onSelectProvider,
}: {
  providers: ProviderUsage[];
  allProviders: ProviderUsage[];
  selectedProvider: string | 'all';
  onSelectProvider: (id: string | 'all') => void;
}) {
  const W = 1000;
  const H = 220;
  const PAD = { l: 44, r: 12, t: 12, b: 22 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const allValues = providers.flatMap((p) => p.series60min);
  const maxY = Math.max(1, ...allValues);
  const yTicks = 4;

  const xStep = innerW / 59;

  return (
    <div className="panel">
      <div className="px-3 py-2 border-b border-line flex items-center gap-2">
        <span className="t-h">TOKENS / นาที · 60 นาทีล่าสุด</span>
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
              key={p.id}
              onClick={() => onSelectProvider(p.id)}
              className={`pill ${selectedProvider === p.id ? 'pill-info' : 'pill-dim'}`}
              style={selectedProvider === p.id ? { borderColor: p.color, color: p.color } : undefined}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="p-2">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
          {/* Grid + y labels */}
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
          {/* X labels — every 10 min */}
          {[60, 50, 40, 30, 20, 10, 0].map((mins, i) => {
            const x = PAD.l + (innerW * i) / 6;
            return (
              <text key={mins} x={x} y={H - 6} textAnchor="middle" fontSize="9" fill="#6b7280" fontFamily="monospace">
                {mins === 0 ? 'now' : `-${mins}m`}
              </text>
            );
          })}
          {/* Lines */}
          {providers.map((p) => {
            const pts = p.series60min
              .map((v, i) => {
                const x = PAD.l + i * xStep;
                const y = PAD.t + innerH - (v / maxY) * innerH;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(' ');
            return (
              <g key={p.id}>
                <polyline
                  points={pts}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={p.enabled ? 1 : 0.3}
                />
                <polyline
                  points={`${pts} ${PAD.l + innerW},${PAD.t + innerH} ${PAD.l},${PAD.t + innerH}`}
                  fill={p.color}
                  opacity={0.07}
                />
                {/* End-of-line dot */}
                {(() => {
                  const last = p.series60min[p.series60min.length - 1];
                  const x = PAD.l + (p.series60min.length - 1) * xStep;
                  const y = PAD.t + innerH - (last / maxY) * innerH;
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

// ─────────────────────────────────────────────────────────────────────────────
// Single alert rule editor card
// ─────────────────────────────────────────────────────────────────────────────
function AlertRuleCard({
  rule,
  providers,
  onToggle,
  onUpdate,
  onDelete,
}: {
  rule: AlertRule;
  providers: ProviderUsage[];
  onToggle: () => void;
  onUpdate: (patch: Partial<AlertRule>) => void;
  onDelete: () => void;
}) {
  const isFired = rule.state === 'triggered';
  return (
    <div
      className="panel p-3"
      style={
        isFired
          ? { boxShadow: '0 0 0 1px rgba(239,68,68,.5), 0 0 24px rgba(239,68,68,.18)' }
          : undefined
      }
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`dot dot-${isFired ? 'crit' : rule.enabled ? 'ok' : 'mute'}`} />
        <input
          value={rule.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="text-sm font-semibold text-fg bg-transparent border-0 px-1 py-0.5 flex-1 focus:outline focus:outline-1 focus:outline-info"
        />
        {isFired && (
          <Pill tone="crit">🚨 ติด · {rule.lastTriggeredAt}</Pill>
        )}
        <Switch checked={rule.enabled} onChange={onToggle} />
        <button className="btn btn-ghost text-2xs" onClick={onDelete} title="ลบกฎ">×</button>
      </div>
      <div className="grid grid-cols-12 gap-2 text-xs">
        <label className="col-span-3">
          <div className="text-2xs text-mute mb-0.5">Provider</div>
          <select
            value={rule.providerId}
            onChange={(e) => onUpdate({ providerId: e.target.value as AlertRule['providerId'] })}
            className="w-full px-2 py-1"
          >
            <option value="any">ทุกราย (any)</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
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
            onChange={(e) => onUpdate({ op: e.target.value as AlertOperator })}
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
      <div className="mt-2 flex items-center gap-3 text-2xs">
        <span className="text-mute">แจ้งทาง:</span>
        {(['toast', 'desktop', 'sound'] as const).map((ch) => (
          <label key={ch} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={rule.notifyChannels.includes(ch)}
              onChange={(e) => {
                const set = new Set(rule.notifyChannels);
                if (e.target.checked) set.add(ch);
                else set.delete(ch);
                onUpdate({ notifyChannels: Array.from(set) as AlertRule['notifyChannels'] });
              }}
            />
            <span className="text-fg">{ch === 'toast' ? '🔔 toast' : ch === 'desktop' ? '🖥 desktop' : '🔊 เสียง'}</span>
          </label>
        ))}
      </div>
      {rule.notes && (
        <div className="text-2xs text-mute mt-2 italic">{rule.notes}</div>
      )}
    </div>
  );
}
