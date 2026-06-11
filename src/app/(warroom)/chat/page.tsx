'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CHAT_TEMPLATES, CHAT_THREADS, type ChatThread, type ChatStage } from '@/lib/mock/chat-page';
import { ChannelChip, Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { Switch } from '@/components/ui/Switch';
import { Kbd } from '@/components/ui/Kbd';
import { useWarroom } from '@/lib/stores/warroom';
import { useFortuneFeed, sendChatMessage, suggestChatReply, fetchReadingTranscript, fetchFortuneWorkersQueue, fetchBanStatus, banUser, unbanUser, markReadingPaid, fetchUserReadings, takeoverChat, resumeChatBot, fetchChatTakeoverStatus, useAdminData, describeError, type ReadingTranscriptMessage, type FortuneWorkersQueue, type WorkerCallRow, type BanStatusResponse } from '@/lib/api';
import { useSettings, isPaired as isPairedFn } from '@/lib/stores/settings';
import { readingToChatThread, STAGE_META } from '@/lib/adapters/chat';
import { cn } from '@/lib/utils';

// Static-export builds require useSearchParams() to be inside a Suspense
// boundary so the CSR-bailout has somewhere to fall through.
export default function ChatPage() {
  return (
    <Suspense fallback={<div className="grid h-full place-items-center text-mute text-sm">กำลังโหลดแชต...</div>}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const feed = useFortuneFeed();
  const threads = useMemo<ChatThread[]>(() => {
    // Paired = real, even when empty (operator must see the actual queue,
    // not stale mocks). Only fall through to mock when truly unpaired.
    if (feed.source === 'live') {
      return feed.data.map(readingToChatThread);
    }
    return CHAT_THREADS;
  }, [feed.data, feed.source]);

  const [filter, setFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [onlyAdmin, setOnlyAdmin] = useState(false);

  // 🔲 (2026-06-11) Multi-view — realtime grid of EVERY conversation with its
  //   funnel stage (เลือกไพ่ / กำลังทำนาย / รอตัดสินใจจ่าย / รอคำทำนาย). Hot
  //   stages auto-surface to the top; click a tile to drop into single-chat.
  const [viewMode, setViewMode] = useState<'single' | 'multi'>('single');
  const [stageFilter, setStageFilter] = useState<ChatStage | ''>('');

  // 🪪 (2026-05-24) Deep-link target from /workers → /chat?thread=r-{id}|fb-{psid}
  //   Read once on mount + whenever it changes. Falls through to the first
  //   thread when missing or unresolvable so the page still renders.
  const searchParams = useSearchParams();
  const deepThreadParam = searchParams?.get('thread') ?? '';

  // Resolve `r-{id}` directly. For `fb-{psid}` find a thread whose psid matches.
  const resolveDeepThread = (param: string, list: ChatThread[]): string | null => {
    if (!param) return null;
    if (param.startsWith('r-')) return list.find((t) => t.id === param)?.id ?? null;
    if (param.startsWith('fb-')) {
      const psid = param.slice(3);
      return list.find((t) => t.psid === psid)?.id ?? null;
    }
    return list.find((t) => t.id === param)?.id ?? null;
  };

  const [activeId, setActiveId] = useState<string>(() =>
    resolveDeepThread(deepThreadParam, threads) ?? threads[0]?.id ?? '',
  );
  const [bot, setBot] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(threads.map((c) => [c.id, c.bot])),
  );
  // The deep-link param we've already resolved (or given up on). null = not yet
  // resolved, so a fresh page load / external link keeps retrying until the live
  // feed delivers the target thread — instead of snapping to threads[0] forever
  // because the live list isn't in the very first (mock) render.
  const resolvedDeepParam = useRef<string | null>(null);
  useEffect(() => {
    setBot(Object.fromEntries(threads.map((c) => [c.id, c.bot])));

    // Honor the deep-link until we actually land on its thread. Retries across
    // feed updates (live threads arrive asynchronously after mount).
    if (deepThreadParam && resolvedDeepParam.current !== deepThreadParam) {
      const fromUrl = resolveDeepThread(deepThreadParam, threads);
      if (fromUrl) {
        setActiveId(fromUrl);
        resolvedDeepParam.current = deepThreadParam;
        return;
      }
      // Not in the list yet. If the live feed has finished loading the id is
      // genuinely absent → give up and let the fallback pick threads[0]. While
      // still loading, wait for the next threads update before deciding.
      if (feed.source === 'live') {
        resolvedDeepParam.current = deepThreadParam;
      } else {
        return;
      }
    }

    if (!threads.find((c) => c.id === activeId)) {
      setActiveId(threads[0]?.id ?? '');
    }
    // resolveDeepThread is referentially stable (pure local helper)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, activeId, deepThreadParam, feed.source]);

  // 🪪 (2026-05-24) Realtime worker activity for the currently-open thread.
  //   Polls /fortune/workers/queue every 3s (same cadence as the workers page)
  //   and filters in_flight + 24h log down to calls whose reading_id matches
  //   the active thread. Header pill shows the freshest one as "ตอบโดย {model}".
  const workersFeed = useAdminData<FortuneWorkersQueue | null>({
    key: 'fortune-workers-queue', // shared cache key — workers page + chat page coalesce
    fetcher: () => fetchFortuneWorkersQueue(),
    mock: null,
    intervalOverride: 3,
  });

  const [draft, setDraft] = useState('');
  const [aiSuggest, setAiSuggest] = useState('');
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const pushToast = useWarroom((s) => s.pushToast);
  const paired = useSettings((s) => isPairedFn(s));

  // Active chat thread → reading id (live threads have id like "r-{id}").
  const readingIdOf = (threadId: string): number | null => {
    const m = /^r-(\d+)$/.exec(threadId);
    return m ? Number(m[1]) : null;
  };

  // 🔄 (2026-05-24) Transcript polling — replaces the prior one-shot fetch
  //   that never updated. Polls every 3s while a real reading is active so:
  //     • customer replies show up in our chat without a manual refresh
  //     • admin messages we just sent appear in OUR pane (not just customer's)
  //   Key includes the reading id so each thread has its own cache slot;
  //   switching back doesn't lose history. intervalOverride=0 + pause when
  //   not paired / not a real reading so the timer doesn't burn API calls.
  const activeReadingId = readingIdOf(activeId);
  const transcriptFeed = useAdminData<{ messages: ReadingTranscriptMessage[] } | null>({
    key: activeReadingId ? `transcript-${activeReadingId}` : 'transcript-none',
    fetcher: async () => {
      if (!activeReadingId) return null;
      const r = await fetchReadingTranscript(activeReadingId);
      return { messages: r.messages ?? [] };
    },
    mock: null,
    intervalOverride: activeReadingId ? 3 : 0,
    pauseAutoRefresh: !activeReadingId,
  });
  const transcriptLoading = transcriptFeed.isLoading && !transcriptFeed.data ? activeReadingId : null;
  const transcriptMessages = transcriptFeed.data?.messages ?? null;

  const filtered = useMemo(
    () =>
      threads.filter((c) => {
        if (channelFilter && c.channel !== channelFilter) return false;
        if (onlyAdmin && bot[c.id]) return false;
        if (filter && !c.name.toLowerCase().includes(filter.toLowerCase())) return false;
        return true;
      }),
    [threads, filter, channelFilter, onlyAdmin, bot],
  );

  const active = threads.find((c) => c.id === activeId);

  // 🪪 (2026-05-24) Find the live AI worker handling THIS thread right now.
  //   Match by reading_id first (most precise), then by fb_user_id (when the
  //   reading hasn't been written yet — pre-backfill window).
  //   Prefer in_flight (last 30s), then the freshest entry from the 24h log
  //   so a recently-finished call still shows ("เพิ่งตอบโดย gemini").
  const activeWorker: WorkerCallRow | null = useMemo(() => {
    if (!active) return null;
    const q = workersFeed.data;
    if (!q) return null;
    const rid = readingIdOf(active.id);
    const psid = active.psid;
    const matches = (r: WorkerCallRow) => {
      // Defensive Number() cast — some Laravel serializers ship BIGINT as
      // string. We type as number|null but the wire format can drift.
      if (rid && r.reading_id != null && Number(r.reading_id) === rid) return true;
      if (psid && r.fb_user_id && String(r.fb_user_id) === psid) return true;
      return false;
    };
    const fromInFlight = q.in_flight.find(matches);
    if (fromInFlight) return fromInFlight;
    return q.recent_completed.find(matches) ?? null;
  }, [active, workersFeed.data]);

  // "In-flight" = call landed in the last 30s. Drives the typing-dots animation.
  const workerIsLive = !!activeWorker && (activeWorker.age_seconds ?? 999) <= 30;

  // 🔲 (2026-06-11) Multi-view staging — every thread gets an effective stage:
  //   a live in-flight AI call (workers queue, ≤60s old) overrides to
  //   'predicting'; otherwise the row-derived stage from the adapter. Sorted by
  //   stage heat then recency, so people picking cards / mid-prediction /
  //   deciding-to-pay bubble to the top automatically on every poll tick.
  const inFlightIndex = useMemo(() => {
    const byReading = new Map<number, WorkerCallRow>();
    const byPsid = new Map<string, WorkerCallRow>();
    for (const r of workersFeed.data?.in_flight ?? []) {
      if (r.reading_id != null) byReading.set(Number(r.reading_id), r);
      if (r.fb_user_id) byPsid.set(String(r.fb_user_id), r);
    }
    return { byReading, byPsid };
  }, [workersFeed.data]);

  const staged = useMemo(() => {
    return threads
      .map((t) => {
        const rid = readingIdOf(t.id);
        const w =
          (rid != null ? inFlightIndex.byReading.get(rid) : undefined) ??
          (t.psid ? inFlightIndex.byPsid.get(t.psid) : undefined);
        const live = !!w && (w.age_seconds ?? 999) <= 60;
        const stage: ChatStage = live ? 'predicting' : t.stage ?? 'idle';
        return { t, stage, worker: live ? w : undefined };
      })
      .sort(
        (a, b) =>
          STAGE_META[a.stage].prio - STAGE_META[b.stage].prio ||
          (b.t.lastTsMs ?? 0) - (a.t.lastTsMs ?? 0),
      );
  }, [threads, inFlightIndex]);

  const stageCounts = useMemo(() => {
    const c: Record<ChatStage, number> = { predicting: 0, celtic: 0, deciding: 0, waiting: 0, idle: 0 };
    for (const s of staged) c[s.stage]++;
    return c;
  }, [staged]);

  // Auto-surface flash — a thread that just ENTERED a hot stage (started
  // picking cards, AI started predicting, bill issued) pulses for a few
  // seconds so the operator's eye lands on it without hunting.
  const prevStagesRef = useRef<Record<string, ChatStage>>({});
  const [flashIds, setFlashIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const prev = prevStagesRef.current;
    const next: Record<string, ChatStage> = {};
    const newlyHot: string[] = [];
    for (const { t, stage } of staged) {
      next[t.id] = stage;
      if (stage !== prev[t.id] && stage !== 'idle') newlyHot.push(t.id);
    }
    prevStagesRef.current = next;
    if (newlyHot.length === 0) return;
    setFlashIds((s) => new Set([...s, ...newlyHot]));
    const timer = setTimeout(() => {
      setFlashIds((s) => {
        const n = new Set(s);
        for (const id of newlyHot) n.delete(id);
        return n;
      });
    }, 6000);
    return () => clearTimeout(timer);
  }, [staged]);

  // 📜 Real recent-reading history for the active customer's sidebar — replaces
  //    the old hardcoded list + the fabricated "ดูดวงทั้งหมด" count. Fetched by
  //    user id; FB-only threads (no account) show an honest empty state.
  const activeUserId = active?.userId ?? null;
  const [recentReadings, setRecentReadings] = useState<Array<{ id: number; title: string; when: string; tone: 'mystic' | 'info' }>>([]);
  const [recentTotal, setRecentTotal] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!paired || !activeUserId) {
      setRecentReadings([]);
      setRecentTotal(null);
      return;
    }
    fetchUserReadings(activeUserId, { per_page: 6 })
      .then((res) => {
        if (cancelled) return;
        setRecentTotal(res.total ?? res.data?.length ?? 0);
        setRecentReadings(
          (res.data ?? []).map((r) => {
            const isCeltic = (r.response_type ?? '').toLowerCase().includes('celtic');
            const firstQ = Array.isArray(r.questions) && r.questions.length ? String(r.questions[0]) : 'คำถามทั่วไป';
            return {
              id: r.id,
              title:
                (isCeltic ? 'Celtic' : r.is_paid ? 'พรีเมียม' : 'ทั่วไป') +
                ' — "' + (firstQ.length > 26 ? firstQ.slice(0, 24) + '…' : firstQ) + '"',
              when: r.created_at ? new Date(r.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }) : '—',
              tone: isCeltic ? ('mystic' as const) : ('info' as const),
            };
          }),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setRecentReadings([]);
          setRecentTotal(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [paired, activeUserId]);

  // 🎮 (2026-06-04) Bot ⇄ admin takeover for the active thread, backed by the
  //   real FortuneTakeoverService via /chat/takeover|resume|takeover-status.
  //   Seeds the toggle from the server (overrides the response_type heuristic).
  const [takeoverBusy, setTakeoverBusy] = useState(false);
  useEffect(() => {
    if (!paired || !active) return;
    const rid = readingIdOf(active.id);
    if (rid == null) return;
    let cancelled = false;
    fetchChatTakeoverStatus(rid)
      .then((res) => {
        if (!cancelled) setBot((s) => ({ ...s, [active.id]: !res.is_takeover }));
      })
      .catch(() => {
        /* keep heuristic default on error */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paired, active?.id]);

  // v === true → hand back to the bot (resume); v === false → admin takes over.
  // Optimistic with rollback so a failed round-trip never leaves a ghost state.
  const setBotForThread = async (threadId: string, v: boolean) => {
    const prev = bot[threadId];
    setBot((s) => ({ ...s, [threadId]: v }));
    const rid = readingIdOf(threadId);
    if (!paired || rid == null) return; // mock / no real reading — local only
    if (takeoverBusy) return;
    setTakeoverBusy(true);
    try {
      if (v) {
        await resumeChatBot(rid);
        pushToast({ kind: 'ok', title: 'คืนงานให้บอทแล้ว', body: active?.name });
      } else {
        const res = await takeoverChat(rid);
        pushToast({ kind: 'info', title: 'รับช่วงต่อจากบอท', body: `${active?.name ?? ''} · บอทหยุด ${res.remaining_minutes} นาที` });
      }
    } catch (e) {
      setBot((s) => ({ ...s, [threadId]: prev })); // rollback
      pushToast({ kind: 'crit', title: 'สลับบอท/แอดมินไม่สำเร็จ', body: describeError(e) });
    } finally {
      setTakeoverBusy(false);
    }
  };

  // 🚫 (2026-05-24) Ban-status for the active thread. Cached per psid so
  //   switching back doesn't re-fetch. Refreshed on thread switch + after
  //   every ban/unban mutation. Shows badge in header + drives the modal
  //   primary action (ban vs unban).
  const [banStatus, setBanStatus] = useState<Record<string, BanStatusResponse | null>>({});
  const [banLoading, setBanLoading] = useState(false);
  const [banModalOpen, setBanModalOpen] = useState(false);

  // Callers are already responsible for checking `paired` — keeping the
  // gate here would silently no-op a manual unban if paired hasn't been
  // recomputed yet (race with settings hydration).
  const refreshBanStatus = async (thread: ChatThread | undefined) => {
    if (!thread?.psid) return;
    const platform: 'facebook' | 'line' = thread.channel === 'LINE' ? 'line' : 'facebook';
    try {
      const res = await fetchBanStatus(platform, thread.psid);
      setBanStatus((m) => ({ ...m, [thread.psid]: res }));
    } catch {
      // 401/network — silently keep the previous value
    }
  };

  useEffect(() => {
    if (!paired) return;
    if (!active?.psid) return;
    if (banStatus[active.psid] !== undefined) return; // already fetched
    void refreshBanStatus(active);
    // refreshBanStatus is stable enough (pure inputs + state setter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.psid, paired]);

  const currentBan = active?.psid ? banStatus[active.psid] ?? null : null;

  // 💸 (2026-05-24) Quick-approve modal — operator marks an unpaid reading
  //   as paid (39฿ Deep / 99฿ Celtic) which kicks off the fortune-telling
  //   flow on the backend (ProcessDeepFortuneReadingJob or Celtic handler).
  //   Replaces the prior "open admin web wallet" detour. Only visible when
  //   the thread is a real reading and not yet paid.
  const [approveOpen, setApproveOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  const performApprove = async (amount: 39 | 99) => {
    if (!active || approving) return;
    const rid = readingIdOf(active.id);
    if (!rid) return;
    setApproving(true);
    try {
      await markReadingPaid(rid, { amount, note: `warroom_chat_approve_${amount}` });
      pushToast({
        kind: 'ok',
        title: `✓ อนุมัติ ฿${amount} → ${active.name}`,
        body: amount === 39 ? 'ส่งคำทำนาย Deep ให้แล้ว' : 'เริ่ม Celtic Cross flow แล้ว',
      });
      setApproveOpen(false);
      // Pull fresh data so the header switches to "ชำระแล้ว" + transcript
      // shows the "✓ รับชำระ" system line + (eventually) the AI reply.
      void transcriptFeed.refetch?.();
      feed.refetch?.();
    } catch (e) {
      pushToast({ kind: 'crit', title: 'อนุมัติชำระไม่สำเร็จ', body: describeError(e) });
    } finally {
      setApproving(false);
    }
  };

  const performBan = async (minutes: number | null, reason: string) => {
    if (!active || banLoading) return;
    const platform: 'facebook' | 'line' = active.channel === 'LINE' ? 'line' : 'facebook';
    setBanLoading(true);
    try {
      await banUser({
        platform,
        platform_user_id: active.psid,
        display_name: active.name,
        reason: reason || 'banned_from_warroom_chat',
        minutes: minutes ?? undefined, // omit → permanent
      });
      pushToast({
        kind: 'ok',
        title: `🚫 แบน ${active.name} แล้ว`,
        body: minutes ? `ระยะเวลา ${formatBanDuration(minutes)}` : 'ถาวร',
      });
      setBanModalOpen(false);
      await refreshBanStatus(active);
    } catch (e) {
      pushToast({ kind: 'crit', title: 'แบนไม่สำเร็จ', body: describeError(e) });
    } finally {
      setBanLoading(false);
    }
  };

  const performUnban = async () => {
    if (!active || banLoading) return;
    const ban = currentBan?.ban;
    // Only the /unban response sends id:null. A LIVE ban-status lookup
    // always carries a real id — narrow the type here for the unbanUser call.
    if (!ban || ban.id == null) return;
    const banId = ban.id;
    const psid = active.psid;
    // Snapshot for rollback if the server rejects.
    const prevStatus = banStatus[psid];
    setBanLoading(true);
    // Optimistic: clear the badge + show the 🚫 button immediately so the
    // operator doesn't see a ghost state during the round-trip.
    setBanStatus((m) => ({ ...m, [psid]: { is_banned: false, ban: null, remaining_seconds: null } }));
    try {
      await unbanUser(banId);
      pushToast({ kind: 'ok', title: `✨ ปลดแบน ${active.name} แล้ว` });
      // Re-confirm against server in case anything else changed (counter etc.)
      await refreshBanStatus(active);
    } catch (e) {
      // Roll back the optimistic clear so the operator sees the real state.
      setBanStatus((m) => ({ ...m, [psid]: prevStatus ?? null }));
      pushToast({ kind: 'crit', title: 'ปลดแบนไม่สำเร็จ', body: describeError(e) });
    } finally {
      setBanLoading(false);
    }
  };

  const sendDraft = async () => {
    const v = draft.trim();
    if (!v || sending) return;
    if (!active) return;

    const rid = readingIdOf(active.id);
    if (!paired || !rid) {
      pushToast({ kind: 'ok', title: 'ส่งข้อความแล้ว (mock)', body: v.slice(0, 60) });
      setDraft('');
      return;
    }

    setSending(true);
    try {
      const res = await sendChatMessage({ reading_id: rid, text: v });
      if (res.delivered) {
        pushToast({ kind: 'ok', title: '✓ ส่งแล้ว → ' + active.name, body: v.slice(0, 60) });
        setDraft('');
        // 🔄 (2026-05-24) Pull the fresh transcript NOW so our message lands
        //   in our own pane without waiting for the next 3s poll tick.
        //   Previously only feed.refetch() ran → admin saw nothing in their
        //   own chat until they switched threads. feed.refetch also stays
        //   so the side-list "last message" preview updates.
        void transcriptFeed.refetch?.();
        feed.refetch?.();
      } else {
        pushToast({ kind: 'warn', title: 'ส่งไม่ผ่าน platform', body: 'FB/LINE ปฏิเสธ — ลองอีกครั้ง' });
      }
    } catch (e) {
      pushToast({ kind: 'crit', title: 'ส่งข้อความล้มเหลว', body: describeError(e) });
    } finally {
      setSending(false);
    }
  };

  const requestAiSuggestion = async () => {
    if (!active || suggesting) return;
    const rid = readingIdOf(active.id);
    const recentText = active.messages?.slice(-3).map((m) => `[${m.by}] ${m.text}`).join('\n') ?? '';

    if (!paired || !rid) {
      // Local mock suggestion (no API call).
      setAiSuggest(
        'คุณ' + active.name + ' คะ ทางทีมงานเช็คยอดเงินอยู่แล้ว ขออภัยในความล่าช้านะคะ',
      );
      return;
    }

    setSuggesting(true);
    setAiSuggest('');
    try {
      const res = await suggestChatReply({
        reading_id: rid,
        context_text: recentText || 'ลูกค้าทักมาขอตรวจสอบสถานะการชำระเงิน',
        customer_name: active.name,
      });
      setAiSuggest(res.suggestion);
    } catch (e) {
      pushToast({ kind: 'crit', title: 'AI แนะนำล้มเหลว', body: describeError(e) });
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div
      className="grid h-full min-h-0"
      style={{ gridTemplateColumns: viewMode === 'multi' ? '280px 1fr' : '280px 1fr 320px' }}
    >
      <aside className="border-r border-line flex flex-col bg-panel2/30 min-h-0">
        <div className="p-2 border-b border-line space-y-1.5">
          <div className="flex items-center gap-2 px-1 mb-1">
            <span className="t-h">แชต · LIVE</span>
            <DataSourceBadge source={feed.source} isLoading={feed.isLoading} error={feed.error} />
            <button
              onClick={() => setViewMode((v) => (v === 'multi' ? 'single' : 'multi'))}
              className={cn('pill ml-auto', viewMode === 'multi' ? 'pill-mystic' : 'pill-dim')}
              title="มัลติวิว — เห็นทุกแชตพร้อมขั้นตอน (เลือกไพ่ / ทำนาย / รอจ่าย) แบบเรียลไทม์"
            >
              🔲 มัลติ
            </button>
          </div>
          <input
            type="text"
            placeholder="ค้นหาแชต..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-2 py-1.5 text-xs"
          />
          <div className="flex gap-1 text-2xs">
            <button onClick={() => setChannelFilter('')} className={cn('pill', channelFilter === '' ? 'pill-info' : 'pill-dim')}>
              ทั้งหมด
            </button>
            <button onClick={() => setChannelFilter('FB')} className={cn('pill', channelFilter === 'FB' ? 'pill-info' : 'pill-dim')}>
              fb · FB
            </button>
            <button onClick={() => setChannelFilter('LINE')} className={cn('pill', channelFilter === 'LINE' ? 'pill-ok' : 'pill-dim')}>
              L · LINE
            </button>
            <button onClick={() => setOnlyAdmin((v) => !v)} className={cn('pill', onlyAdmin ? 'pill-mystic' : 'pill-dim')}>
              มีแอดมิน
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {filtered.map((c) => {
            const isActive = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveId(c.id);
                  setViewMode('single'); // เลือกมาแชท — drop out of the grid
                }}
                className={cn(
                  'w-full text-left px-3 py-2.5 border-b border-lined hover:bg-rowhi',
                  isActive && 'bg-info/8 border-l-2 border-l-info',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ChannelChip channel={c.channel === 'LINE' ? 'line' : 'fb'} />
                  <span className="text-sm text-fg font-medium truncate flex-1">{c.name}</span>
                  <span className="text-2xs mono text-mute">{c.lastTs}</span>
                </div>
                <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                  {c.vip && <Pill tone="warn">VIP</Pill>}
                  {bot[c.id] ? <Pill tone="ok">🤖</Pill> : c.takenBy && (
                    <Pill tone="info">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.takenBy.color }} />
                      {c.takenBy.initial}
                    </Pill>
                  )}
                  {c.sentiment === 'angry' && <Pill tone="rose">😡</Pill>}
                  {c.sentiment === 'happy' && <Pill tone="ok">😊</Pill>}
                  {c.unread > 0 && <Pill tone="crit">{c.unread}</Pill>}
                </div>
                <div className="text-2xs text-dim truncate">{c.last}</div>
                {c.pinReason && (
                  <div className="text-2xs text-warn mt-0.5">{c.pinReason}</div>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* 🔲 (2026-06-11) Multi-view — realtime grid of every conversation. */}
      {viewMode === 'multi' && (
        <section className="flex flex-col bg-base min-h-0">
          <header className="px-4 py-2 border-b border-line bg-panel2/40 flex items-center gap-1.5 flex-wrap">
            <span className="t-h shrink-0">มัลติวิว · ทุกแชตเรียลไทม์</span>
            <button
              onClick={() => setStageFilter('')}
              className={cn('pill', stageFilter === '' ? 'pill-info' : 'pill-dim')}
            >
              ทั้งหมด {staged.length}
            </button>
            {(Object.keys(STAGE_META) as ChatStage[]).map((s) => (
              <button
                key={s}
                onClick={() => setStageFilter((cur) => (cur === s ? '' : s))}
                className={cn('pill', stageFilter === s ? 'pill-mystic' : 'pill-dim')}
                style={stageCounts[s] > 0 && s !== 'idle' ? { borderColor: STAGE_META[s].color + '88', color: STAGE_META[s].color } : undefined}
              >
                {STAGE_META[s].icon} {STAGE_META[s].label} {stageCounts[s]}
              </button>
            ))}
            <span className="text-2xs text-mute ml-auto shrink-0">
              ขั้นตอนร้อนเด้งขึ้นบนสุดอัตโนมัติ · กดการ์ดเพื่อเข้าแชท
            </span>
          </header>
          <div className="flex-1 overflow-y-auto p-3 min-h-0 scanline">
            {(() => {
              const shown = staged.filter((s) => !stageFilter || s.stage === stageFilter);
              if (shown.length === 0) {
                return (
                  <div className="grid place-items-center h-full text-mute text-sm">
                    {stageFilter
                      ? `ไม่มีแชตในขั้น "${STAGE_META[stageFilter].label}" ตอนนี้`
                      : 'ยังไม่มีแชต'}
                  </div>
                );
              }
              return (
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                  {shown.map(({ t, stage, worker }) => (
                    <MultiTile
                      key={t.id}
                      thread={t}
                      stage={stage}
                      workerProvider={worker?.provider ?? null}
                      flash={flashIds.has(t.id)}
                      canApprove={paired && t.isPaid === false && readingIdOf(t.id) != null}
                      onOpen={() => {
                        setActiveId(t.id);
                        setViewMode('single');
                      }}
                      onApprove={() => {
                        setActiveId(t.id);
                        setApproveOpen(true);
                      }}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {viewMode === 'single' && (
      <section className="flex flex-col bg-base min-h-0">
        {active && (
          <>
            <header className="px-4 py-2 border-b border-line bg-panel2/40 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-mystic/20 border border-mystic/50 grid place-items-center text-lg">🔮</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-fg">{active.name}</span>
                  <ChannelChip channel={active.channel === 'LINE' ? 'line' : 'fb'} />
                  {active.vip && <Pill tone="warn">VIP</Pill>}
                  <Pill tone="mystic">{active.rarity}</Pill>
                  {activeWorker && <ActiveWorkerBadge w={activeWorker} live={workerIsLive} />}
                  {currentBan?.is_banned && currentBan.ban && (
                    <BanStatusBadge ban={currentBan.ban} remainingSec={currentBan.remaining_seconds} onUnban={() => void performUnban()} loading={banLoading} />
                  )}
                </div>
                <div className="text-2xs text-mute mono mt-0.5">
                  PSID {active.psid} · เปิดสนทนา {active.openedAt}
                  {active.takenByName && (
                    <>
                      {' · เทคโอเวอร์โดย '}
                      <span className="text-info">{active.takenByName}</span> ({active.takenAt})
                    </>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-2xs text-dim">
                บอท
                <Switch
                  checked={bot[active.id]}
                  disabled={takeoverBusy}
                  onChange={(v) => void setBotForThread(active.id, v)}
                />
              </label>
              {!bot[active.id] && (
                <button
                  onClick={() => void setBotForThread(active.id, true)}
                  disabled={takeoverBusy}
                  className="btn btn-ok disabled:opacity-40"
                >
                  ↪ คืนงานให้บอท
                </button>
              )}
              {/* 💸 (2026-05-24) Quick-approve — mark paid + trigger fortune flow.
                  Only shown when this is a real reading and not yet paid. */}
              {paired && active.isPaid === false && readingIdOf(active.id) && (
                <button
                  onClick={() => setApproveOpen(true)}
                  className="btn btn-ok"
                  title="อนุมัติชำระเงิน → ส่งคำทำนายให้ลูกค้าทันที"
                  disabled={approving}
                >
                  {approving ? '⏳ กำลังอนุมัติ...' : '✓ อนุมัติชำระ'}
                </button>
              )}
              {/* 🚫 (2026-05-24) Quick-ban — same pattern as admin /takeover */}
              {!currentBan?.is_banned && (
                <button
                  onClick={() => setBanModalOpen(true)}
                  className="btn btn-ghost text-rose-400 hover:bg-rose-500/10 border-rose-500/30"
                  title="แบนลูกค้านี้ — บอทจะไม่ตอบอีก"
                  disabled={!paired}
                >
                  🚫 แบน
                </button>
              )}
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0 scanline">
              {(() => {
                // If we have a fetched server transcript, render that (real Q+A
                // + admin replies from fortune_admin_qa + customer image bubbles).
                // Otherwise fall back to the messages we synthesized from the
                // reading row (mock or first-paint before the poll resolves).
                const live = transcriptMessages;
                const isLoading = transcriptLoading != null && !live;
                const rendered = live
                  ? live.map((m) => ({
                      id: m.id,
                      role: m.role,
                      text: m.text,
                      ts: m.ts ? m.ts.slice(11, 16) : '',
                      by: m.by ?? undefined,
                      ai: m.ai ?? undefined,
                      image_url: m.image_url ?? undefined,
                    }))
                  : active.messages;
                if (isLoading && rendered.length === 0) {
                  return (
                    <div className="text-center text-2xs text-mute p-6">กำลังโหลดประวัติสนทนา...</div>
                  );
                }
                return rendered.map((m) => {
                  if (m.role === 'system') {
                    return (
                      <div key={m.id} className="text-center">
                        <span className="pill pill-dim border-dashed">{m.text}</span>
                      </div>
                    );
                  }
                  if (m.role === 'user') {
                    return (
                      <div key={m.id} className="flex gap-2 max-w-[80%]">
                        <div className="bg-rowhi border border-line rounded-lg rounded-tl-sm px-3 py-2 text-sm">
                          {/* 📸 (2026-05-24) Customer-sent image (slip/photo) */}
                          {m.image_url && (
                            <a
                              href={m.image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block mb-1.5 -mx-1 -mt-1"
                              title="คลิกเปิดภาพเต็มในแท็บใหม่"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.image_url}
                                alt="ลูกค้าส่งภาพ"
                                className="max-w-[240px] max-h-[360px] rounded border border-line object-cover hover:border-info/60 transition-colors"
                                loading="lazy"
                              />
                            </a>
                          )}
                          <div className="whitespace-pre-wrap break-words">{m.text}</div>
                          <div className="text-2xs text-mute mono mt-1">{m.ts}</div>
                        </div>
                      </div>
                    );
                  }
                  if (m.role === 'bot') {
                    return (
                      <div key={m.id} className="flex gap-2 max-w-[80%] ml-auto flex-row-reverse">
                        <div className="bg-info/8 border border-info/20 rounded-lg rounded-tr-sm px-3 py-2 text-sm text-cyan-200">
                          <div className="text-2xs text-info/80 mb-0.5 font-semibold flex items-center gap-1">
                            <span>🤖 บอท</span>
                            {m.ai && <span className="text-mute font-normal">· {m.ai}</span>}
                          </div>
                          <div className="whitespace-pre-wrap break-words">{m.text}</div>
                          <div className="text-2xs text-info/50 mono mt-1 text-right">{m.ts}</div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className="flex gap-2 max-w-[80%] ml-auto flex-row-reverse">
                      <div className="bg-mystic/12 border border-mystic/30 rounded-lg rounded-tr-sm px-3 py-2 text-sm text-violet-200">
                        <div className="text-2xs text-mystic/90 mb-0.5 font-semibold">👤 {m.by ?? 'admin'}</div>
                        <div className="whitespace-pre-wrap break-words">{m.text}</div>
                        <div className="text-2xs text-mystic/60 mono mt-1 text-right">{m.ts}</div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {aiSuggest && (
              <div className="mx-4 mb-2 border border-mystic/30 rounded bg-mystic/8 p-3">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded grid place-items-center bg-mystic/20 text-mystic text-2xs font-bold">
                    AI
                  </span>
                  <div className="flex-1">
                    <div className="text-2xs text-mystic font-semibold mb-1">AI แนะนำคำตอบ</div>
                    <div className="text-sm text-fg/90">{aiSuggest}</div>
                  </div>
                  <button
                    onClick={() => {
                      setDraft(aiSuggest);
                      setAiSuggest('');
                    }}
                    className="btn btn-mystic"
                  >
                    ใช้
                  </button>
                  <button onClick={() => setAiSuggest('')} className="btn btn-ghost">
                    ✕
                  </button>
                </div>
              </div>
            )}

            <div className="px-4 py-2 border-t border-line bg-panel2/40 flex items-center gap-1.5 overflow-x-auto">
              <span className="t-h shrink-0">เทมเพลต</span>
              {CHAT_TEMPLATES.map((t) => (
                <button key={t} onClick={() => setDraft(t)} className="btn shrink-0 text-2xs">
                  {t}
                </button>
              ))}
            </div>

            <div className="border-t border-line p-3 bg-panel2/60">
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <button
                    className="btn btn-ghost h-7 w-7 justify-center"
                    title="แนบรูป (เปิดในแอดมินเว็บ)"
                    onClick={() => {
                      const rid = readingIdOf(active.id);
                      if (rid) window.open('https://main.thaiprompt.online/admin/fortune/readings/' + rid, '_blank', 'noopener');
                      else pushToast({ kind: 'info', title: '📎 แนบรูป', body: 'รองรับเฉพาะใน admin web' });
                    }}
                  >
                    📎
                  </button>
                  <button
                    className="btn btn-ghost h-7 w-7 justify-center"
                    title="แทรก PromptPay QR text"
                    onClick={() => {
                      const amount = window.prompt('ยอดที่จะส่ง QR (THB)', String(active.due || 99));
                      const n = amount ? Number(amount) : NaN;
                      if (!Number.isFinite(n) || n <= 0) return;
                      setDraft((d) => d + (d ? '\n' : '') + 'โอน ฿' + n.toLocaleString() + ' มาที่ PromptPay 0805782958 (ขอบคุณค่ะ ✨)');
                    }}
                  >
                    ▦
                  </button>
                  <button
                    className="btn btn-ghost h-7 w-7 justify-center"
                    title="ข้อความเสียง — ใช้ admin web"
                    onClick={() => {
                      const rid = readingIdOf(active.id);
                      if (rid) window.open('https://main.thaiprompt.online/admin/fortune/readings/' + rid + '?compose=voice', '_blank', 'noopener');
                      else pushToast({ kind: 'info', title: '🎤 ข้อความเสียง', body: 'ใช้ผ่าน admin web' });
                    }}
                  >
                    🎤
                  </button>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="พิมพ์ข้อความ... (Cmd+Enter ส่ง)"
                  className="flex-1 p-2 text-sm resize-none"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      sendDraft();
                    }
                  }}
                />
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => void sendDraft()}
                    disabled={!draft.trim() || sending}
                    className="btn btn-primary px-3 disabled:opacity-40"
                  >
                    {sending ? 'กำลังส่ง...' : <>ส่ง <Kbd>⌘↵</Kbd></>}
                  </button>
                  <button
                    onClick={() => void requestAiSuggestion()}
                    disabled={suggesting}
                    className="btn btn-mystic px-3 disabled:opacity-40"
                  >
                    {suggesting ? '⏳ คิด...' : 'AI แนะนำ'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
      )}

      {viewMode === 'single' && active && (
        <aside className="border-l border-line flex flex-col bg-panel2/30 min-h-0 overflow-y-auto">
          <div className="p-4 border-b border-line">
            <div
              className="relative rounded-lg overflow-hidden border border-mystic/30"
              style={{
                background:
                  'radial-gradient(circle at top right, rgba(139,92,246,.18), transparent 50%), linear-gradient(135deg, #1a1330, #0d1320)',
              }}
            >
              <div className="p-3">
                <div className="flex items-start gap-2">
                  <div className="w-12 h-12 rounded-full bg-mystic/20 border border-mystic/50 grid place-items-center text-xl">🔮</div>
                  <div className="flex-1">
                    <div className="font-semibold text-fg text-sm">{active.name}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Pill tone="mystic">{active.rarity}</Pill>
                      {active.vip && <Pill tone="warn">VIP</Pill>}
                    </div>
                    <div className="text-2xs mono text-dim mt-1">
                      LV <span className="text-mystic font-bold">{active.level}</span> · EXP {active.exp}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 border-b border-line">
            <div className="t-h mb-2">เครดิต & การเงิน</div>
            <div className="grid grid-cols-2 gap-2 text-2xs">
              <div className="bg-panel border border-line rounded p-2">
                <div className="text-mute">เครดิตคงเหลือ</div>
                <div className="mono text-info text-base font-semibold">{active.credits}</div>
              </div>
              <div className="bg-panel border border-line rounded p-2">
                <div className="text-mute">LTV รวม</div>
                <div className="mono text-ok text-base font-semibold">฿{active.ltv.toLocaleString()}</div>
              </div>
              <div className="bg-panel border border-line rounded p-2">
                <div className="text-mute">ดูดวงทั้งหมด</div>
                <div className="mono text-fg text-base font-semibold">{recentTotal != null ? recentTotal : '—'}</div>
              </div>
              <div className="bg-panel border border-line rounded p-2">
                <div className="text-mute">ค้างจ่าย</div>
                <div className="mono text-warn text-base font-semibold">฿{active.due}</div>
              </div>
            </div>
            <div className="flex gap-1 mt-2">
              <button
                className="btn btn-ok flex-1 justify-center"
                onClick={() => {
                  // Credit adjustment lives in the admin wallet page; open with user filter.
                  // active.userId may be null for FB-only threads — fall back to psid filter.
                  const target = (active as { userId?: number; psid?: string }).userId ?? active.psid;
                  window.open('https://main.thaiprompt.online/admin/wallets?user=' + target, '_blank', 'noopener');
                }}
              >
                + เครดิต
              </button>
              <button
                className="btn flex-1 justify-center"
                onClick={() => {
                  // "Reset" = clear the local draft + clear the AI suggestion.
                  setDraft('');
                  setAiSuggest('');
                  pushToast({ kind: 'info', title: '↻ รีเซ็ต', body: 'ล้าง draft + AI แนะนำแล้ว' });
                }}
              >
                รีเซ็ต
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="t-h mb-2">ดูดวงล่าสุด</div>
            <div className="space-y-1.5">
              {recentReadings.length > 0 ? (
                recentReadings.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    <span className={`dot dot-${r.tone}`} />
                    <span className="flex-1 text-fg truncate">{r.title}</span>
                    <span className="text-2xs text-mute mono">{r.when}</span>
                  </div>
                ))
              ) : (
                <div className="text-2xs text-mute">
                  {activeUserId ? '(ไม่มีประวัติ)' : '(ลูกค้า FB ยังไม่มีบัญชี — ดูประวัติไม่ได้)'}
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* 🚫 (2026-05-24) Quick-ban modal — preset durations matching the
          admin /takeover page so the warroom operator gets identical UX. */}
      {active && banModalOpen && (
        <BanModal
          customerName={active.name}
          psid={active.psid}
          platform={active.channel === 'LINE' ? 'line' : 'facebook'}
          loading={banLoading}
          onClose={() => setBanModalOpen(false)}
          onConfirm={(minutes, reason) => performBan(minutes, reason)}
        />
      )}

      {/* 💸 (2026-05-24) Quick-approve modal — Deep 39฿ / Celtic 99฿.
          mark-paid → backend triggers ProcessDeepFortuneReadingJob (or Celtic
          handler), so the customer receives their reading right after this. */}
      {active && approveOpen && (
        <ApproveModal
          customerName={active.name}
          due={active.due}
          loading={approving}
          onClose={() => setApproveOpen(false)}
          onConfirm={(amount) => performApprove(amount)}
        />
      )}
    </div>
  );
}

// 🚫 (2026-05-24) Header pill showing current ban state + inline ปลดแบน.
function BanStatusBadge({
  ban,
  remainingSec,
  onUnban,
  loading,
}: {
  ban: NonNullable<BanStatusResponse['ban']>;
  remainingSec: number | null;
  onUnban: () => void;
  loading: boolean;
}) {
  const label = ban.is_permanent
    ? 'ติดแบนถาวร'
    : remainingSec != null
    ? `ติดแบน · เหลือ ${formatRemaining(remainingSec)}`
    : 'ติดแบน';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs"
      style={{
        background: 'rgba(244,63,94,0.12)',
        border: '1px solid rgba(244,63,94,0.5)',
        boxShadow: '0 0 8px rgba(244,63,94,0.25)',
      }}
      title={`เหตุผล: ${ban.reason ?? '—'} · attempts: ${ban.attempt_count}`}
    >
      <span className="text-rose-400 font-semibold">🚫 {label}</span>
      {ban.attempt_count > 0 && (
        <span className="text-rose-300/80 mono">· {ban.attempt_count} ครั้ง</span>
      )}
      <button
        onClick={onUnban}
        disabled={loading}
        className="ml-1 text-rose-200 hover:text-white underline-offset-2 hover:underline disabled:opacity-50"
        title="ปลดแบน — บอทจะตอบลูกค้าคนนี้อีกครั้ง"
      >
        {loading ? '...' : '✨ ปลดแบน'}
      </button>
    </span>
  );
}

// 🚫 (2026-05-24) Ban confirmation modal. Duration presets mirror the admin
// /takeover page (10m / 1h / 24h / 7d / permanent). reason is optional.
function BanModal({
  customerName,
  psid,
  platform,
  loading,
  onClose,
  onConfirm,
}: {
  customerName: string;
  psid: string;
  platform: 'facebook' | 'line';
  loading: boolean;
  onClose: () => void;
  onConfirm: (minutes: number | null, reason: string) => void;
}) {
  const presets: Array<{ key: string; label: string; minutes: number | null }> = [
    { key: '10m', label: '10 นาที', minutes: 10 },
    { key: '1h', label: '1 ชั่วโมง', minutes: 60 },
    { key: '24h', label: '1 วัน', minutes: 1440 },
    { key: '7d', label: '7 วัน', minutes: 10080 },
    { key: 'permanent', label: 'ถาวร', minutes: null },
  ];
  const [selected, setSelected] = useState<string>('24h');
  const [reason, setReason] = useState('');
  const chosen = presets.find((p) => p.key === selected) ?? presets[0];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel w-[440px] max-w-[92vw] p-4 border border-rose-500/40"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 0 32px rgba(244,63,94,0.18)' }}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="text-2xl">🚫</div>
          <div className="flex-1">
            <div className="text-base font-semibold text-fg">แบน {customerName}</div>
            <div className="text-2xs text-mute mono mt-0.5">
              {platform.toUpperCase()} · PSID {psid}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost text-mute" title="ปิด">
            ✕
          </button>
        </div>

        <div className="text-2xs text-mute mb-1.5">ระยะเวลา</div>
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {presets.map((p) => {
            const isSel = p.key === selected;
            const isPerm = p.minutes === null;
            return (
              <button
                key={p.key}
                onClick={() => setSelected(p.key)}
                className={cn(
                  'px-2 py-1.5 text-2xs rounded border transition-colors',
                  isSel
                    ? isPerm
                      ? 'bg-rose-500/20 border-rose-500 text-rose-200 font-semibold'
                      : 'bg-info/15 border-info/70 text-info font-semibold'
                    : 'border-line text-dim hover:border-line/80',
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="text-2xs text-mute mb-1.5">เหตุผล (ไม่บังคับ)</div>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เช่น สแปม / ใช้คำหยาบ / ขู่รีวิว 1 ดาว"
          className="w-full px-2 py-1.5 text-xs mb-3"
          maxLength={500}
        />

        <div className="flex items-center gap-2">
          <button onClick={onClose} className="btn btn-ghost flex-1 justify-center">
            ยกเลิก
          </button>
          <button
            onClick={() => {
              if (chosen.minutes === null) {
                // Permanent — extra confirm
                if (!window.confirm(`ยืนยันแบน ${customerName} แบบ "ถาวร"?\nบอทจะไม่ตอบลูกค้านี้อีกจนกว่าจะปลดแบน`)) return;
              }
              onConfirm(chosen.minutes, reason.trim());
            }}
            disabled={loading}
            className="btn btn-primary flex-1 justify-center bg-rose-600 hover:bg-rose-500 border-rose-600"
          >
            {loading ? 'กำลังแบน...' : `🚫 แบน ${chosen.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// 💸 (2026-05-24) Approve-payment modal. Two presets only (Deep 39 / Celtic 99)
// because those are the only live SKUs — adding a custom-amount input was
// declined by the user; if a third tier ships, add another preset here.
function ApproveModal({
  customerName,
  due,
  loading,
  onClose,
  onConfirm,
}: {
  customerName: string;
  due: number;
  loading: boolean;
  onClose: () => void;
  onConfirm: (amount: 39 | 99) => void;
}) {
  // Pre-select based on the customer's outstanding bill so one click commits.
  // Falls through to 39 when due is 0 (fresh thread, no tier picked yet).
  const presetFromDue: 39 | 99 = due >= 99 ? 99 : 39;
  const [selected, setSelected] = useState<39 | 99>(presetFromDue);

  const presets: Array<{ amount: 39 | 99; label: string; tier: string; tone: 'info' | 'mystic' }> = [
    { amount: 39, label: '฿39', tier: 'Deep · ทำนายเชิงลึก 2 ข้อ', tone: 'info' },
    { amount: 99, label: '฿99', tier: 'Celtic Cross · 10 ใบ + 3 คำถาม', tone: 'mystic' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel w-[460px] max-w-[92vw] p-4 border border-ok/40"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 0 32px rgba(16,185,129,0.20)' }}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="text-2xl">💸</div>
          <div className="flex-1">
            <div className="text-base font-semibold text-fg">อนุมัติชำระ {customerName}</div>
            <div className="text-2xs text-mute mt-0.5">
              เมื่อกดอนุมัติ ระบบจะมาร์คบิลและส่งคำทำนายให้ลูกค้าทันที
              {due > 0 && (
                <>
                  {' · '}
                  <span className="text-warn">ยอดในบิล ฿{due.toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost text-mute" title="ปิด">
            ✕
          </button>
        </div>

        <div className="text-2xs text-mute mb-1.5">เลือกแพคเกจ</div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {presets.map((p) => {
            const isSel = p.amount === selected;
            return (
              <button
                key={p.amount}
                onClick={() => setSelected(p.amount)}
                className={cn(
                  'px-3 py-2.5 rounded border text-left transition-colors',
                  isSel
                    ? p.tone === 'mystic'
                      ? 'bg-mystic/15 border-mystic/60 text-mystic'
                      : 'bg-info/12 border-info/70 text-info'
                    : 'border-line text-dim hover:border-line/80',
                )}
              >
                <div className="text-base font-bold mono">{p.label}</div>
                <div className="text-2xs opacity-80 mt-0.5">{p.tier}</div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onClose} className="btn btn-ghost flex-1 justify-center">
            ยกเลิก
          </button>
          <button
            onClick={() => onConfirm(selected)}
            disabled={loading}
            className="btn btn-ok flex-1 justify-center"
          >
            {loading ? 'กำลังอนุมัติ...' : `✓ อนุมัติ ฿${selected}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRemaining(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} นาที`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชม. ${min % 60} นาที`;
  const d = Math.floor(hr / 24);
  return `${d} วัน ${hr % 24} ชม.`;
}

function formatBanDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} นาที`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} ชั่วโมง`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} วัน`;
  return `${Math.floor(minutes / 10080)} สัปดาห์`;
}

// 🪪 (2026-05-24) Live AI worker pill shown in the chat header — same data
//   the /workers page reads, so operator sees "ตอบโดย groq/llama-3.3 · 4s"
//   in realtime while the bot is generating, and "เพิ่งตอบโดย ..." right
//   after. Clicking jumps to /workers for the full activity log.
function ActiveWorkerBadge({ w, live }: { w: WorkerCallRow; live: boolean }) {
  const color = providerColorForBadge(w.provider);
  const age = w.age_seconds ?? 0;
  const label = live ? 'ตอบโดย' : 'เพิ่งตอบโดย';
  return (
    <Link
      href="/workers"
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs no-underline transition-colors"
      style={{
        background: live ? `${color}1a` : 'rgba(75,85,99,0.15)',
        border: `1px solid ${live ? color + '66' : 'rgba(75,85,99,0.4)'}`,
        boxShadow: live ? `0 0 8px ${color}44` : 'none',
      }}
      title={`${label} ${w.provider}/${w.model} · ${age}s ago · ${w.tokens.toLocaleString()} tokens · ${w.latency_ms}ms`}
    >
      {live && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />}
      <span style={{ color: live ? color : '#9ca3af' }}>
        🤖 {label} <span className="font-semibold">{w.provider}</span>
      </span>
      <span className="text-mute mono">· {age}s</span>
    </Link>
  );
}

// 🔲 (2026-06-11) One conversation card in the multi-view grid. Stage-coloured
// border, live stage badge (+ provider while the AI is generating), last
// message snippet, and quick actions: open the chat / approve the bill.
function MultiTile({
  thread: t,
  stage,
  workerProvider,
  flash,
  canApprove,
  onOpen,
  onApprove,
}: {
  thread: ChatThread;
  stage: ChatStage;
  workerProvider: string | null;
  flash: boolean;
  canApprove: boolean;
  onOpen: () => void;
  onApprove: () => void;
}) {
  const meta = STAGE_META[stage];
  const hot = stage !== 'idle';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'text-left rounded-lg border bg-panel p-2.5 cursor-pointer transition-colors hover:bg-rowhi flex flex-col gap-1.5',
        flash && 'animate-pulse',
      )}
      style={{
        borderColor: hot ? meta.color + '66' : undefined,
        boxShadow: hot ? `0 0 10px ${meta.color}22` : undefined,
      }}
      title="กดเพื่อเปิดแชทนี้"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <ChannelChip channel={t.channel === 'LINE' ? 'line' : 'fb'} />
        <span className="text-sm text-fg font-medium truncate flex-1">{t.name}</span>
        {t.vip && <Pill tone="warn">VIP</Pill>}
        <span className="text-2xs mono text-mute shrink-0">{t.lastTs}</span>
      </div>

      <div
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs self-start"
        style={{
          background: meta.color + '1a',
          border: `1px solid ${meta.color}55`,
          color: meta.color,
        }}
      >
        {stage === 'predicting' && (
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: meta.color, boxShadow: `0 0 4px ${meta.color}` }} />
        )}
        <span className="font-semibold">
          {meta.icon} {meta.label}
          {stage === 'predicting' && workerProvider ? ` · ${workerProvider}` : ''}
        </span>
      </div>

      <div className="text-2xs text-dim line-clamp-2 break-words flex-1">{t.last}</div>

      <div className="flex items-center gap-1.5">
        {t.due > 0 && (
          <span className="text-2xs text-warn mono shrink-0">บิล ฿{t.due.toLocaleString()}</span>
        )}
        <div className="flex-1" />
        {canApprove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApprove();
            }}
            className="btn btn-ok text-2xs py-0.5"
            title="อนุมัติชำระ — ส่งคำทำนายให้ลูกค้าทันที"
          >
            ✓ อนุมัติ
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="btn btn-ghost text-2xs py-0.5"
        >
          💬 แชท
        </button>
      </div>
    </div>
  );
}

// Lighter copy of providerColor() local to chat — avoids re-export from workers
// page. Same palette as /workers so the colors stay consistent across pages.
function providerColorForBadge(name?: string): string {
  const m: Record<string, string> = {
    openai: '#10b981', anthropic: '#d4a747', groq: '#22d3ee',
    grok: '#e879f9', google: '#8b5cf6', gemini: '#8b5cf6',
    deepseek: '#f59e0b', qwen: '#f43f5e', meta: '#1877f2', 'meta-local': '#0ea5e9',
  };
  if (!name) return '#6b7280';
  return m[name.toLowerCase()] ?? '#94a3b8';
}
