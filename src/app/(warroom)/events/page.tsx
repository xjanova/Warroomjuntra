'use client';

import { useEffect, useMemo, useState } from 'react';
import { EVENT_TOGGLES, FULL_EVENTS, type FullEvent } from '@/lib/mock/events-page';
import { ChannelChip, Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/utils';
import { useWarroom } from '@/lib/stores/warroom';

const SAMPLES: Pick<FullEvent, 'kind' | 'tone' | 'category' | 'channel' | 'msg'>[] = [
  { kind: 'PAY OK', tone: 'ok', category: 'payment', channel: 'FB', msg: 'รับโอน ฿299 · บิลใหม่' },
  { kind: 'READ', tone: 'info', category: 'reading', channel: 'LINE', msg: 'เริ่มดูดวง · qwen-72b' },
  { kind: 'BOT', tone: 'mystic', category: 'bot', msg: 'บอทตอบสำเร็จ · 1.2s' },
  { kind: 'SYS', tone: 'warn', category: 'system', msg: 'AI gemini latency 320ms' },
];

export default function EventsPage() {
  const [items, setItems] = useState<FullEvent[]>(FULL_EVENTS);
  const [live, setLive] = useState(true);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState<FullEvent['category'][]>([
    'payment',
    'reading',
    'sensitive',
    'system',
    'bot',
    'audit',
    'moderation',
  ]);
  const frozen = useWarroom((s) => s.frozen);

  useEffect(() => {
    if (!live || frozen) return;
    const id = setInterval(() => {
      const sample = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      const ev: FullEvent = {
        id: Date.now(),
        ts: `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
        ref: '#' + Math.floor(Math.random() * 9000 + 1000),
        ...sample,
      };
      setItems((arr) => [ev, ...arr].slice(0, 100));
    }, 2000);
    return () => clearInterval(id);
  }, [live, frozen]);

  const toggle = (k: FullEvent['category']) =>
    setActive((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const filtered = useMemo(() => {
    return items.filter((e) => {
      if (!active.includes(e.category)) return false;
      if (filter) {
        try {
          return new RegExp(filter, 'i').test(e.msg + e.kind);
        } catch {
          return (e.msg + e.kind).toLowerCase().includes(filter.toLowerCase());
        }
      }
      return true;
    });
  }, [items, active, filter]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className="dot dot-info" />
        <span className="t-h">อีเวนต์ / log · EVENT STREAM</span>
        <Pill tone={live && !frozen ? 'crit' : 'dim'}>{live && !frozen ? '🔴 LIVE' : '⏸ หยุด'}</Pill>
        <div className="flex-1" />
        <button onClick={() => setLive((v) => !v)} className={live ? 'btn btn-crit' : 'btn'}>
          {live ? '⏸ หยุดสตรีม' : '▶ สตรีมสด'}
        </button>
      </header>

      <div className="px-3 py-2 border-b border-line flex items-center gap-2 flex-wrap shrink-0">
        <input
          type="text"
          placeholder="ค้นหา (regex รองรับ)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-xs px-2 py-1 w-72"
        />
        <span className="text-2xs text-mute">ช่วงเวลา:</span>
        <select className="text-xs px-1.5 py-1">
          <option>5 นาทีล่าสุด</option>
          <option>1 ชั่วโมง</option>
          <option>24 ชั่วโมง</option>
          <option>วันนี้</option>
          <option>ระบุเอง</option>
        </select>
        <div className="w-px h-6 bg-line" />
        {EVENT_TOGGLES.map((t) => (
          <button
            key={t.k}
            onClick={() => toggle(t.k)}
            className={cn('pill', active.includes(t.k) ? `pill-${t.tone}` : 'pill-dim')}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-2xs text-mute">
          แสดง {filtered.length} / {items.length} รายการ
        </span>
        <button className="btn">📥 export</button>
      </div>

      <main className="flex-1 overflow-hidden">
        <div className="overflow-y-auto h-full mono text-xs leading-relaxed scanline">
          {filtered.map((ev) => (
            <div key={ev.id} className="flex items-start gap-3 px-3 py-1 border-b border-lined/40 hover:bg-rowhi">
              <span className="text-mute shrink-0 mono">{ev.ts}</span>
              <span className={cn('shrink-0 w-20 text-center pill', `pill-${ev.tone}`)}>{ev.kind}</span>
              {ev.channel && (
                <span className="shrink-0">
                  <ChannelChip channel={ev.channel === 'LINE' ? 'line' : 'fb'} />
                </span>
              )}
              <span className="text-fg/90 flex-1">{ev.msg}</span>
              {ev.actor && <span className="text-mystic text-2xs shrink-0">{ev.actor}</span>}
              <span className="text-mute shrink-0">{ev.ref}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
