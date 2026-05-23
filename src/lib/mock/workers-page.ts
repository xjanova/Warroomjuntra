import type { Channel } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// DM Workers page mocks
//
// "Worker" คือกระบวนการอัตโนมัติที่ระบบ spawn ขึ้นมาเพื่อตอบ DM กลับคนที่
// คอมเม้นต์ใต้โพสต์ FB/LINE. แต่ละ worker หยิบงานจาก queue ทีละราย → ส่ง
// Private Reply / Push message → log ผลลัพธ์.
//
// หน้านี้ยังไม่มี endpoint ฝั่ง thaiprompt.online — รัน mock-first พร้อม
// realtime tick ที่ทำใน client (setInterval) เพื่อให้เห็นโครงสร้างก่อนต่อ
// backend ในรอบถัดไป.
// ─────────────────────────────────────────────────────────────────────────────

export type WorkerState =
  | 'processing'   // กำลังพิมพ์/ส่งหา target
  | 'cooldown'     // FB rate limit cooldown
  | 'idle'         // ว่างรอ queue
  | 'error';       // ล่าสุด fail (จะ retry)

export type WorkerTarget = {
  psid: string;
  name: string;
  avatar: string;        // emoji หรือ initial
  comment: string;       // คอมเม้นต์ที่ลูกค้าทิ้งไว้
  channel: Channel;
  postTitle: string;     // โพสต์ที่คอมเม้นต์ใต้นั้น
};

export type DmWorker = {
  id: string;            // 'DM-W01' …
  pid: number;           // PID หลอกๆ ให้ดูเหมือนเป็น process
  state: WorkerState;
  target: WorkerTarget | null;
  tasksDone: number;     // ตอบไปแล้วในกะนี้
  tasksTotal: number;    // ที่ assign มาในกะนี้
  rate: number;          // reply/min
  avgLatencyMs: number;  // ms ต่อ reply
  startedAt: string;     // 'HH:mm' boot time
  uptimeMin: number;
  errorReason?: string;  // ใส่ตอน state='error'
  cooldownUntil?: string;// 'HH:mm:ss' ตอน state='cooldown'
};

export type WorkerActivity = {
  id: string;
  ts: string;            // 'HH:mm:ss'
  workerId: string;
  customer: string;
  channel: Channel;
  comment: string;       // ที่ลูกค้าคอมเม้นต์
  reply: string;         // ที่ worker ส่งกลับ
  status: 'ok' | 'fail' | 'sending';
  latencyMs: number;
};

export type WorkerQueueStats = {
  pending: number;       // รอใน queue
  sent: number;          // ส่งสำเร็จในกะนี้
  failed: number;        // fail ในกะนี้
  totalAssigned: number; // = pending + sent + failed + กำลังประมวลผล
  throughput: number;    // reply/min (รวมทุก worker)
  avgLatencyMs: number;  // เฉลี่ยทั้งฝูง
};

// ─── seed: 8 workers ──────────────────────────────────────────────────────────

const SAMPLE_COMMENTS = [
  'อยากรู้ดวงสัปดาห์นี้ค่ะ',
  'รับดูดวงไหมคะ',
  'inbox มาเลย',
  'แม่นไหม',
  'ราคาเท่าไหร่',
  'ขอเลขเด็ดด้วย',
  'จะหายอด 4 พ.ค. มั้ยคะ',
  'ตอบช้ามาก งง',
  'ขอความรักหน่อยค่า',
  'ดูงานหน่อย',
  'ทำไมยังไม่ตอบ',
  'อยากปรึกษา',
];

const SAMPLE_NAMES = [
  ['🌸', 'น้องแพรว', '7102992184'],
  ['💎', 'คุณนุช', '1834441902'],
  ['🌙', 'พี่อ้อย', '4290120993'],
  ['⭐', 'มะปราง', '2884451111'],
  ['🔮', 'ฟ้า', '9028441820'],
  ['🌺', 'พลอย', '5512887119'],
  ['☕', 'ก้อย', '8810002991'],
  ['🍀', 'นนท์', '7711882200'],
  ['🦋', 'ใบเฟิร์น', '3010998777'],
  ['🌹', 'เอม', '6678553311'],
] as const;

const SAMPLE_POSTS = [
  'ดวงรายสัปดาห์ 12 ราศี',
  'เผยเลขนำโชค 1 พ.ค.',
  'ความรักเดือนนี้',
  'การงาน-การเงิน',
  'ไพ่ Celtic Cross จัดเต็ม',
];

export function makeRandomTarget(seedIdx: number): WorkerTarget {
  const n = SAMPLE_NAMES[seedIdx % SAMPLE_NAMES.length];
  return {
    psid: n[2],
    name: n[1],
    avatar: n[0],
    comment: SAMPLE_COMMENTS[seedIdx % SAMPLE_COMMENTS.length],
    channel: seedIdx % 3 === 0 ? 'LINE' : 'FB',
    postTitle: SAMPLE_POSTS[seedIdx % SAMPLE_POSTS.length],
  };
}

export const INITIAL_WORKERS: DmWorker[] = [
  { id: 'DM-W01', pid: 28114, state: 'processing', target: makeRandomTarget(0), tasksDone: 42, tasksTotal: 60, rate: 8.4, avgLatencyMs: 920, startedAt: '08:02', uptimeMin: 312 },
  { id: 'DM-W02', pid: 28119, state: 'processing', target: makeRandomTarget(1), tasksDone: 38, tasksTotal: 60, rate: 7.9, avgLatencyMs: 1080, startedAt: '08:02', uptimeMin: 312 },
  { id: 'DM-W03', pid: 28124, state: 'processing', target: makeRandomTarget(2), tasksDone: 51, tasksTotal: 60, rate: 9.1, avgLatencyMs: 880, startedAt: '08:02', uptimeMin: 312 },
  { id: 'DM-W04', pid: 28129, state: 'cooldown', target: null,                  tasksDone: 47, tasksTotal: 60, rate: 0.0, avgLatencyMs: 1120, startedAt: '08:02', uptimeMin: 312, cooldownUntil: '14:32:10' },
  { id: 'DM-W05', pid: 28134, state: 'processing', target: makeRandomTarget(4), tasksDone: 35, tasksTotal: 60, rate: 7.2, avgLatencyMs: 1240, startedAt: '08:05', uptimeMin: 309 },
  { id: 'DM-W06', pid: 28139, state: 'idle',       target: null,                tasksDone: 60, tasksTotal: 60, rate: 0.0, avgLatencyMs: 990,  startedAt: '08:05', uptimeMin: 309 },
  { id: 'DM-W07', pid: 28144, state: 'error',      target: makeRandomTarget(6), tasksDone: 22, tasksTotal: 60, rate: 4.1, avgLatencyMs: 2210, startedAt: '08:30', uptimeMin: 284, errorReason: 'FB#10 — outside 24h window' },
  { id: 'DM-W08', pid: 28149, state: 'processing', target: makeRandomTarget(7), tasksDone: 44, tasksTotal: 60, rate: 8.6, avgLatencyMs: 1010, startedAt: '08:30', uptimeMin: 284 },
];

export const INITIAL_QUEUE_STATS: WorkerQueueStats = {
  pending: 138,
  sent: 339,
  failed: 9,
  totalAssigned: 480,
  throughput: 45.3,
  avgLatencyMs: 1058,
};

const REPLY_TEMPLATES = [
  'สวัสดีค่าาา ทักทายผ่าน DM นะคะ พี่หมอกำลังเปิดไพ่ให้เลยค่า ✨',
  'ขอบคุณที่ทักมานะคะ ตอนนี้มีโปรดูดวง Celtic 99฿ สนใจไหมคะ 🔮',
  'รับค่าาา ส่งวันเดือนปีเกิดมาในนี้เลยนะคะ',
  'พี่หมอเห็นคอมเม้นต์แล้วค่ะ ขอเปิด 3 ใบให้เลยนะคะ 💫',
  'ขอวันเดือนปีเกิด เวลาที่จำได้ และคำถาม 1 ข้อหลักนะคะ',
];

const seedActivity = (i: number, base: number): WorkerActivity => {
  const n = SAMPLE_NAMES[i % SAMPLE_NAMES.length];
  const worker = INITIAL_WORKERS[i % INITIAL_WORKERS.length];
  const ts = new Date(base - i * 7_500);
  const fail = i === 4;
  return {
    id: `act-${i}`,
    ts: ts.toTimeString().slice(0, 8),
    workerId: worker.id,
    customer: n[1],
    channel: i % 3 === 0 ? 'LINE' : 'FB',
    comment: SAMPLE_COMMENTS[i % SAMPLE_COMMENTS.length],
    reply: fail ? '(no reply — over rate limit)' : REPLY_TEMPLATES[i % REPLY_TEMPLATES.length],
    status: fail ? 'fail' : 'ok',
    latencyMs: 850 + (i % 6) * 140,
  };
};

export const INITIAL_ACTIVITY: WorkerActivity[] = (() => {
  const now = Date.now();
  return Array.from({ length: 14 }, (_, i) => seedActivity(i, now));
})();

// ─── helpers ──────────────────────────────────────────────────────────────────

export function workerStateLabel(s: WorkerState): string {
  return {
    processing: 'กำลังตอบ',
    cooldown:   'พักคูลดาวน์',
    idle:       'ว่าง',
    error:      'ผิดพลาด',
  }[s];
}

export function workerStateTone(s: WorkerState): 'ok' | 'warn' | 'crit' | 'info' | 'dim' {
  return {
    processing: 'info',
    cooldown:   'warn',
    idle:       'dim',
    error:      'crit',
  }[s] as 'ok' | 'warn' | 'crit' | 'info' | 'dim';
}

export function workerStateColor(s: WorkerState): string {
  return {
    processing: '#22d3ee',
    cooldown:   '#f59e0b',
    idle:       '#6b7280',
    error:      '#ef4444',
  }[s];
}
