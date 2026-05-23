'use client';

import { useMemo, useState } from 'react';
import { Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { FOLLOWUPS } from '@/lib/mock/warroom';
import {
  followupBg,
  followupBorderColor,
  followupGlow,
  followupHeatLabel,
  followupHeatPct,
  sortFollowups,
} from '@/lib/helpers';
import { useWarroom } from '@/lib/stores/warroom';
import { useFortuneFeed } from '@/lib/api';
import { readingToFollowup } from '@/lib/adapters/followups';
import type { Followup } from '@/lib/mock/types';

export function FollowupStrip() {
  const [sort, setSort] = useState<'heat' | 'value'>('heat');
  const pushToast = useWarroom((s) => s.pushToast);
  const feed = useFortuneFeed();

  const followups = useMemo<Followup[]>(() => {
    if (feed.source === 'live') {
      // Real: unpaid + still actively engaged (last 24h). Cap at 20 cards so
      // the strip doesn't blow up when there's a backlog.
      const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
      return feed.data
        .filter((r) => !r.is_paid && !r.paid_at)
        .filter((r) => {
          const ts = r.created_at ? new Date(r.created_at).getTime() : 0;
          return ts >= cutoffMs;
        })
        .map(readingToFollowup)
        .slice(0, 20);
    }
    // Mock fallback while unpaired so the panel previews correctly.
    return FOLLOWUPS;
  }, [feed.data, feed.source]);

  const items = useMemo(() => sortFollowups(followups, sort), [followups, sort]);
  const total = useMemo(() => followups.reduce((s, f) => s + f.amount, 0), [followups]);

  // Hide when paired AND no real followups — keeps the dashboard clean on slow days.
  if (feed.source === 'live' && followups.length === 0) return null;

  return (
    <div className="border-b border-line bg-gradient-to-r from-warn/10 via-warn/5 to-transparent shrink-0">
      <div className="px-3 pt-2 pb-1.5 flex items-center gap-2">
        <span className="text-base">🎯</span>
        <span className="t-h text-warn">ติดตามด่วน · ลูกค้าสร้างบิลแล้ว ยังไม่จ่าย</span>
        <Pill tone="warn">{followups.length} คน</Pill>
        <Pill tone="dim">มูลค่ารวม ฿{total.toLocaleString()}</Pill>
        <DataSourceBadge source={feed.source} isLoading={feed.isLoading} error={feed.error} />
        <span className="text-2xs text-mute">เรียงตามความร้อนของลีด — ทักก่อนเย็น</span>
        <div className="flex-1" />
        <button onClick={() => setSort(sort === 'heat' ? 'value' : 'heat')} className="btn btn-ghost text-2xs">
          เรียง: {sort === 'heat' ? 'ความร้อน' : 'มูลค่า'}
        </button>
        <button
          className="btn btn-warn text-2xs"
          onClick={() => pushToast({ kind: 'warn', title: 'ส่งติดตามแล้ว', body: `${followups.length} ราย` })}
        >
          📣 ส่งติดตามทั้งหมด
        </button>
      </div>

      <div className="px-3 pb-2 flex gap-2 overflow-x-auto">
        {items.map((f) => {
          const border = followupBorderColor(f);
          return (
            <div
              key={f.id}
              className="shrink-0 w-[220px] cursor-pointer group relative rounded border"
              style={{
                background: followupBg(f),
                borderColor: border,
                boxShadow: followupGlow(f),
              }}
            >
              <div
                className="absolute top-0 right-0 px-1.5 py-0.5 text-2xs font-bold mono rounded-bl"
                style={{ background: border, color: '#0a0e17' }}
              >
                {followupHeatLabel(f)}
              </div>
              <div className="p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`shrink-0 w-6 h-6 rounded grid place-items-center ${f.channel === 'LINE' ? 'bg-ok/15' : 'bg-info/15'}`}>
                    <span className={`text-2xs font-bold mono ${f.channel === 'LINE' ? 'text-ok' : 'text-info'}`}>
                      {f.channel === 'LINE' ? 'L' : 'fb'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-fg truncate">{f.customer}</div>
                    <div className="text-2xs text-mute truncate">{f.service}</div>
                  </div>
                  {f.vip && (
                    <span className="pill pill-mystic" style={{ padding: '1px 4px', fontSize: 9 }}>
                      VIP
                    </span>
                  )}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="mono font-semibold text-fg" style={{ fontSize: 18, lineHeight: 1 }}>
                      ฿{f.amount.toLocaleString()}
                    </div>
                    <div className="text-2xs text-dim mono mt-0.5">{f.bill}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xs text-mute">เงียบ</div>
                    <div className="mono font-semibold" style={{ color: border, fontSize: 13 }}>
                      {f.silentMin} นาที
                    </div>
                  </div>
                </div>
                <div className="mt-2 h-1 rounded-full overflow-hidden bg-panel2">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${followupHeatPct(f)}%`,
                      background: `linear-gradient(90deg, ${border}, ${border}88)`,
                    }}
                  />
                </div>
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      pushToast({ kind: 'warn', title: 'ส่งติดตามแล้ว', body: f.customer });
                    }}
                    className="btn btn-warn flex-1 justify-center text-2xs py-1"
                  >
                    💬 ทัก
                  </button>
                  <button className="btn flex-1 justify-center text-2xs py-1" title="ส่ง QR อีกครั้ง" onClick={(e) => e.stopPropagation()}>
                    ▦ QR
                  </button>
                  <button className="btn btn-ghost justify-center text-2xs py-1 px-1.5" title="ยกเลิกบิล" onClick={(e) => e.stopPropagation()}>
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
