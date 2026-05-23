'use client';

import { useMemo } from 'react';
import { Pill, ChannelChip } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import {
  useAdminData,
  fetchFortuneWorkersQueue,
  describeError,
  type FortuneWorkersQueue,
  type FortuneCompletedRow,
  type FortuneInFlightRow,
} from '@/lib/api';

// 3-second refresh: aggressive enough to feel realtime; cheap enough on the
// server (one query in the controller, ~5ms each).
const REFRESH_SEC = 3;

export default function WorkersPage() {
  const live = useAdminData({
    key: 'fortune-workers-queue',
    fetcher: () => fetchFortuneWorkersQueue(),
    mock: null as unknown as FortuneWorkersQueue,
    intervalOverride: REFRESH_SEC,
  });

  const data = live.data ?? null;
  const inFlight: FortuneInFlightRow[] = data?.in_flight ?? [];
  const recent: FortuneCompletedRow[] = data?.recent_completed ?? [];
  const q = data?.queue ?? {
    pending_paid: 0,
    pending_unpaid: 0,
    in_flight: 0,
    stuck: 0,
    completed_last_15m: 0,
    completed_last_hour: 0,
    failed_last_15m: 0,
  };
  const tp = data?.throughput ?? { per_min: 0, per_hour: 0 };
  const lat = data?.latency ?? { avg_seconds: 0, p95_seconds: 0 };

  // Progress: completed vs (pending+in_flight+completed) over the last 15min.
  const completed = q.completed_last_15m;
  const totalSeen = q.pending_paid + q.in_flight + completed + q.failed_last_15m;
  const donePct = totalSeen > 0 ? Math.min(100, (completed / totalSeen) * 100) : 0;
  const failPct = totalSeen > 0 ? Math.min(100, (q.failed_last_15m / totalSeen) * 100) : 0;

  const kpis = useMemo(
    () => [
      { label: 'กำลังตอบ (in-flight)', value: String(q.in_flight), sub: q.stuck ? `${q.stuck} stuck >60s` : 'ปกติ', color: q.in_flight > 0 ? '#22d3ee' : '#6b7280' },
      { label: 'รอจ่าย (queue)', value: String(q.pending_unpaid), sub: q.pending_paid ? `${q.pending_paid} จ่ายแล้ว รอตอบ` : '—', color: '#f59e0b' },
      { label: 'ตอบใน 15 นาที', value: String(q.completed_last_15m), sub: `${q.completed_last_hour} ใน 1 ชม.`, color: '#10b981' },
      { label: 'ล้มเหลว / สแตก', value: String(q.failed_last_15m + q.stuck), sub: `fail 15m: ${q.failed_last_15m} · stuck: ${q.stuck}`, color: (q.failed_last_15m + q.stuck) > 0 ? '#ef4444' : '#6b7280' },
      { label: 'Throughput', value: tp.per_min.toFixed(1), sub: `${tp.per_hour}/ชม.`, color: '#8b5cf6' },
      { label: 'Latency เฉลี่ย', value: `${lat.avg_seconds}s`, sub: `p95 ${lat.p95_seconds}s`, color: '#67e8f9' },
    ],
    [q, tp, lat],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className={`dot ${q.stuck > 0 || q.failed_last_15m > 0 ? 'dot-warn' : q.in_flight > 0 ? 'dot-info' : 'dot-mute'}`} />
        <span className="t-h">DM WORKERS · Fortune AI queue (real)</span>
        <DataSourceBadge source={live.source} isLoading={live.isLoading} error={live.error} />
        <Pill tone={q.in_flight > 0 ? 'info' : 'dim'}>{q.in_flight} กำลังตอบ</Pill>
        {q.stuck > 0 && <Pill tone="crit">⚠ {q.stuck} stuck</Pill>}
        <div className="flex-1" />
        <span className="text-2xs text-mute mono">refresh {REFRESH_SEC}s</span>
        <button className="btn" onClick={() => void live.refetch()}>
          ↻ refresh
        </button>
      </header>

      {/* KPI strip */}
      <section className="px-3 py-2 border-b border-line shrink-0">
        <div className="grid grid-cols-6 gap-2">
          {kpis.map((k) => (
            <div key={k.label} className="panel px-3 py-2">
              <div className="t-h">{k.label}</div>
              <div className="mono text-2xl font-semibold mt-1" style={{ color: k.color }}>{k.value}</div>
              <div className="text-2xs text-mute mt-0.5">{k.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Big queue progress bar — last 15 minutes */}
      <section className="px-3 py-3 border-b border-line shrink-0">
        <div className="flex items-center justify-between text-2xs mb-1.5">
          <span className="t-h">QUEUE · 15 นาทีล่าสุด</span>
          <span className="mono text-mute">
            <span className="text-ok">{q.completed_last_15m}</span>
            {' + '}
            <span className="text-crit">{q.failed_last_15m}</span>
            {' / '}
            <span className="text-fg">{totalSeen}</span>
            {' · '}
            <span className="text-info font-semibold">{donePct.toFixed(1)}% เสร็จ</span>
          </span>
        </div>
        <div className="queue-bar">
          <div className="queue-fill queue-fill-ok" style={{ width: `${donePct}%` }} />
          <div className="queue-fill queue-fill-fail" style={{ width: `${failPct}%`, left: `${donePct}%` }} />
          <div className="queue-shimmer" style={{ left: `${donePct}%` }} />
        </div>
        <div className="flex justify-between text-2xs text-mute mt-1.5 mono">
          <span>● ตอบสำเร็จ {q.completed_last_15m}</span>
          <span>● ล้มเหลว {q.failed_last_15m}</span>
          <span>○ รอ {q.pending_paid + q.pending_unpaid}</span>
          <span>throughput {tp.per_min.toFixed(1)}/min</span>
        </div>
      </section>

      {/* Main: in-flight + recent activity */}
      <main className="flex-1 grid min-h-0 overflow-hidden" style={{ gridTemplateColumns: '1fr 420px' }}>
        <section className="overflow-y-auto p-3">
          <div className="t-h mb-2">IN-FLIGHT · กำลังประมวลผล ({inFlight.length})</div>
          {inFlight.length === 0 ? (
            <div className="text-center text-2xs text-mute p-12 panel">
              {live.isLoading ? 'กำลังโหลด...' : '— ไม่มี reading รอประมวลผลตอนนี้ —'}
            </div>
          ) : (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
            >
              {inFlight.map((r) => (
                <InFlightCard key={r.reading_id} r={r} />
              ))}
            </div>
          )}
        </section>

        <aside className="border-l border-line bg-panel2/30 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-line flex items-center gap-2 shrink-0">
            <span className="dot dot-info" />
            <span className="t-h">ACTIVITY · ตอบล่าสุด 24h</span>
            <Pill tone="info">{recent.length}</Pill>
            <div className="flex-1" />
            {live.error && (
              <span className="text-2xs text-crit mono truncate" title={live.error}>
                ‼ {describeError(live.error).slice(0, 40)}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {recent.length === 0 ? (
              <div className="text-center text-2xs text-mute p-6">ยังไม่มีการตอบใน 24 ชั่วโมงที่ผ่านมา</div>
            ) : (
              recent.map((a) => <ActivityRow key={a.reading_id} a={a} />)
            )}
          </div>
        </aside>
      </main>

      <style jsx>{`
        .queue-bar {
          position: relative;
          height: 14px;
          background: #0d1320;
          border: 1px solid var(--border, #1f2937);
          border-radius: 7px;
          overflow: hidden;
          box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.5);
        }
        .queue-fill {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          transition: width 0.5s cubic-bezier(0.22, 0.61, 0.36, 1), left 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);
        }
        .queue-fill-ok {
          background: linear-gradient(90deg, rgba(16, 185, 129, 0.45) 0%, rgba(16, 185, 129, 0.85) 100%);
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
        }
        .queue-fill-fail {
          background: linear-gradient(90deg, rgba(239, 68, 68, 0.45) 0%, rgba(239, 68, 68, 0.85) 100%);
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
        }
        .queue-bar::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            -45deg,
            rgba(255, 255, 255, 0.04) 0,
            rgba(255, 255, 255, 0.04) 6px,
            transparent 6px,
            transparent 12px
          );
          animation: stripes 1.6s linear infinite;
          pointer-events: none;
        }
        @keyframes stripes {
          to {
            background-position: 24px 0;
          }
        }
        .queue-shimmer {
          position: absolute;
          top: -2px;
          bottom: -2px;
          width: 28px;
          transform: translateX(-50%);
          background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.7), transparent);
          filter: blur(2px);
          animation: shimmerPulse 1.4s ease-in-out infinite;
          transition: left 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);
          pointer-events: none;
        }
        @keyframes shimmerPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function InFlightCard({ r }: { r: FortuneInFlightRow }) {
  const stuck = r.age_seconds > 60;
  const color = stuck ? '#ef4444' : r.paid ? '#22d3ee' : '#f59e0b';
  return (
    <div
      className="panel relative overflow-hidden"
      style={stuck ? { boxShadow: 'inset 0 0 0 1px rgba(239,68,68,.3), 0 0 18px rgba(239,68,68,.15)' } : undefined}
    >
      <div className="severity-stripe" style={{ background: color }} />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
        <span className={`dot dot-${stuck ? 'crit' : r.paid ? 'info' : 'warn'}`} />
        <span className="font-semibold text-fg text-sm mono">#{r.reading_id}</span>
        <ChannelChip channel={r.platform === 'line' ? 'line' : 'fb'} />
        <Pill tone={r.paid ? 'ok' : 'warn'}>{r.paid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย'}</Pill>
        <div className="flex-1" />
        <span className={`mono text-2xs ${stuck ? 'text-crit' : 'text-mute'}`}>{r.age_seconds}s</span>
      </div>
      <div className="px-3 py-3">
        <div className="text-sm text-fg font-medium truncate">{r.name}</div>
        {r.comment_preview && (
          <div className="text-xs text-fg/70 italic mt-1 line-clamp-2">
            "{r.comment_preview}"
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-2 text-2xs text-info">
          <TypingDots />
          <span>{stuck ? 'ค้างนานผิดปกติ — กำลัง retry' : 'AI กำลังประมวลผล...'}</span>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ a }: { a: FortuneCompletedRow }) {
  const fail = !a.reply_preview;
  const time = a.responded_at ? a.responded_at.slice(11, 19) : '';
  return (
    <div className={`px-3 py-2 border-b border-line/60 text-2xs activity-row ${fail ? 'activity-fail' : 'activity-ok'}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="mono text-mute">{time}</span>
        <span className="mono font-semibold text-info">#{a.reading_id}</span>
        <span className="text-mute">→</span>
        <ChannelChip channel={a.platform === 'line' ? 'line' : 'fb'} />
        <span className="text-fg truncate flex-1">{a.name}</span>
        {a.provider && <Pill tone="mystic">{a.provider}</Pill>}
        {a.latency_seconds != null && (
          <span className={`mono ${a.latency_seconds > 30 ? 'text-warn' : 'text-mute'}`}>{a.latency_seconds}s</span>
        )}
      </div>
      {a.comment_preview && (
        <div className="text-mute italic line-clamp-1">› "{a.comment_preview}"</div>
      )}
      {a.reply_preview && (
        <div className="line-clamp-2 mt-0.5 text-fg/80">
          ✓ {a.reply_preview}
        </div>
      )}
      <style jsx>{`
        .activity-row {
          animation: rowIn 0.32s ease-out;
        }
        .activity-ok {
          border-left: 2px solid rgba(16, 185, 129, 0.35);
        }
        .activity-fail {
          border-left: 2px solid rgba(239, 68, 68, 0.5);
        }
        @keyframes rowIn {
          from { opacity: 0; transform: translateY(-4px); background: rgba(34, 211, 238, 0.08); }
          to   { opacity: 1; transform: translateY(0); background: transparent; }
        }
      `}</style>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="typing">
      <span /><span /><span />
      <style jsx>{`
        .typing { display: inline-flex; gap: 3px; align-items: center; }
        .typing span {
          width: 4px; height: 4px; border-radius: 50%;
          background: #22d3ee; box-shadow: 0 0 6px rgba(34, 211, 238, 0.6);
          animation: typingDot 0.9s ease-in-out infinite;
        }
        .typing span:nth-child(2) { animation-delay: 0.15s; }
        .typing span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes typingDot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </span>
  );
}
