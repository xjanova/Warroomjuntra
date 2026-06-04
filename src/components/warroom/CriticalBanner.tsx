'use client';

import { useMemo, useState } from 'react';
import { useWarroom } from '@/lib/stores/warroom';
import { useSettings } from '@/lib/stores/settings';
import { useFortuneFeed } from '@/lib/api';
import { readingToTriageCase } from '@/lib/adapters/triage';

type Alert = {
  msg: string;
  ago: string;
  caseId: string;
} | null;

export function CriticalBanner() {
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const openCaseDrawer = useWarroom((s) => s.openCaseDrawer);
  const sla = useSettings((s) => s.sla);
  const feed = useFortuneFeed();

  // 🧹 (2026-06-04) Live-only — no demo banner. When not paired / still loading /
  //   no critical case, this simply doesn't render (returns null below).
  const alert = useMemo<Alert>(() => {
    if (feed.source !== 'live') return null;
    const candidate = deriveCriticalAlert(
      feed.data
        .filter((r) => r.response_type === 'pending' || !r.responded_at)
        .map((r) => readingToTriageCase(r, sla)),
    );
    if (!candidate) return null;
    if (candidate.caseId === dismissedId) return null;
    return candidate;
  }, [feed.data, feed.source, sla, dismissedId]);

  if (!alert) return null;

  return (
    <div className="bg-crit/10 border-b border-crit/40 px-3 py-1.5 flex items-center gap-3 text-xs relative overflow-hidden shrink-0">
      <span className="dot dot-crit" />
      <span className="font-semibold text-crit tracking-wide">🚨 แจ้งเตือนวิกฤต</span>
      <span className="text-fg">{alert.msg}</span>
      <span className="mono text-2xs text-dim">เมื่อ {alert.ago}</span>
      <div className="flex-1" />
      <button onClick={() => openCaseDrawer(alert.caseId)} className="btn btn-crit">
        เปิดเคส →
      </button>
      <button onClick={() => setDismissedId(alert.caseId)} className="btn btn-ghost">
        ปิด
      </button>
    </div>
  );
}

function deriveCriticalAlert(
  cases: { id: string; severity: string; detail: string; customer: string; slaDisplay: string }[],
): Alert {
  const crit = cases.filter((c) => c.severity === 'crit');
  if (crit.length === 0) return null;
  // pick the one that's most overdue (slaDisplay starts with '-' meaning past due)
  const worst = crit
    .map((c) => ({ ...c, overdueSec: parseOverdueSec(c.slaDisplay) }))
    .sort((a, b) => b.overdueSec - a.overdueSec)[0];

  const minutes = Math.floor(worst.overdueSec / 60);
  return {
    msg: `${worst.customer} · ${worst.detail}`,
    ago: minutes > 0 ? `${minutes} นาทีที่แล้ว` : 'เพิ่งเกินกำหนด',
    caseId: worst.id,
  };
}

function parseOverdueSec(display: string): number {
  if (!display.startsWith('-')) return 0;
  const m = display.slice(1).match(/^(\d+):(\d+)$/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
