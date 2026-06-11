'use client';

import { useEffect, useMemo, useState } from 'react';
import { APPROVAL_ITEMS, APPROVAL_TABS, type ApprovalItem } from '@/lib/mock/approvals-page';
import { ChannelChip, Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { useWarroom } from '@/lib/stores/warroom';
import {
  useAdminData,
  fetchPendingWithdrawals,
  fetchWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  batchApproveWithdrawals,
  completeWithdrawal,
  describeError,
} from '@/lib/api';
import { withdrawalToApprovalItem } from '@/lib/adapters/approvals-page';
import { CreditModal } from '@/components/warroom/CreditModal';
import { useSettings, isPaired as isPairedFn } from '@/lib/stores/settings';
import { cn } from '@/lib/utils';

export default function ApprovalsPage() {
  const live = useAdminData<ApprovalItem[]>({
    key: 'approvals-page-withdrawals',
    fetcher: async () => {
      const res = await fetchPendingWithdrawals();
      const list = Array.isArray(res) ? res : res.data;
      return list.map(withdrawalToApprovalItem);
    },
    mock: APPROVAL_ITEMS,
  });

  // Local copy lets us optimistically remove items after approve/reject.
  // Resets whenever upstream data changes.
  const [items, setItems] = useState(live.data);
  useEffect(() => setItems(live.data), [live.data]);

  const [tab, setTab] = useState<string>('all');
  const [active, setActive] = useState<ApprovalItem | null>(null);
  useEffect(() => {
    if (!active && items.length) setActive(items[0]);
    if (active && !items.find((i) => i.id === active.id)) setActive(items[0] ?? null);
  }, [items, active]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const pushToast = useWarroom((s) => s.pushToast);
  const paired = useSettings((s) => isPairedFn(s));

  // 💸 (2026-06-11) Money actions now require an explicit confirm step — the
  //   old ✓ fired approveWithdrawal instantly and ✕ used a bare window.prompt.
  const [confirm, setConfirm] = useState<{
    action: 'approve' | 'reject' | 'complete';
    items: ApprovalItem[];
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // 💳 In-app credit adjust for the selected item's customer.
  const [creditTarget, setCreditTarget] = useState<{ id: number; name: string } | null>(null);

  // 🏦 (2026-06-11) Approved-but-not-transferred queue → "✓ โอนแล้ว" closes the
  //   loop with completeWithdrawal (status approved → completed).
  const approvedFeed = useAdminData<ApprovalItem[]>({
    key: 'approvals-approved-withdrawals',
    fetcher: async () => {
      const res = await fetchWithdrawals({ status: 'approved', per_page: 50 });
      const list = Array.isArray(res) ? res : res.data;
      return list.map(withdrawalToApprovalItem);
    },
    mock: [],
  });

  const tabs = useMemo(() => {
    const count = (kind: string) =>
      kind === 'all' ? items.length : items.filter((i) => i.kind === kind).length;
    return APPROVAL_TABS.map((t) => ({
      ...t,
      count: t.k === 'all' ? items.length : count(t.k.toUpperCase()),
    }));
  }, [items]);

  // Stats derived from current items so the tile numbers match the table.
  // Mock APPROVAL_STATS hard-coded "23 รออนุมัติ" but items.length might be 10 —
  // that mismatch confused users on first load.
  const stats = useMemo(() => {
    const sum = (kind?: string) =>
      items
        .filter((i) => (kind ? i.kind === kind : true))
        .reduce((acc, i) => acc + Math.abs(i.amount), 0);
    const todayApproved: number = 0; // we don't track approved items locally yet
    return [
      {
        label: 'รออนุมัติ',
        value: items.length.toLocaleString(),
        sub: `฿${sum().toLocaleString()} รวม`,
        color: '#f59e0b',
      },
      {
        label: 'คอมมิชชั่น',
        value: `฿${sum('COMM').toLocaleString()}`,
        sub: `${items.filter((i) => i.kind === 'COMM').length} รายการ`,
        color: '#8b5cf6',
      },
      {
        label: 'คืนเงิน',
        value: `฿${sum('REFUND').toLocaleString()}`,
        sub: `${items.filter((i) => i.kind === 'REFUND').length} ราย`,
        color: '#ef4444',
      },
      {
        label: 'เครดิตพิเศษ',
        value: `฿${sum('CREDIT').toLocaleString()}`,
        sub: `${items.filter((i) => i.kind === 'CREDIT').length} ราย`,
        color: '#22d3ee',
      },
      {
        label: 'วันนี้อนุมัติแล้ว',
        value: todayApproved ? `฿${todayApproved.toLocaleString()}` : '—',
        sub: 'ยังไม่ track',
        color: '#10b981',
      },
    ];
  }, [items]);

  // Open the confirm modal (live items) or apply locally (mock / non-wd rows).
  // Real money NEVER moves without the operator reading a summary + pressing
  // ยืนยัน — the old ✓ fired the API instantly with no second look.
  function requestAction(targets: ApprovalItem[], action: 'approve' | 'reject' | 'complete') {
    if (targets.length === 0) return;
    const liveItems = targets.filter((i) => live.source === 'live' && i.id.startsWith('wd-'));
    if (liveItems.length === 0) {
      // mock-only — keep the old UI-only behavior
      const ids = new Set(targets.map((i) => i.id));
      setItems((arr) => arr.filter((i) => !ids.has(i.id)));
      setActive((a) => (a && ids.has(a.id) ? null : a));
      pushToast({
        kind: action === 'reject' ? 'crit' : 'ok',
        title: (action === 'approve' ? 'อนุมัติแล้ว' : action === 'reject' ? 'ปฏิเสธแล้ว' : 'ปิดงานแล้ว') + ' (mock)',
        body: targets[0].title,
      });
      return;
    }
    setConfirm({ action, items: liveItems });
  }

  // Operator pressed ยืนยัน in the modal → hit the API for real.
  async function executeConfirmed(reason: string) {
    if (!confirm || confirmBusy) return;
    const { action, items: targets } = confirm;
    const ids = targets.map((i) => i.id.replace(/^wd-/, ''));
    setConfirmBusy(true);
    try {
      if (action === 'approve') {
        // One batch call when approving several — the backend only touches
        // status=pending rows, so double-fires are harmless.
        if (ids.length > 1) await batchApproveWithdrawals(ids);
        else await approveWithdrawal(ids[0]);
        pushToast({ kind: 'ok', title: `อนุมัติถอนเงินแล้ว ${ids.length} รายการ`, body: targets[0].title });
      } else if (action === 'reject') {
        for (const id of ids) await rejectWithdrawal(id, reason);
        pushToast({ kind: 'crit', title: `ปฏิเสธแล้ว ${ids.length} รายการ`, body: reason.slice(0, 60) });
      } else {
        for (const id of ids) await completeWithdrawal(id, reason || undefined);
        pushToast({ kind: 'ok', title: `บันทึกโอนแล้ว ${ids.length} รายการ`, body: targets[0].title });
      }
      const removed = new Set(targets.map((i) => i.id));
      setItems((arr) => arr.filter((i) => !removed.has(i.id)));
      setActive((a) => (a && removed.has(a.id) ? null : a));
      setPicked({});
      setConfirm(null);
      void live.refetch();
      void approvedFeed.refetch();
    } catch (e) {
      pushToast({
        kind: 'crit',
        title: action === 'approve' ? 'อนุมัติไม่สำเร็จ' : action === 'reject' ? 'ปฏิเสธไม่สำเร็จ' : 'บันทึกโอนไม่สำเร็จ',
        body: describeError(e),
      });
      // Keep the modal open — partial bulk failures need a refetch to resync.
      void live.refetch();
      void approvedFeed.refetch();
    } finally {
      setConfirmBusy(false);
    }
  }

  const filtered = useMemo(() => {
    if (tab === 'all') return items;
    const map: Record<string, string> = { comm: 'COMM', bill: 'BILL', refund: 'REFUND', credit: 'CREDIT' };
    return items.filter((i) => i.kind === map[tab]);
  }, [items, tab]);

  const selectedCount = useMemo(
    () => Object.entries(picked).filter(([, v]) => v).length,
    [picked],
  );

  function bulkAction(action: 'approve' | 'reject') {
    const targets = filtered.filter((i) => picked[i.id]);
    requestAction(targets, action);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-12 flex items-center border-b border-line bg-panel2/40 px-3 gap-3 shrink-0">
        <span className="dot dot-ok" />
        <span className="t-h">อนุมัติรายการ · APPROVALS</span>
        <DataSourceBadge source={live.source} isLoading={live.isLoading} error={live.error} />
        {live.error && <span className="text-2xs text-crit mono">{live.error}</span>}
      </header>

      <section className="px-3 py-2 border-b border-line shrink-0">
        <div className="grid grid-cols-5 gap-2">
          {stats.map((s) => (
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

      {/* 🏦 (2026-06-11) Approved → waiting for the actual bank transfer. The
          flow used to dead-end at "approve"; โอนแล้ว calls completeWithdrawal. */}
      {approvedFeed.source === 'live' && approvedFeed.data.length > 0 && (
        <section className="px-3 py-2 border-b border-line bg-ok/5 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="t-h text-ok shrink-0">🏦 อนุมัติแล้ว · รอโอนจริง {approvedFeed.data.length} รายการ</span>
            <div className="flex-1" />
            <button
              className="btn btn-ok text-2xs"
              onClick={() => requestAction(approvedFeed.data, 'complete')}
            >
              ✓ โอนครบทั้งหมดแล้ว
            </button>
          </div>
          <div className="flex gap-1.5 mt-1.5 overflow-x-auto pb-0.5">
            {approvedFeed.data.map((w) => (
              <div
                key={w.id}
                className="shrink-0 border border-ok/30 bg-panel rounded px-2 py-1.5 text-2xs flex items-center gap-2"
              >
                <div>
                  <div className="text-fg">{w.party}</div>
                  <div className="mono text-warn">฿{Math.abs(w.amount).toLocaleString()}</div>
                  <div className="text-mute mono">{w.note}</div>
                </div>
                <button
                  className="btn btn-ok text-2xs py-0.5"
                  title="บันทึกว่าโอนเงินให้ลูกค้าแล้ว"
                  onClick={() => requestAction([w], 'complete')}
                >
                  ✓ โอนแล้ว
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="px-3 border-b border-line flex items-center gap-1 shrink-0">
        {tabs.map((t) => (
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
          onClick={() => bulkAction('approve')}
          disabled={!selectedCount}
          className="btn btn-ok disabled:opacity-30"
        >
          ✓ อนุมัติที่เลือก
        </button>
        <button
          onClick={() => bulkAction('reject')}
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
                    <button className="btn btn-ok" onClick={() => requestAction([it], 'approve')}>
                      ✓
                    </button>
                    <button className="btn btn-crit" onClick={() => requestAction([it], 'reject')}>
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
                  onClick={() => requestAction([active], 'approve')}
                >
                  ✓ อนุมัติ
                </button>
                <button
                  className="btn btn-crit justify-center py-2"
                  onClick={() => requestAction([active], 'reject')}
                >
                  ✕ ปฏิเสธ
                </button>
                <button
                  className="btn justify-center py-2"
                  disabled={!paired || active.userId == null}
                  title={active.userId == null ? 'ไม่ทราบ user id ของรายการนี้' : 'เติม/หักเครดิตลูกค้าคนนี้'}
                  onClick={() => {
                    if (active.userId != null) setCreditTarget({ id: active.userId, name: active.party });
                  }}
                >
                  💳 + เครดิต
                </button>
                <button
                  className="btn justify-center py-2"
                  onClick={() => {
                    // Wallet detail in admin web. Old code stripped `w-` off a
                    // `wd-…` id → linked to user "d-5"; use the real userId now.
                    const target = active.userId ?? '';
                    window.open('https://main.thaiprompt.online/admin/wallets' + (target ? '?user=' + target : ''), '_blank', 'noopener');
                  }}
                >
                  ↪ ขอข้อมูลเพิ่ม
                </button>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* 💸 (2026-06-11) Confirm-before-money modal (single + bulk). */}
      {confirm && (
        <ConfirmActionModal
          action={confirm.action}
          items={confirm.items}
          busy={confirmBusy}
          onClose={() => !confirmBusy && setConfirm(null)}
          onConfirm={(reason) => void executeConfirmed(reason)}
        />
      )}

      {/* 💳 (2026-06-11) In-app credit adjust for the selected customer. */}
      {creditTarget && (
        <CreditModal
          userId={creditTarget.id}
          customerName={creditTarget.name}
          onClose={() => setCreditTarget(null)}
        />
      )}
    </div>
  );
}

// 💸 (2026-06-11) Confirmation before any money-moving call. Shows who/how
// much/total; reject requires a reason (it lands in the customer-facing record).
function ConfirmActionModal({
  action,
  items,
  busy,
  onClose,
  onConfirm,
}: {
  action: 'approve' | 'reject' | 'complete';
  items: ApprovalItem[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const total = items.reduce((acc, i) => acc + Math.abs(i.amount), 0);
  const meta = {
    approve: { icon: '✓', title: 'อนุมัติถอนเงิน', btn: 'btn-ok', accent: 'border-ok/40', note: 'เงินจะถูกอนุมัติให้ถอน — ตรวจบัญชีรับโอนก่อนยืนยัน' },
    reject: { icon: '✕', title: 'ปฏิเสธคำขอถอน', btn: 'btn-crit', accent: 'border-crit/40', note: 'ลูกค้าจะเห็นเหตุผลที่ปฏิเสธ' },
    complete: { icon: '🏦', title: 'บันทึกว่าโอนแล้ว', btn: 'btn-ok', accent: 'border-ok/40', note: 'ยืนยันว่าโอนเงินเข้าบัญชีลูกค้าเรียบร้อยแล้ว (ปิดงาน)' },
  }[action];
  const reasonRequired = action === 'reject';
  const canConfirm = !busy && (!reasonRequired || reason.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <div
        className={cn('panel w-[460px] max-w-[92vw] p-4 border', meta.accent)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="text-2xl">{meta.icon}</div>
          <div className="flex-1">
            <div className="text-base font-semibold text-fg">
              {meta.title} · {items.length} รายการ · ฿{total.toLocaleString()}
            </div>
            <div className="text-2xs text-mute mt-0.5">{meta.note}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost text-mute" title="ปิด" disabled={busy}>
            ✕
          </button>
        </div>

        <div className="max-h-[200px] overflow-y-auto space-y-1 mb-3">
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-2 bg-panel border border-line rounded px-2 py-1.5 text-xs">
              <span className="flex-1 text-fg truncate">{i.party}</span>
              <span className="text-2xs text-mute mono truncate max-w-[160px]">{i.note}</span>
              <span className="mono font-semibold text-warn shrink-0">฿{Math.abs(i.amount).toLocaleString()}</span>
            </div>
          ))}
        </div>

        {action !== 'approve' && (
          <>
            <div className="text-2xs text-mute mb-1.5">
              {action === 'reject' ? 'เหตุผลที่ปฏิเสธ (บังคับ)' : 'โน้ต (ไม่บังคับ เช่น เลขอ้างอิงสลิป)'}
            </div>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={action === 'reject' ? 'เช่น บัญชีรับโอนไม่ตรงชื่อ / ยอดผิดเงื่อนไข' : 'เช่น โอนผ่าน KBANK 21:30'}
              className="w-full px-2 py-1.5 text-xs mb-3"
              maxLength={500}
            />
          </>
        )}

        <div className="flex items-center gap-2">
          <button onClick={onClose} className="btn btn-ghost flex-1 justify-center" disabled={busy}>
            ยกเลิก
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={!canConfirm}
            className={cn('btn flex-1 justify-center disabled:opacity-40', meta.btn)}
          >
            {busy ? 'กำลังทำ...' : `${meta.icon} ยืนยัน${items.length > 1 ? ` ${items.length} รายการ` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
