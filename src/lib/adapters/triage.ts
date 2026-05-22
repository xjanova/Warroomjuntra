import type { TriageCase, Severity, CaseType, Channel } from '@/lib/mock/types';
import type { FortuneReading } from '@/lib/api';
import type { SlaThresholds } from '@/lib/stores/settings';

/**
 * Map a thaiprompt FortuneReading → warroom TriageCase view model.
 *
 * SLA logic:
 *   - reading_type 'deep' uses sla.celtic (default 30 min)
 *   - otherwise sla.reading (default 5 min)
 *   - We don't know mood/sensitive flagging from this endpoint alone, so
 *     'sensitive' is only triggered when a future field shines through.
 *
 * Time math: warn @ 70% of budget, crit when 100%+.
 */
export function readingToTriageCase(r: FortuneReading, sla: SlaThresholds): TriageCase {
  const type: CaseType = r.reading_type === 'deep' ? 'celtic' : 'reading';
  const budgetMin = type === 'celtic' ? sla.celtic : sla.reading;

  const createdAt = r.created_at ? new Date(r.created_at).getTime() : Date.now();
  const elapsedSec = Math.max(0, (Date.now() - createdAt) / 1000);
  const budgetSec = budgetMin * 60;
  const remainingSec = budgetSec - elapsedSec;

  const slaPct = Math.max(0, Math.min(100, (elapsedSec / budgetSec) * 100));
  const slaDisplay = formatSlaDelta(remainingSec);

  let severity: Severity = 'low';
  if (remainingSec < 0) severity = 'crit';
  else if (slaPct >= 70) severity = 'warn';

  // Channel heuristic — readings born from FB Messenger bot have facebook_user_id set
  const channel: Channel = r.facebook_user_id ? 'FB' : 'LINE';

  const customer = r.user?.name || r.facebook_user_name || `#${r.id}`;
  const questionPreview = previewQuestion(r.questions);
  const aiTag = r.ai?.provider ? ` · ${r.ai.provider}` : '';
  const detail = `${type === 'celtic' ? 'Celtic Cross' : 'คำทำนาย'} "${questionPreview}"${aiTag}`;

  return {
    id: `r-${r.id}`,
    customer,
    channel,
    type,
    severity,
    detail,
    slaDisplay,
    slaPct: Math.round(slaPct),
    amount: r.amount_paid > 0 ? r.amount_paid : undefined,
    meta: r.is_paid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย',
    tags: [],
  };
}

function previewQuestion(q: FortuneReading['questions']): string {
  if (!q) return '—';
  if (Array.isArray(q)) return q[0] ? truncate(String(q[0]), 60) : '—';
  return truncate(String(q), 60);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function formatSlaDelta(remainingSec: number): string {
  const abs = Math.abs(remainingSec);
  const m = Math.floor(abs / 60);
  const s = Math.floor(abs % 60);
  const sign = remainingSec < 0 ? '-' : '';
  return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
