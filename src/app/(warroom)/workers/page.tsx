'use client';

import { useMemo } from 'react';
import { Pill, ChannelChip } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import {
  useAdminData,
  fetchFortuneWorkersQueue,
  describeError,
  type FortuneWorkersQueue,
  type WorkerCallRow,
  type CommentDmRow,
} from '@/lib/api';

const REFRESH_SEC = 3;

const PROVIDER_COLOR: Record<string, string> = {
  openai: '#10b981',
  anthropic: '#d4a747',
  groq: '#22d3ee',
  grok: '#e879f9',
  google: '#8b5cf6',
  gemini: '#8b5cf6',
  deepseek: '#f59e0b',
  qwen: '#f43f5e',
  meta: '#1877f2',
  'meta-local': '#0ea5e9',
};

function providerColor(name?: string): string {
  if (!name) return '#6b7280';
  return PROVIDER_COLOR[name.toLowerCase()] ?? '#94a3b8';
}

export default function WorkersPage() {
  const live = useAdminData({
    key: 'fortune-workers-queue',
    fetcher: () => fetchFortuneWorkersQueue(),
    mock: null as unknown as FortuneWorkersQueue,
    intervalOverride: REFRESH_SEC,
  });

  const data = live.data ?? null;
  const inFlight: WorkerCallRow[] = data?.in_flight ?? [];
  const recent: WorkerCallRow[] = data?.recent_completed ?? [];
  const commentDms: CommentDmRow[] = data?.comment_dms ?? [];
  const split = data?.provider_split ?? [];
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
  const lat = data?.latency ?? { avg_ms: 0, p95_ms: 0 };

  const total15 = q.completed_last_15m + q.failed_last_15m;
  const donePct = total15 > 0 ? (q.completed_last_15m / total15) * 100 : 0;
  const failPct = total15 > 0 ? (q.failed_last_15m / total15) * 100 : 0;

  const kpis = useMemo(
    () => [
      { label: 'AI calls / 15 นาที', value: total15.toString(), sub: `${q.completed_last_15m} OK · ${q.failed_last_15m} fail`, color: q.failed_last_15m > q.completed_last_15m ? '#ef4444' : '#10b981' },
      { label: 'รอบล่าสุด (in-flight 30s)', value: String(inFlight.length), sub: inFlight.length > 0 ? '🔥 บอททำงานอยู่' : 'ว่าง', color: inFlight.length > 0 ? '#22d3ee' : '#6b7280' },
      { label: 'Throughput', value: tp.per_min.toFixed(1), sub: `${tp.per_hour}/ชม.`, color: '#8b5cf6' },
      { label: 'Latency', value: `${lat.avg_ms}ms`, sub: `p95 ${lat.p95_ms}ms`, color: lat.p95_ms > 5000 ? '#f59e0b' : '#67e8f9' },
      { label: 'คิวดูดวงค้าง', value: String(q.pending_paid + q.pending_unpaid), sub: q.stuck > 0 ? `⚠ ${q.stuck} stuck` : `${q.pending_paid} จ่ายแล้ว`, color: q.stuck > 0 ? '#ef4444' : '#f59e0b' },
      { label: 'Comment→DM 24h', value: String(commentDms.length), sub: 'auto-reply log', color: '#d4a747' },
    ],
    [q, tp, lat, inFlight.length, commentDms.length, total15],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className={`dot ${q.failed_last_15m > q.completed_last_15m ? 'dot-warn' : inFlight.length > 0 ? 'dot-info' : 'dot-ok'}`} />
        <span className="t-h">BOT WORKERS · ฝูง AI ตอบลูกค้า (real)</span>
        <DataSourceBadge source={live.source} isLoading={live.isLoading} error={live.error} />
        <Pill tone={inFlight.length > 0 ? 'info' : 'ok'}>
          {inFlight.length > 0 ? `🔥 ${inFlight.length} ทำงานอยู่` : 'พักรอ'}
        </Pill>
        {q.failed_last_15m > 0 && <Pill tone="crit">⚠ {q.failed_last_15m} fail / 15m</Pill>}
        <div className="flex-1" />
        <span className="text-2xs text-mute mono">refresh {REFRESH_SEC}s</span>
        <button className="btn" onClick={() => void live.refetch()}>↻ refresh</button>
      </header>

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

      {/* Big bar: success vs fail over last 15 min */}
      <section className="px-3 py-3 border-b border-line shrink-0">
        <div className="flex items-center justify-between text-2xs mb-1.5">
          <span className="t-h">AI CALLS · 15 นาทีล่าสุด</span>
          <span className="mono text-mute">
            <span className="text-ok">{q.completed_last_15m}</span>
            {' OK + '}
            <span className="text-crit">{q.failed_last_15m}</span>
            {' fail = '}
            <span className="text-fg">{total15}</span>
            {' calls · '}
            <span className="text-info font-semibold">{donePct.toFixed(1)}% success</span>
          </span>
        </div>
        <div className="queue-bar">
          <div className="queue-fill queue-fill-ok" style={{ width: `${donePct}%` }} />
          <div className="queue-fill queue-fill-fail" style={{ width: `${failPct}%`, left: `${donePct}%` }} />
          {total15 > 0 && <div className="queue-shimmer" style={{ left: `${donePct}%` }} />}
        </div>

        {/* Per-provider split row */}
        {split.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap text-2xs">
            {split.map((s) => {
              const okPct = s.calls > 0 ? (s.ok / s.calls) * 100 : 0;
              return (
                <div key={s.provider} className="flex items-center gap-1.5 panel px-2 py-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: providerColor(s.provider) }} />
                  <span className="text-fg font-semibold">{s.provider}</span>
                  <span className="mono text-mute">{s.calls} calls</span>
                  <span className={`mono ${okPct >= 90 ? 'text-ok' : okPct >= 50 ? 'text-warn' : 'text-crit'}`}>
                    {okPct.toFixed(0)}% ok
                  </span>
                  <span className="mono text-mute">{s.tokens.toLocaleString()} tok</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <main className="flex-1 grid min-h-0 overflow-hidden" style={{ gridTemplateColumns: '1fr 420px' }}>
        <section className="overflow-y-auto p-3 space-y-3">
          {/* In-flight (last 30s of activity) */}
          <div>
            <div className="t-h mb-2">🔥 LIVE · บอทกำลังตอบ (30 วินาทีล่าสุด)</div>
            {inFlight.length === 0 ? (
              <div className="text-center text-2xs text-mute p-6 panel">— ไม่มี call ในช่วง 30 วินาทีล่าสุด —</div>
            ) : (
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {inFlight.map((r) => (
                  <InFlightCard key={r.log_id} r={r} />
                ))}
              </div>
            )}
          </div>

          {/* Comment → DM events (what bot literally sent to customers) */}
          {commentDms.length > 0 && (
            <div>
              <div className="t-h mb-2">💬 COMMENT → DM · ส่งหา FB user (last 24h, {commentDms.length})</div>
              <div className="space-y-1.5">
                {commentDms.slice(0, 8).map((d) => (
                  <CommentDmCard key={d.id} d={d} />
                ))}
                {commentDms.length > 8 && (
                  <div className="text-center text-2xs text-mute py-1">+ อีก {commentDms.length - 8} รายการ</div>
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="border-l border-line bg-panel2/30 flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-line flex items-center gap-2 shrink-0">
            <span className="dot dot-info" />
            <span className="t-h">AI CALL LOG · 24h</span>
            <Pill tone="info">{recent.length}</Pill>
            <div className="flex-1" />
            {live.error && (
              <span className="text-2xs text-crit mono truncate" title={live.error}>
                ‼ {describeError(live.error).slice(0, 36)}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {recent.length === 0 ? (
              <div className="text-center text-2xs text-mute p-6">ยังไม่มี call ใน 24 ชั่วโมงที่ผ่านมา</div>
            ) : (
              recent.map((a) => <CallRow key={a.log_id} a={a} />)
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
          background: linear-gradient(90deg, rgba(16, 185, 129, 0.45), rgba(16, 185, 129, 0.85));
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
        }
        .queue-fill-fail {
          background: linear-gradient(90deg, rgba(239, 68, 68, 0.45), rgba(239, 68, 68, 0.85));
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
        }
        .queue-bar::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 6px, transparent 6px, transparent 12px);
          animation: stripes 1.6s linear infinite;
          pointer-events: none;
        }
        @keyframes stripes { to { background-position: 24px 0; } }
        .queue-shimmer {
          position: absolute;
          top: -2px; bottom: -2px; width: 28px;
          transform: translateX(-50%);
          background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.7), transparent);
          filter: blur(2px);
          animation: shimmerPulse 1.4s ease-in-out infinite;
          transition: left 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);
          pointer-events: none;
        }
        @keyframes shimmerPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

function InFlightCard({ r }: { r: WorkerCallRow }) {
  const color = providerColor(r.provider);
  return (
    <div className="panel relative overflow-hidden" style={{ boxShadow: `inset 0 0 0 1px ${color}40, 0 0 16px ${color}22` }}>
      <div className="severity-stripe" style={{ background: color }} />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="font-semibold text-fg text-sm">{r.provider}</span>
        <Pill tone={r.success ? 'ok' : 'crit'}>{r.success ? '✓' : '✗'}</Pill>
        <div className="flex-1" />
        <span className="mono text-2xs text-mute">{r.age_seconds ?? 0}s ago</span>
      </div>
      <div className="px-3 py-2 text-xs">
        <div className="mono text-fg/90 truncate" title={r.model}>{r.model}</div>
        <div className="flex items-center gap-2 mt-1 text-2xs text-mute">
          <span className="text-info">{r.request_type}</span>
          <span>·</span>
          <span className="mono">{r.tokens.toLocaleString()} tok</span>
          <span>·</span>
          <span className="mono">{r.latency_ms}ms</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-2xs">
          <TypingDots color={color} />
          <span className="text-info/80">{r.success ? 'เพิ่งตอบเสร็จ' : 'ล้มเหลว — fallback ไป provider อื่น'}</span>
        </div>
      </div>
    </div>
  );
}

function CallRow({ a }: { a: WorkerCallRow }) {
  const fail = !a.success;
  const time = a.created_at ? a.created_at.slice(11, 19) : '';
  const color = providerColor(a.provider);
  // Best-effort link: admin web /admin/ai/usage filtered by this provider + model.
  // We don't have user_id on the usage log, so we can't link straight to a
  // specific customer — but the operator can search by model/key from here.
  const adminLogUrl = `https://main.thaiprompt.online/admin/ai/api-keys?search=${encodeURIComponent(a.key_name ?? '')}`;
  return (
    <a
      href={adminLogUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`block px-3 py-2 border-b border-line/60 text-2xs activity-row no-underline hover:bg-rowhi`}
      style={{ borderLeft: `2px solid ${fail ? 'rgba(239,68,68,0.5)' : color + '99'}` }}
      title="คลิกเปิด admin web → ai-keys"
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="mono text-mute">{time}</span>
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="mono font-semibold text-fg">{a.provider}</span>
        <Pill tone="mystic">{a.request_type}</Pill>
        <div className="flex-1" />
        {fail ? (
          <span className="mono text-crit">FAIL</span>
        ) : (
          <span className="mono text-mute">{a.latency_ms}ms</span>
        )}
        <span className="text-mute group-hover:text-info">↗</span>
      </div>
      <div className="text-mute mono truncate" title={a.model}>{a.model}</div>
      {!fail && (
        <div className="flex items-center gap-2 mt-0.5 text-mute">
          <span className="mono">{a.tokens.toLocaleString()} tokens</span>
          <span>·</span>
          <span>key {a.key_name}</span>
        </div>
      )}
      {fail && a.error_message && (
        <div className="text-crit mt-0.5 line-clamp-1" title={a.error_message}>{a.error_message}</div>
      )}
      <style jsx>{`
        .activity-row { animation: rowIn 0.32s ease-out; }
        @keyframes rowIn {
          from { opacity: 0; transform: translateY(-4px); background: rgba(34, 211, 238, 0.08); }
          to { opacity: 1; transform: translateY(0); background: transparent; }
        }
      `}</style>
    </a>
  );
}

function CommentDmCard({ d }: { d: CommentDmRow }) {
  const ts = d.engaged_at ? d.engaged_at.slice(11, 19) : '';
  // facebook_post_id format: "{pageId}_{postId}". Splitting gives us a clean URL.
  // facebook_comment_id format: "{postId}_{commentId}" → take part after underscore.
  const [pageId, postOnlyId] = (d.fb_post_id ?? '').split('_');
  const commentOnlyId = (d.fb_comment_id ?? '').split('_')[1] ?? null;
  const postUrl = pageId && postOnlyId ? `https://www.facebook.com/${pageId}/posts/${postOnlyId}` : null;
  const commentDeepUrl =
    pageId && postOnlyId && commentOnlyId
      ? `${postUrl}?comment_id=${commentOnlyId}`
      : postUrl;
  // FB Page Inbox (Business Suite) — admin can read the DM thread with this user.
  const inboxUrl = pageId
    ? `https://business.facebook.com/latest/inbox/?asset_id=${pageId}&thread_id=${d.fb_user_id}`
    : null;
  // Admin web reading lookup by FB user id — closest thing to "open this customer's history".
  const adminUserUrl = `https://main.thaiprompt.online/admin/fortune/readings?search=${encodeURIComponent(d.fb_user_id ?? '')}`;

  return (
    <div className="panel p-2.5 text-xs">
      <div className="flex items-center gap-2 mb-1.5">
        <ChannelChip channel="fb" />
        <span className="mono text-2xs text-mute">{ts}</span>
        <span className="text-fg/90 truncate flex-1">PSID {d.fb_user_id}</span>
        <span className="mono text-2xs text-mute">post {(d.fb_post_id ?? '').slice(-8)}</span>
      </div>
      {d.comment_text && (
        <div className="text-mute italic line-clamp-1 mb-1">› คอมเม้นต์: "{d.comment_text}"</div>
      )}
      {d.comment_reply && (
        <div className="text-ok/90 line-clamp-1 mb-1">↩ ตอบ comment: {d.comment_reply}</div>
      )}
      {d.dm_message && (
        <div className="text-info/90 line-clamp-2 mb-1.5">✉ ส่ง DM: {d.dm_message}</div>
      )}
      <div className="flex gap-1 mt-1.5">
        {commentDeepUrl && (
          <a
            href={commentDeepUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-info text-2xs flex-1 justify-center"
            title="เปิดคอมเม้นต์ในโพสต์ FB"
          >
            🔗 ดูโพสต์ FB
          </a>
        )}
        {inboxUrl && (
          <a
            href={inboxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-mystic text-2xs flex-1 justify-center"
            title="เปิด FB Page Inbox สนทนากับ user นี้"
          >
            📨 Inbox
          </a>
        )}
        <a
          href={adminUserUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn text-2xs flex-1 justify-center"
          title="เปิดประวัติ readings ของลูกค้านี้ใน admin web"
        >
          📜 ประวัติ
        </a>
      </div>
    </div>
  );
}

function TypingDots({ color = '#22d3ee' }: { color?: string }) {
  return (
    <span className="typing">
      <span /><span /><span />
      <style jsx>{`
        .typing { display: inline-flex; gap: 3px; align-items: center; }
        .typing span {
          width: 4px; height: 4px; border-radius: 50%;
          background: ${color}; box-shadow: 0 0 6px ${color}99;
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
