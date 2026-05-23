'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useEve, type EveMood } from '@/lib/stores/eve';
import { useSettings } from '@/lib/stores/settings';
import { EveAvatar } from './EveAvatar';
import { EveChatBody } from './EveChatBody';

// Drag-position persistence — saved as offset-from-right-bottom (px), so the
// dock still feels anchored to the bottom-right when the viewport resizes.
const DRAG_STORE_KEY = 'warroom-eve-dock-position.v1';
type DragPos = { right: number; bottom: number };
const DEFAULT_POS: DragPos = { right: 14, bottom: 36 };

function loadPos(): DragPos {
  if (typeof window === 'undefined') return DEFAULT_POS;
  try {
    const raw = localStorage.getItem(DRAG_STORE_KEY);
    if (!raw) return DEFAULT_POS;
    const p = JSON.parse(raw) as DragPos;
    if (typeof p.right === 'number' && typeof p.bottom === 'number') return p;
  } catch {}
  return DEFAULT_POS;
}

function clampPos(p: DragPos, dockEl: HTMLElement | null): DragPos {
  if (typeof window === 'undefined') return p;
  // Keep at least 60×60 px of the dock on-screen so the user can always grab it.
  const w = dockEl?.offsetWidth ?? 80;
  const h = dockEl?.offsetHeight ?? 80;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    right: Math.max(8 - (w - 60), Math.min(vw - 60, p.right)),
    bottom: Math.max(8 - (h - 60), Math.min(vh - 60, p.bottom)),
  };
}

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
  const eveEnabled = useSettings((s) => s.eve.enabled);
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

  // ── Drag state (call hooks BEFORE any early return so hook order stays stable) ──
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<DragPos>(DEFAULT_POS);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{ startX: number; startY: number; startRight: number; startBottom: number } | null>(null);
  const hasMovedRef = useRef(false);

  // Load saved position once on mount.
  useEffect(() => {
    setPos(loadPos());
  }, []);

  // Re-clamp on window resize so the dock can't end up off-screen.
  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p, dockRef.current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only initiate drag on primary button + when we have a starting point.
    if (e.button !== 0) return;
    // Don't capture drags that started on a real interactive child — buttons
    // inside Eve still need to click through. The handle wrapper sets
    // data-drag-handle="true" on the area we accept drags on.
    const handle = (e.target as HTMLElement).closest('[data-drag-handle="true"]');
    if (!handle) return;
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRight: pos.right,
      startBottom: pos.bottom,
    };
    hasMovedRef.current = false;
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos.right, pos.bottom]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = dragStateRef.current;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!hasMovedRef.current && Math.hypot(dx, dy) < 4) return; // ignore tiny jitter — keeps clicks working
    hasMovedRef.current = true;
    setPos(clampPos({ right: s.startRight - dx, bottom: s.startBottom - dy }, dockRef.current));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setPos((p) => {
      const final = clampPos(p, dockRef.current);
      try {
        localStorage.setItem(DRAG_STORE_KEY, JSON.stringify(final));
      } catch {}
      return final;
    });
    // If the pointer barely moved we treat this as a click, not a drag.
    // The button's onClick still fires naturally because we don't preventDefault.
  }, []);

  // Hide the floating widget on the dedicated /eve page — the page itself
  // renders a full-size Eve, no need for duplication.
  if (pathname === '/eve') return null;

  // Master switch from Settings → Eve AI tab. When off, the floating dock
  // disappears entirely (operator can re-enable from Settings).
  if (!eveEnabled) return null;

  return (
    <div
      className="eve-dock"
      ref={dockRef}
      style={{
        right: pos.right + 'px',
        bottom: pos.bottom + 'px',
        cursor: isDragging ? 'grabbing' : undefined,
        userSelect: isDragging ? 'none' : undefined,
        transition: isDragging ? 'none' : 'right .15s ease, bottom .15s ease',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="eve" data-mood={mood}>
        {mode === 'min' && (
          <button
            type="button"
            className="eve-pill"
            data-drag-handle="true"
            onClick={() => {
              if (hasMovedRef.current) return; // suppress click after drag
              setMode('open');
            }}
            aria-label="เปิด Eve · ลากเพื่อขยับ"
            title="ลากเพื่อขยับ · คลิกเพื่อเปิด"
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
            data-drag-handle="true"
            onClick={() => {
              if (hasMovedRef.current) return;
              setMode('open');
            }}
            aria-label="เรียก Eve · ลากเพื่อขยับ"
            title="ลากเพื่อขยับ · คลิกเพื่อเรียก Eve"
          >
            <span className="eve-launcher-pulse" />
          </button>
        )}

        {mode === 'open' && (
          <div className="eve-panel">
            <div data-drag-handle="true" title="ลากเพื่อขยับ Eve">
              <EveAvatar scale={1} />
            </div>

            <div className="eve-head" data-drag-handle="true" title="ลากเพื่อขยับ Eve">
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
