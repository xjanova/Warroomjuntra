'use client';

import { useEffect, useState } from 'react';
import { BOT_CARDS, BOT_STATS, type BotCard } from '@/lib/mock/bots-page';
import { Switch } from '@/components/ui/Switch';
import { Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { useWarroom } from '@/lib/stores/warroom';
import { useAdminData, fetchAiBots, toggleAiBot, testAiBot, describeError } from '@/lib/api';
import { aiBotToBotCardFull } from '@/lib/adapters/bots-page';

export default function BotsPage() {
  const pushToast = useWarroom((s) => s.pushToast);

  const live = useAdminData<BotCard[]>({
    key: 'bots-page',
    fetcher: async () => {
      const res = await fetchAiBots({ per_page: 30 });
      return res.data.map((b, i) => aiBotToBotCardFull(b, i));
    },
    mock: BOT_CARDS,
  });

  const [bots, setBots] = useState<BotCard[]>(live.data);
  useEffect(() => setBots(live.data), [live.data]);
  const enabledCount = bots.filter((b) => b.enabled).length;

  async function setEnabled(id: number, enabled: boolean) {
    setBots((arr) => arr.map((b) => (b.id === id ? { ...b, enabled } : b)));
    if (live.source !== 'live') return;
    try {
      await toggleAiBot(id);
      void live.refetch();
    } catch (e) {
      setBots((arr) => arr.map((b) => (b.id === id ? { ...b, enabled: !enabled } : b)));
      pushToast({ kind: 'crit', title: 'สลับบอทไม่สำเร็จ', body: describeError(e) });
    }
  }

  async function emergencyStop() {
    if (!window.confirm('หยุดบอทอัตโนมัติทั้งหมดทันที?')) return;
    if (live.source !== 'live') {
      setBots((arr) => arr.map((b) => ({ ...b, enabled: false })));
      pushToast({ kind: 'crit', title: '🛑 หยุดบอททั้งหมด (mock)', body: `${bots.length} ตัว` });
      return;
    }
    const targets = bots.filter((b) => b.enabled);
    let failed = 0;
    for (const b of targets) {
      try {
        await toggleAiBot(b.id);
      } catch {
        failed += 1;
      }
    }
    pushToast({
      kind: 'crit',
      title: failed ? `หยุดบางส่วน — ล้มเหลว ${failed}` : '🛑 หยุดบอททั้งหมด',
      body: `${targets.length - failed} / ${targets.length}`,
    });
    void live.refetch();
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className="dot dot-ok" />
        <span className="t-h">บอท / อัตโนมัติ · BOTS</span>
        <Pill tone="info">{enabledCount} / {bots.length} เปิด</Pill>
        <DataSourceBadge source={live.source} isLoading={live.isLoading} error={live.error} />
        <div className="flex-1" />
        <button onClick={emergencyStop} className="btn btn-crit">🛑 หยุดทั้งหมดฉุกเฉิน</button>
      </header>

      <section className="px-3 py-2 border-b border-line shrink-0">
        <div className="grid grid-cols-5 gap-2">
          {BOT_STATS.map((s) => (
            <div key={s.label} className="panel px-3 py-2">
              <div className="t-h">{s.label}</div>
              <div className="mono text-2xl font-semibold mt-1" style={{ color: s.color }}>
                {s.dyn ? enabledCount : s.value}
              </div>
              {s.sub && <div className="text-2xs text-mute mt-0.5">{s.sub}</div>}
            </div>
          ))}
        </div>
      </section>

      <main
        className="flex-1 p-3 grid gap-3 min-h-0 overflow-y-auto"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}
      >
        {bots.map((b) => (
          <div
            key={b.id}
            className={`panel relative overflow-hidden ${
              b.state === 'warn' ? 'border-warn/40' : b.state === 'crit' ? 'border-crit/40' : ''
            }`}
          >
            <div className="p-3 border-b border-line">
              <div className="flex items-start gap-2">
                <div
                  className="w-9 h-9 rounded grid place-items-center shrink-0"
                  style={{ background: `${b.color}22`, border: `1px solid ${b.color}44`, color: b.color }}
                >
                  <span className="text-base">{b.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-fg truncate">{b.name}</span>
                    <span className={`dot dot-${b.state}`} />
                  </div>
                  <div className="text-2xs text-mute mt-0.5">{b.desc}</div>
                </div>
                <Switch checked={b.enabled} onChange={(v) => setEnabled(b.id, v)} />
              </div>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-mute text-2xs">รอบถัดไป</div>
                <div className="mono text-fg">{b.next}</div>
              </div>
              <div>
                <div className="text-mute text-2xs">รอบล่าสุด</div>
                <div className={`mono ${b.state === 'ok' ? 'text-ok' : 'text-warn'}`}>{b.last}</div>
              </div>
              <div>
                <div className="text-mute text-2xs">สำเร็จ</div>
                <div className="mono text-ok">{b.success}%</div>
              </div>
              <div>
                <div className="text-mute text-2xs">รัน 7 วัน</div>
                <div className="mono text-fg">{b.runs7d}</div>
              </div>
            </div>
            <div className="px-3 pb-3">
              <svg className="w-full" width="100%" height={32} viewBox="0 0 200 32" preserveAspectRatio="none">
                <path d={b.spark} fill="none" stroke={b.color} strokeWidth={1.5} strokeLinejoin="round" />
                <path d={`${b.spark} L 200 32 L 0 32 Z`} fill={b.color} opacity={0.1} />
              </svg>
            </div>
            <div className="px-3 pb-3 flex gap-1">
              <button
                className="btn flex-1 justify-center"
                onClick={async () => {
                  if (live.source !== 'live') {
                    pushToast({ kind: 'info', title: 'รันบอท (mock)', body: b.name });
                    return;
                  }
                  pushToast({ kind: 'info', title: 'รัน ' + b.name, body: 'กำลังทดสอบ...' });
                  try {
                    const res = await testAiBot(b.id);
                    if (res.ok) {
                      pushToast({
                        kind: 'ok',
                        title: '✓ บอทตอบกลับ ' + (res.latency_ms ?? '?') + 'ms',
                        body: (res.output ?? '').slice(0, 120),
                      });
                    } else {
                      pushToast({ kind: 'crit', title: '✗ บอทล้มเหลว', body: res.error ?? 'ไม่ทราบสาเหตุ' });
                    }
                  } catch (e) {
                    pushToast({ kind: 'crit', title: 'รันบอทล้มเหลว', body: describeError(e) });
                  }
                }}
              >
                ▶ รันเลย
              </button>
              <button
                className="btn flex-1 justify-center"
                onClick={() => {
                  // /admin/ai/bots/{id} จะ trigger admin web log page เปิดใน tab ใหม่
                  const baseUrl = new URL(((document.querySelector('a[href="/"]') as HTMLAnchorElement)?.href) || location.origin);
                  // Open thaiprompt admin web log viewer for this bot (no separate endpoint —
                  // ai_bots log lives in the existing admin web UI under /admin/ai/bots/{id})
                  window.open('https://main.thaiprompt.online/admin/ai/bots/' + b.id, '_blank', 'noopener');
                }}
              >
                📜 log
              </button>
              <button
                className="btn flex-1 justify-center"
                onClick={() => {
                  window.open('https://main.thaiprompt.online/admin/ai/bots/' + b.id + '/edit', '_blank', 'noopener');
                }}
              >
                ⚙ แก้
              </button>
            </div>
          </div>
        ))}
        {bots.length === 0 && (
          <div className="col-span-full text-center text-2xs text-mute p-12">ยังไม่มีบอทในระบบ</div>
        )}
      </main>
    </div>
  );
}
