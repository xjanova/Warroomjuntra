'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { CHATS } from '@/lib/mock/warroom';
import { Switch } from '@/components/ui/Switch';
import { formatSilent } from '@/lib/helpers';
import { useFortuneFeed } from '@/lib/api';
import { readingToChat } from '@/lib/adapters/livechats';
import { useMemo } from 'react';
import type { Chat } from '@/lib/mock/types';

export function LiveChats() {
  const feed = useFortuneFeed();
  const chats = useMemo<Chat[]>(() => {
    if (feed.source === 'mock' || (feed.source === 'loading' && feed.data.length === 0)) {
      return CHATS;
    }
    return feed.data.slice(0, 12).map(readingToChat);
  }, [feed.data, feed.source]);
  const live = { ...feed, data: chats };

  const [botFlags, setBotFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(live.data.map((c) => [c.id, c.bot]))
  );
  useEffect(() => {
    setBotFlags(Object.fromEntries(live.data.map((c) => [c.id, c.bot])));
  }, [live.data]);

  return (
    <section className="panel flex flex-col min-h-0">
      <header className="panel-h">
        <div className="title">
          <span className="dot dot-info" />
          <span className="t-h">แชตสด · LIVE CHATS</span>
          <Pill tone="info">{live.data.length} active</Pill>
          <DataSourceBadge source={live.source} isLoading={live.isLoading} error={live.error} />
        </div>
        <Link href="/chat" className="btn btn-info">
          เปิดหน้าแชต →
        </Link>
      </header>
      <div className="overflow-y-auto flex-1 min-h-0">
        {live.data.map((ch) => (
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
        {live.data.length === 0 && (
          <div className="p-6 text-center text-2xs text-mute">ยังไม่มีแชตในตอนนี้</div>
        )}
      </div>
    </section>
  );
}
