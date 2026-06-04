'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEve, type EveMood, type PendingAction } from '@/lib/stores/eve';
import { useWarroom } from '@/lib/stores/warroom';
import { useSettings, isPaired as isPairedFn } from '@/lib/stores/settings';
import { eveChat, fetchEveSignals, describeError, type EveSignals } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  startListening,
  speak as ttsSpeak,
  cancelSpeech,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  type ListenHandle,
} from '@/lib/eve/voice';
import {
  parseActions,
  executeActions,
  executeManagedAction,
  isManaged,
  describeAction,
  stripActionTags,
  buildActionInstructions,
  type ParsedAction,
  type ActionTag,
} from '@/lib/eve/actions';
import { detectIntent } from '@/lib/eve/intents';

// 🧹 (2026-06-04) Removed the canned demo RESPONDERS — they fabricated metrics
//   (เคสวิกฤต 3 · ฿48,290 · พิมพ์ชนก VIP). Eve now answers ONLY via the real
//   /eve/chat LLM when paired; otherwise she's honestly offline (see respond()).

const QUICK_ACTIONS = [
  { label: '📊 สรุปสถานการณ์', prompt: 'สรุปสถานการณ์ตอนนี้' },
  { label: '🚨 เคสด่วน', prompt: 'เคสวิกฤตที่สุด' },
  { label: '💰 ยอดวันนี้', prompt: 'ยอดเงินวันนี้เป็นยังไง' },
  { label: '🤖 สถานะบอท', prompt: 'บอทเป็นยังไง' },
];

// Compact the live /eve/signals snapshot into the chat `context.state` so the
// backend folds REAL War Room numbers into Eve's system prompt — she answers
// "เคสด่วน / ยอดวันนี้ / ค้างกี่ราย" with facts and proposes precise actions instead
// of guessing. Drops generated_at (noise) and keeps the decision-relevant figures.
function buildStateContext(s: EveSignals): Record<string, unknown> {
  return {
    headline: s.alert.headline,
    alert_level: s.alert.level,
    fortune: {
      stuck_paid: s.fortune.stuck_paid,
      oldest_stuck_paid_min: s.fortune.oldest_stuck_paid_min,
      lead_count: s.fortune.lead_count,
      unpaid_followups: s.fortune.unpaid_followups,
      triage_crit: s.fortune.triage_crit,
      triage_warn: s.fortune.triage_warn,
      completed_15m: s.fortune.completed_15m,
      failed_15m: s.fortune.failed_15m,
    },
    finance: {
      withdrawals_pending: s.finance.withdrawals_pending,
      sms_unmatched: s.finance.sms_unmatched,
    },
    ai_pool: {
      providers_offline: s.ai_pool.providers_offline,
      keys_active: s.ai_pool.keys_active,
      error_rate_15m_pct: s.ai_pool.error_rate_15m_pct,
    },
    moderation: { suspects: s.moderation.suspects, banned_active: s.moderation.banned_active },
  };
}

export function EveChatBody({
  compact = true,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { typing, messages, setMood, setTyping, addMessage, pending, addPending, setPendingStatus, removePending } = useEve();
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const msgsRef = useRef<HTMLDivElement>(null);
  const listenHandleRef = useRef<ListenHandle | null>(null);

  const paired = useSettings((s) => isPairedFn(s));
  const eveCfg = useSettings((s) => s.eve);

  // Memoize the action-vocabulary instructions so we don't rebuild on every keystroke.
  const actionInstructions = useMemo(() => buildActionInstructions(), []);

  // Speak any reply from Eve (TTS) — only if user enabled it in Settings.
  const speakReply = useCallback(
    (text: string) => {
      if (!eveCfg.voice.speak.enabled) return;
      if (!isSpeechSynthesisSupported()) return;
      const clean = text.replace(/<[^>]+>/g, '');
      if (!clean.trim()) return;
      ttsSpeak(clean, {
        voiceName: eveCfg.voice.speak.voiceName,
        rate: eveCfg.voice.speak.rate,
        pitch: eveCfg.voice.speak.pitch,
        volume: eveCfg.voice.speak.volume,
        interruptOnNew: eveCfg.voice.speak.interruptOnNew,
        lang: eveCfg.voice.listen.lang,
      });
    },
    [eveCfg.voice],
  );

  // ── Action orchestrator ─────────────────────────────────────────────────
  // Non-managed actions (navigate / toggle / open drawer / refresh) run instantly.
  // Managed actions (approve / refund / cancel / ban / mark-paid / toggle-bot …)
  // either run immediately (โหมด "จัดการเอง" = autoManage) OR get queued as a
  // confirmation card the operator must press ยืนยัน on (โหมด "ขออนุญาต").
  const runActions = useCallback(
    async (actions: ParsedAction[], opts?: { forceConfirm?: boolean }): Promise<string[]> => {
      const settings = useSettings.getState();
      // forceConfirm (keyword fast-path) overrides "จัดการเอง" → a classifier-
      // matched managed action ALWAYS queues a confirm card, never auto-runs.
      const autoManage = settings.eve.safety.autoManage && !opts?.forceConfirm;
      const connected = isPairedFn(settings);
      const msgs: string[] = [];

      const immediate = actions.filter((a) => !isManaged(a.tag));
      if (immediate.length > 0) {
        for (const r of executeActions(immediate)) {
          if (r.message) msgs.push((r.ok ? '' : '⚠ ') + r.message);
        }
      }

      for (const act of actions.filter((a) => isManaged(a.tag))) {
        const { label, kind } = describeAction(act);
        // Managed actions hit the live admin API — never run or even queue them
        // while offline (Phase-A intent runs before the paired check).
        if (!connected) {
          msgs.push('🔌 ' + label + ' — เชื่อมต่อก่อนถึงจะสั่งจัดการได้ (Settings → การเชื่อมต่อ)');
          continue;
        }
        if (autoManage) {
          const res = await executeManagedAction(act);
          msgs.push((res.ok ? '✓ ' : '✗ ') + (res.message ?? label));
        } else {
          addPending({ tag: act.tag, args: act.args, label, kind });
          msgs.push('🔐 รออนุญาต: ' + label);
        }
      }
      return msgs;
    },
    [addPending],
  );

  // Operator pressed ยืนยัน on a queued card → run it for real.
  const confirmPending = useCallback(
    async (p: PendingAction) => {
      setPendingStatus(p.id, 'running');
      const res = await executeManagedAction({ tag: p.tag as ActionTag, args: p.args, raw: '' });
      setPendingStatus(p.id, res.ok ? 'done' : 'error', res.message ?? (res.ok ? 'สำเร็จ' : 'ล้มเหลว'));
      setMood(res.ok ? 'happy' : 'concerned');
      setTimeout(() => removePending(p.id), 3500);
    },
    [setPendingStatus, removePending, setMood],
  );

  const cancelPending = useCallback((id: string) => removePending(id), [removePending]);

  const respond = useCallback(
    async (text: string, opts?: { forceLLM?: boolean }) => {
      // ── Phase A: client-side intent. If we can satisfy the request locally
      //    (navigate, refresh, toggle, open drawer, manage) do it now — no LLM
      //    round trip needed. Eve speaks an immediate ack.
      //    forceLLM (quick-action info questions) skips this so Eve ANSWERS with
      //    live data instead of just navigating to a page.
      const intent = opts?.forceLLM ? null : detectIntent(text);
      if (intent) {
        const ack = intent.spokenAck ?? 'จัดการให้แล้วค่ะ ✦';
        addMessage({ role: 'eve', text: ack });
        // forceConfirm: keyword-classifier managed actions always need a confirm
        // card — only the LLM path (Phase B) may auto-run under "จัดการเอง".
        const msgs = await runActions(intent.actions, { forceConfirm: true });
        if (msgs.length > 0) {
          addMessage({ role: 'eve', text: '<small class="text-2xs text-mute">' + msgs.join('<br>') + '</small>' });
        }
        setMood('happy');
        speakReply(ack);
        setTimeout(() => setMood('idle'), 2000);
        return;
      }

      // ── Phase B: no clear intent → ask the LLM.
      setMood('thinking');
      setTyping(true);

      // Paired? → real LLM via /api/admin/eve/chat
      if (paired) {
        // Build conversation history from store. Drop HTML tags so the LLM
        // sees plain Thai, not <b> markup. Strip action tags too — they're
        // side-channel commands, not narrative.
        const history = messages
          .slice(-10)
          .map((m) => ({
            role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: stripActionTags(m.text.replace(/<[^>]+>/g, '')).slice(0, 500),
          }));

        // Gather the live signals snapshot so Eve reasons over REAL numbers
        // (stuck-paid, pending withdrawals, triage…). Best-effort — if it fails
        // Eve still answers, just without situational state.
        let stateCtx: Record<string, unknown> | undefined;
        if (eveCfg.passContext) {
          try {
            stateCtx = buildStateContext(await fetchEveSignals());
          } catch {
            /* situational data is optional */
          }
        }

        try {
          const res = await eveChat({
            message: text,
            history,
            provider: eveCfg.provider,
            model: eveCfg.model,
            temperature: eveCfg.temperature,
            max_tokens: eveCfg.maxTokens,
            // Inject the action vocabulary (tools) + live state via context. The
            // backend folds tools into the system prompt (untruncated) so the LLM
            // emits [TAG:args] markers, and state so it answers with real numbers.
            context: eveCfg.passContext
              ? {
                  source: 'warroom-dock',
                  ts: new Date().toISOString(),
                  tools: actionInstructions,
                  state: stateCtx,
                }
              : undefined,
          });
          setTyping(false);

          // Parse any action markers from the reply, run them (mode-gated), strip from display.
          const reply = res.reply || 'Eve ตอบไม่ได้ในตอนนี้ค่ะ';
          const actions = parseActions(reply);

          const displayText = stripActionTags(reply).replace(/\n/g, '<br>') ||
            'จัดการให้แล้วค่ะ ✦';
          addMessage({ role: 'eve', text: displayText });
          setMood(res.mood ?? 'talking');
          speakReply(displayText);
          if (actions.length > 0) {
            const msgs = await runActions(actions);
            if (msgs.length > 0) {
              addMessage({ role: 'eve', text: '<small class="text-2xs text-mute">' + msgs.join('<br>') + '</small>' });
            }
          }
          setTimeout(() => setMood('idle'), 2400);
          return;
        } catch (e) {
          setTyping(false);
          const err = '<i>Eve ออฟไลน์ — เชื่อมต่อ AI ไม่ได้ตอนนี้ค่ะ 🔌</i><br><small class="text-2xs text-mute">' + describeError(e) + '</small>';
          addMessage({ role: 'eve', text: err });
          setMood('concerned');
          setTimeout(() => setMood('idle'), 2400);
          return;
        }
      }

      // 🧹 (2026-06-04) Unpaired → Eve is honestly OFFLINE. No canned demo replies
      //   (those faked metrics). She only talks via the real LLM when connected.
      setTyping(false);
      const offline = 'Eve ออฟไลน์อยู่ค่ะ — ยังเชื่อมต่อ AI ไม่ได้ 🔌 เชื่อมต่อใน <b>Settings → การเชื่อมต่อ</b> ก่อนถึงจะคุยกับ Eve ได้นะคะ';
      addMessage({ role: 'eve', text: '<i>' + offline + '</i>' });
      setMood('concerned');
      speakReply(offline);
      setTimeout(() => setMood('idle'), 2400);
    },
    [paired, messages, setMood, setTyping, addMessage, eveCfg.provider, eveCfg.model, eveCfg.temperature, eveCfg.maxTokens, eveCfg.passContext, actionInstructions, speakReply, runActions],
  );

  const onAction = useCallback((action: string) => {
    if (action === 'open-crit') {
      // Open the case drawer straight through the store. The previous
      // CustomEvent('warroom:open-case') had no listener anywhere — it was a
      // no-op. In the unpaired demo this resolves the mock case; when paired
      // Eve answers via the live /eve/chat model so this canned link isn't shown.
      useWarroom.getState().openCaseDrawer('c-pay-001');
    }
  }, []);

  const onQuick = useCallback(
    (prompt: string) => {
      addMessage({ role: 'user', text: prompt });
      // Quick actions are informational — always answer via the LLM (with live
      // state), never short-circuit into a navigation intent.
      respond(prompt, { forceLLM: true });
    },
    [addMessage, respond],
  );

  const submitDraft = useCallback(() => {
    const v = draft.trim();
    if (!v) return;
    setDraft('');
    setInterim('');
    addMessage({ role: 'user', text: v.replace(/</g, '&lt;') });
    respond(v);
  }, [draft, addMessage, respond]);

  // ── Mic toggle ────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    // Currently listening → stop
    if (listening) {
      listenHandleRef.current?.stop();
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      addMessage({
        role: 'eve',
        text: '<i>เบราว์เซอร์นี้ไม่รองรับ SpeechRecognition</i> — ลองใช้ Chrome/Edge บน macOS/Windows ค่ะ',
      });
      return;
    }
    cancelSpeech(); // stop Eve mid-sentence so the mic doesn't pick it up
    setInterim('');
    const handle = startListening({
      lang: eveCfg.voice.listen.lang || 'th-TH',
      continuous: eveCfg.voice.listen.continuous,
      interim: true,
      onStart: () => setListening(true),
      onPartial: (text) => setInterim(text),
      onFinal: (text) => {
        setInterim('');
        if (eveCfg.voice.listen.autoSendOnFinal) {
          addMessage({ role: 'user', text: text.replace(/</g, '&lt;') });
          respond(text);
        } else {
          // Drop into the text box for the operator to confirm
          setDraft((d) => (d ? d + ' ' + text : text));
        }
      },
      onError: (kind, message) => {
        setListening(false);
        setInterim('');
        if (kind === 'not-allowed') {
          addMessage({
            role: 'eve',
            text: '<i>กรุณาอนุญาตการเข้าถึงไมโครโฟนในเบราว์เซอร์</i>',
          });
        } else if (kind !== 'no-speech') {
          addMessage({
            role: 'eve',
            text: '<i>เกิดปัญหาฟังเสียง:</i> <small class="text-2xs">' + kind + (message ? ' — ' + message : '') + '</small>',
          });
        }
      },
      onEnd: () => {
        setListening(false);
        listenHandleRef.current = null;
      },
    });
    listenHandleRef.current = handle;
    if (!handle) setListening(false);
  }, [listening, eveCfg.voice.listen, addMessage, respond]);

  // Cleanup mic on unmount
  useEffect(() => {
    return () => {
      listenHandleRef.current?.abort();
      cancelSpeech();
    };
  }, []);

  useEffect(() => {
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    const el = msgsRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const link = t.closest('[data-action]') as HTMLElement | null;
      if (link?.dataset.action) onAction(link.dataset.action);
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [onAction]);

  const micSupported = isSpeechRecognitionSupported();
  const micEnabledInSettings = eveCfg.voice.listen.enabled;

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div
        className={cn(
          compact ? 'eve-msgs' : 'flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2',
        )}
        ref={msgsRef}
      >
        {!compact && messages.length === 0 && !typing && (
          <div className="grid place-items-center h-full text-mute text-sm">
            ทักทาย Eve ได้เลยค่ะ ✨
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(compact ? 'eve-msg' : 'eve-msg eve-msg-lg', m.role)}
            dangerouslySetInnerHTML={{ __html: m.text }}
          />
        ))}
        {typing && (
          <div className={cn(compact ? 'eve-msg eve' : 'eve-msg eve-msg-lg eve')}>
            <span className="eve-typing">
              <span /> <span /> <span />
            </span>
          </div>
        )}
        {listening && (
          <div className={cn(compact ? 'eve-msg user' : 'eve-msg eve-msg-lg user', 'opacity-70 italic')}>
            <span className="mono text-2xs">● ฟังอยู่...</span>
            {interim && <div className="text-fg mt-0.5">{interim}</div>}
          </div>
        )}

        {/* 🤖 (2026-06-04) Pending management actions — "ขออนุญาต" mode confirm cards. */}
        {pending.map((p) => (
          <div
            key={p.id}
            className={cn(
              'rounded border px-2.5 py-2 my-1 text-fg',
              p.kind === 'crit'
                ? 'border-crit/50 bg-crit/10'
                : p.kind === 'warn'
                ? 'border-warn/50 bg-warn/10'
                : 'border-ok/50 bg-ok/10',
            )}
          >
            <div className="flex items-center gap-1.5 text-2xs">
              <span>🔐</span>
              <span className="font-semibold flex-1">{p.label}</span>
            </div>
            {p.status === 'pending' && (
              <div className="flex gap-1 mt-1.5">
                <button
                  type="button"
                  className="btn btn-ok flex-1 justify-center text-2xs py-1"
                  onClick={() => void confirmPending(p)}
                >
                  ✓ ยืนยัน
                </button>
                <button
                  type="button"
                  className="btn btn-ghost flex-1 justify-center text-2xs py-1"
                  onClick={() => cancelPending(p.id)}
                >
                  ✕ ยกเลิก
                </button>
              </div>
            )}
            {p.status === 'running' && <div className="text-2xs text-mute mt-1">⏳ กำลังทำ…</div>}
            {p.status === 'done' && <div className="text-2xs text-ok mt-1">✓ {p.result}</div>}
            {p.status === 'error' && <div className="text-2xs text-crit mt-1">✗ {p.result}</div>}
          </div>
        ))}
      </div>

      <div className={compact ? 'eve-quick' : 'eve-quick eve-quick-lg'}>
        {QUICK_ACTIONS.map((q) => (
          <button key={q.prompt} type="button" onClick={() => onQuick(q.prompt)}>
            {q.label}
          </button>
        ))}
      </div>

      <form
        className={compact ? 'eve-input' : 'eve-input eve-input-lg'}
        onSubmit={(e) => {
          e.preventDefault();
          submitDraft();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={listening ? 'ฟังอยู่...' : 'ถาม Eve อะไรก็ได้...'}
          autoComplete="off"
          disabled={listening && !draft}
        />
        {micEnabledInSettings && micSupported && (
          <button
            type="button"
            onClick={toggleMic}
            title={listening ? 'หยุดฟัง' : 'พูดกับ Eve'}
            className={cn(
              'eve-mic-btn',
              listening && 'eve-mic-btn-active',
            )}
            aria-pressed={listening}
          >
            {/* Inline mic icon — outlined when idle, filled+pulsing when active */}
            <svg width={compact ? 13 : 16} height={compact ? 13 : 16} viewBox="0 0 24 24" fill={listening ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <button type="submit" title="ส่ง">
          <svg width={compact ? 13 : 16} height={compact ? 13 : 16} viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 11L22 2l-9 20-2-9-8-2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
