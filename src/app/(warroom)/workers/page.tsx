'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pill, ChannelChip } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { useWarroom } from '@/lib/stores/warroom';
import {
  INITIAL_ACTIVITY,
  INITIAL_QUEUE_STATS,
  INITIAL_WORKERS,
  makeRandomTarget,
  workerStateColor,
  workerStateLabel,
  workerStateTone,
  type DmWorker,
  type WorkerActivity,
  type WorkerQueueStats,
} from '@/lib/mock/workers-page';

// Realtime tick interval — fake "live" feed until backend exposes this endpoint.
const TICK_MS = 1500;

const REPLY_POOL = [
  'สวัสดีค่าาา ทักทายผ่าน DM นะคะ พี่หมอเปิดไพ่ให้เลย ✨',
  'รับค่าาา ส่งวันเดือนปีเกิดมาในนี้เลยนะคะ',
  'ขอบคุณที่ทักมาค่า ตอนนี้มีโปร Celtic 99฿ สนใจไหมคะ 🔮',
  'พี่หมอเห็นคอมเม้นต์แล้วค่ะ ขอเปิด 3 ใบให้เลยนะคะ',
  'ขอวันเดือนปีเกิด เวลาที่จำได้ และคำถาม 1 ข้อหลักนะคะ',
];

function nowHMS() {
  return new Date().toTimeString().slice(0, 8);
}

export default function WorkersPage() {
  const pushToast = useWarroom((s) => s.pushToast);

  const [workers, setWorkers] = useState<DmWorker[]>(INITIAL_WORKERS);
  const [activity, setActivity] = useState<WorkerActivity[]>(INITIAL_ACTIVITY);
  const [stats, setStats] = useState<WorkerQueueStats>(INITIAL_QUEUE_STATS);
  const [paused, setPaused] = useState(false);

  // Counter for generating unique target seeds without re-rolling identical
  // ones from the SAMPLE_NAMES pool every tick.
  const seedRef = useRef(100);
  // Monotonic id source for activity rows. Date.now() + workerId can collide
  // when React StrictMode double-invokes the tick in dev — use a counter.
  const actIdRef = useRef(0);

  // ── Realtime tick ────────────────────────────────────────────────────────
  // Drives the whole page: workers finish their current target, push a new
  // entry to the activity log, dec pending / inc sent, and pick a new target.
  // Errors and cooldowns flip back to processing after a few ticks.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setWorkers((prev) => {
        const next = prev.map((w) => ({ ...w }));
        const newActs: WorkerActivity[] = [];
        let sentDelta = 0;
        let failedDelta = 0;
        let pendingDelta = 0;

        for (const w of next) {
          // Cooldown / error: ~50% chance to recover this tick.
          if (w.state === 'cooldown' || w.state === 'error') {
            if (Math.random() < 0.5) {
              w.state = 'processing';
              w.target = makeRandomTarget(seedRef.current++);
              w.errorReason = undefined;
              w.cooldownUntil = undefined;
            }
            continue;
          }

          if (w.state === 'idle') {
            // Idle worker has small chance to pick up new work if queue has it.
            if (Math.random() < 0.4) {
              w.state = 'processing';
              w.target = makeRandomTarget(seedRef.current++);
            }
            continue;
          }

          // processing — chance to finish this tick.
          if (Math.random() < 0.6 && w.target) {
            const failed = Math.random() < 0.05;
            const latency = 600 + Math.random() * 1400;
            const reply = REPLY_POOL[Math.floor(Math.random() * REPLY_POOL.length)];
            const target = w.target;

            newActs.push({
              id: `act-${++actIdRef.current}-${w.id}`,
              ts: nowHMS(),
              workerId: w.id,
              customer: target.name,
              channel: target.channel,
              comment: target.comment,
              reply: failed ? '(no reply — rate limit / window closed)' : reply,
              status: failed ? 'fail' : 'ok',
              latencyMs: Math.round(latency),
            });

            // update counters
            w.tasksDone += 1;
            w.avgLatencyMs = Math.round(w.avgLatencyMs * 0.7 + latency * 0.3);
            if (failed) failedDelta += 1;
            else sentDelta += 1;
            pendingDelta -= 1;

            // What's next? cooldown / error / finished / new target
            if (failed && Math.random() < 0.4) {
              w.state = 'error';
              w.errorReason = 'FB#10 — outside 24h window';
              w.target = null;
            } else if (Math.random() < 0.07) {
              w.state = 'cooldown';
              w.cooldownUntil = new Date(Date.now() + 30_000).toTimeString().slice(0, 8);
              w.target = null;
            } else if (w.tasksDone >= w.tasksTotal) {
              w.state = 'idle';
              w.target = null;
            } else {
              w.target = makeRandomTarget(seedRef.current++);
            }
          }
        }

        if (newActs.length) {
          setActivity((a) => [...newActs.reverse(), ...a].slice(0, 60));
        }
        if (sentDelta || failedDelta || pendingDelta) {
          setStats((s) => {
            const newPending = Math.max(0, s.pending + pendingDelta);
            const newSent = s.sent + sentDelta;
            const newFailed = s.failed + failedDelta;
            const newTotal = newPending + newSent + newFailed + next.filter((w) => w.state === 'processing').length;
            // throughput: rough moving avg (per minute)
            const tp = Math.max(0, (sentDelta + failedDelta) * (60_000 / TICK_MS) * 0.4 + s.throughput * 0.6);
            const lats = next.filter((w) => w.avgLatencyMs).map((w) => w.avgLatencyMs);
            const avg = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : s.avgLatencyMs;
            return {
              pending: newPending,
              sent: newSent,
              failed: newFailed,
              totalAssigned: newTotal,
              throughput: Math.round(tp * 10) / 10,
              avgLatencyMs: avg,
            };
          });
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, [paused]);

  // ── Aggregates ───────────────────────────────────────────────────────────
  const processingCount = workers.filter((w) => w.state === 'processing').length;
  const cooldownCount = workers.filter((w) => w.state === 'cooldown').length;
  const errorCount = workers.filter((w) => w.state === 'error').length;
  const idleCount = workers.filter((w) => w.state === 'idle').length;

  const donePct = stats.totalAssigned
    ? Math.min(100, ((stats.sent + stats.failed) / stats.totalAssigned) * 100)
    : 0;
  const sentPct = stats.totalAssigned ? (stats.sent / stats.totalAssigned) * 100 : 0;
  const failedPct = stats.totalAssigned ? (stats.failed / stats.totalAssigned) * 100 : 0;

  const kpis = useMemo(
    () => [
      { label: 'Workers ทำงาน', value: `${processingCount}/${workers.length}`, sub: `${idleCount} ว่าง · ${cooldownCount} cooldown`, color: '#22d3ee' },
      { label: 'รอใน Queue', value: stats.pending.toLocaleString(), sub: 'ค้างส่ง DM', color: '#f59e0b' },
      { label: 'ส่งสำเร็จ', value: stats.sent.toLocaleString(), sub: 'กะนี้', color: '#10b981' },
      { label: 'ล้มเหลว', value: stats.failed.toLocaleString(), sub: errorCount ? `${errorCount} worker error` : 'ภายในขีด', color: '#ef4444' },
      { label: 'Throughput', value: stats.throughput.toFixed(1), sub: 'reply / นาที', color: '#8b5cf6' },
      { label: 'Latency เฉลี่ย', value: `${stats.avgLatencyMs}ms`, sub: 'ต่อ reply', color: '#67e8f9' },
    ],
    [processingCount, workers.length, idleCount, cooldownCount, errorCount, stats],
  );

  // ── Actions ──────────────────────────────────────────────────────────────
  const spawnWorker = useCallback(() => {
    setWorkers((prev) => {
      const id = `DM-W${String(prev.length + 1).padStart(2, '0')}`;
      const w: DmWorker = {
        id,
        pid: 28000 + Math.floor(Math.random() * 9999),
        state: 'processing',
        target: makeRandomTarget(seedRef.current++),
        tasksDone: 0,
        tasksTotal: 60,
        rate: 0,
        avgLatencyMs: 0,
        startedAt: new Date().toTimeString().slice(0, 5),
        uptimeMin: 0,
      };
      return [...prev, w];
    });
    setStats((s) => ({ ...s, totalAssigned: s.totalAssigned + 60, pending: s.pending + 60 }));
    pushToast({ kind: 'ok', title: '➕ Spawn worker', body: 'เพิ่ม worker ใหม่ในฝูง' });
  }, [pushToast]);

  const killWorker = useCallback((id: string) => {
    setWorkers((prev) => prev.filter((w) => w.id !== id));
    pushToast({ kind: 'warn', title: 'หยุด ' + id, body: 'worker ถูกถอดออกจากฝูง' });
  }, [pushToast]);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      pushToast({
        kind: p ? 'ok' : 'warn',
        title: p ? '▶ เดินต่อ' : '⏸ หยุดชั่วคราว',
        body: p ? 'ฝูง worker เริ่มประมวลผลต่อ' : 'ฝูง worker หยุดทุกตัว',
      });
      return !p;
    });
  }, [pushToast]);

  const resetStats = useCallback(() => {
    if (!window.confirm('รีเซ็ตยอดของกะนี้?')) return;
    setStats(INITIAL_QUEUE_STATS);
    setActivity(INITIAL_ACTIVITY);
    setWorkers(INITIAL_WORKERS);
    pushToast({ kind: 'info', title: '↻ รีเซ็ตยอดแล้ว', body: 'กลับสู่ค่าเริ่มต้น' });
  }, [pushToast]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className={`dot ${paused ? 'dot-warn' : 'dot-info'}`} />
        <span className="t-h">DM WORKERS · ฝูงตอบคอมเม้นต์</span>
        <DataSourceBadge source="mock" title="mock-first — ยังไม่มี endpoint ฝั่ง thaiprompt" />
        <Pill tone={paused ? 'warn' : 'ok'}>{paused ? 'หยุดอยู่' : 'กำลังทำงาน'}</Pill>
        <div className="flex-1" />
        <button className="btn" onClick={spawnWorker}>➕ Spawn worker</button>
        <button className="btn" onClick={resetStats}>↻ Reset</button>
        <button className={`btn ${paused ? 'btn-ok' : 'btn-warn'}`} onClick={togglePause}>
          {paused ? '▶ เดินต่อ' : '⏸ หยุดทั้งหมด'}
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

      {/* Big queue progress bar */}
      <section className="px-3 py-3 border-b border-line shrink-0">
        <div className="flex items-center justify-between text-2xs mb-1.5">
          <span className="t-h">QUEUE PROGRESS · ความคืบหน้าของกะ</span>
          <span className="mono text-mute">
            <span className="text-ok">{stats.sent}</span>
            {' + '}
            <span className="text-crit">{stats.failed}</span>
            {' / '}
            <span className="text-fg">{stats.totalAssigned}</span>
            {' · '}
            <span className="text-info font-semibold">{donePct.toFixed(1)}%</span>
          </span>
        </div>
        <div className="queue-bar">
          <div className="queue-fill queue-fill-ok" style={{ width: `${sentPct}%` }} />
          <div
            className="queue-fill queue-fill-fail"
            style={{ width: `${failedPct}%`, left: `${sentPct}%` }}
          />
          <div className="queue-shimmer" style={{ left: `${donePct}%` }} />
        </div>
        <div className="flex justify-between text-2xs text-mute mt-1.5 mono">
          <span>● ส่งแล้ว {stats.sent}</span>
          <span>● ล้มเหลว {stats.failed}</span>
          <span>○ เหลือ {stats.pending}</span>
          <span>throughput {stats.throughput.toFixed(1)}/min</span>
        </div>
      </section>

      {/* Main grid: workers + activity */}
      <main className="flex-1 grid min-h-0 overflow-hidden" style={{ gridTemplateColumns: '1fr 380px' }}>
        {/* Worker cards */}
        <section className="overflow-y-auto p-3">
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
          >
            {workers.map((w) => (
              <WorkerCard key={w.id} worker={w} onKill={() => killWorker(w.id)} />
            ))}
            {workers.length === 0 && (
              <div className="col-span-full text-center text-2xs text-mute p-12">
                ยังไม่มี worker — กด ➕ Spawn worker
              </div>
            )}
          </div>
        </section>

        {/* Activity log */}
        <aside className="border-l border-line bg-panel2/30 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-line flex items-center gap-2 shrink-0">
            <span className={`dot ${paused ? 'dot-mute' : 'dot-info'}`} />
            <span className="t-h">ACTIVITY · ตอบล่าสุด</span>
            <Pill tone="info">{activity.length}</Pill>
            <div className="flex-1" />
            <button
              className="btn btn-ghost text-2xs"
              onClick={() => setActivity([])}
              title="ล้าง log ที่แสดง (ไม่กระทบยอดสะสม)"
            >
              ล้าง
            </button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {activity.map((a) => (
              <ActivityRow key={a.id} a={a} />
            ))}
            {activity.length === 0 && (
              <div className="text-center text-2xs text-mute p-6">ยังไม่มีการตอบในรอบนี้</div>
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
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker card — one box per worker. Shows current target with typing dots,
// per-worker progress bar (tasksDone / tasksTotal), and a kill button.
// ─────────────────────────────────────────────────────────────────────────────
function WorkerCard({ worker: w, onKill }: { worker: DmWorker; onKill: () => void }) {
  const color = workerStateColor(w.state);
  const pct = w.tasksTotal ? Math.min(100, (w.tasksDone / w.tasksTotal) * 100) : 0;
  const isProcessing = w.state === 'processing';
  const isError = w.state === 'error';

  return (
    <div
      className={`panel relative overflow-hidden ${isError ? 'border-crit/40' : ''}`}
      style={{
        boxShadow: isProcessing
          ? `inset 0 0 0 1px ${color}40, 0 0 18px ${color}22`
          : undefined,
      }}
    >
      {/* Status stripe */}
      <div className="severity-stripe" style={{ background: color }} />

      {/* Top: id + state + kill */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
        <span className={`dot dot-${workerStateTone(w.state)}`} />
        <span className="font-semibold text-fg text-sm mono">{w.id}</span>
        <span className="text-2xs text-mute mono">pid {w.pid}</span>
        <Pill tone={workerStateTone(w.state)}>{workerStateLabel(w.state)}</Pill>
        <div className="flex-1" />
        <button
          className="btn btn-ghost text-2xs"
          onClick={onKill}
          title="หยุด worker นี้"
        >
          ✕
        </button>
      </div>

      {/* Current target / status body */}
      <div className="px-3 py-3 min-h-[88px]">
        {w.state === 'processing' && w.target ? (
          <>
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-8 h-8 rounded-full grid place-items-center text-base shrink-0"
                style={{
                  background: 'rgba(139,92,246,.15)',
                  border: '1px solid rgba(139,92,246,.4)',
                }}
              >
                {w.target.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-fg font-medium truncate">{w.target.name}</span>
                  <ChannelChip channel={w.target.channel === 'LINE' ? 'line' : 'fb'} />
                </div>
                <div className="text-2xs text-mute mono truncate">PSID {w.target.psid}</div>
              </div>
            </div>
            <div className="text-2xs text-mute mb-0.5">คอมเม้นต์ใต้ "{w.target.postTitle}"</div>
            <div className="text-xs text-fg/90 line-clamp-1 italic">"{w.target.comment}"</div>
            <div className="flex items-center gap-1.5 mt-1.5 text-2xs text-info">
              <TypingDots />
              <span>กำลังพิมพ์ตอบ...</span>
            </div>
          </>
        ) : w.state === 'cooldown' ? (
          <div className="grid place-items-center h-full text-center py-3">
            <div>
              <div className="text-2xl mb-1">🧊</div>
              <div className="text-2xs text-warn font-semibold">พักคูลดาวน์</div>
              <div className="text-2xs text-mute mono mt-0.5">ปลดล็อก {w.cooldownUntil}</div>
            </div>
          </div>
        ) : w.state === 'idle' ? (
          <div className="grid place-items-center h-full text-center py-3">
            <div>
              <div className="text-2xl mb-1">💤</div>
              <div className="text-2xs text-mute">ว่าง — รอ queue ใหม่</div>
            </div>
          </div>
        ) : (
          <div className="grid place-items-center h-full text-center py-2">
            <div>
              <div className="text-2xl mb-1">⚠️</div>
              <div className="text-2xs text-crit font-semibold">{w.errorReason ?? 'ล้มเหลวไม่ทราบสาเหตุ'}</div>
              <div className="text-2xs text-mute mono mt-0.5">รอ retry...</div>
            </div>
          </div>
        )}
      </div>

      {/* Per-worker progress */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between text-2xs text-mute mb-1">
          <span>ความคืบหน้า</span>
          <span className="mono">
            <span style={{ color }}>{w.tasksDone}</span>
            <span className="text-mute">/{w.tasksTotal}</span>
          </span>
        </div>
        <div className="worker-bar">
          <div
            className="worker-fill"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${color}50, ${color})`,
              boxShadow: `0 0 8px ${color}66`,
            }}
          />
        </div>
        <div className="flex items-center justify-between text-2xs text-mute mt-1.5 mono">
          <span>↻ {w.rate.toFixed(1)} /min</span>
          <span>⏱ {w.avgLatencyMs ? w.avgLatencyMs + 'ms' : '—'}</span>
          <span>up {w.uptimeMin}m</span>
        </div>
      </div>

      <style jsx>{`
        .worker-bar {
          height: 6px;
          background: #0d1320;
          border: 1px solid var(--border, #1f2937);
          border-radius: 3px;
          overflow: hidden;
          position: relative;
        }
        .worker-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
          position: relative;
        }
        .worker-fill::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.35) 50%,
            transparent 100%
          );
          animation: workerSheen 1.6s linear infinite;
        }
        @keyframes workerSheen {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="typing">
      <span />
      <span />
      <span />
      <style jsx>{`
        .typing {
          display: inline-flex;
          gap: 3px;
          align-items: center;
        }
        .typing span {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #22d3ee;
          box-shadow: 0 0 6px rgba(34, 211, 238, 0.6);
          animation: typingDot 0.9s ease-in-out infinite;
        }
        .typing span:nth-child(2) {
          animation-delay: 0.15s;
        }
        .typing span:nth-child(3) {
          animation-delay: 0.3s;
        }
        @keyframes typingDot {
          0%,
          80%,
          100% {
            transform: translateY(0);
            opacity: 0.35;
          }
          40% {
            transform: translateY(-3px);
            opacity: 1;
          }
        }
      `}</style>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// One row in the right-side activity log.
// ─────────────────────────────────────────────────────────────────────────────
function ActivityRow({ a }: { a: WorkerActivity }) {
  const fail = a.status === 'fail';
  return (
    <div
      className={`px-3 py-2 border-b border-line/60 text-2xs activity-row ${fail ? 'activity-fail' : 'activity-ok'}`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="mono text-mute">{a.ts}</span>
        <span className={`mono font-semibold ${fail ? 'text-crit' : 'text-info'}`}>{a.workerId}</span>
        <span className="text-mute">→</span>
        <ChannelChip channel={a.channel === 'LINE' ? 'line' : 'fb'} />
        <span className="text-fg truncate">{a.customer}</span>
        <div className="flex-1" />
        <span className="mono text-mute">{a.latencyMs}ms</span>
      </div>
      <div className="text-mute italic line-clamp-1">› "{a.comment}"</div>
      <div className={`line-clamp-2 mt-0.5 ${fail ? 'text-crit' : 'text-fg/80'}`}>
        {fail ? '✗ ' : '✓ '}
        {a.reply}
      </div>
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
          from {
            opacity: 0;
            transform: translateY(-4px);
            background: rgba(34, 211, 238, 0.08);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            background: transparent;
          }
        }
      `}</style>
    </div>
  );
}
