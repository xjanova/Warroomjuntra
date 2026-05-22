// Adapters: thaiprompt admin API responses → warroom mock-shaped view models.
// Keeps mock-driven components untouched while we swap data underneath.

import type { Kpi } from '@/lib/mock/types';
import type { DashboardResponse } from '@/lib/api';

const THB = (n: number) =>
  '฿' + Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

const PALETTE = {
  ok: '#10b981',
  warn: '#f59e0b',
  crit: '#ef4444',
  info: '#22d3ee',
  mystic: '#8b5cf6',
} as const;

function deltaTone(pct: number): { tone: Kpi['tone']; color: string } {
  if (pct >= 10) return { tone: 'ok', color: PALETTE.ok };
  if (pct >= 0) return { tone: 'info', color: PALETTE.info };
  if (pct >= -10) return { tone: 'warn', color: PALETTE.warn };
  return { tone: 'crit', color: PALETTE.crit };
}

/**
 * Map dashboard API → 6-tile KPI strip.
 * The mock has 6 tiles (revenue, readings, new customers, close rate, response time, free credit).
 * We populate the ones we have ground truth for + leave placeholders that surface
 * obvious "n/a" for the ones the admin API doesn't return.
 */
export function dashboardToKpis(d: DashboardResponse): Kpi[] {
  const revenueDelta = d.hero.revenue_growth_pct;
  const revenueTone = deltaTone(revenueDelta);
  const sparkTotals = d.sparkline.map((p) => Math.max(0, Math.round(p.total)));
  const sparkCounts = d.sparkline.map((p) => p.count);

  return [
    {
      label: 'รายได้เดือนนี้',
      value: THB(d.hero.monthly_revenue),
      delta: Math.round(revenueDelta),
      tone: revenueTone.tone,
      color: revenueTone.color,
      sub: `เดือนก่อน ${THB(d.hero.last_month_revenue)}`,
      spark: sparkTotals.length ? sparkTotals : [0],
    },
    {
      label: 'ออเดอร์ทั้งหมด',
      value: d.stats.orders_total.toLocaleString(),
      delta: 0,
      tone: 'info',
      color: PALETTE.info,
      sub: `รออนุมัติ ${d.stats.orders_pending.toLocaleString()}`,
      spark: sparkCounts.length ? sparkCounts : [0],
    },
    {
      label: 'สมาชิกใหม่วันนี้',
      value: d.stats.new_users_today.toLocaleString(),
      delta: 0,
      tone: d.stats.new_users_today > 0 ? 'ok' : 'dim',
      color: d.stats.new_users_today > 0 ? PALETTE.ok : PALETTE.info,
      sub: `รวม ${d.stats.total_users.toLocaleString()} คน`,
      spark: sparkCounts.length ? sparkCounts.slice(-9) : [0],
    },
    {
      label: 'Affiliate ทั้งหมด',
      value: d.stats.total_affiliates.toLocaleString(),
      delta: 0,
      tone: 'info',
      color: PALETTE.mystic,
      sub: 'รวมทุกชั้น MLM',
      spark: [d.stats.total_affiliates],
    },
    {
      label: 'ถอนเงินรออนุมัติ',
      value: d.stats.pending_withdrawals.toLocaleString(),
      delta: 0,
      tone: d.stats.pending_withdrawals > 5 ? 'warn' : 'dim',
      color: d.stats.pending_withdrawals > 5 ? PALETTE.warn : PALETTE.info,
      sub: 'รอ admin ตรวจสอบ',
      spark: [d.stats.pending_withdrawals],
    },
    {
      label: 'อนุมัติคอม.รอ',
      value: d.quick_actions.approvals.toLocaleString(),
      delta: 0,
      tone: d.quick_actions.approvals > 0 ? 'warn' : 'ok',
      color: d.quick_actions.approvals > 0 ? PALETTE.warn : PALETTE.ok,
      sub: `KYC รอ ${d.quick_actions.kyc_pending}`,
      spark: [d.quick_actions.approvals],
    },
  ];
}
