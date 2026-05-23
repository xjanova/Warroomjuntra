'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FLOATING_BILLS,
  LEDGER,
  OPEN_BILLS,
  PAYMENT_KPIS,
  PAYMENT_TABS,
  UNMATCHED_SMS,
  type OpenBill,
  type SmsRecord,
} from '@/lib/mock/payment';
import { ChannelChip, Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { useWarroom } from '@/lib/stores/warroom';
import { useAdminData } from '@/lib/api/useAdminData';
import {
  fetchSmsInbox,
  fetchPaymentReconStats,
  matchSms,
  rejectSms,
} from '@/lib/api';
import {
  smsInboxToRecord,
  reconStatsToKpis,
} from '@/lib/adapters/payment-page';

export default function PaymentPage() {
  const [tab, setTab] = useState<'match' | 'floating' | 'ledger'>('match');
  const [selectedSmsId, setSelectedSmsId] = useState<string | null>(null);
  const pushToast = useWarroom((s) => s.pushToast);

  // ── Live SMS inbox (pending only — what matters on this tab) ──
  const smsFeed = useAdminData({
    key: 'payment-sms-pending',
    fetcher: () => fetchSmsInbox({ status: 'pending', per_page: 50 }),
    mock: {
      data: [] as Array<unknown>,
      current_page: 1,
      last_page: 1,
      per_page: 50,
      total: 0,
    } as unknown as Awaited<ReturnType<typeof fetchSmsInbox>>,
  });

  // ── Live reconciliation stats (the 5 KPI tiles) ──
  const stats = useAdminData({
    key: 'payment-recon-stats',
    fetcher: () => fetchPaymentReconStats(),
    mock: null as unknown as Awaited<ReturnType<typeof fetchPaymentReconStats>>,
  });

  const sms: SmsRecord[] = useMemo(() => {
    if (smsFeed.source === 'live' && smsFeed.data && typeof smsFeed.data === 'object' && 'data' in smsFeed.data) {
      const items = (smsFeed.data as { data: unknown[] }).data;
      if (Array.isArray(items) && items.length && typeof items[0] === 'object' && items[0] && 'sender_or_receiver' in (items[0] as object)) {
        // Live shape — map server records to UI shape.
        return items.map((it) => smsInboxToRecord(it as Parameters<typeof smsInboxToRecord>[0]));
      }
    }
    // Mock fallback.
    return UNMATCHED_SMS;
  }, [smsFeed.source, smsFeed.data]);

  // Open bills stay mock until we add a /payment/open-bills endpoint —
  // operator can stub it in by extending PaymentReconController. The UI
  // already renders fine with mock so we keep continuity.
  const [bills, setBills] = useState<OpenBill[]>(OPEN_BILLS);
  useEffect(() => {
    // Re-seed when the user re-pairs — keeps mock fresh between sessions.
    setBills(OPEN_BILLS);
  }, []);

  const kpis = useMemo(() => {
    if (stats.source === 'live' && stats.data) {
      return reconStatsToKpis(stats.data as Parameters<typeof reconStatsToKpis>[0]);
    }
    return PAYMENT_KPIS;
  }, [stats.source, stats.data]);

  const isLive = smsFeed.source === 'live';

  const selectedSms = sms.find((s) => s.id === selectedSmsId);

  const suggestedBillIds = useMemo(() => {
    if (!selectedSms) return [] as string[];
    const target = selectedSms.amount;
    return bills
      .filter((b) => Math.abs(b.amount - target) <= 50)
      .sort((a, b) => Math.abs(a.amount - target) - Math.abs(b.amount - target))
      .slice(0, 2)
      .map((b) => b.id);
  }, [selectedSms, bills]);

  const activeMismatch = useMemo(() => {
    if (!selectedSms || !suggestedBillIds.length) return null;
    const bill = bills.find((b) => b.id === suggestedBillIds[0]);
    if (!bill) return null;
    return { sms: selectedSms, bill, delta: selectedSms.amount - bill.amount };
  }, [selectedSms, suggestedBillIds, bills]);

  // ── Live actions: match + reject ──
  const matchBill = async (billId: string) => {
    if (!selectedSmsId) return;
    const bill = bills.find((b) => b.id === billId);

    if (isLive && selectedSmsId.startsWith('sms-')) {
      const serverId = Number(selectedSmsId.replace('sms-', ''));
      try {
        const res = await matchSms(serverId);
        if (res.sms.status === 'matched') {
          pushToast({ kind: 'ok', title: 'จับคู่สำเร็จ', body: `SMS #${serverId} → bill #${res.sms.matched_transaction_id}` });
        } else {
          pushToast({ kind: 'warn', title: 'ยังไม่มีบิลตรง', body: `SMS #${serverId} ยังไม่จับคู่ได้ — รอบิลใหม่` });
        }
      } catch (e) {
        pushToast({ kind: 'crit', title: 'จับคู่ล้มเหลว', body: String((e as Error).message) });
      }
      smsFeed.refetch?.();
      stats.refetch?.();
    } else {
      // Mock branch — keep continuity for unpaired UI.
      setBills((b) => b.filter((x) => x.id !== billId));
      pushToast({ kind: 'ok', title: 'จับคู่สำเร็จ (mock)', body: bill ? `${bill.id} · ${bill.customer}` : billId });
    }
    setSelectedSmsId(null);
  };

  const rejectSelectedSms = async () => {
    if (!selectedSmsId) return;
    if (isLive && selectedSmsId.startsWith('sms-')) {
      const serverId = Number(selectedSmsId.replace('sms-', ''));
      try {
        await rejectSms(serverId, 'rejected_from_warroom');
        pushToast({ kind: 'ok', title: 'เพิกเฉย SMS แล้ว', body: `SMS #${serverId}` });
      } catch (e) {
        pushToast({ kind: 'crit', title: 'reject ล้มเหลว', body: String((e as Error).message) });
      }
      smsFeed.refetch?.();
      stats.refetch?.();
    }
    setSelectedSmsId(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className="dot dot-ok" />
        <span className="t-h">กระทบยอดการเงิน · RECONCILIATION</span>
        <DataSourceBadge source={smsFeed.source} />
        <span className="text-2xs text-mute mono">21 พ.ค. 69</span>
        <div className="flex-1" />
        <span className="text-2xs text-mute">มีเชื่อมต่อ SMS Parser</span>
        <div className="flex items-center gap-1.5 px-2 h-7 rounded border border-line">
          <span className="dot dot-ok" />
          <span className="text-2xs mono text-fg">KBANK · 14 รายการ/ชม.</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 h-7 rounded border border-warn/40 bg-warn/10">
          <span className="dot dot-warn" />
          <span className="text-2xs mono text-warn">SCB · 3 unparsed</span>
        </div>
      </header>

      <section className="px-3 py-2 border-b border-line shrink-0">
        <div className="grid grid-cols-5 gap-2">
          {kpis.map((k) => (
            <div key={k.label} className="panel px-3 py-2">
              <div className="t-h">{k.label}</div>
              <div className="mono text-2xl font-semibold mt-1" style={{ color: k.color }}>{k.value}</div>
              <div className="text-2xs mt-0.5" style={{ color: k.subColor ?? '#6b7280' }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="px-3 border-b border-line flex items-center gap-1 shrink-0">
        {PAYMENT_TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as typeof tab)}
            className={`px-4 py-2 border-b-2 text-sm flex items-center gap-2 ${
              tab === t.k ? 'text-fg border-info' : 'text-mute border-transparent hover:text-fg'
            }`}
          >
            <span>{t.label}</span>
            <Pill tone={t.tone}>{t.count}</Pill>
          </button>
        ))}
        <div className="flex-1" />
        <input type="text" placeholder="ค้นหา ชื่อ / เลขบิล / จำนวน" className="text-xs px-2 py-1 w-72 mr-2" />
        <button
          className="btn"
          onClick={() => setTab('ledger')}
        >
          📊 สมุดบัญชี
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            smsFeed.refetch?.();
            stats.refetch?.();
            pushToast({ kind: 'info', title: '⟳ ดึง SMS ใหม่', body: 'รีเฟรชจาก SMS Parser แล้ว' });
          }}
        >
          ⟳ ดึง SMS ใหม่
        </button>
      </div>

      {tab === 'match' && (
        <main className="flex-1 p-3 grid gap-3 overflow-hidden min-h-0" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <section className="panel flex flex-col min-h-0">
            <div className="panel-h">
              <div className="title">
                <span className="dot dot-info" />
                <span className="t-h">SMS เงินเข้า · UNMATCHED</span>
                <Pill tone="info">{sms.length}</Pill>
              </div>
              <span className="text-2xs text-mute">เรียงจากใหม่ → เก่า</span>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {sms.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSmsId(selectedSmsId === s.id ? null : s.id)}
                  className={`row cursor-pointer ${selectedSmsId === s.id ? 'selected' : ''}`}
                  style={selectedSmsId === s.id ? { background: 'rgba(34,211,238,.1)', boxShadow: 'inset 3px 0 0 #22d3ee' } : undefined}
                >
                  <div className={`shrink-0 w-9 h-9 rounded grid place-items-center ${s.bank === 'KBANK' ? 'bg-ok/15' : 'bg-mystic/15'}`}>
                    <span className={`text-2xs font-bold mono ${s.bank === 'KBANK' ? 'text-ok' : 'text-mystic'}`}>
                      {s.bank.slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="mono text-base font-semibold text-fg">฿{s.amount.toLocaleString()}</span>
                      <span className="text-2xs text-dim">จาก {s.sender}</span>
                      {s.bestMatchDelta === 0 && <Pill tone="ok">มีบิลตรงเป๊ะ</Pill>}
                      {s.bestMatchDelta != null && s.bestMatchDelta > 0 && s.bestMatchDelta <= 5 && (
                        <Pill tone="warn">+฿{s.bestMatchDelta}</Pill>
                      )}
                      {s.bestMatchDelta != null && s.bestMatchDelta > 5 && (
                        <Pill tone="crit">+฿{s.bestMatchDelta} ไม่ตรง</Pill>
                      )}
                      {s.bestMatchDelta === null && <Pill tone="dim">ไม่พบบิลใกล้</Pill>}
                    </div>
                    <div className="text-2xs text-mute mono mt-0.5">
                      {s.bank} xxx-{s.account} · {s.time}
                      {s.ref !== '—' && <> · ref {s.ref}</>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedSmsId === s.id) {
                        void rejectSelectedSms();
                      } else {
                        setSelectedSmsId(s.id);
                        setTimeout(() => void rejectSelectedSms(), 50);
                      }
                    }}
                    className="btn btn-crit text-2xs"
                  >
                    เพิกเฉย
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="panel flex flex-col min-h-0">
            <div className="panel-h">
              <div className="title">
                <span className="dot dot-warn" />
                <span className="t-h">บิลค้าง · OPEN INVOICES</span>
                <Pill tone="warn">{bills.length}</Pill>
              </div>
              <span className="text-2xs text-mute">เก่าสุดอยู่บนสุด</span>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              {bills.map((b) => (
                <div
                  key={b.id}
                  className={`row group ${suggestedBillIds.includes(b.id) ? 'bg-ok/10' : ''}`}
                >
                  <div className={`shrink-0 w-9 h-9 rounded grid place-items-center ${b.channel === 'LINE' ? 'bg-ok/15' : 'bg-info/15'}`}>
                    <span className={`text-2xs font-bold mono ${b.channel === 'LINE' ? 'text-ok' : 'text-info'}`}>
                      {b.channel === 'LINE' ? 'L' : 'fb'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="mono text-base font-semibold text-fg">฿{b.amount.toLocaleString()}</span>
                      <span className="text-sm text-fg truncate">{b.customer}</span>
                      {b.celtic && <Pill tone="mystic">Celtic</Pill>}
                      {suggestedBillIds.includes(b.id) && <Pill tone="info">AI แนะนำ</Pill>}
                    </div>
                    <div className="text-2xs text-mute mono mt-0.5">
                      {b.id} · รอ {b.waiting} นาที · {b.service}
                    </div>
                  </div>
                  <button
                    onClick={() => matchBill(b.id)}
                    disabled={!selectedSmsId}
                    className="btn btn-ok disabled:opacity-30"
                  >
                    จับคู่
                  </button>
                </div>
              ))}
            </div>
          </section>

          {activeMismatch && (
            <div
              className="col-span-2 panel border-info/40"
              style={{ boxShadow: '0 0 0 1px rgba(34,211,238,.3), 0 0 20px rgba(34,211,238,.12)' }}
            >
              <div className="px-4 py-3 border-b border-line flex items-center gap-3">
                <span className="dot dot-info" />
                <span className="t-h">เคสยอดไม่ตรง · MISMATCH HANDLER</span>
                <span className="text-xs text-fg">
                  SMS <span className="mono text-info">฿{activeMismatch.sms.amount.toLocaleString()}</span> ↔ บิล{' '}
                  <span className="mono text-warn">฿{activeMismatch.bill.amount.toLocaleString()}</span> · ส่วนต่าง{' '}
                  <span className={`mono font-semibold ${activeMismatch.delta > 0 ? 'text-warn' : 'text-crit'}`}>
                    {(activeMismatch.delta > 0 ? '+' : '') + '฿' + activeMismatch.delta.toLocaleString()}
                  </span>
                </span>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3">
                <button className="panel hover:border-ok/60 px-4 py-3 text-left transition border-line">
                  <div className="text-ok text-sm font-semibold mb-1">✓ ยอมรับส่วนต่าง</div>
                  <div className="text-2xs text-dim">ปิดบิลโดยถือว่ายอดต่างเป็นรายได้ (ใช้กับส่วนต่าง ≤ ฿5)</div>
                </button>
                <button className="panel hover:border-info/60 px-4 py-3 text-left transition border-line">
                  <div className="text-info text-sm font-semibold mb-1">↺ คืนส่วนต่าง</div>
                  <div className="text-2xs text-dim">
                    ปิดบิล + สร้างคำขอคืน (PromptPay) จำนวน <span className="mono">฿{Math.abs(activeMismatch.delta)}</span>
                  </div>
                </button>
                <button className="panel hover:border-mystic/60 px-4 py-3 text-left transition border-line">
                  <div className="text-mystic text-sm font-semibold mb-1">+ เติมเครดิตแทน</div>
                  <div className="text-2xs text-dim">เปลี่ยนส่วนต่างเป็นเครดิต — มูลค่า 1 บาท = 1 เครดิต</div>
                </button>
              </div>
            </div>
          )}
        </main>
      )}

      {tab === 'floating' && (
        <main className="flex-1 p-3 overflow-hidden min-h-0">
          <section className="panel flex flex-col h-full min-h-0">
            <div className="panel-h">
              <div className="title">
                <span className="dot dot-crit" />
                <span className="t-h">บิลลอย · บิลที่ลูกค้าบอกโอนแล้ว แต่ระบบไม่เจอ SMS</span>
                <Pill tone="crit">{FLOATING_BILLS.length}</Pill>
              </div>
              <div className="flex gap-1.5">
                <button className="btn">ส่งออก CSV</button>
                <button className="btn btn-warn">ตามทั้งหมด (LINE)</button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
              <table className="dense">
                <thead className="sticky top-0">
                  <tr>
                    <th>บิล</th>
                    <th>ลูกค้า</th>
                    <th>บริการ</th>
                    <th className="text-right">ยอด</th>
                    <th>ช่อง</th>
                    <th className="text-right">รอ</th>
                    <th>หลักฐานสลิป</th>
                    <th className="text-right">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {FLOATING_BILLS.map((f) => (
                    <tr key={f.id} className="hover:bg-rowhi">
                      <td className="mono text-info">{f.id}</td>
                      <td className="text-fg">{f.customer}</td>
                      <td className="text-dim">{f.service}</td>
                      <td className="mono font-semibold text-fg text-right">฿{f.amount.toLocaleString()}</td>
                      <td><ChannelChip channel={f.channel === 'LINE' ? 'line' : 'fb'} /></td>
                      <td className={`mono text-right ${f.waiting > 30 ? 'text-crit' : 'text-warn'}`}>
                        {f.waiting} นาที
                      </td>
                      <td>
                        <Pill tone={f.slip ? 'warn' : 'dim'}>
                          {f.slip ? `📎 ${f.slipNote}` : 'ไม่มี'}
                        </Pill>
                      </td>
                      <td className="text-right space-x-1">
                        <button className="btn">เปิด</button>
                        <button className="btn btn-warn">ขอสลิป</button>
                        <button className="btn btn-crit">ยกเลิก</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {tab === 'ledger' && (
        <main className="flex-1 p-3 grid gap-3 overflow-hidden min-h-0" style={{ gridTemplateColumns: '1fr 320px' }}>
          <section className="panel flex flex-col min-h-0">
            <div className="panel-h">
              <div className="title">
                <span className="dot dot-info" />
                <span className="t-h">สมุดบัญชี · LEDGER · วันนี้</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xs text-mute">21 พ.ค. 69</span>
                <button className="btn">← วันก่อน</button>
                <button className="btn">→ วันถัดไป</button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 mono text-xs">
              {LEDGER.map((l, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-1.5 border-b border-lined/50">
                  <span className="text-mute w-16 shrink-0">{l.time}</span>
                  <span className={`pill pill-${l.tone}`}>{l.kind}</span>
                  <span className="flex-1 text-fg/90 truncate">{l.desc}</span>
                  <span className={`mono w-24 text-right shrink-0 ${l.amount > 0 ? 'text-ok' : 'text-crit'}`}>
                    {(l.amount > 0 ? '+' : '') + '฿' + Math.abs(l.amount).toLocaleString()}
                  </span>
                  <span className="mono w-28 text-right text-fg shrink-0">฿{l.balance.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>

          <aside className="panel flex flex-col min-h-0">
            <div className="panel-h">
              <span className="t-h">สรุปวันนี้</span>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-dim">ยอดเข้า</span><span className="mono text-ok font-semibold">+฿48,290</span></div>
              <div className="flex justify-between"><span className="text-dim">คืนเงิน</span><span className="mono text-crit">−฿599</span></div>
              <div className="flex justify-between"><span className="text-dim">คอมมิชชั่นจ่าย</span><span className="mono text-mystic">−฿22,200</span></div>
              <div className="border-t border-line pt-3 flex justify-between">
                <span className="text-fg font-semibold">สุทธิ</span>
                <span className="mono text-fg text-base font-semibold">฿25,491</span>
              </div>
              <div className="border-t border-line pt-3">
                <div className="t-h mb-2">แยกตามช่องทาง</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-dim flex items-center gap-1.5"><span className="w-2 h-2 bg-info rounded-sm" />FB Messenger</span>
                    <span className="mono text-fg">฿28,792</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-dim flex items-center gap-1.5"><span className="w-2 h-2 bg-ok rounded-sm" />LINE OA</span>
                    <span className="mono text-fg">฿19,498</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-line pt-3">
                <div className="t-h mb-2">บริการ</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-dim">ดูดวงทั่วไป</span><span className="mono">฿18,490</span></div>
                  <div className="flex justify-between"><span className="text-dim">Celtic Cross</span><span className="mono text-mystic">฿22,485</span></div>
                  <div className="flex justify-between"><span className="text-dim">เครดิตเติม</span><span className="mono">฿7,315</span></div>
                </div>
              </div>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}
