'use client';

import { useMemo, useState } from 'react';
import { APPROVAL_ITEMS, APPROVAL_STATS, APPROVAL_TABS, type ApprovalItem } from '@/lib/mock/approvals-page';
import { ChannelChip, Pill } from '@/components/ui/Pill';
import { useWarroom } from '@/lib/stores/warroom';

export default function ApprovalsPage() {
  const [items, setItems] = useState(APPROVAL_ITEMS);
  const [tab, setTab] = useState<string>('all');
  const [active, setActive] = useState<ApprovalItem | null>(items[0]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const pushToast = useWarroom((s) => s.pushToast);

  const filtered = useMemo(() => {
    if (tab === 'all') return items;
    const map: Record<string, string> = { comm: 'COMM', bill: 'BILL', refund: 'REFUND', credit: 'CREDIT' };
    return items.filter((i) => i.kind === map[tab]);
  }, [items, tab]);

  const selectedCount = useMemo(
    () => Object.entries(picked).filter(([, v]) => v).length,
    [picked],
  );

  const removeMany = (ids: string[]) => {
    setItems((arr) => arr.filter((i) => !ids.includes(i.id)));
    if (active && ids.includes(active.id)) setActive(null);
    setPicked({});
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className="dot dot-ok" />
        <span className="t-h">อนุมัติรายการ · APPROVALS</span>
      </header>

      <section className="px-3 py-2 border-b border-line shrink-0">
        <div className="grid grid-cols-5 gap-2">
          {APPROVAL_STATS.map((s) => (
            <div key={s.label} className="panel px-3 py-2">
              <div className="t-h">{s.label}</div>
              <div className="mono text-2xl font-semibold mt-1" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-2xs text-mute mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="px-3 border-b border-line flex items-center gap-1 shrink-0">
        {APPROVAL_TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2 border-b-2 text-sm flex items-center gap-2 ${
              tab === t.k ? 'text-fg border-info' : 'text-mute border-transparent hover:text-fg'
            }`}
          >
            <span>{t.label}</span>
            <Pill tone={t.tone}>{t.count}</Pill>
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-2xs text-mute">{selectedCount} เลือก</span>
        <button
          onClick={() => {
            const ids = filtered.filter((i) => picked[i.id]).map((i) => i.id);
            if (!ids.length) return;
            removeMany(ids);
            pushToast({ kind: 'ok', title: 'อนุมัติแล้ว', body: `${ids.length} รายการ` });
          }}
          disabled={!selectedCount}
          className="btn btn-ok disabled:opacity-30"
        >
          ✓ อนุมัติที่เลือก
        </button>
        <button
          onClick={() => {
            const ids = filtered.filter((i) => picked[i.id]).map((i) => i.id);
            if (!ids.length) return;
            removeMany(ids);
            pushToast({ kind: 'crit', title: 'ปฏิเสธแล้ว', body: `${ids.length} รายการ` });
          }}
          disabled={!selectedCount}
          className="btn btn-crit disabled:opacity-30"
        >
          ✕ ปฏิเสธที่เลือก
        </button>
      </div>

      <main className="flex-1 grid min-h-0 overflow-hidden" style={{ gridTemplateColumns: '1fr 380px' }}>
        <section className="overflow-y-auto">
          <table className="dense">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      const v = e.target.checked;
                      const next: Record<string, boolean> = { ...picked };
                      filtered.forEach((i) => (next[i.id] = v));
                      setPicked(next);
                    }}
                  />
                </th>
                <th>รายการ</th>
                <th>ลูกค้า/ผู้รับ</th>
                <th>ช่อง</th>
                <th className="text-right">ยอด</th>
                <th>วันที่</th>
                <th>ผู้ร้องขอ</th>
                <th className="text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr
                  key={it.id}
                  onClick={() => setActive(it)}
                  className={`cursor-pointer ${active?.id === it.id ? 'selected' : ''}`}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!!picked[it.id]}
                      onChange={(e) => setPicked((s) => ({ ...s, [it.id]: e.target.checked }))}
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Pill tone={it.tone}>{it.kind}</Pill>
                      <div>
                        <div className="text-sm text-fg">{it.title}</div>
                        <div className="text-2xs text-mute mono">{it.note}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-fg text-xs">{it.party}</td>
                  <td>
                    {it.channel && <ChannelChip channel={it.channel === 'LINE' ? 'line' : 'fb'} />}
                  </td>
                  <td className={`mono text-right font-semibold ${it.amount >= 0 ? 'text-ok' : 'text-crit'}`}>
                    {(it.amount >= 0 ? '+' : '') + '฿' + Math.abs(it.amount).toLocaleString()}
                  </td>
                  <td className="mono text-2xs text-mute">{it.when}</td>
                  <td className="text-xs text-mystic">{it.by}</td>
                  <td onClick={(e) => e.stopPropagation()} className="text-right space-x-1">
                    <button
                      className="btn btn-ok"
                      onClick={() => {
                        removeMany([it.id]);
                        pushToast({ kind: 'ok', title: 'อนุมัติแล้ว', body: it.title });
                      }}
                    >
                      ✓
                    </button>
                    <button
                      className="btn btn-crit"
                      onClick={() => {
                        removeMany([it.id]);
                        pushToast({ kind: 'crit', title: 'ปฏิเสธ', body: it.title });
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {active && (
          <aside className="border-l border-line bg-panel2/30 overflow-y-auto">
            <div className="p-4 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Pill tone={active.tone}>{active.kind}</Pill>
                  <span className="text-xs text-fg">{active.title}</span>
                </div>
                <div className="text-2xs text-mute mono">{active.id.toUpperCase()} · {active.when}</div>
              </div>
              <div className="bg-panel border border-line rounded p-3 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-mute">ผู้รับ/ลูกค้า</span><span className="text-fg">{active.party}</span></div>
                <div className="flex justify-between"><span className="text-mute">ยอด</span><span className="mono font-semibold text-fg">฿{Math.abs(active.amount).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-mute">ผู้ร้องขอ</span><span className="text-mystic">{active.by}</span></div>
                {active.channel && (
                  <div className="flex justify-between items-center">
                    <span className="text-mute">ช่อง</span>
                    <ChannelChip channel={active.channel === 'LINE' ? 'line' : 'fb'} />
                  </div>
                )}
              </div>
              <div>
                <div className="t-h mb-2">รายละเอียด</div>
                <div className="text-xs text-fg/90 leading-relaxed">{active.detail}</div>
              </div>
              {active.evidence && active.evidence.length > 0 && (
                <div>
                  <div className="t-h mb-2">หลักฐาน / context</div>
                  <div className="space-y-1.5 text-xs">
                    {active.evidence.map((e, i) => (
                      <div key={i} className="bg-panel border border-line rounded px-2 py-1.5">
                        <div className="text-2xs text-mute mono mb-0.5">{e.label}</div>
                        <div className="text-fg/90">{e.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="btn btn-ok justify-center py-2"
                  onClick={() => {
                    removeMany([active.id]);
                    pushToast({ kind: 'ok', title: 'อนุมัติแล้ว', body: active.title });
                  }}
                >
                  ✓ อนุมัติ
                </button>
                <button
                  className="btn btn-crit justify-center py-2"
                  onClick={() => {
                    removeMany([active.id]);
                    pushToast({ kind: 'crit', title: 'ปฏิเสธ', body: active.title });
                  }}
                >
                  ✕ ปฏิเสธ
                </button>
                <button className="btn justify-center py-2 col-span-2">↪ ขอข้อมูลเพิ่ม</button>
              </div>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
