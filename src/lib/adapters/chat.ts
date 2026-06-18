import type { ChatThread, ChatMessage, ChatStage } from '@/lib/mock/chat-page';
import type { FortuneReading } from '@/lib/api';
import { inferReadingChannel, extractReadingPsid } from './channel';

// ── 🔲 Funnel stages (multi-view) ────────────────────────────────────────────

/** Display metadata per stage. `prio` orders the multi-view grid — hot stages
 *  (live prediction, at-risk money, card-picking) float to the top; terminal /
 *  cold stages sink to the bottom. The 13 stages mirror the real Fortune Bot
 *  funnel (see CS_STAGE) so the operator sees exactly where each customer is. */
export const STAGE_META: Record<ChatStage, { label: string; icon: string; prio: number; color: string }> = {
  predicting:       { label: 'AI กำลังทำนาย', icon: '🔮', prio: 0, color: '#8b5cf6' },
  cancelled_user:   { label: 'ลูกค้ายกเลิกบิลเอง', icon: '🚨', prio: 1, color: '#ef4444' },
  deciding:         { label: 'รอชำระเงิน', icon: '💰', prio: 2, color: '#f59e0b' },
  celtic:           { label: 'เลือกไพ่ · Celtic', icon: '🃏', prio: 3, color: '#22d3ee' },
  waiting:          { label: 'จ่ายแล้ว · รอคำทำนาย', icon: '⏳', prio: 4, color: '#f43f5e' },
  upsell:           { label: 'ฟรีแล้ว · รอซื้อ 39/99', icon: '🎁', prio: 5, color: '#10b981' },
  choosing:         { label: 'เลือกแพ็กเกจ/คุยเก็บข้อมูล', icon: '🧭', prio: 6, color: '#eab308' },
  collecting:       { label: 'กำลังเก็บข้อมูล', icon: '📝', prio: 7, color: '#84cc16' },
  intake:           { label: 'เริ่มสนทนาใหม่', icon: '💬', prio: 8, color: '#38bdf8' },
  delivered:        { label: 'ส่งคำทำนายแล้ว', icon: '✅', prio: 9, color: '#64748b' },
  declined:         { label: 'ปฏิเสธ upsell', icon: '🙅', prio: 10, color: '#94a3b8' },
  cancelled_system: { label: 'ยกเลิกโดยระบบ', icon: '❌', prio: 11, color: '#9ca3af' },
  idle:             { label: 'อื่น ๆ', icon: '💤', prio: 12, color: '#6b7280' },
};

// conversation_status → stage. Verified 1:1 against the backend state machine
// (Thaiprompt-Affiliate app/Models/FortuneReading.php STATUS_* constants). Every
// known status maps explicitly; only a NEW/unknown backend status falls through
// to inference → 'idle', so it's visibly bucketed rather than silently
// mis-labeled. NOTE: 'paid' → waiting (not predicting): the live worker-queue
// overlay in chat/page.tsx promotes a paid row to 'predicting' only when an AI
// call is actually in-flight; absent that it's "paid, awaiting delivery".
const CS_STAGE: Record<string, ChatStage> = {
  // 💬 top of funnel — engaged, no bill yet
  new: 'intake',
  awaiting_confirmation: 'intake',
  // 🧭 picking a package / discovery chat (no bill yet — NOT 'deciding')
  tier_choice: 'choosing',
  discovery_chat: 'choosing',
  discovery_confirm: 'choosing',
  // 📝 locked pre-payment data collection
  collecting_birthdate: 'collecting',
  collecting_questions: 'collecting',
  collecting_tarot: 'collecting', // pre-pay Celtic card draw — NOT the paid celtic flow
  // 💰 bill issued / choosing pay method — unpaid, money at stake
  awaiting_payment_method: 'deciding',
  pending_payment: 'deciding',
  celtic_pending_payment: 'deciding',
  pending_stripe_payment: 'deciding',
  // ⏳/🔮 paid Deep — awaiting delivery (overlay promotes to predicting when live)
  paid: 'waiting',
  // 🃏 paid Celtic flow
  celtic_picking: 'celtic',
  celtic_awaiting_question: 'celtic',
  celtic_qa_prompt: 'celtic',
  celtic_generating: 'predicting', // AI generating the answer now
  // 🎁 free card drawn + predicted — HOT upsell decision (39/99/ไม่สนใจ)
  free_predicted: 'upsell',
  // ✅/🙅 terminal
  basic_done: 'delivered',
  completed: 'delivered', // cancellation is checked BEFORE this in stageOfReading
  free_declined: 'declined',
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
  // 1. Cancellation wins over everything — the row is terminal. Checked BEFORE
  //    any status/terminal mapping because a cancelled bill is also
  //    conversation_status='completed' (is_paid=false + cancellation_reason).
  //    user_cancelled is the critical one (customer actively walked from the bill).
  if (r.cancellation) {
    return r.cancellation.reason === 'user_cancelled' ? 'cancelled_user' : 'cancelled_system';
  }
  // 2. Exact stage from the backend's conversation_status when present.
  const cs = (r.conversation_status ?? '').toLowerCase();
  if (cs && CS_STAGE[cs]) return CS_STAGE[cs];
  // 3. Fallback inference (older backend / unknown status) — keyed off the
  //    structural payment/response shape, NOT reading_type string literals
  //    (those aren't guaranteed on the wire). Order matters.
  if (!r.is_paid && r.amount_paid > 0) return 'deciding';            // bill issued, unpaid
  if (!r.is_paid && r.ai_response) return 'upsell';                  // free card predicted, awaiting upsell (HOT)
  if (r.is_paid && !r.ai_response) return looksCeltic(r) ? 'celtic' : 'waiting'; // paid, undelivered
  if (r.is_paid && r.ai_response) return 'delivered';               // paid + reading delivered
  if (!r.is_paid && r.amount_paid === 0 && !r.ai_response) return 'intake'; // fresh, nothing yet
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
  const psid = extractReadingPsid(r) ?? (r.user?.id ? `U-${r.user.id}` : `id-${r.id}`);
  const channel = inferReadingChannel(r);
  // 🧑‍🤝‍🧑 Stable per-customer key for multi-view dedup. A logged-in web account
  //   (userId) is the strongest identity; else the platform user id, namespaced
  //   by channel so an FB PSID and a LINE userId of the same value can't merge.
  //   Anonymous rows fall back to a per-reading psid (id-{id}) → never merge.
  const customerKey = r.user?.id ? `u:${r.user.id}` : `${channel}:${psid}`;
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
    customerKey,
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
