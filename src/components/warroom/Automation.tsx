'use client';

import { useEffect, useState } from 'react';
import { BOTS } from '@/lib/mock/warroom';
import { Switch } from '@/components/ui/Switch';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { useWarroom } from '@/lib/stores/warroom';
import { useAdminData, fetchAiBots, toggleAiBot, describeError } from '@/lib/api';
import { aiBotToBotCard } from '@/lib/adapters/automation';
import type { Bot } from '@/lib/mock/types';

export function Automation() {
  const pushToast = useWarroom((s) => s.pushToast);

  const live = useAdminData<Bot[]>({
    key: 'automation-bots',
    fetcher: async () => {
      const res = await fetchAiBots({ per_page: 20 });
      return res.data.map(aiBotToBotCard);
    },
    mock: BOTS,
  });

  // Local optimistic state, reset whenever upstream data changes
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(live.data.map((b) => [b.id, b.enabled]))
  );
  useEffect(() => {
    setEnabled(Object.fromEntries(live.data.map((b) => [b.id, b.enabled])));
  }, [live.data]);

  async function onToggle(id: string, v: boolean) {
    setEnabled((s) => ({ ...s, [id]: v }));
    if (live.source !== 'live') return; // mock mode — UI only
    try {
      await toggleAiBot(id);
      pushToast({ kind: v ? 'ok' : 'warn', title: v ? 'เปิดบอทแล้ว' : 'ปิดบอทแล้ว' });
      void live.refetch();
    } catch (e) {
      // revert optimistic flip
      setEnabled((s) => ({ ...s, [id]: !v }));
      pushToast({ kind: 'crit', title: 'สลับบอทไม่สำเร็จ', body: describeError(e) });
    }
  }

  async function onStopAll() {
    if (!confirm('หยุดบอททั้งหมด — แน่ใจไหม?')) return;
    setEnabled(Object.fromEntries(live.data.map((b) => [b.id, false])));
    if (live.source !== 'live') {
      pushToast({ kind: 'crit', title: 'หยุดบอททั้งหมดแล้ว (mock)' });
      return;
    }
    const targets = live.data.filter((b) => b.enabled);
    let failed = 0;
    for (const b of targets) {
      try {
        await toggleAiBot(b.id);
      } catch {
        failed += 1;
      }
    }
    pushToast({
      kind: failed ? 'warn' : 'crit',
      title: failed ? `หยุดบอทบางส่วน — ล้มเหลว ${failed}` : 'หยุดบอททั้งหมดแล้ว',
    });
    void live.refetch();
  }

  return (
    <section className="panel flex flex-col min-h-0">
      <header className="panel-h">
        <div className="title">
          <span className="dot dot-mystic" />
          <span className="t-h">ระบบอัตโนมัติ · BOTS</span>
          <DataSourceBadge source={live.source} isLoading={live.isLoading} error={live.error} />
        </div>
        <button className="btn btn-crit text-2xs" onClick={onStopAll}>
          🛑 หยุดทั้งหมด
        </button>
      </header>
      <div className="overflow-y-auto flex-1 min-h-0">
        {live.data.map((b) => (
          <div key={b.id} className="px-3 py-2 border-b border-lined">
            <div className="flex items-center gap-2 mb-1">
              <span className={`dot dot-${b.state}`} />
              <span className="text-fg text-xs flex-1 truncate">{b.name}</span>
              <Switch
                checked={enabled[b.id] ?? b.enabled}
                onChange={(v) => onToggle(b.id, v)}
              />
            </div>
            <div className="flex items-center justify-between text-2xs">
              <span className="text-mute">
                ถัดไป <span className="mono text-dim">{b.next}</span>
              </span>
              <span className="text-mute">
                ล่าสุด <span className={`mono ${b.state === 'ok' ? 'text-ok' : 'text-warn'}`}>{b.last}</span>
              </span>
            </div>
          </div>
        ))}
        {live.data.length === 0 && (
          <div className="p-6 text-center text-2xs text-mute">ยังไม่มีบอทในระบบ</div>
        )}
      </div>
    </section>
  );
}
