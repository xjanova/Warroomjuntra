'use client';

import { useEffect, useMemo, useState } from 'react';
import { EVENT_TOGGLES, type FullEvent } from '@/lib/mock/events-page';
import { ChannelChip, Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { cn } from '@/lib/utils';
import { useWarroom } from '@/lib/stores/warroom';
import { useFortuneFeed } from '@/lib/api';
import { readingsToFullEvents } from '@/lib/adapters/events-page';

// Time-range presets for the event filter. `min: null` = no recency limit.
const RANGE_OPTIONS: Array<{ label: string; min: number | null }> = [
  { label: '5 นาทีล่าสุด', min: 5 },
  { label: '1 ชั่วโมง', min: 60 },
  { label: '24 ชั่วโมง', min: 1440 },
  { label: 'ทั้งหมดวันนี้', min: null },
];

// Events carry ts as "HH:MM:SS". Return how long ago that was (minutes), wrapping
// a "future" time back to the previous day so a fresh stream never vanishes.
function minutesAgo(tsStr: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(tsStr.trim());
  if (!m) return null; // unknown format → caller treats as "always show"
  const now = new Date();
  const evSec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0);
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  let diff = nowSec - evSec;
  if (diff < 0) diff += 86400;
  return diff / 60;
}

export default function EventsPage() {
  const feed = useFortuneFeed();
  const fromApi = useMemo<FullEvent[]>(() => readingsToFullEvents(feed.data), [feed.data]);

  // Live event list — populated from REAL readings only (no synthetic demo stream).
  const [items, setItems] = useState<FullEvent[]>([]);
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
  const [rangeMin, setRangeMin] = useState<number | null>(60);
  const frozen = useWarroom((s) => s.frozen);

  // Drive the list from REAL readings. The ▶/⏸ button (live) freezes updates so
  // the operator can read a snapshot; the global frozen flag also pauses.
  useEffect(() => {
    if (feed.source === 'live' && live && !frozen) {
      setItems(fromApi);
    }
  }, [feed.source, fromApi, live, frozen]);

  const toggle = (k: FullEvent['category']) =>
    setActive((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const filtered = useMemo(() => {
    return items.filter((e) => {
      if (!active.includes(e.category)) return false;
      if (rangeMin != null) {
        const ago = minutesAgo(e.ts);
        if (ago != null && ago > rangeMin) return false;
      }
      if (filter) {
        try {
          return new RegExp(filter, 'i').test(e.msg + e.kind);
        } catch {
          return (e.msg + e.kind).toLowerCase().includes(filter.toLowerCase());
        }
      }
      return true;
    });
  }, [items, active, filter, rangeMin]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className="dot dot-info" />
        <span className="t-h">อีเวนต์ / log · EVENT STREAM</span>
        <Pill tone={live && !frozen ? 'crit' : 'dim'}>{live && !frozen ? '🔴 LIVE' : '⏸ หยุด'}</Pill>
        <DataSourceBadge source={feed.source} isLoading={feed.isLoading} error={feed.error} />
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
        <select
          className="text-xs px-1.5 py-1"
          value={rangeMin == null ? 'all' : String(rangeMin)}
          onChange={(e) => setRangeMin(e.target.value === 'all' ? null : Number(e.target.value))}
        >
          {RANGE_OPTIONS.map((o) => (
            <option key={o.label} value={o.min == null ? 'all' : String(o.min)}>
              {o.label}
            </option>
          ))}
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
        <button
          className="btn"
          onClick={() => {
            const rows = filtered.map((ev) => ({
              ts: ev.ts, kind: ev.kind, channel: ev.channel ?? '', msg: ev.msg,
            }));
            const header = ['ts', 'kind', 'channel', 'msg'];
            const csv = [
              header.join(','),
              ...rows.map((r) => header.map((h) => JSON.stringify((r as Record<string, unknown>)[h] ?? '')).join(',')),
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `warroom-events-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }}
        >
          📥 export
        </button>
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
