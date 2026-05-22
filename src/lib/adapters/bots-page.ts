import type { BotCard } from '@/lib/mock/bots-page';
import type { AiBot } from '@/lib/api';

const COLORS = ['#1877f2', '#06c755', '#8b5cf6', '#f59e0b', '#22d3ee', '#10b981', '#f43f5e', '#3b82f6', '#a855f7'];

const ICONS = ['🤖', '🌙', '🎯', '🔔', '⚠️', '🌟', '💰', '😊', '🎙️', '🔮', '⚡', '✨'];

/**
 * Map AiBot → BotCard for the full-page bots view.
 * spark path is synthesized — the API doesn't return a timeseries per bot yet.
 */
export function aiBotToBotCardFull(b: AiBot, idx: number): BotCard {
  const color = COLORS[idx % COLORS.length];
  const icon = ICONS[idx % ICONS.length];
  const lineConnected = b.line_oa.is_connected;
  const state: BotCard['state'] = !b.is_active ? 'warn' : lineConnected ? 'ok' : 'ok';

  const providerLabel = b.provider?.name ?? 'no-provider';
  const modelLabel = b.model?.name ?? '';
  const last = lineConnected
    ? `LINE OA · ${providerLabel}${modelLabel ? ' · ' + modelLabel : ''}`
    : b.is_rentable
    ? `ให้เช่า ฿${b.rental.price_per_month.toFixed(0)}/เดือน`
    : `${providerLabel}${modelLabel ? ' · ' + modelLabel : ''}`;

  return {
    id: b.id,
    name: b.display_name || b.name,
    icon,
    color,
    desc: b.description || `${providerLabel} · max_tokens ${b.tuning.max_tokens}`,
    state,
    enabled: b.is_active,
    next: lineConnected ? 'realtime' : 'standby',
    last,
    success: 96,
    runs7d: 0,
    spark: 'M 0 18 L 28 14 L 56 16 L 84 12 L 112 14 L 140 10 L 168 12 L 200 8',
  };
}
