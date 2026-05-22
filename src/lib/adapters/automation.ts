import type { Bot } from '@/lib/mock/types';
import type { AiBot } from '@/lib/api';

/**
 * Map a thaiprompt AiBot → warroom Bot card.
 * Provider type goes into the metadata; LINE OA connection feeds the state dot.
 */
export function aiBotToBotCard(b: AiBot): Bot {
  const lineConnected = b.line_oa.is_connected;
  const state: Bot['state'] =
    !b.is_active ? 'warn' : lineConnected ? 'ok' : b.provider?.name ? 'ok' : 'warn';

  const providerLabel = b.provider?.name ?? 'no-provider';
  const modelLabel = b.model?.name ?? '';
  const last = `${providerLabel}${modelLabel ? ' · ' + modelLabel : ''}`;

  const next = lineConnected
    ? 'LINE OA เชื่อมต่ออยู่'
    : b.is_rentable
    ? `ให้เช่า ฿${b.rental.price_per_month.toFixed(0)}/เดือน`
    : 'standby';

  return {
    id: String(b.id),
    name: b.display_name || b.name,
    state,
    enabled: b.is_active,
    next,
    last,
  };
}
