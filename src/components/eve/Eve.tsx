'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useEve, type EveMood } from '@/lib/stores/eve';
import { cn } from '@/lib/utils';

type ScriptStep = {
  mood: EveMood;
  delay: number;
  pauseAfter: number;
  html: string;
};

const INTRO_SCRIPT: ScriptStep[] = [
  {
    mood: 'happy',
    delay: 600,
    pauseAfter: 1400,
    html: '<b>สวัสดีค่ะ พี่</b> ✦ Eve รายงานตัว · เป็นผู้ช่วย AI ประจำ War Room ของพี่นะคะ',
  },
  {
    mood: 'talking',
    delay: 300,
    pauseAfter: 1800,
    html: 'ตอนนี้สังเกตเห็น <b class="lnk" data-action="open-crit">3 เคสวิกฤต</b> ค้างคิวอยู่ค่ะ — เด่นสุดคือยอดโอน ฿2,500 ของคุณพิมพ์ชนกที่ไม่ตรงบิล',
  },
  {
    mood: 'concerned',
    delay: 400,
    pauseAfter: 1600,
    html: '<b>กังวลนิดนึง</b> ค่ะ คุณวรากรกำลังพิมพ์ขู่ขอคืนเงินใน FB · mood ระดับ 5 น่าจะรีบทักก่อนเสียลูกค้า',
  },
  {
    mood: 'idle',
    delay: 300,
    pauseAfter: 0,
    html: 'มีอะไรให้ Eve ช่วยมั้ยคะ? ลองพิมพ์คำสั่ง หรือกดปุ่มลัดด้านล่างได้เลยค่ะ ✨',
  },
];

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

const MOODS: EveMood[] = ['idle', 'happy', 'talking', 'thinking', 'concerned', 'surprise'];

export function Eve() {
  const { mode, mood, typing, messages, eyeY, eyeLX, eyeRX, mouthX, mouthY, setMode, setMood, setTyping, addMessage, clearMessages } = useEve();
  const [draft, setDraft] = useState('');
  const msgsRef = useRef<HTMLDivElement>(null);
  const introPlayed = useRef(false);

  const scrollToEnd = useCallback(() => {
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const respond = useCallback(
    async (text: string) => {
      const found = RESPONDERS.find((r) => r.match.test(text));
      const reply = found ? found.reply : 'เข้าใจค่ะ · Eve ยังเรียนรู้อยู่นะคะ ลองถามแบบ <b>"สรุปสถานการณ์"</b> หรือ <b>"เคสด่วน"</b> ก็ได้ค่ะ ✦';
      const replyMood = found ? found.mood : 'thinking';
      setMood('thinking');
      setTyping(true);
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 500));
      setTyping(false);
      addMessage({ role: 'eve', text: reply });
      setMood(replyMood);
      setTimeout(() => setMood('idle'), 2400);
    },
    [setMood, setTyping, addMessage],
  );

  const onAction = useCallback((action: string) => {
    if (action === 'open-crit') {
      // proxy via global event so any page can listen
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
    addMessage({ role: 'user', text: v.replace(/</g, '&lt;') });
    respond(v);
  }, [draft, addMessage, respond]);

  // intro script (once)
  useEffect(() => {
    if (introPlayed.current) return;
    introPlayed.current = true;
    let cancelled = false;
    let acc = 400;
    INTRO_SCRIPT.forEach((step) => {
      acc += step.delay;
      const fire = acc;
      setTimeout(() => {
        if (cancelled) return;
        setMood(step.mood);
        setTyping(true);
        setTimeout(() => {
          if (cancelled) return;
          setTyping(false);
          addMessage({ role: 'eve', text: step.html });
          // briefly switch to "talking" then back to declared mood
          setMood('talking');
          setTimeout(() => !cancelled && setMood(step.mood), 800);
        }, 700);
      }, fire);
      acc += 700 + step.pauseAfter;
    });
    setTimeout(() => !cancelled && setMood('idle'), acc + 200);
    return () => {
      cancelled = true;
    };
  }, [setMood, setTyping, addMessage]);

  // eve:alert listener
  useEffect(() => {
    const onAlert = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { msg?: string } | undefined;
      setMode('open');
      addMessage({ role: 'eve', text: '⚠ <b>ตรวจพบเหตุการณ์ใหม่</b><br>' + (detail?.msg ?? '') });
      setMood('surprise');
      setTimeout(() => setMood('concerned'), 1500);
    };
    document.addEventListener('eve:alert', onAlert);
    return () => document.removeEventListener('eve:alert', onAlert);
  }, [setMode, addMessage, setMood]);

  // auto-scroll on new message / typing
  useEffect(() => {
    scrollToEnd();
  }, [messages, typing, scrollToEnd]);

  // bind data-action links inside Eve messages
  useEffect(() => {
    const el = msgsRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const link = t.closest('[data-action]') as HTMLElement | null;
      if (link) {
        const a = link.dataset.action;
        if (a) onAction(a);
      }
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [onAction]);

  return (
    <div className="eve-dock">
      <div className="eve" data-mood={mood}>
        {mode === 'min' && (
          <button
            type="button"
            className="eve-pill"
            onClick={() => setMode('open')}
            aria-label="เปิด Eve"
          >
            <span className="eve-pill-port">
              <Image className="eve-avatar-img" src="/assets/eve.svg" alt="" width={51} height={51} priority unoptimized />
            </span>
            <span className="eve-pill-meta">
              <span className="eve-pill-name">
                Eve <span className="rune">AI · ASSIST</span>
              </span>
              <span className="eve-pill-status">
                <span className="dot-tiny" /> ออนไลน์ · มีข้อความใหม่
              </span>
            </span>
            <span
              role="button"
              tabIndex={0}
              className="eve-pill-close"
              onClick={(e) => {
                e.stopPropagation();
                setMode('hidden');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setMode('hidden');
                }
              }}
              aria-label="ซ่อน Eve"
            >
              ✕
            </span>
          </button>
        )}

        {mode === 'hidden' && (
          <button
            type="button"
            className="eve-launcher"
            onClick={() => setMode('open')}
            aria-label="เรียก Eve"
          >
            <Image className="eve-avatar-img" src="/assets/eve.svg" alt="" width={73} height={73} priority unoptimized />
            <span className="eve-launcher-pulse" />
          </button>
        )}

        {mode === 'open' && (
          <div className="eve-panel">
            <div className="eve-stage">
              <span className="ring" />
              <span className="spark s2" />
              <span className="spark s3" />
              <span className="spark s4" />
              <span className="spark s5" />
              <div className="eve-avatar">
                <Image className="eve-avatar-img" src="/assets/eve.svg" alt="Eve" width={200} height={200} priority unoptimized />
                <div
                  className="eve-face"
                  style={{
                    ['--eye-y' as string]: `${eyeY}%`,
                    ['--eyeL-x' as string]: `${eyeLX}%`,
                    ['--eyeR-x' as string]: `${eyeRX}%`,
                    ['--mouth-x' as string]: `${mouthX}%`,
                    ['--mouth-y' as string]: `${mouthY}%`,
                  } as React.CSSProperties}
                >
                  <div className="eve-eyes-pan">
                    <span className="eve-eye l" />
                    <span className="eve-eye r" />
                  </div>
                  <div className="eve-mouth">
                    <svg viewBox="0 0 22 14">
                      <path d="M 2 3 Q 11 6 20 3" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="eve-head">
              <div className="eve-head-name">
                <b>
                  Eve <span className="rune">AI ASSIST</span>
                </b>
                <small>
                  <em>● ฟัง War Room อยู่</em> · v0.7 · qwen-72b
                </small>
              </div>
              <button
                type="button"
                className="eve-head-btn"
                title="ปรับตำแหน่งใบหน้า"
                onClick={() => {
                  const cur = `${eyeY}, ${eyeLX}, ${eyeRX}, ${mouthX}, ${mouthY}`;
                  const next = window.prompt(
                    'ปรับตำแหน่ง (eye-y, eyeL-x, eyeR-x, mouth-x, mouth-y — เลข 0-100)',
                    cur,
                  );
                  if (!next) return;
                  const [ey, el, er, mx, my] = next.split(',').map((s) => Number(s.trim()));
                  if ([ey, el, er, mx, my].some((n) => Number.isNaN(n))) return;
                  useEve.getState().setFace({ eyeY: ey, eyeLX: el, eyeRX: er, mouthX: mx, mouthY: my });
                }}
              >
                ⚙
              </button>
              <button type="button" className="eve-head-btn" title="ย่อ" onClick={() => setMode('min')}>
                —
              </button>
              <button type="button" className="eve-head-btn" title="ปิด Eve" onClick={() => setMode('hidden')}>
                ✕
              </button>
            </div>

            <div className="eve-msgs" ref={msgsRef}>
              {messages.map((m) => (
                <div key={m.id} className={cn('eve-msg', m.role)} dangerouslySetInnerHTML={{ __html: m.text }} />
              ))}
              {typing && (
                <div className="eve-msg eve">
                  <span className="eve-typing">
                    <span /> <span /> <span />
                  </span>
                </div>
              )}
            </div>

            <div className="eve-quick">
              {QUICK_ACTIONS.map((q) => (
                <button key={q.prompt} type="button" onClick={() => onQuick(q.prompt)}>
                  {q.label}
                </button>
              ))}
            </div>

            <form
              className="eve-input"
              onSubmit={(e) => {
                e.preventDefault();
                submitDraft();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="ถาม Eve อะไรก็ได้..."
                autoComplete="off"
              />
              <button type="submit" title="ส่ง">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 11L22 2l-9 20-2-9-8-2z" />
                </svg>
              </button>
            </form>

            <div className="eve-moods">
              <small>MOOD</small>
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={mood === m ? 'active' : ''}
                  onClick={() => setMood(m)}
                >
                  {m}
                </button>
              ))}
              <small style={{ marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={clearMessages}
                  style={{ borderColor: 'rgba(239,68,68,.35)', color: '#fca5a5' }}
                >
                  ล้าง
                </button>
              </small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
