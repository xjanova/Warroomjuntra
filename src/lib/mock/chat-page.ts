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

export const CHAT_THREADS: ChatThread[] = [
  {
    id: 'ch1', name: 'พิมพ์ชนก ส.', channel: 'FB', psid: '1042883', openedAt: '14:18',
    bot: false, takenBy: { initial: 'AN', color: '#22d3ee' }, takenByName: 'แอน',
    takenAt: '14:26:34', sentiment: 'angry',
    priority: 'bill', pinReason: '💰 บิล ฿1,499 · ยอดไม่ตรง',
    last: 'ทำไมโอนแล้วยังไม่ได้คำตอบคะ', lastTs: '14:24', unread: 0, vip: true,
    rarity: 'LEGENDARY', level: 28, exp: '1280/2000', credits: 142, ltv: 24599, readings: 189, due: 1499,
    messages: [
      { id: 1, role: 'system', text: 'เริ่มสนทนา · 14:18' },
      { id: 2, role: 'user', ts: '14:18', text: 'สวัสดีค่ะ อยากดู Celtic Cross เรื่องความรักหน่อยค่ะ' },
      { id: 3, role: 'bot', ts: '14:18', ai: 'gemini', text: 'สวัสดีค่ะคุณพิมพ์ชนก 🔮 Celtic Cross ค่าบริการ 1,499 บาท โอนมาที่ KBANK xxx-2841 แล้วส่งสลิปได้เลยนะคะ' },
      { id: 4, role: 'user', ts: '14:20', text: '(ส่งสลิปโอน 2,500 บาท)' },
      { id: 5, role: 'bot', ts: '14:20', ai: 'gemini', text: 'ระบบกำลังตรวจสอบยอดเงิน รอสักครู่นะคะ ✨' },
      { id: 6, role: 'system', text: '⚠ ยอดโอน 2,500฿ ไม่ตรงบิล (ค่าบริการ 1,499฿) — รอแอดมินจับคู่' },
      { id: 7, role: 'user', ts: '14:24', text: 'ทำไมโอนแล้วยังไม่ได้คำตอบคะ 😤' },
      { id: 8, role: 'system', text: 'แอน รับเคสและปิดปากบอท · 14:26' },
      { id: 9, role: 'admin', by: 'แอน', ts: '14:26', text: 'สวัสดีค่ะคุณพิมพ์ชนก ขออภัยด้วยนะคะ แอนรับเรื่องเองค่ะ คุณโอนเกินมา 1 บาทพอดี ขออภัยมากเลยที่ระบบจับคู่ไม่ได้' },
      { id: 10, role: 'user', ts: '14:28', text: 'อ๋อ ส่วนต่างเก็บไว้เลยค่ะ ขอดูดวงเร็วๆ ได้มั้ย' },
      { id: 11, role: 'admin', by: 'แอน', ts: '14:29', text: 'ได้เลยค่ะ 🙏 เดี๋ยวจับคู่ให้และส่งคำทำนายภายใน 30 นาทีนะคะ' },
    ],
  },
  {
    id: 'ch2', name: 'ปวีณา ก.', channel: 'LINE', psid: 'U-a4d9f1', openedAt: '14:21',
    bot: true, sentiment: 'neutral',
    last: '(บอทกำลังพิมพ์...)', lastTs: '14:32', unread: 0, vip: false,
    rarity: 'RARE', level: 12, exp: '420/800', credits: 8, ltv: 1290, readings: 24, due: 0,
    messages: [
      { id: 1, role: 'system', text: 'เริ่มสนทนา · 14:21' },
      { id: 2, role: 'user', ts: '14:21', text: 'อยากดูดวงรายเดือนค่ะ' },
      { id: 3, role: 'bot', ts: '14:21', ai: 'groq', text: 'สวัสดีค่ะคุณปวีณา 🌙 ใช้เครดิตฟรี 1 ครั้งนะคะ กำลังเตรียมดวงรายเดือนของคุณ...' },
      { id: 4, role: 'bot', ts: '14:32', ai: 'groq', text: 'พฤษภาคมนี้ดาวพฤหัสในเรือนงานเด่นมาก ✨ มีโอกาสได้รับข่าวดีเรื่องการเงินช่วงกลางเดือน...' },
    ],
  },
  {
    id: 'ch3', name: 'วรากร พ.', channel: 'FB', psid: '1098232', openedAt: '14:11',
    bot: false, takenBy: { initial: 'NT', color: '#10b981' }, takenByName: 'นัท',
    takenAt: '14:18', sentiment: 'angry',
    priority: 'sensitive', pinReason: '🚨 mood 5 · ขู่รีวิว 1 ดาว',
    last: 'ถ้าไม่คืนเงินจะไปรีวิวให้ดู', lastTs: '14:29', unread: 2, vip: false,
    rarity: 'COMMON', level: 4, exp: '40/100', credits: 0, ltv: 599, readings: 3, due: 0,
    messages: [
      { id: 1, role: 'user', ts: '14:11', text: 'ดูดวงไม่ตรงเลย คืนเงินด้วยครับ' },
      { id: 2, role: 'bot', ts: '14:11', ai: 'gemini', text: 'ขออภัยด้วยค่ะ ระบบจะแจ้งทีมแม่หมอให้ตรวจสอบนะคะ' },
      { id: 3, role: 'user', ts: '14:18', text: 'ถ้าไม่คืนเงินจะไปรีวิวให้ดู' },
      { id: 4, role: 'system', text: 'AI Sentiment Watcher · mood 5 ตรวจพบ · escalate' },
      { id: 5, role: 'admin', by: 'นัท', ts: '14:19', text: 'สวัสดีค่ะคุณวรากร นัทดูแลเรื่องนี้ให้นะคะ ขอเช็คคำทำนายของคุณสักครู่' },
    ],
  },
  {
    id: 'ch4', name: 'ธนกฤต ภ.', channel: 'LINE', psid: 'U-b8c2', openedAt: '13:08',
    bot: false, takenBy: { initial: 'BE', color: '#8b5cf6' }, takenByName: 'แม่หมอบี',
    takenAt: '13:15', sentiment: 'neutral',
    priority: 'celtic', pinReason: '🔮 Celtic Cross · เกินกำหนด',
    last: 'รอคำตอบ Celtic Cross ครับ', lastTs: '14:00', unread: 1, vip: true,
    rarity: 'EPIC', level: 18, exp: '720/1200', credits: 54, ltv: 9420, readings: 62, due: 0,
    messages: [
      { id: 1, role: 'user', ts: '13:08', text: 'อยากดู Celtic Cross เรื่องงานปีหน้าครับ' },
      { id: 2, role: 'admin', by: 'แม่หมอบี', ts: '13:15', text: 'รับเรื่องค่ะ จะอ่านให้ละเอียดนะคะ' },
      { id: 3, role: 'user', ts: '14:00', text: 'รอคำตอบ Celtic Cross ครับ' },
    ],
  },
  {
    id: 'ch5', name: 'อภิญญา ม.', channel: 'FB', psid: '1124492', openedAt: '14:30',
    bot: true, sentiment: 'happy',
    last: 'ขอบคุณค่า แม่หมอ ❤️', lastTs: '14:31', unread: 0, vip: false,
    rarity: 'UNCOMMON', level: 7, exp: '180/400', credits: 3, ltv: 299, readings: 8, due: 0,
    messages: [
      { id: 1, role: 'user', ts: '14:30', text: 'แม่นมากค่า ขอบคุณนะคะ' },
      { id: 2, role: 'bot', ts: '14:30', ai: 'groq', text: 'ยินดีค่ะ ✨ ขอให้พลังบวกอยู่กับคุณตลอดเดือนพฤษภาคมนะคะ' },
      { id: 3, role: 'user', ts: '14:31', text: 'ขอบคุณค่า แม่หมอ ❤️' },
    ],
  },
  {
    id: 'ch6', name: 'จิราพร ส.', channel: 'LINE', psid: 'U-c8a2', openedAt: '14:28',
    bot: true, sentiment: 'neutral',
    last: 'ดูดวงรายเดือนหน่อยค่ะ', lastTs: '14:28', unread: 0, vip: false,
    rarity: 'UNCOMMON', level: 8, exp: '120/400', credits: 1, ltv: 498, readings: 7, due: 0,
    messages: [
      { id: 1, role: 'user', ts: '14:28', text: 'ดูดวงรายเดือนหน่อยค่ะ' },
    ],
  },
];
