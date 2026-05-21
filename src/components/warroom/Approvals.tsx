'use client';

import { useState } from 'react';
import { Pill } from '@/components/ui/Pill';
import { APPROVALS } from '@/lib/mock/warroom';
import { useWarroom } from '@/lib/stores/warroom';

export function Approvals() {
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const pushToast = useWarroom((s) => s.pushToast);
  const selectAll = () => setPicked(Object.fromEntries(APPROVALS.map((a) => [a.id, true])));
  const approveSelected = () => {
    const count = Object.values(picked).filter(Boolean).length;
    if (count === 0) return pushToast({ kind: 'warn', title: 'ยังไม่ได้เลือก', body: 'เลือกรายการที่จะอนุมัติก่อน' });
    pushToast({ kind: 'ok', title: 'อนุมัติแล้ว', body: `${count} รายการ` });
    setPicked({});
  };

  return (
    <section className="panel flex flex-col min-h-0">
      <header className="panel-h">
        <div className="title">
          <span className="dot dot-warn" />
          <span className="t-h">รออนุมัติ · APPROVALS</span>
          <Pill tone="warn">{APPROVALS.length}</Pill>
        </div>
        <div className="flex gap-1">
          <button className="btn btn-ghost" onClick={selectAll}>เลือกทั้งหมด</button>
          <button className="btn btn-ok" onClick={approveSelected}>อนุมัติที่เลือก</button>
        </div>
      </header>
      <div className="overflow-y-auto flex-1 min-h-0">
        {APPROVALS.map((a) => (
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
            <button
              className="btn btn-ok"
              onClick={() => pushToast({ kind: 'ok', title: 'อนุมัติแล้ว', body: a.title })}
            >
              ✓
            </button>
            <button
              className="btn btn-crit"
              onClick={() => pushToast({ kind: 'crit', title: 'ปฏิเสธ', body: a.title })}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
