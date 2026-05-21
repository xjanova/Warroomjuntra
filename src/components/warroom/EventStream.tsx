'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pill } from '@/components/ui/Pill';
import { EVENTS, EVENT_FILTERS } from '@/lib/mock/warroom';
import { cn } from '@/lib/utils';

const KIND_TO_FILTER: Record<string, string> = {
  'PAY OK': 'payment',
  'PAY ?': 'payment',
  READ: 'reading',
  SENS: 'sensitive',
  SYS: 'system',
  'AI ?': 'system',
  AUDIT: 'audit',
  BOT: 'system',
};

export function EventStream() {
  const [active, setActive] = useState<string[]>(['payment', 'reading', 'sensitive', 'system']);
  const filtered = useMemo(
    () =>
      EVENTS.filter((ev) => {
        const k = KIND_TO_FILTER[ev.kind] ?? 'audit';
        return active.includes(k);
      }),
    [active],
  );
  const toggle = (k: string) =>
    setActive((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  return (
    <section
      className="panel flex flex-col min-h-0"
      style={{ gridColumn: '1 / -1' }}
    >
      <header className="panel-h">
        <div className="title">
          <span className="dot dot-info" />
          <span className="t-h">ฟีดเหตุการณ์สด · EVENT STREAM</span>
          <Pill tone="info">+{EVENTS.length} ใหม่/นาที</Pill>
        </div>
        <div className="flex items-center gap-1.5">
          {EVENT_FILTERS.map((f) => (
            <button
              key={f.k}
              onClick={() => toggle(f.k)}
              className={cn('pill', active.includes(f.k) ? `pill-${f.tone}` : 'pill-dim')}
            >
              {f.label}
            </button>
          ))}
          <Link href="/payment" className="btn btn-info ml-2">
            → กระทบยอด
          </Link>
        </div>
      </header>
      <div className="overflow-y-auto flex-1 min-h-0 px-3 py-1 mono text-2xs leading-relaxed scanline">
        {filtered.map((ev) => (
          <div key={ev.id} className="flex items-center gap-3 py-1 border-b border-lined/40">
            <span className="text-mute shrink-0">{ev.ts}</span>
            <span className={cn('shrink-0 w-16 text-center pill', `pill-${ev.tone}`)}>{ev.kind}</span>
            <span className="text-fg/90 flex-1 truncate">{ev.msg}</span>
            <span className="text-mute shrink-0">{ev.ref}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
