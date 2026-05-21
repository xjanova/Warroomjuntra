'use client';

import Link from 'next/link';
import { Pill } from '@/components/ui/Pill';
import { CHATS } from '@/lib/mock/warroom';
import { Switch } from '@/components/ui/Switch';
import { useState } from 'react';
import { formatSilent } from '@/lib/helpers';

export function LiveChats() {
  const [botFlags, setBotFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CHATS.map((c) => [c.id, c.bot])),
  );

  return (
    <section className="panel flex flex-col min-h-0">
      <header className="panel-h">
        <div className="title">
          <span className="dot dot-info" />
          <span className="t-h">แชตสด · LIVE CHATS</span>
          <Pill tone="info">{CHATS.length} active</Pill>
        </div>
        <Link href="/chat" className="btn btn-info">
          เปิดหน้าแชต →
        </Link>
      </header>
      <div className="overflow-y-auto flex-1 min-h-0">
        {CHATS.map((ch) => (
          <Link
            key={ch.id}
            href={`/chat?id=${ch.id}`}
            className="row block no-underline"
          >
            <div className="flex items-center gap-2 w-full">
              <div
                className={`shrink-0 w-7 h-7 rounded grid place-items-center ${
                  ch.channel === 'LINE' ? 'bg-ok/15' : 'bg-info/15'
                }`}
              >
                <span
                  className={`text-2xs font-bold mono ${
                    ch.channel === 'LINE' ? 'text-ok' : 'text-info'
                  }`}
                >
                  {ch.channel === 'LINE' ? 'L' : 'fb'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-fg truncate">{ch.name}</span>
                  {botFlags[ch.id] && <Pill tone="ok">🤖 บอท</Pill>}
                  {!botFlags[ch.id] && ch.takenBy && (
                    <Pill tone="info">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: ch.takenBy.color }}
                      />
                      {ch.takenBy.initial}
                    </Pill>
                  )}
                  {ch.sentiment === 'angry' && <Pill tone="rose">😡</Pill>}
                  {ch.sentiment === 'happy' && <Pill tone="ok">😊</Pill>}
                </div>
                <div className="text-2xs text-dim truncate mt-0.5">{ch.last}</div>
              </div>
              <div className="text-right shrink-0" onClick={(e) => e.preventDefault()}>
                <div className={`mono text-2xs ${ch.silentSec > 180 ? 'text-warn' : 'text-mute'}`}>
                  {formatSilent(ch.silentSec)}
                </div>
                <div className="mt-1">
                  <Switch
                    checked={!botFlags[ch.id]}
                    onChange={(v) => setBotFlags((s) => ({ ...s, [ch.id]: !v }))}
                  />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
