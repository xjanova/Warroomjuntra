'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { adminWebUrl } from '@/lib/stores/settings';
import { useFortuneFeed, sendChatMessage, cancelReading, describeError } from '@/lib/api';
import { readingToFollowup, needsFollowup } from '@/lib/adapters/followups';
import type { Followup } from '@/lib/mock/types';

// Live followup cards carry id "r-{readingId}". Pull the numeric id so we can
// hit /chat/send + /readings/{id}/cancel. Mock cards return null → preview only.
function readingIdOf(id: string): number | null {
  const m = /^r-(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

function followupText(f: Followup): string {
  return f.status === 'await_reading'
    ? 'สวัสดีค่ะ 🙏 ขออภัยที่คำทำนายล่าช้านะคะ กำลังเร่งให้อยู่ เดี๋ยวส่งให้เร็วที่สุดเลยค่ะ ✨'
    : `สวัสดีค่ะคุณ${f.customer} 🙏 เห็นว่ามีรายการ "${f.service}" ค้างอยู่ — สนใจให้แม่หมอช่วยดูต่อไหมคะ ✨`;
}

export function FollowupStrip() {
  const [sort, setSort] = useState<'heat' | 'value'>('heat');
  const pushToast = useWarroom((s) => s.pushToast);
  const openCaseDrawer = useWarroom((s) => s.openCaseDrawer);
  const router = useRouter();
  const feed = useFortuneFeed();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [bulkSending, setBulkSending] = useState(false);

  const followups = useMemo<Followup[]>(() => {
    if (feed.source === 'live') {
      // Real: anything that needs a follow-up — both "unpaid" AND
      // "paid-but-no-reading-delivered". Cap at 20 cards so the strip doesn't
      // blow up when there's a backlog. 24h window keeps it actionable.
      const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
      return feed.data
        .filter(needsFollowup)
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

  const stuckPaidCount = useMemo(
    () => followups.filter((f) => f.status === 'await_reading').length,
    [followups],
  );

  const items = useMemo(() => sortFollowups(followups, sort), [followups, sort]);
  const total = useMemo(() => followups.reduce((s, f) => s + f.amount, 0), [followups]);

  // ── Real actions ──────────────────────────────────────────────────────────
  // Send a follow-up DM to one customer via /chat/send (reading_id routes it to
  // the right FB/LINE recipient server-side). Debounced per card.
  const pokeOne = async (f: Followup) => {
    const rid = readingIdOf(f.id);
    if (feed.source !== 'live' || rid == null) {
      pushToast({
        kind: f.status === 'await_reading' ? 'crit' : 'warn',
        title: f.status === 'await_reading' ? '⚡ เร่งคำทำนาย (ตัวอย่าง)' : 'ส่งติดตาม (ตัวอย่าง)',
        body: `${f.customer} — เชื่อมต่อ API ก่อนเพื่อส่งจริง`,
      });
      return;
    }
    if (busy[f.id]) return; // guard double-tap
    setBusy((b) => ({ ...b, [f.id]: true }));
    try {
      const res = await sendChatMessage({ reading_id: rid, text: followupText(f) });
      pushToast({
        kind: res.delivered ? 'ok' : 'warn',
        title: res.delivered ? 'ส่งติดตามแล้ว' : 'ส่งไม่ผ่าน platform',
        body: res.delivered ? f.customer : `${f.customer} — FB/LINE ปฏิเสธ ลองใหม่อีกครั้ง`,
      });
    } catch (e) {
      pushToast({ kind: 'crit', title: 'ส่งติดตามล้มเหลว', body: describeError(e) });
    } finally {
      setBusy((b) => ({ ...b, [f.id]: false }));
    }
  };

  // Cancel the underlying reading/bill via /readings/{id}/cancel, then refetch.
  const cancelOne = async (f: Followup) => {
    if (!confirm(`ยกเลิกบิลของ ${f.customer} (฿${f.amount.toLocaleString()}) ?`)) return;
    const rid = readingIdOf(f.id);
    if (feed.source !== 'live' || rid == null) {
      pushToast({ kind: 'warn', title: 'ยกเลิกบิล (ตัวอย่าง)', body: f.customer });
      return;
    }
    if (busy[f.id]) return;
    setBusy((b) => ({ ...b, [f.id]: true }));
    try {
      await cancelReading(rid, 'cancelled_from_warroom_followup');
      pushToast({ kind: 'ok', title: 'ยกเลิกบิลแล้ว', body: `${f.customer} · ${f.bill}` });
      feed.refetch?.();
    } catch (e) {
      pushToast({ kind: 'crit', title: 'ยกเลิกล้มเหลว', body: describeError(e) });
    } finally {
      setBusy((b) => ({ ...b, [f.id]: false }));
    }
  };

  // Bulk DM every live followup. Outward-facing → require explicit confirm with
  // the count, then report real delivered/failed tallies.
  const sendAll = async () => {
    const targets = items.filter((f) => readingIdOf(f.id) != null);
    if (feed.source !== 'live' || targets.length === 0) {
      pushToast({ kind: 'warn', title: 'ส่งติดตามทั้งหมด (ตัวอย่าง)', body: `${followups.length} ราย — เชื่อมต่อ API ก่อน` });
      return;
    }
    if (bulkSending) return;
    if (!confirm(`ส่งข้อความติดตามถึงลูกค้า ${targets.length} ราย?\nระบบจะ DM แต่ละคนผ่าน FB/LINE`)) return;
    setBulkSending(true);
    let ok = 0;
    let fail = 0;
    for (const f of targets) {
      const rid = readingIdOf(f.id)!;
      try {
        const res = await sendChatMessage({ reading_id: rid, text: followupText(f) });
        if (res.delivered) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    setBulkSending(false);
    pushToast({
      kind: fail === 0 ? 'ok' : ok === 0 ? 'crit' : 'warn',
      title: `ส่งติดตามแล้ว ${ok}/${targets.length} ราย`,
      body: fail > 0 ? `ส่งไม่ผ่าน ${fail} ราย` : 'สำเร็จทั้งหมด',
    });
  };

  // Hide when paired AND no real followups — keeps the dashboard clean on slow days.
  if (feed.source === 'live' && followups.length === 0) return null;

  return (
    <div className="border-b border-line bg-gradient-to-r from-warn/10 via-warn/5 to-transparent shrink-0">
      <div className="px-3 pt-2 pb-1.5 flex items-center gap-2">
        <span className="text-base">🎯</span>
        <span className="t-h text-warn">ติดตามด่วน · บิลค้าง / จ่ายแล้วยังไม่ได้คำทำนาย</span>
        <Pill tone="warn">{followups.length} คน</Pill>
        {stuckPaidCount > 0 && <Pill tone="crit">💰 {stuckPaidCount} จ่ายแล้วรอคำทำนาย</Pill>}
        <Pill tone="dim">มูลค่ารวม ฿{total.toLocaleString()}</Pill>
        <DataSourceBadge source={feed.source} isLoading={feed.isLoading} error={feed.error} />
        <span className="text-2xs text-mute">เรียงตามความร้อนของลีด — ทักก่อนเย็น</span>
        <div className="flex-1" />
        <button onClick={() => setSort(sort === 'heat' ? 'value' : 'heat')} className="btn btn-ghost text-2xs">
          เรียง: {sort === 'heat' ? 'ความร้อน' : 'มูลค่า'}
        </button>
        <button
          className="btn btn-warn text-2xs disabled:opacity-40"
          onClick={sendAll}
          disabled={bulkSending}
          title="ส่งข้อความติดตามถึงลูกค้าทุกคนในแถบนี้"
        >
          {bulkSending ? '⏳ กำลังส่ง…' : '📣 ส่งติดตามทั้งหมด'}
        </button>
      </div>

      <div className="px-3 pb-2 flex gap-2 overflow-x-auto">
        {items.map((f) => {
          const border = followupBorderColor(f);
          const isStuckPaid = f.status === 'await_reading';
          return (
            <div
              key={f.id}
              onClick={() => openCaseDrawer(f.id)}
              className="shrink-0 w-[220px] cursor-pointer group relative rounded border"
              style={{
                background: followupBg(f),
                borderColor: isStuckPaid ? '#ef4444' : border,
                boxShadow: isStuckPaid
                  ? '0 0 0 1px rgba(239,68,68,.4), 0 0 14px rgba(239,68,68,.18)'
                  : followupGlow(f),
              }}
            >
              <div
                className="absolute top-0 right-0 px-1.5 py-0.5 text-2xs font-bold mono rounded-bl"
                style={{ background: isStuckPaid ? '#ef4444' : border, color: '#0a0e17' }}
              >
                {followupHeatLabel(f)}
              </div>
              <div className="p-2.5">
                <div className="mb-1.5">
                  <span
                    className={`pill ${isStuckPaid ? 'pill-crit' : 'pill-warn'}`}
                    style={{ padding: '1px 5px', fontSize: 9 }}
                    title={isStuckPaid ? 'ลูกค้าจ่ายเงินแล้ว แต่บอทยังไม่ได้ส่งคำทำนาย — ต้องส่งให้ด่วน' : 'ลูกค้าสร้างบิลแล้ว ยังไม่ได้จ่ายเงิน — ต้องตามให้จ่าย'}
                  >
                    {isStuckPaid ? '💰 จ่ายแล้ว · รอคำทำนาย' : '⏳ รอจ่าย'}
                  </span>
                </div>
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
                  {f.vip && !isStuckPaid && (
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
                    disabled={busy[f.id]}
                    onClick={(e) => {
                      e.stopPropagation();
                      void pokeOne(f);
                    }}
                    className={`btn ${isStuckPaid ? 'btn-crit' : 'btn-warn'} flex-1 justify-center text-2xs py-1 disabled:opacity-40`}
                  >
                    {busy[f.id] ? '⏳' : isStuckPaid ? '⚡ เร่ง' : '💬 ทัก'}
                  </button>
                  {isStuckPaid ? (
                    <button
                      className="btn flex-1 justify-center text-2xs py-1"
                      title="เปิดในแอดมินเว็บเพื่อ retry คำทำนาย"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(adminWebUrl('/fortune/readings/' + f.id.replace(/^r-/, '')), '_blank', 'noopener');
                      }}
                    >
                      🔮 retry
                    </button>
                  ) : (
                    <button
                      className="btn flex-1 justify-center text-2xs py-1"
                      title="เปิดแชตเพื่อส่ง QR ชำระเงินอีกครั้ง"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/chat?thread=${encodeURIComponent(f.id)}`);
                      }}
                    >
                      ▦ QR
                    </button>
                  )}
                  <button
                    className="btn btn-ghost justify-center text-2xs py-1 px-1.5 disabled:opacity-40"
                    title="ยกเลิกบิล"
                    disabled={busy[f.id]}
                    onClick={(e) => {
                      e.stopPropagation();
                      void cancelOne(f);
                    }}
                  >
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
