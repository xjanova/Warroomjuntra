'use client';

import { useState } from 'react';
import { CRITICAL_ALERT } from '@/lib/mock/warroom';
import { useWarroom } from '@/lib/stores/warroom';

export function CriticalBanner() {
  const [open, setOpen] = useState(true);
  const openCaseDrawer = useWarroom((s) => s.openCaseDrawer);
  if (!open) return null;
  return (
    <div className="bg-crit/10 border-b border-crit/40 px-3 py-1.5 flex items-center gap-3 text-xs relative overflow-hidden shrink-0">
      <span className="dot dot-crit" />
      <span className="font-semibold text-crit tracking-wide">🚨 แจ้งเตือนวิกฤต</span>
      <span className="text-fg">{CRITICAL_ALERT.msg}</span>
      <span className="mono text-2xs text-dim">เมื่อ {CRITICAL_ALERT.ago}</span>
      <div className="flex-1" />
      <button onClick={() => openCaseDrawer(CRITICAL_ALERT.caseId)} className="btn btn-crit">
        เปิดเคส →
      </button>
      <button onClick={() => setOpen(false)} className="btn btn-ghost">
        ปิด
      </button>
    </div>
  );
}
