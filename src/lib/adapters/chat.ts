import type { ChatThread, ChatMessage, ChatStage } from '@/lib/mock/chat-page';
import type { FortuneReading } from '@/lib/api';

// ── 🔲 Funnel stages (multi-view) ────────────────────────────────────────────

/** Display metadata per stage. `prio` orders the multi-view grid — hot stages
 *  (live prediction, card-picking, payment decision) float to the top. */
export const STAGE_META: Record<ChatStage, { label: string; icon: string; prio: number; color: string }> = {
  predicting:       { label: 'AI กำลังทำนาย', icon: '🔮', prio: 0, color: '#8b5cf6' },
  cancelled_user:   { label: 'ลูกค้ายกเลิกบิลเอง', icon: '🚨', prio: 1, color: '#ef4444' },
  celtic:           { label: 'กำลังเลือกไพ่ · Celtic', icon: '🃏', prio: 2, color: '#22d3ee' },
  deciding:         { label: 'รอตัดสินใจชำระ', icon: '💰', prio: 3, color: '#f59e0b' },
  waiting:          { label: 'จ่ายแล้ว · รอคำทำนาย', icon: '⏳', prio: 4, color: '#f43f5e' },
  cancelled_system: { label: 'ยกเลิกโดยระบบ', icon: '❌', prio: 8, color: '#9ca3af' },
  idle:             { label: 'คุยทั่วไป', icon: '💬', prio: 9, color: '#6b7280' },
};

// conversation_status → stage. The backend's fine statuses beat inference;
// listed explicitly so a new backend status falls through to inference rather
// than silently mis-bucketing.
const CS_STAGE: Record<string, ChatStage> = {
  celtic_generating: 'predicting',
  celtic_picking: 'celtic',
  collecting_tarot: 'celtic',
  celtic_awaiting_question: 'celtic',
  celtic_qa_prompt: 'celtic',
  pending_payment: 'deciding',
  celtic_pending_payment: 'deciding',
  awaiting_payment_method: 'deciding',
  pending_stripe_payment: 'deciding',
  tier_choice: 'deciding',
};

function looksCeltic(r: FortuneReading): boolean {
  return (
    (r.response_type ?? '').toLowerCase().includes('celtic') ||
    (r.reading_type ?? '').toLowerCase().includes('celtic')
  );
}

/**
 * Derive the funnel stage from the reading row alone. The resource doesn't
 * expose the backend's fine-grained status column (CELTIC_WAITING_CARDS …),
 * so we infer from payment/response state:
 *   bill issued + unpaid            → deciding   (ลูกค้ากำลังตัดสินใจจ่าย)
 *   paid + no reading yet + celtic  → celtic     (อยู่ในขั้นเลือกไพ่/ตอบคำถาม)
 *   paid + no reading yet           → waiting    (คิวส่งคำทำนาย — stuck ถ้านาน)
 * 'predicting' is NOT decidable here — the chat page overlays it live from
 * the workers queue (an actual in-flight AI call for this reading).
 */
export function stageOfReading(r: FortuneReading): ChatStage {
  // Cancellation wins over everything — the row is terminal. user_cancelled is
  // the critical one (customer actively walked from the bill).
  if (r.cancellation) {
    return r.cancellation.reason === 'user_cancelled' ? 'cancelled_user' : 'cancelled_system';
  }
  // Exact stage from the backend's conversation_status when present.
  const cs = (r.conversation_status ?? '').toLowerCase();
  if (cs && CS_STAGE[cs]) return CS_STAGE[cs];
  // Fallback inference (older backend without the new resource fields).
  if (!r.is_paid && r.amount_paid > 0) return 'deciding';
  if (r.is_paid && !r.ai_response) return looksCeltic(r) ? 'celtic' : 'waiting';
  return 'idle';
}

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
    userId: r.user?.id ?? null,
    openedAt,
    stage: stageOfReading(r),
    lastTsMs: parseMs(r.responded_at) ?? parseMs(r.paid_at) ?? parseMs(r.created_at) ?? 0,
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
    isPaid: r.is_paid,
    takenBy: bot ? undefined : { initial: 'AD', color: '#22d3ee' },
    takenByName: bot ? undefined : 'admin',
    takenAt: r.responded_at ? formatTime(r.responded_at) : undefined,
    pinReason: r.cancellation
      ? r.cancellation.reason === 'user_cancelled'
        ? '🚨 ลูกค้ายกเลิกบิลเอง'
        : '❌ ' + (r.cancellation.label ?? 'ยกเลิกโดยระบบ')
      : r.reading_type === 'deep'
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

function parseMs(iso?: string | null): number | null {
  if (!iso) return null;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : null;
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
