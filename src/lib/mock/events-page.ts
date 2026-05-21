import type { Channel, Tone } from './types';

export type FullEvent = {
  id: number | string;
  ts: string;
  kind: string;
  tone: Tone;
  category: 'payment' | 'reading' | 'sensitive' | 'system' | 'bot' | 'audit' | 'moderation';
  channel?: Channel;
  msg: string;
  actor?: string;
  ref: string;
};

export const EVENT_TOGGLES: Array<{ k: FullEvent['category']; tone: Tone; label: string }> = [
  { k: 'payment', tone: 'ok', label: 'จ่ายเงิน' },
  { k: 'reading', tone: 'info', label: 'ดูดวง' },
  { k: 'sensitive', tone: 'rose', label: 'อ่อนไหว' },
  { k: 'system', tone: 'warn', label: 'ระบบ' },
  { k: 'bot', tone: 'mystic', label: 'บอท' },
  { k: 'audit', tone: 'mystic', label: 'audit' },
  { k: 'moderation', tone: 'crit', label: 'เฝ้าระวัง' },
];

export const FULL_EVENTS: FullEvent[] = [
  { id: 1, ts: '14:33:08', kind: 'AUDIT', tone: 'mystic', category: 'audit', msg: 'แอน เปิด predict.html สำหรับ คุณพิมพ์ชนก', actor: 'แอน', ref: 'log-89' },
  { id: 2, ts: '14:32:51', kind: 'BOT', tone: 'mystic', category: 'bot', msg: 'AI Sentiment Watcher: flagged คุณวรากร mood=5', ref: 'evt-302' },
  { id: 3, ts: '14:32:18', kind: 'BAN', tone: 'crit', category: 'moderation', msg: 'แบนอัตโนมัติ — บัญชี multi-account คะแนน 92 → 24ชม.', actor: 'system', ref: 'mod-58' },
  { id: 4, ts: '14:32:08', kind: 'PAY OK', tone: 'ok', category: 'payment', channel: 'FB', msg: 'รับโอน ฿299 · บิล FB-0148 · คุณกิตติ ส.', ref: '#0148' },
  { id: 5, ts: '14:32:01', kind: 'READ', tone: 'info', category: 'reading', channel: 'LINE', msg: 'เริ่มคำทำนาย Celtic · คุณรัตนา ฉ. · qwen-72b', ref: 'r-9821' },
  { id: 6, ts: '14:31:54', kind: 'SENS', tone: 'rose', category: 'sensitive', channel: 'FB', msg: 'mood ระดับ 5 ตรวจพบในแชต · คุณวรากร พ.', ref: 'evt-302' },
  { id: 7, ts: '14:31:42', kind: 'AUDIT', tone: 'mystic', category: 'audit', msg: 'แอน เปิดปากบอทคืนให้คุณอภิญญา ม.', actor: 'แอน', ref: 'log-77' },
  { id: 8, ts: '14:31:30', kind: 'PAY ?', tone: 'warn', category: 'payment', msg: 'SMS KBANK ฿2,500 — ไม่จับคู่บิลอัตโนมัติ', ref: 'sms-918' },
  { id: 9, ts: '14:31:14', kind: 'SYS', tone: 'warn', category: 'system', msg: 'AI qwen-72b latency 1,420ms (threshold 1,000ms)', ref: 'metric' },
  { id: 10, ts: '14:30:55', kind: 'READ', tone: 'info', category: 'reading', channel: 'FB', msg: 'เสร็จคำทำนาย "ความรัก 3 เดือน" · 38 วินาที', ref: 'r-9819' },
  { id: 11, ts: '14:30:42', kind: 'PAY OK', tone: 'ok', category: 'payment', channel: 'LINE', msg: 'รับโอน ฿199 · บิล LN-3299 · คุณจิราพร ส.', ref: '#3299' },
  { id: 12, ts: '14:30:30', kind: 'AUDIT', tone: 'mystic', category: 'audit', msg: 'นัท รับเคส c-sens-002', actor: 'นัท', ref: 'log-76' },
  { id: 13, ts: '14:30:18', kind: 'AI ?', tone: 'warn', category: 'system', msg: 'AI ตอบไม่ได้: "แฟนชอบเราจริงมั้ย แม่หมอ"', ref: 'saved-12' },
  { id: 14, ts: '14:30:04', kind: 'READ', tone: 'info', category: 'reading', channel: 'LINE', msg: 'เริ่มดูดวงเร่งด่วน · คุณมนัสนันท์', ref: 'r-9818' },
  { id: 15, ts: '14:29:51', kind: 'BOT', tone: 'mystic', category: 'bot', msg: 'โพสต์ดวงรายวัน FB Page เผยแพร่แล้ว · เข้าถึง 8.4k', ref: 'post-451' },
  { id: 16, ts: '14:29:34', kind: 'PAY OK', tone: 'ok', category: 'payment', channel: 'LINE', msg: 'รับโอน ฿1,499 · Celtic · คุณกฤษณ์ ส.', ref: '#0145' },
  { id: 17, ts: '14:29:12', kind: 'SENS', tone: 'rose', category: 'sensitive', channel: 'LINE', msg: 'budget_blocked = true · คุณสมชาย จ.', ref: 'evt-301' },
  { id: 18, ts: '14:28:55', kind: 'WATCH', tone: 'crit', category: 'moderation', msg: 'เพิ่มในเฝ้าระวัง · คุณนนทกฤช (alias detected)', actor: 'system', ref: 'mod-57' },
  { id: 19, ts: '14:28:24', kind: 'PAY OK', tone: 'ok', category: 'payment', channel: 'FB', msg: 'รับโอน ฿599 · แพ็ค 5 ครั้ง · คุณมนัสนันท์', ref: '#0138' },
  { id: 20, ts: '14:27:50', kind: 'BOT', tone: 'mystic', category: 'bot', msg: 'แคมเปญ พฤษภาคม-มู: sent 1,240 · CTR 12%', ref: 'camp-9' },
];
