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

export type ChatThread = {
  id: string;
  name: string;
  channel: Channel;
  psid: string;
  userId?: number | null;
  openedAt: string;
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
