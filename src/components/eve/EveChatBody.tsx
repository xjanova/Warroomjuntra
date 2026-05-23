'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEve, type EveMood } from '@/lib/stores/eve';
import { useSettings, isPaired as isPairedFn } from '@/lib/stores/settings';
import { eveChat, describeError } from '@/lib/api';
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
  stripActionTags,
  buildActionInstructions,
} from '@/lib/eve/actions';
import { detectIntent } from '@/lib/eve/intents';

type Responder = { match: RegExp; mood: EveMood; reply: string };

const RESPONDERS: Responder[] = [
  {
    match: /(สรุป|สรุปคิว|status|สรุปสถานการณ์|รายงาน)/i,
    mood: 'talking',
    reply:
      'ขอสรุปให้ค่ะ ✦<br>· เคสวิกฤต <b>3</b> · เคสเตือน <b>5</b> · ติดตามด่วน <b>6</b><br>· ยอดเงินวันนี้ <b>฿48,290</b> (▲ 18%)<br>· ตอบเฉลี่ย <b>42 วินาที</b><br>· AI <b>qwen-72b</b> ช้ากว่า threshold · แนะนำให้สลับไป gemini-pro ชั่วคราวค่ะ',
  },
  {
    match: /(วิกฤต|crit|critical|ด่วน|urgent)/i,
    mood: 'concerned',
    reply:
      'เคสวิกฤตที่สุดตอนนี้คือ <b class="lnk" data-action="open-crit">คุณพิมพ์ชนก ส.</b> ยอดโอนไม่ตรงบิล ค้าง 14 นาทีค่ะ — Eve เปิดเคสให้พี่ดูดีกว่ามั้ยคะ?',
  },
  {
    match: /(เงิน|ยอด|รายรับ|revenue|sales)/i,
    mood: 'happy',
    reply:
      'ยอดวันนี้ <b>฿48,290</b> ค่ะ · เพิ่มขึ้น 18% จากเมื่อวาน · Celtic Cross ขายดีที่สุด 12 ใบ ส่วนใหญ่มาจาก LINE OA นะคะ ✦',
  },
  {
    match: /(บอท|bot|automation)/i,
    mood: 'thinking',
    reply:
      'บอทอัตโนมัติ 4 จาก 5 ตัวทำงานปกติค่ะ · มีตัวเดียวที่เตือน — <b>"ติดตามลูกค้าหายไป 7 วัน"</b> มี 12 รายส่งไม่สำเร็จเมื่อวาน · ลองส่งซ้ำมั้ยคะ?',
  },
  {
    match: /(ลูกค้า|customer|พิมพ์ชนก|วรากร|ธนกฤต)/i,
    mood: 'idle',
    reply:
      'พิมพ์ชื่อแล้วกด Enter หรือกด <b>⌘K</b> ได้ค่ะ · Eve เปิด Customer 360 ของคุณพิมพ์ชนกไว้แล้ว · เธอเป็น VIP Legendary LV 28 มูลค่ารวม ฿24,599 ค่ะ',
  },
  {
    match: /(ขอบคุณ|thanks|thank you|ดีจ)/i,
    mood: 'happy',
    reply: 'ยินดีที่ได้ช่วยพี่ค่ะ ✦ Eve จะคอยจับตาดูคิวให้นะคะ',
  },
  {
    match: /(สวัสดี|hi|hello|hey|ทัก)/i,
    mood: 'happy',
    reply: 'สวัสดีค่ะ พี่ ✨ มีอะไรให้ช่วยมั้ยคะ?',
  },
  {
    match: /(เธอคือใคร|who are you|ชื่อ|who)/i,
    mood: 'idle',
    reply:
      'Eve ค่ะ — AI ผู้ช่วยประจำ War Room ของ Juntra · หน้าที่ของ Eve คือคอยสรุปคิว ตอบคำถาม แจ้งเตือนเคสวิกฤต และช่วยพี่ตัดสินใจให้เร็วขึ้นค่ะ ✦',
  },
];

const QUICK_ACTIONS = [
  { label: '📊 สรุปสถานการณ์', prompt: 'สรุปสถานการณ์ตอนนี้' },
  { label: '🚨 เคสด่วน', prompt: 'เคสวิกฤตที่สุด' },
  { label: '💰 ยอดวันนี้', prompt: 'ยอดเงินวันนี้เป็นยังไง' },
  { label: '🤖 สถานะบอท', prompt: 'บอทเป็นยังไง' },
];

export function EveChatBody({
  compact = true,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { typing, messages, setMood, setTyping, addMessage } = useEve();
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

  const respond = useCallback(
    async (text: string) => {
      // ── Phase A: client-side intent. If we can satisfy the request locally
      //    (navigate, refresh, toggle, open drawer), do it now — no LLM round
      //    trip needed. Eve speaks an immediate ack.
      const intent = detectIntent(text);
      if (intent) {
        const results = executeActions(intent.actions);
        const ack = intent.spokenAck ?? 'จัดการให้แล้วค่ะ ✦';
        addMessage({ role: 'eve', text: ack });
        setMood('happy');
        speakReply(ack);
        setTimeout(() => setMood('idle'), 2000);

        // If any action failed (e.g. opened a non-existent drawer), tack on a heads-up.
        const failed = results.filter((r) => !r.ok);
        if (failed.length > 0) {
          const msg = 'แต่มีบางอย่างขัดข้องค่ะ: ' + failed.map((r) => r.message).join(' · ');
          addMessage({ role: 'eve', text: '<small class="text-2xs">' + msg + '</small>' });
        }
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

        try {
          const res = await eveChat({
            message: text,
            history,
            provider: eveCfg.provider,
            model: eveCfg.model,
            temperature: eveCfg.temperature,
            max_tokens: eveCfg.maxTokens,
            // Inject the action vocabulary via context so the LLM (if backend
            // includes context.tools in its system prompt) emits [TAG:args]
            // markers. If backend ignores `tools`, we still get a plain reply.
            context: eveCfg.passContext
              ? {
                  source: 'warroom-dock',
                  ts: new Date().toISOString(),
                  tools: actionInstructions,
                }
              : undefined,
          });
          setTyping(false);

          // Parse any action markers from the reply, execute, strip from display.
          const reply = res.reply || 'Eve ตอบไม่ได้ในตอนนี้ค่ะ';
          const actions = parseActions(reply);
          if (actions.length > 0) executeActions(actions);

          const displayText = stripActionTags(reply).replace(/\n/g, '<br>') ||
            'จัดการให้แล้วค่ะ ✦';
          addMessage({ role: 'eve', text: displayText });
          setMood(res.mood ?? 'talking');
          speakReply(displayText);
          setTimeout(() => setMood('idle'), 2400);
          return;
        } catch (e) {
          setTyping(false);
          const err = '<i>ขออภัยค่ะ — เชื่อมต่อ AI ไม่สำเร็จ:</i><br><small class="text-2xs">' + describeError(e) + '</small>';
          addMessage({ role: 'eve', text: err });
          setMood('concerned');
          setTimeout(() => setMood('idle'), 2400);
          return;
        }
      }

      // Unpaired → fall back to the canned RESPONDERS so Eve still feels alive.
      const found = RESPONDERS.find((r) => r.match.test(text));
      const reply = found
        ? found.reply
        : 'เข้าใจค่ะ · Eve ยังเรียนรู้อยู่นะคะ ลองถามแบบ <b>"สรุปสถานการณ์"</b> หรือ <b>"เคสด่วน"</b> ก็ได้ค่ะ ✦';
      const replyMood: EveMood = found ? found.mood : 'thinking';
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 500));
      setTyping(false);
      addMessage({ role: 'eve', text: reply });
      setMood(replyMood);
      speakReply(reply);
      setTimeout(() => setMood('idle'), 2400);
    },
    [paired, messages, setMood, setTyping, addMessage, eveCfg.provider, eveCfg.model, eveCfg.temperature, eveCfg.maxTokens, eveCfg.passContext, actionInstructions, speakReply],
  );

  const onAction = useCallback((action: string) => {
    if (action === 'open-crit') {
      document.dispatchEvent(new CustomEvent('warroom:open-case', { detail: { id: 'c-pay-001' } }));
    }
  }, []);

  const onQuick = useCallback(
    (prompt: string) => {
      addMessage({ role: 'user', text: prompt });
      respond(prompt);
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
