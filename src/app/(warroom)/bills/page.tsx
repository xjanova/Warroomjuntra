'use client';

import { useEffect, useMemo, useState } from 'react';
import { BILLS, billStatusLabel, billStatusTone, type Bill } from '@/lib/mock/bills';
import { ChannelChip, Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { useWarroom } from '@/lib/stores/warroom';
import { useFortuneFeed, markReadingPaid, refundReading, cancelReading, describeError } from '@/lib/api';
import { useSettings, isPaired as isPairedFn } from '@/lib/stores/settings';
import { readingToBill } from '@/lib/adapters/bills';

const TONE_COLOR: Record<string, string> = {
  fg: '#e5e7eb',
  ok: '#10b981',
  warn: '#f59e0b',
  crit: '#ef4444',
  mute: '#6b7280',
  rose: '#f43f5e',
};

export default function BillsPage() {
  const feed = useFortuneFeed();
  const bills = useMemo<Bill[]>(() => {
    if (feed.source === 'live' && feed.data.length > 0) {
      return feed.data.map(readingToBill);
    }
    return BILLS;
  }, [feed.data, feed.source]);

  // Stats derived from current bill list so the tile numbers always match the table.
  const stats = useMemo(() => {
    const by = (s: Bill['status']) => bills.filter((b) => b.status === s);
    const sum = (rows: Bill[]) => rows.reduce((acc, b) => acc + b.amount, 0);
    const paid = by('paid');
    const open = by('open');
    const floating = by('floating');
    const cancelled = by('cancelled');
    const refunded = by('refunded');
    return [
      { label: 'บิลทั้งหมด', value: bills.length.toString(), tone: 'fg' as const },
      { label: 'จ่ายแล้ว', value: paid.length.toString(), tone: 'ok', sub: `฿${sum(paid).toLocaleString()}` },
      { label: 'รอจ่าย', value: open.length.toString(), tone: 'warn', sub: `฿${sum(open).toLocaleString()}` },
      { label: 'บิลลอย', value: floating.length.toString(), tone: 'crit', sub: `฿${sum(floating).toLocaleString()}` },
      { label: 'ยกเลิก', value: cancelled.length.toString(), tone: 'mute' },
      { label: 'คืนเงิน', value: refunded.length.toString(), tone: 'rose', sub: refunded.length ? `฿${sum(refunded).toLocaleString()}` : undefined },
    ];
  }, [bills]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [chanFilter, setChanFilter] = useState('');
  const [svcFilter, setSvcFilter] = useState('');
  const [active, setActive] = useState<Bill | null>(bills[0] ?? null);
  useEffect(() => {
    if (active && !bills.find((b) => b.id === active.id)) setActive(bills[0] ?? null);
    if (!active && bills.length) setActive(bills[0]);
  }, [bills, active]);
  const pushToast = useWarroom((s) => s.pushToast);
  const paired = useSettings((s) => isPairedFn(s));

  // Extract numeric reading id from "r-{id}" wrapper. Mock bills have "B-..." prefix.
  const readingIdFromBillId = (billId: string): number | null => {
    const m = /^r-(\d+)$/.exec(billId);
    return m ? Number(m[1]) : null;
  };

  const doMarkPaid = async (b: Bill) => {
    const rid = readingIdFromBillId(b.id);
    if (!paired || !rid) {
      pushToast({ kind: 'ok', title: 'มาร์คจ่ายแล้ว (mock)', body: b.id });
      return;
    }
    try {
      await markReadingPaid(rid, { amount: b.amount });
      pushToast({ kind: 'ok', title: '✓ มาร์คจ่าย', body: b.id + ' · ฿' + b.amount.toLocaleString() });
      feed.refetch?.();
    } catch (e) {
      pushToast({ kind: 'crit', title: 'มาร์คจ่ายล้มเหลว', body: describeError(e) });
    }
  };

  const doRefund = async (b: Bill, reason?: string) => {
    const rid = readingIdFromBillId(b.id);
    if (!paired || !rid) {
      pushToast({ kind: 'crit', title: 'ส่งเข้าคิวคืนเงิน (mock)', body: b.id });
      return;
    }
    try {
      await refundReading(rid, reason ?? 'admin_refund_from_warroom');
      pushToast({ kind: 'crit', title: '↺ คืนเงิน ' + b.id, body: 'ส่งเข้าคิวคืนเงินแล้ว' });
      feed.refetch?.();
    } catch (e) {
      pushToast({ kind: 'crit', title: 'คืนเงินล้มเหลว', body: describeError(e) });
    }
  };

  const doCancel = async (b: Bill) => {
    const rid = readingIdFromBillId(b.id);
    if (!confirm(`ยกเลิกบิล ${b.id} (${b.customer} · ฿${b.amount.toLocaleString()}) ?`)) return;
    if (!paired || !rid) {
      pushToast({ kind: 'crit', title: 'ยกเลิกบิล (mock)', body: b.id });
      return;
    }
    try {
      await cancelReading(rid, 'admin_cancel_from_warroom');
      pushToast({ kind: 'crit', title: '✕ ยกเลิก ' + b.id });
      feed.refetch?.();
    } catch (e) {
      pushToast({ kind: 'crit', title: 'ยกเลิกล้มเหลว', body: describeError(e) });
    }
  };

  const filtered = useMemo(
    () =>
      bills.filter((b) => {
        if (statusFilter && b.status !== statusFilter) return false;
        if (chanFilter && b.channel !== chanFilter) return false;
        if (svcFilter && b.service !== svcFilter) return false;
        if (search && !(b.id + b.customer).toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [bills, search, statusFilter, chanFilter, svcFilter],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className="dot dot-info" />
        <span className="t-h">จัดการบิล / ใบเสร็จ · BILLS</span>
        <DataSourceBadge source={feed.source} isLoading={feed.isLoading} error={feed.error} />
        <div className="flex-1" />
        <a href="/payment" className="btn">→ กระทบยอด</a>
      </header>

      <section className="px-3 py-2 border-b border-line shrink-0">
        <div className="grid grid-cols-6 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="panel px-3 py-2">
              <div className="t-h">{s.label}</div>
              <div className="mono text-2xl font-semibold mt-1" style={{ color: TONE_COLOR[s.tone] }}>{s.value}</div>
              {s.sub && <div className="text-2xs" style={{ color: TONE_COLOR[s.tone] }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      </section>

      <div className="px-3 py-2 border-b border-line flex items-center gap-2 shrink-0">
        <input
          type="text"
          placeholder="ค้นหา เลขบิล / ลูกค้า"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs px-2 py-1 w-72"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs px-1.5 py-1">
          <option value="">ทุกสถานะ</option>
          <option value="open">รอจ่าย</option>
          <option value="paid">จ่ายแล้ว</option>
          <option value="floating">บิลลอย</option>
          <option value="cancelled">ยกเลิก</option>
          <option value="refunded">คืนเงิน</option>
        </select>
        <select value={chanFilter} onChange={(e) => setChanFilter(e.target.value)} className="text-xs px-1.5 py-1">
          <option value="">ทุกช่อง</option>
          <option>FB</option>
          <option>LINE</option>
        </select>
        <select value={svcFilter} onChange={(e) => setSvcFilter(e.target.value)} className="text-xs px-1.5 py-1">
          <option value="">ทุกบริการ</option>
          <option>ดูดวงรายเดือน</option>
          <option>ทาโรต์ 3 ใบ</option>
          <option>Celtic Cross</option>
          <option>เครดิตเติม</option>
        </select>
        <div className="flex-1" />
        <button className="btn">📥 ส่งออก CSV</button>
        <button className="btn btn-primary">+ สร้างบิล</button>
      </div>

      <main className="flex-1 grid min-h-0 overflow-hidden" style={{ gridTemplateColumns: '1fr 380px' }}>
        <section className="overflow-y-auto">
          <table className="dense">
            <thead className="sticky top-0 z-10">
              <tr>
                <th>เลขบิล</th>
                <th>ลูกค้า</th>
                <th>ช่อง</th>
                <th>บริการ</th>
                <th className="text-right">ยอด</th>
                <th>สถานะ</th>
                <th>เวลา</th>
                <th className="text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => setActive(b)}
                  className={`cursor-pointer ${active?.id === b.id ? 'selected' : ''}`}
                >
                  <td className="mono text-info text-xs">{b.id}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-mystic/15 grid place-items-center text-2xs">{b.customer[0]}</div>
                      <span className="text-fg text-xs">{b.customer}</span>
                    </div>
                  </td>
                  <td>
                    <ChannelChip channel={b.channel === 'LINE' ? 'line' : 'fb'} />
                  </td>
                  <td className="text-2xs text-dim">{b.service}</td>
                  <td className="mono font-semibold text-fg text-right">฿{b.amount.toLocaleString()}</td>
                  <td>
                    <Pill tone={billStatusTone(b.status)}>{billStatusLabel(b.status)}</Pill>
                  </td>
                  <td className="mono text-2xs text-mute">{b.when}</td>
                  <td onClick={(e) => e.stopPropagation()} className="text-right space-x-1">
                    {(b.status === 'open' || b.status === 'floating') && (
                      <button className="btn btn-ok" onClick={() => void doMarkPaid(b)}>
                        มาร์คจ่าย
                      </button>
                    )}
                    {b.status === 'paid' && (
                      <button className="btn" onClick={() => void doRefund(b)} style={{ borderColor: 'rgba(244,63,94,.4)', color: '#fda4af' }}>
                        คืนเงิน
                      </button>
                    )}
                    <button className="btn" onClick={() => setActive(b)}>เปิด</button>
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
                  <span className="mono text-info text-base font-semibold">{active.id}</span>
                  <Pill tone={billStatusTone(active.status)}>{billStatusLabel(active.status)}</Pill>
                </div>
                <div className="text-2xs text-mute mono">{active.when}</div>
              </div>
              <div className="bg-panel border border-line rounded p-3 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-mute">ลูกค้า</span><span className="text-fg">{active.customer}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-mute">ช่อง</span>
                  <ChannelChip channel={active.channel === 'LINE' ? 'line' : 'fb'} />
                </div>
                <div className="flex justify-between"><span className="text-mute">บริการ</span><span className="text-fg">{active.service}</span></div>
                <div className="flex justify-between"><span className="text-mute">ยอด</span><span className="mono text-base text-fg font-semibold">฿{active.amount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-mute">วิธีจ่าย</span><span className="text-fg">QR / โอน</span></div>
                {active.paidAt && (
                  <div className="flex justify-between"><span className="text-mute">จ่ายเมื่อ</span><span className="mono text-ok">{active.paidAt}</span></div>
                )}
              </div>
              <div>
                <div className="t-h mb-2">QR Code ส่งให้ลูกค้า</div>
                <div className="bg-white rounded p-3 grid place-items-center">
                  <div
                    className="w-32 h-32"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(0deg, #000 0 4px, transparent 4px 8px), repeating-linear-gradient(90deg, #000 0 4px, transparent 4px 8px)',
                    }}
                  />
                </div>
                <div className="text-2xs text-center text-mute mt-1 mono">PromptPay · {active.id}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="btn btn-ok justify-center py-2"
                  onClick={() => void doMarkPaid(active)}
                  disabled={active.status === 'paid' || active.status === 'refunded' || active.status === 'cancelled'}
                >
                  ✓ มาร์คว่าจ่ายแล้ว
                </button>
                <button
                  className="btn justify-center py-2"
                  onClick={() => {
                    const url = `https://main.thaiprompt.online/admin/fortune/readings/${(active.id.startsWith('r-') ? active.id.slice(2) : active.id)}`;
                    window.open(url, '_blank', 'noopener');
                  }}
                >
                  📨 เปิดในแอดมินเว็บ
                </button>
                <button
                  className="btn btn-warn justify-center py-2"
                  onClick={() => {
                    const next = window.prompt('ยอดใหม่ (THB)', String(active.amount));
                    const n = next !== null ? Number(next) : NaN;
                    if (!Number.isFinite(n) || n <= 0) return;
                    // Mark-paid endpoint accepts amount override — use that as a stand-in
                    // for "edit amount + mark paid" (the only operator-facing edit we need today).
                    const rid = readingIdFromBillId(active.id);
                    if (!paired || !rid) {
                      pushToast({ kind: 'warn', title: 'แก้ยอด (mock)', body: `${active.id} → ฿${n.toLocaleString()}` });
                      return;
                    }
                    markReadingPaid(rid, { amount: n, note: 'edit_amount_from_warroom' })
                      .then(() => {
                        pushToast({ kind: 'warn', title: '✎ แก้ยอด ' + active.id, body: '฿' + n.toLocaleString() });
                        feed.refetch?.();
                      })
                      .catch((e) => pushToast({ kind: 'crit', title: 'แก้ยอดล้มเหลว', body: describeError(e) }));
                  }}
                >
                  ✎ แก้ยอด
                </button>
                <button className="btn btn-crit justify-center py-2" onClick={() => void doCancel(active)}>
                  ✕ ยกเลิกบิล
                </button>
              </div>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
