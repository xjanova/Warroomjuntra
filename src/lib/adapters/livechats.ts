import type { Chat } from '@/lib/mock/types';
import type { FortuneReading } from '@/lib/api';

/**
 * Map a thaiprompt FortuneReading → warroom Chat card for the LiveChats panel.
 *
 * `silentSec` is computed from responded_at when present, else created_at —
 * approximates "how long since the last message in this thread."
 */
export function readingToChat(r: FortuneReading): Chat {
  const lastTs = r.responded_at ?? r.created_at;
  const silentSec = lastTs ? Math.max(0, Math.floor((Date.now() - new Date(lastTs).getTime()) / 1000)) : 0;

  const fromFB = !!r.facebook_user_id;
  const channel = fromFB ? 'FB' : 'LINE';
  const name = r.user?.name || r.facebook_user_name || `#${r.id}`;

  // Bot vs human owner heuristic: response_type === 'admin' means a human took over.
  const bot = r.response_type !== 'admin';

  const last = previewLastMessage(r);

  // Sentiment is not exposed by the API yet — keep neutral. Rating 1-2 → angry.
  let sentiment: Chat['sentiment'] = 'neutral';
  if (typeof r.rating === 'number') {
    if (r.rating <= 2) sentiment = 'angry';
    else if (r.rating >= 4) sentiment = 'happy';
  }

  return {
    id: `ch-${r.id}`,
    name,
    channel,
    bot,
    sentiment,
    last,
    silentSec,
    takenBy: bot ? undefined : { initial: 'AD', color: '#22d3ee' },
  };
}

function previewLastMessage(r: FortuneReading): string {
  if (r.ai_response) return truncate(r.ai_response, 80);
  if (Array.isArray(r.questions) && r.questions.length) return truncate(String(r.questions[0]), 80);
  if (typeof r.questions === 'string') return truncate(r.questions, 80);
  return '(เริ่มต้นการสนทนา)';
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
