import type { Channel } from './types';

export type ChatMessage = {
  id: number;
  role: 'system' | 'user' | 'bot' | 'admin';
  ts?: string;
  text: string;
  ai?: string;
  by?: string;
  // 📸 (2026-05-24) Customer-sent image (slip/photo). Rendered as a
  //   thumbnail in the user bubble when present.
  image_url?: string | null;
};

// 🔲 (2026-06-11, expanded 2026-06-18) Funnel stage for the multi-view grid.
//   Derived from the reading row's conversation_status (adapters/chat.ts) so the
//   grid mirrors the REAL Fortune Bot customer journey end-to-end, except
//   'predicting', which the chat page overlays live from the workers queue (an
//   in-flight AI call right now). Ordered loosely by operator heat — see
//   STAGE_META.prio for the canonical ordering.
export type ChatStage =
  | 'predicting'       // 🔮 AI กำลังทำนายอยู่ตอนนี้ (live worker call / celtic_generating)
  | 'cancelled_user'   // 🚨 ลูกค้ายกเลิกบิลเอง — รายได้หลุดมือ ต้องตามด่วน (CRITICAL)
  | 'deciding'         // 💰 มีบิลค้าง/เลือกวิธีจ่าย — กำลังตัดสินใจชำระ
  | 'celtic'           // 🃏 จ่ายแล้ว · เลือกไพ่/ตอบคำถาม (Celtic)
  | 'waiting'          // ⏳ จ่ายแล้ว รอคำทำนายส่ง (อาจค้าง)
  | 'upsell'           // 🎁 ดูดวงฟรีแล้ว · รอตัดสินใจซื้อ 39/99
  | 'choosing'         // 🧭 เลือกแพ็กเกจ/คุยเก็บข้อมูล (tier/discovery — ยังไม่มีบิล)
  | 'collecting'       // 📝 กำลังเก็บข้อมูลก่อนชำระ (วันเกิด/คำถาม/จั่วไพ่)
  | 'intake'           // 💬 เริ่มสนทนาใหม่ / รอยืนยัน
  | 'delivered'        // ✅ ส่งคำทำนายแล้ว · จบงาน
  | 'declined'         // 🙅 ปฏิเสธ upsell · ส่งคำลาแล้ว
  | 'cancelled_system' // ❌ ระบบยกเลิกบิลให้ (หมดเวลา 30/90 นาที — cron)
  | 'idle';            // 💤 อื่น ๆ (สถานะใหม่ที่ยังไม่ได้แมป — fallback)

export type ChatThread = {
  id: string;
  name: string;
  channel: Channel;
  psid: string;
  userId?: number | null;
  // 🧑‍🤝‍🧑 (2026-06-18) Stable per-CUSTOMER identity used to collapse the many
  //   readings of one person into a single multi-view card. Channel-namespaced
  //   so an FB PSID and a LINE userId that share a value never merge two people.
  //   See readingToChatThread + the `customers` grouping in chat/page.tsx.
  customerKey: string;
  // 🧑‍🤝‍🧑 (2026-06-18) Only set on a deduped CUSTOMER card (grid/sidebar): the
  //   r-{id}s of every reading collapsed into it. Lets bot/takeover state be read
  //   across the whole customer instead of the volatile representative reading.
  memberIds?: string[];
  openedAt: string;
  // 🔲 (2026-06-11) Multi-view: funnel stage + epoch ms of last activity
  //   (lastTs is a display string — useless for ordering).
  stage?: ChatStage;
  // 🔍 (2026-06-19) Fine-grained "what are they doing now" label shown on the
  //   card (e.g. "เปิดไพ่ 7/10", "เปิดไพ่ครบ · รอวันเกิด"). undefined → use the
  //   coarse STAGE_META label.
  stageDetail?: string;
  lastTsMs?: number;
  bot: boolean;
  takenBy?: { initial: string; color: string };
  takenByName?: string;
  takenAt?: string;
  takenAtMs?: number;
  sentiment: 'happy' | 'neutral' | 'angry';
  priority?: string;
  pinReason?: string;
  last: string;
  lastTs: string;
  unread: number;
  vip: boolean;
  rarity: 'LEGENDARY' | 'EPIC' | 'RARE' | 'UNCOMMON' | 'COMMON';
  level: number;
  exp: string;
  credits: number;
  ltv: number;
  readings: number;
  due: number;
  // 💸 (2026-05-24) Payment state — drives the "✓ อนุมัติ 39/99" header
  //   button visibility. Mock threads default to true so the button doesn't
  //   flash on dev fixtures.
  isPaid?: boolean;
  messages: ChatMessage[];
};

export const CHAT_TEMPLATES = [
  'สวัสดีค่ะ ขอเลขท้ายบัตร 4 ตัวเพื่อยืนยันนะคะ',
  'ขออภัยในความล่าช้า กำลังตรวจสอบให้ค่ะ',
  'โอนเงินมาที่ KBANK xxx-2841 ชื่อ "ดูดวงแม่หมอบี"',
  'เครดิตของลูกค้ายังเหลืออยู่ค่ะ ลองทักบอทใหม่ได้เลย',
  'ขออภัย ระบบขัดข้องเล็กน้อย แม่หมอกำลังตอบให้ค่ะ',
  'ยินดีค่ะ ขอบคุณที่ใช้บริการ 🙏',
];

// 🧹 (2026-06-04) demo data removed — live data only
export const CHAT_THREADS: ChatThread[] = [];
