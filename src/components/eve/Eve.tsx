'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useEve, type EveMood } from '@/lib/stores/eve';
import { EveAvatar } from './EveAvatar';
import { EveChatBody } from './EveChatBody';

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

const MOODS: EveMood[] = ['idle', 'happy', 'talking', 'thinking', 'concerned', 'surprise'];

export function Eve() {
  const pathname = usePathname();
  const {
    mode, mood,
    eyeY, eyeLX, eyeRX, mouthX, mouthY,
    setMode, setMood, setTyping, addMessage, clearMessages,
  } = useEve();
  const introPlayed = useRef(false);

  // Intro script — fire once per session, regardless of which page renders Eve first.
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

  // eve:alert listener — any page can trigger Eve to bounce open + react.
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

  // Hide the floating widget on the dedicated /eve page — the page itself
  // renders a full-size Eve, no need for duplication.
  if (pathname === '/eve') return null;

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
            <span className="eve-pill-port" aria-hidden />
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
            <span className="eve-launcher-pulse" />
          </button>
        )}

        {mode === 'open' && (
          <div className="eve-panel">
            <EveAvatar scale={1} />

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

            <EveChatBody compact />

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
