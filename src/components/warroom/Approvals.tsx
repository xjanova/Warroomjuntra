'use client';

import { useState } from 'react';
import { Pill } from '@/components/ui/Pill';
import { DataSourceBadge } from '@/components/ui/DataSourceBadge';
import { APPROVALS } from '@/lib/mock/warroom';
import { useWarroom } from '@/lib/stores/warroom';
import {
  useAdminData,
  fetchPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  describeError,
} from '@/lib/api';
import { withdrawalToApproval } from '@/lib/adapters/approvals';
import type { Approval } from '@/lib/mock/types';

export function Approvals() {
  const pushToast = useWarroom((s) => s.pushToast);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const live = useAdminData<Approval[]>({
    key: 'approvals-withdrawals',
    fetcher: async () => {
      const res = await fetchPendingWithdrawals();
      const items = Array.isArray(res) ? res : res.data;
      return items.map(withdrawalToApproval);
    },
    mock: APPROVALS,
  });

  const approvals = live.data;
  const selectAll = () =>
    setPicked(Object.fromEntries(approvals.map((a) => [a.id, true])));

  async function callApprove(id: string) {
    const numericId = id.replace(/^wd-/, '');
    if (live.source !== 'live') {
      pushToast({ kind: 'ok', title: 'อนุมัติแล้ว (mock)' });
      return;
    }
    try {
      await approveWithdrawal(numericId);
      pushToast({ kind: 'ok', title: 'อนุมัติถอนเงินแล้ว' });
      void live.refetch();
    } catch (e) {
      pushToast({ kind: 'crit', title: 'อนุมัติไม่สำเร็จ', body: describeError(e) });
    }
  }

  async function callReject(id: string) {
    const numericId = id.replace(/^wd-/, '');
    const reason = prompt('เหตุผลที่ปฏิเสธ?') ?? '';
    if (!reason.trim()) return;
    if (live.source !== 'live') {
      pushToast({ kind: 'crit', title: 'ปฏิเสธแล้ว (mock)' });
      return;
    }
    try {
      await rejectWithdrawal(numericId, reason);
      pushToast({ kind: 'crit', title: 'ปฏิเสธคำขอแล้ว' });
      void live.refetch();
    } catch (e) {
      pushToast({ kind: 'crit', title: 'ปฏิเสธไม่สำเร็จ', body: describeError(e) });
    }
  }

  async function approveSelected() {
    const ids = Object.entries(picked)
      .filter(([, v]) => v)
      .map(([id]) => id);
    if (ids.length === 0) {
      return pushToast({ kind: 'warn', title: 'ยังไม่ได้เลือก', body: 'เลือกรายการที่จะอนุมัติก่อน' });
    }
    for (const id of ids) await callApprove(id);
    setPicked({});
  }

  return (
    <section className="panel flex flex-col min-h-0">
      <header className="panel-h">
        <div className="title">
          <span className="dot dot-warn" />
          <span className="t-h">รออนุมัติ · APPROVALS</span>
          <Pill tone="warn">{approvals.length}</Pill>
          <DataSourceBadge source={live.source} isLoading={live.isLoading} error={live.error} />
        </div>
        <div className="flex gap-1">
          <button className="btn btn-ghost" onClick={selectAll}>เลือกทั้งหมด</button>
          <button className="btn btn-ok" onClick={approveSelected}>อนุมัติที่เลือก</button>
        </div>
      </header>
      <div className="overflow-y-auto flex-1 min-h-0">
        {approvals.map((a) => (
          <div key={a.id} className="row">
            <input
              type="checkbox"
              className="shrink-0"
              checked={!!picked[a.id]}
              onChange={(e) => setPicked((s) => ({ ...s, [a.id]: e.target.checked }))}
            />
            <Pill tone={a.tone}>{a.kind}</Pill>
            <div className="flex-1 min-w-0">
              <div className="text-fg truncate">{a.title}</div>
              <div className="text-2xs text-mute mono">{a.meta}</div>
            </div>
            <div className="mono text-fg shrink-0">฿{a.amount.toLocaleString()}</div>
            <button className="btn btn-ok" onClick={() => callApprove(a.id)}>
              ✓
            </button>
            <button className="btn btn-crit" onClick={() => callReject(a.id)}>
              ✕
            </button>
          </div>
        ))}
        {approvals.length === 0 && (
          <div className="p-6 text-center text-2xs text-mute">ไม่มีรายการรออนุมัติ</div>
        )}
      </div>
    </section>
  );
}
