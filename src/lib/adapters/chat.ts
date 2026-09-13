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

/** Cold / inactive stages: a finished or dormant conversation. These cards stay
 *  flat — no glow border, no auto-surface flash — so the operator's eye is drawn
 *  only to customers who actually need attention. (cancelled_user is NOT here: a
 *  customer killing their own bill is a hot revenue-loss alert.) */
export const COLD_STAGES: ChatStage[] = ['delivered', 'declined', 'cancelled_system', 'idle'];

/** 🔔 (2026-09-06) Stages that deserve their OWN alert — sound + an LED ring
 *  around the multi-view card — because a human replying right now is what
 *  closes the sale: the customer has asked for a reading and is choosing a
 *  package (conversation_status tier_choice / discovery_chat / discovery_confirm
 *  → 'choosing'). Deliberately NOT the whole hot half of the funnel: a card
 *  that lights up every few seconds stops being an alert.
 *  Add 'upsell' here to include free_predicted (ดูฟรีแล้ว · รอตัดสินใจซื้อ). */
export const ALERT_STAGES: ChatStage[] = ['choosing'];

export function isAlertStage(s: ChatStage): boolean {
  return ALERT_STAGES.includes(s);
}

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

/** Bill rejected from the SMS Checker app — raw conversation_status 'cancelled', unpaid. */
function isRejectedBill(r: FortuneReading): boolean {
  return (r.conversation_status ?? '').toLowerCase() === 'cancelled' && !r.is_paid;
}

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
  // 🚫 (2026-09-13) Raw 'cancelled' = the SMS Checker app rejected this bill
  //    (Thaiprompt SmsPaymentController writes it directly — it is NOT a
  //    FortuneReading::STATUS_* and isCancelled() ignores it, so `cancellation`
  //    is null). Without this it fell through to inference and an admin-rejected
  //    bill showed as "รอชำระเงิน". Mirrors FortuneFunnelStage::REJECTED_STATUS.
  if (isRejectedBill(r)) return 'cancelled_system';
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
 * Fine-grained "what is this customer doing RIGHT NOW" label for a card —
 * surfaces the sub-state that conversation_status alone can't express (Celtic
 * card-pick progress, the post-cards birthdate collection, Q&A counters,
 * pre-payment steps). Returns undefined when the coarse stage label is enough.
 * Uses the optional celtic_* fields from the backend resource (2026-06-19);
 * degrades gracefully when they're absent on older deploys.
 */
export function stageDetailOf(r: FortuneReading): string | undefined {
  if (r.cancellation) return undefined; // pinReason already says why
  if (isRejectedBill(r)) return 'ปฏิเสธบิลจากแอป SMS Checker';
  const cs = (r.conversation_status ?? '').toLowerCase();
  const picked = r.celtic_picked_count ?? null;
  const usedQ = r.celtic_questions_used ?? 0;
  switch (cs) {
    case 'celtic_picking':
      return picked != null ? `เปิดไพ่ ${picked}/10` : 'กำลังเปิดไพ่';
    case 'celtic_awaiting_question':
      if (r.celtic_birthdate_pending) return 'เปิดไพ่ครบ · รอวันเกิด 🎂';
      return usedQ > 0 ? `ถามไป ${usedQ} · รอคำถามต่อ` : 'เปิดไพ่ครบ · รอคำถามแรก';
    case 'celtic_generating':
      return `กำลังตอบคำถามที่ ${usedQ + 1}`;
    case 'celtic_qa_prompt':
      return usedQ > 0 ? `ตอบไป ${usedQ} คำถาม · ถามต่อไหม` : 'ถามต่อไหม';
    case 'celtic_pending_payment':
      return 'รอจ่าย 99 (Celtic)';
    case 'pending_payment':
      return 'รอจ่าย 39 (Deep)';
    case 'awaiting_payment_method':
      return 'เลือกวิธีจ่าย (QR/บัตร)';
    case 'pending_stripe_payment':
      return 'รอจ่ายผ่านบัตร (Stripe)';
    case 'collecting_birthdate':
      return 'กำลังขอวันเกิด';
    case 'collecting_questions':
      return 'กำลังขอคำถาม';
    case 'collecting_tarot':
      return 'จั่วไพ่ก่อนจ่าย';
    case 'tier_choice':
      return 'กำลังเลือก 39/99';
    case 'free_predicted':
      return 'ดูฟรีแล้ว · รอตัดสินใจซื้อ';
    default:
      return undefined;
  }
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
  const channel = inferReadingChannel(r);
  // The REAL platform user id (FB PSID / LINE userId) when resolvable — now
  //   reliable for LINE too via platform_user_id. Falls back to an internal id
  //   for display/ban only when no platform identity exists.
  const platformId = extractReadingPsid(r);
  const psid = platformId ?? (r.user?.id ? `U-${r.user.id}` : `id-${r.id}`);
  // 🧑‍🤝‍🧑 Stable per-customer key for multi-view dedup. Prefer the platform
  //   identity (present on EVERY bot reading incl. LINE — the field that fixes
  //   the duplicate-card bug), namespaced by channel so an FB PSID and a LINE
  //   userId of the same value can't merge. Else a web userId; else per-reading
  //   (never merges — correct when identity is genuinely unknown).
  const customerKey = platformId
    ? `${channel}:${platformId}`
    : r.user?.id
    ? `u:${r.user.id}`
    : `r:${r.id}`;
  const openedAt = formatTime(r.created_at);
  const lastTs = formatTime(r.responded_at ?? r.created_at);
  const bot = r.response_type !== 'admin';

  // sentiment: rating ≤2 → angry, ≥4 → happy
  let sentiment: ChatThread['sentiment'] = 'neutral';
  if (typeof r.rating === 'number') {
    if (r.rating <= 2) sentiment = 'angry';
    else if (r.rating >= 4) sentiment = 'happy';
  }

  // 💰 Revenue actually COLLECTED on this reading. `amount_paid` carries the
  //   BILLED amount while is_paid is still false (that is exactly what `due`
  //   reads below), so counting it unconditionally turned unpaid + cancelled
  //   bills into earnings — a customer who walked away from three ฿99 bills read
  //   "LTV ฿297" and could even cross the VIP line. Only paid rows count.
  const ltv = r.is_paid ? Math.round(r.amount_paid || 0) : 0;
  const rarity = bucketRarity(ltv);

  const messages = buildMessages(r);
  const last = messages.length > 0 ? messages[messages.length - 1].text : '(เริ่มสนทนา)';

  return {
    id: `r-${r.id}`,
    name: customer,
    channel,
    psid,
    // 🚫 The REAL FB PSID / LINE userId, or null when this reading carries no
    //   platform identity at all. `psid` above falls back to a synthetic
    //   "U-{userId}" / "id-{readingId}" for display — those are NOT addressable on
    //   FB/LINE, so ban / unban / ban-status must key off THIS field or they
    //   silently write a record that matches nobody.
    platformId,
    userId: r.user?.id ?? null,
    customerKey,
    openedAt,
    stage: stageOfReading(r),
    stageDetail: stageDetailOf(r),
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
    // ✍️ response_type==='admin' means an admin wrote the LAST reply — it is not
    //   the takeover flag and it carries no admin identity, so we no longer
    //   invent a name ('admin') or call responded_at a takeover time. The chat
    //   page renders this as "แอดมินตอบล่าสุด" and shows the real takeover
    //   state separately from /chat/takeover-status.
    takenBy: bot ? undefined : { initial: 'AD', color: '#22d3ee' },
    takenAt: r.responded_at ? formatTime(r.responded_at) : undefined,
    readingType: r.reading_type ?? null,
    // 🏷️ Product label straight from reading_type. This used to read
    //   `reading_type === 'deep' ? '🔮 Celtic Cross'`, which tagged every ฿39 Deep
    //   reading as Celtic and left real Celtic rows unlabelled — 'deep' is the
    //   ฿39 เชิงลึก product; Celtic is 'celtic_cross'
    //   (Thaiprompt-Affiliate FortuneReading::READING_TYPE_*).
    pinReason: r.cancellation
      ? r.cancellation.reason === 'user_cancelled'
        ? '🚨 ลูกค้ายกเลิกบิลเอง'
        : '❌ ' + (r.cancellation.label ?? 'ยกเลิกโดยระบบ')
      : isRejectedBill(r)
      ? '❌ ปฏิเสธบิลจากแอป'
      : !r.is_paid && r.amount_paid > 0
      ? `💰 บิล ฿${r.amount_paid.toLocaleString()}` +
        (productLabel(r.reading_type) ? ` · ${productLabel(r.reading_type)}` : '')
      : productLabel(r.reading_type),
    messages,
  };
}

/** Human label for the reading_type column. Mirrors the backend's own
 *  getReadingTypeLabel() so warroom and admin-web name the same product the
 *  same way. Returns undefined for 'basic' — nothing worth pinning. */
function productLabel(t: FortuneReading['reading_type']): string | undefined {
  switch ((t ?? '').toLowerCase()) {
    case 'celtic_cross':
      return '💎 Celtic 99';
    case 'deep':
      return '🌟 เชิงลึก 39';
    default:
      return undefined;
  }
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
      // The list feed asks for `preview=1`, so this can be the opening 200
      //   characters rather than the whole reading. Say so — an operator must
      //   not read a trimmed preview as the full text that went to the
      //   customer. (This bubble is only the first-paint fallback anyway; the
      //   transcript fetch replaces it with the real conversation.)
      text: r.ai_response_truncated
        ? r.ai_response + '\n\n(แสดงย่อ — เปิดแชทเพื่อดูคำทำนายเต็ม)'
        : r.ai_response,
    });
  } else if (r.is_paid && !r.responded_at) {
    // Only a PAID reading is genuinely awaiting a prediction. An unpaid row with
    // no response is just an ongoing chat — don't push a system line so the card
    // preview falls back to the customer's actual question, not a false
    // "รอคำทำนาย" (the customer hasn't paid, so no prediction is owed).
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

/** Rarity / level for a CUSTOMER's total collected revenue. Exported so the chat
 *  page can recompute them on a deduped card: the per-reading values spread from
 *  the representative would otherwise sit right next to a summed LTV they
 *  disagree with (rep earned ฿99, card shows ฿1,200 but still says COMMON). */
export function rarityForLtv(ltv: number): ChatThread['rarity'] {
  return bucketRarity(ltv);
}

export function levelForLtv(ltv: number): number {
  return clamp(Math.floor(Math.log2((ltv || 1) + 1)), 1, 30);
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
