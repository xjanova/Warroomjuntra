import type { ChatThread, ChatMessage } from '@/lib/mock/chat-page';
import type { FortuneReading } from '@/lib/api';

/**
 * Synthesize a ChatThread from a FortuneReading.
 *
 * The reading endpoint doesn't return a full message history yet — we
 * reconstruct a believable transcript from the fields we DO have:
 *   - questions[] → user messages
 *   - ai_response → bot message (if AI responded)
 *   - response_type === 'admin' → human takeover marker
 *   - is_paid + amount_paid → payment confirmation system line
 *
 * When the backend ships a `/fortune/readings/{id}/transcript` endpoint,
 * swap this for a proper fetch — the rest of the page is shape-stable.
 */
export function readingToChatThread(r: FortuneReading): ChatThread {
  const customer = r.user?.name || r.facebook_user_name || `#${r.id}`;
  const psid = r.facebook_user_id || (r.user?.id ? `U-${r.user.id}` : `id-${r.id}`);
  const channel = r.facebook_user_id ? 'FB' : 'LINE';
  const openedAt = formatTime(r.created_at);
  const lastTs = formatTime(r.responded_at ?? r.created_at);
  const bot = r.response_type !== 'admin';

  // sentiment: rating ≤2 → angry, ≥4 → happy
  let sentiment: ChatThread['sentiment'] = 'neutral';
  if (typeof r.rating === 'number') {
    if (r.rating <= 2) sentiment = 'angry';
    else if (r.rating >= 4) sentiment = 'happy';
  }

  // rarity from LTV proxy (amount_paid is a thin proxy)
  const ltv = Math.round(r.amount_paid || 0);
  const rarity = bucketRarity(ltv);

  const messages = buildMessages(r);
  const last = messages.length > 0 ? messages[messages.length - 1].text : '(เริ่มสนทนา)';

  return {
    id: `r-${r.id}`,
    name: customer,
    channel,
    psid,
    openedAt,
    bot,
    sentiment,
    last: truncate(last, 80),
    lastTs,
    unread: 0,
    vip: ltv >= 5000,
    rarity,
    level: clamp(Math.floor(Math.log2((ltv || 1) + 1)), 1, 30),
    exp: '—',
    credits: 0,
    ltv,
    readings: 1,
    due: r.is_paid ? 0 : Math.round(r.amount_paid || 0),
    takenBy: bot ? undefined : { initial: 'AD', color: '#22d3ee' },
    takenByName: bot ? undefined : 'admin',
    takenAt: r.responded_at ? formatTime(r.responded_at) : undefined,
    pinReason:
      r.reading_type === 'deep'
        ? '🔮 Celtic Cross'
        : !r.is_paid && r.amount_paid > 0
        ? `💰 บิล ฿${r.amount_paid.toLocaleString()}`
        : undefined,
    messages,
  };
}

function buildMessages(r: FortuneReading): ChatMessage[] {
  const out: ChatMessage[] = [];
  let id = 1;

  out.push({
    id: id++,
    role: 'system',
    text: `เริ่มสนทนา · ${formatTime(r.created_at)}`,
  });

  // User question(s)
  const questions = normalizeQuestions(r.questions);
  for (const q of questions) {
    out.push({
      id: id++,
      role: 'user',
      ts: formatTime(r.created_at),
      text: q,
    });
  }

  // Payment system line
  if (r.is_paid && r.amount_paid > 0 && r.paid_at) {
    out.push({
      id: id++,
      role: 'system',
      text: `✓ รับชำระ ฿${r.amount_paid.toLocaleString()} · ${formatTime(r.paid_at)}`,
    });
  }

  // AI/admin response
  if (r.ai_response) {
    const isAdmin = r.response_type === 'admin';
    out.push({
      id: id++,
      role: isAdmin ? 'admin' : 'bot',
      by: isAdmin ? 'admin' : undefined,
      ts: formatTime(r.responded_at ?? r.created_at),
      ai: !isAdmin ? r.ai?.provider ?? undefined : undefined,
      text: r.ai_response,
    });
  } else if (!r.responded_at) {
    out.push({
      id: id++,
      role: 'system',
      text: '⌛ รอคำทำนาย',
    });
  }

  return out;
}

function normalizeQuestions(q: FortuneReading['questions']): string[] {
  if (!q) return ['(ไม่มีคำถาม)'];
  if (Array.isArray(q)) return q.filter(Boolean).map(String);
  return [String(q)];
}

function bucketRarity(ltv: number): ChatThread['rarity'] {
  if (ltv >= 20000) return 'LEGENDARY';
  if (ltv >= 5000) return 'EPIC';
  if (ltv >= 1000) return 'RARE';
  if (ltv >= 200) return 'UNCOMMON';
  return 'COMMON';
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function formatTime(iso?: string | null): string {
  if (!iso) return '--:--';
  try {
    return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
