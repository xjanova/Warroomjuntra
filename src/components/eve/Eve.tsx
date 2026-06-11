'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useEve, type EveMood } from '@/lib/stores/eve';
import { useSettings } from '@/lib/stores/settings';
import { type EveSignals } from '@/lib/api';
import { EveAvatar } from './EveAvatar';
import { EveChatBody } from './EveChatBody';
import { useEveHealth } from './useEveHealth';

// Eve always (re)starts anchored at the default bottom-right on a fresh mount /
// reload. We deliberately do NOT persist the dragged position across reloads — a
// stale offset (smaller viewport / different monitor) used to strand the dock
// off-screen with no way to grab it back. In-session drags still hold because
// this dock stays mounted across client-side page navigation.
type DragPos = { right: number; bottom: number };
const DEFAULT_POS: DragPos = { right: 14, bottom: 36 };

function clampPos(p: DragPos, dockEl: HTMLElement | null): DragPos {
  if (typeof window === 'undefined') return p;
  // Keep at least 60×60 px of the dock on-screen so the user can always grab
  // it — and when the dock is SMALLER than that (the 56px launcher), keep the
  // whole thing visible: 60px-of-340px is fine for the panel, but 60px-rule on
  // a 56px button used to let it sit entirely past the edge.
  const w = dockEl?.offsetWidth ?? 80;
  const h = dockEl?.offsetHeight ?? 80;
  const visW = Math.min(w, 60);
  const visH = Math.min(h, 60);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // A backgrounded/minimized window can report a ~0 viewport — clamping
  // against that "ขนาดจอ 0" stranded the dock at e.g. right:-56px (off-screen
  // for good once it became the 56px launcher). Don't clamp against lies.
  if (vw < 100 || vh < 100) return p;
  return {
    right: Math.max(8 - (w - visW), Math.min(vw - visW, p.right)),
    bottom: Math.max(8 - (h - visH), Math.min(vh - visH, p.bottom)),
  };
}

type ScriptStep = {
  mood: EveMood;
  delay: number;
  pauseAfter: number;
  html: string;
};

/**
 * Build Eve's intro from live signals. When paired we tell the operator what
 * we actually see; when not paired we keep a generic welcome.
 */
function buildIntroScript(signals: EveSignals | null): ScriptStep[] {
  const greet: ScriptStep = {
    mood: 'happy', delay: 600, pauseAfter: 1400,
    html: '<b>สวัสดีค่ะ พี่</b> ✦ Eve รายงานตัว · เป็นผู้ช่วย AI ประจำ War Room ของพี่นะคะ',
  };

  if (!signals) {
    return [
      greet,
      { mood: 'idle', delay: 300, pauseAfter: 0,
        html: 'มีอะไรให้ Eve ช่วยมั้ยคะ? ลองพิมพ์คำสั่ง หรือกดปุ่มลัดด้านล่างได้เลยค่ะ ✨' },
    ];
  }

  const f = signals.fortune;
  const a = signals.ai_pool;
  const isCrit = signals.alert.level === 'crit';
  const status: ScriptStep = {
    mood: isCrit ? 'concerned' : 'talking',
    delay: 300,
    pauseAfter: 1800,
    html: 'รายงานสด: ' + signals.alert.headline,
  };

  const detail: ScriptStep[] = [];
  if (f.stuck_paid > 0) {
    const oldest = f.oldest_stuck_paid_min ? ` (เก่าสุด ${f.oldest_stuck_paid_min} นาที)` : '';
    detail.push({
      mood: 'concerned', delay: 400, pauseAfter: 1400,
      html: `💰 <b>${f.stuck_paid} รายจ่ายแล้วยังไม่ได้คำทำนาย</b>${oldest} — ควรรีบส่ง`,
    });
  }
  if (f.lead_count > 0) {
    detail.push({
      mood: 'thinking', delay: 300, pauseAfter: 1400,
      html: `🎯 มี <b>${f.lead_count} ลีดสด</b> (เริ่มดูดวงแต่ยังไม่จ่าย) — ทักด้วย QR ราคา จะปิดได้`,
    });
  }
  if (a.providers_offline > 0) {
    detail.push({
      mood: 'concerned', delay: 300, pauseAfter: 1400,
      html: `🔌 <b>${a.providers_offline} provider offline</b> — error rate ${a.error_rate_15m_pct}% ใน 15 นาที`,
    });
  }
  if (detail.length === 0 && f.completed_15m > 0) {
    detail.push({
      mood: 'happy', delay: 300, pauseAfter: 1200,
      html: `✓ ทุกอย่างปกติ · ตอบไป ${f.completed_15m} ครั้งใน 15 นาทีล่าสุด`,
    });
  }

  const tail: ScriptStep = {
    mood: 'idle', delay: 300, pauseAfter: 0,
    html: 'มีอะไรให้ Eve ช่วยมั้ยคะ? ลองพิมพ์คำสั่ง หรือกดปุ่มลัดด้านล่างได้เลยค่ะ ✨',
  };

  return [greet, status, ...detail.slice(0, 2), tail];
}

const MOODS: EveMood[] = ['idle', 'happy', 'talking', 'thinking', 'concerned', 'surprise'];

export function Eve() {
  const pathname = usePathname();
  const eveEnabled = useSettings((s) => s.eve.enabled);
  const {
    mode, mood,
    setMode, setMood, setTyping, setAiStatus, addMessage, clearMessages,
  } = useEve();
  const introPlayed = useRef(false);

  // Live signal feed + honest connectivity badge — shared with the /eve page
  // via useEveHealth so the dock and the full page can never disagree.
  const { paired, connStatus, signals, signalsSource, health, healthDot, healthText } = useEveHealth();

  // Re-pair → forget the last chat verdict. A stale 'offline' from the dead
  // token would otherwise keep the badge amber until the first successful chat,
  // even though the operator just reconnected.
  const prevPairedRef = useRef(paired);
  useEffect(() => {
    if (!prevPairedRef.current && paired) setAiStatus('unknown');
    prevPairedRef.current = paired;
  }, [paired, setAiStatus]);

  // Track which threshold-crossings we've already announced so Eve doesn't
  // re-narrate the same alert every 30s.
  const announcedRef = useRef<{ stuck: number; offline: number }>({ stuck: 0, offline: 0 });
  useEffect(() => {
    if (!signals) return;
    const s = signals.fortune.stuck_paid;
    if (s > announcedRef.current.stuck && s > 0) {
      announcedRef.current.stuck = s;
      // Soft proactive nudge — only when expanded, otherwise just pulse mood.
      if (mode === 'open') {
        addMessage({
          role: 'eve',
          text: `💰 <b>${s} รายจ่ายแล้วยังไม่ได้คำทำนาย</b>${signals.fortune.oldest_stuck_paid_min ? ' (เก่าสุด ' + signals.fortune.oldest_stuck_paid_min + ' นาที)' : ''}`,
        });
        setMood('concerned');
      } else {
        setMood('concerned');
      }
    }
    const off = signals.ai_pool.providers_offline;
    if (off > announcedRef.current.offline && off > 0) {
      announcedRef.current.offline = off;
      if (mode === 'open') {
        addMessage({
          role: 'eve',
          text: `🔌 <b>${off} provider offline</b> — error rate ${signals.ai_pool.error_rate_15m_pct}%`,
        });
        setMood('concerned');
      }
    }
  }, [signals, mode, addMessage, setMood]);

  // Intro script — fire once per session, regardless of which page renders Eve first.
  // Waits up to ~3s for the first signals tick so the intro is data-aware.
  useEffect(() => {
    if (introPlayed.current) return;
    // If paired and we haven't loaded signals yet, give it one beat.
    if (paired && !signals && signalsSource !== 'error') return;
    introPlayed.current = true;
    let cancelled = false;
    let acc = 400;
    const script = buildIntroScript(signals);
    script.forEach((step) => {
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
  }, [setMood, setTyping, addMessage, paired, signals, signalsSource]);

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

  // Re-anchor to the default on every fresh mount; clamp in case the viewport
  // is small. No restore from storage — that's what stranded Eve off-screen.
  useEffect(() => {
    setPos((p) => clampPos(p, dockRef.current));
  }, []);

  // Re-clamp on window resize so the dock can't end up off-screen.
  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p, dockRef.current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Re-clamp whenever the dock changes shape (open ⇄ min ⇄ hidden). A position
  // that was legal for the 340px panel (allowed to hang most of itself past the
  // edge) strands the 56px launcher ENTIRELY off-screen — "กดปิดแล้วกดอีกที
  // ไม่ออกมา" because there was literally nothing left to click. useEffect runs
  // after the DOM commit, so the dock already has its new size here (no rAF —
  // rAF never fires in a backgrounded tab).
  useEffect(() => {
    setPos((p) => clampPos(p, dockRef.current));
  }, [mode]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only initiate drag on primary button + when we have a starting point.
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Explicit opt-outs: close button / minimize / mood switch / inputs.
    // Without this the pointer-capture below swallows clicks on those buttons
    // because the parent .eve-dock claims the pointer first.
    if (target.closest('[data-no-drag="true"]')) return;
    // Don't capture drags that started on a real interactive child — buttons
    // inside Eve still need to click through. The handle wrapper sets
    // data-drag-handle="true" on the area we accept drags on.
    const handle = target.closest('[data-drag-handle="true"]');
    if (!handle) return;
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRight: pos.right,
      startBottom: pos.bottom,
    };
    hasMovedRef.current = false;
    // ⚠ Do NOT setPointerCapture here. Capturing on pointerdown retargets the
    // subsequent click event to the dock (common ancestor of down/up targets),
    // so the launcher/pill onClick never fired — "กดแล้วไม่ขยายออก". Capture
    // starts only once real movement begins (see onPointerMove).
  }, [pos.right, pos.bottom]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = dragStateRef.current;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!hasMovedRef.current && Math.hypot(dx, dy) < 4) return; // ignore tiny jitter — keeps clicks working
    if (!hasMovedRef.current) {
      // Real drag begins — capture from here on so fast moves can't escape the
      // dock. A clean click never reaches this branch and stays a normal click.
      hasMovedRef.current = true;
      setIsDragging(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported — drag still works while the pointer stays inside */
      }
    }
    setPos(clampPos({ right: s.startRight - dx, bottom: s.startBottom - dy }, dockRef.current));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setPos((p) => clampPos(p, dockRef.current));
    // If the pointer barely moved we treat this as a click, not a drag.
    // The button's onClick still fires naturally because we don't preventDefault.
  }, []);

  // Hide the floating widget on the dedicated /eve page — the page itself
  // renders a full-size Eve, no need for duplication. next.config has
  // trailingSlash:true, so the exported site reports '/eve/' — strip it before
  // comparing or the dock duplicates on the page it was meant to hide on.
  if (pathname.replace(/\/+$/, '') === '/eve') return null;

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
                <span className="dot-tiny" style={{ background: healthDot, boxShadow: `0 0 6px ${healthDot}` }} />{' '}
                {healthText}
              </span>
            </span>
            {signals && signals.alert.crit > 0 && (
              <span
                className="eve-pill-badge"
                aria-label={`${signals.alert.crit} วิกฤต`}
                title={signals.alert.headline}
              >
                {signals.alert.crit}
              </span>
            )}
            <span
              role="button"
              tabIndex={0}
              className="eve-pill-close"
              data-no-drag="true"
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
                  {health === 'online' ? (
                    <>
                      <em style={{ color: '#34d399' }}>● ฟัง War Room อยู่</em>{' '}
                      {signals && (
                        <span style={{ color: signals.alert.level === 'crit' ? '#fca5a5' : signals.alert.level === 'warn' ? '#fbbf24' : '#34d399' }}>
                          · {signals.alert.headline}
                        </span>
                      )}
                    </>
                  ) : (
                    <em style={{ color: health === 'ai-down' ? '#fbbf24' : '#9ca3af' }}>
                      {health === 'ai-down'
                        ? '🔌 AI ออฟไลน์ — เชื่อมต่อ AI ไม่ได้'
                        : connStatus === 'error'
                        ? '🔌 เชื่อมต่อหลุด — ต่อใหม่ใน Settings → การเชื่อมต่อ'
                        : '○ ออฟไลน์ — ยังไม่เชื่อมต่อ'}
                    </em>
                  )}
                </small>
              </div>
              <button type="button" className="eve-head-btn" data-no-drag="true" title="ย่อ" onClick={() => setMode('min')}>
                —
              </button>
              <button type="button" className="eve-head-btn" data-no-drag="true" title="ปิด Eve" onClick={() => setMode('hidden')}>
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
