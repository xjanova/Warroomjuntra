import type { SystemService } from '@/lib/mock/types';
import type { AiDashboardResponse } from '@/lib/api';

/**
 * Map /ai/dashboard → SystemStatus rows.
 * Each AI provider becomes a service row; quotas/latency/error rate fold in.
 */
export function aiDashboardToServices(d: AiDashboardResponse): SystemService[] {
  const rows: SystemService[] = [];

  for (const p of d.providers_summary) {
    const status: SystemService['status'] =
      !p.is_available ? 'crit' : p.quota_pct >= 90 ? 'warn' : 'ok';
    const metric =
      p.quota_pct > 0
        ? `${p.quota_pct.toFixed(0)}% โควต้า · ฿${p.cost_thb.toFixed(0)}`
        : `฿${p.cost_thb.toFixed(0)} เดือนนี้`;
    rows.push({
      name: `AI · ${p.name}`,
      status,
      metric,
    });
  }

  // Inference summary as a synthetic row
  rows.push({
    name: 'AI · Inference (p95 latency)',
    status:
      d.inference.errors_pct >= 5
        ? 'crit'
        : d.inference.p95_latency_ms >= 2000
        ? 'warn'
        : 'ok',
    metric: `${d.inference.p95_latency_ms}ms · ${d.inference.errors_pct.toFixed(1)}% err · ${d.inference.requests_per_min} req/min`,
  });

  rows.push({
    name: 'AI · Bots',
    status: d.bots_summary.active > 0 ? 'ok' : 'warn',
    metric: `${d.bots_summary.active}/${d.bots_summary.total} ทำงาน · ${d.bots_summary.rentable} ให้เช่า`,
  });

  rows.push({
    name: 'AI · Token usage (เดือนนี้)',
    status: 'ok',
    metric: `${d.hero.total_tokens.toLocaleString()} tokens · ฿${d.hero.total_cost_thb.toFixed(0)} · cache ${d.hero.cache_hit_pct.toFixed(0)}%`,
  });

  return rows;
}
