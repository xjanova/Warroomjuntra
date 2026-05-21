import type { Channel, Tone } from './types';

export type SmsRecord = {
  id: string;
  bank: 'KBANK' | 'SCB';
  account: string;
  amount: number;
  sender: string;
  time: string;
  ref: string;
  bestMatchDelta: number | null;
};

export type OpenBill = {
  id: string;
  customer: string;
  channel: Channel;
  amount: number;
  service: string;
  waiting: number;
  celtic?: boolean;
};

export type FloatingBill = {
  id: string;
  customer: string;
  service: string;
  amount: number;
  channel: Channel;
  waiting: number;
  slip: boolean;
  slipNote: string;
};

export type LedgerEntry = {
  time: string;
  kind: string;
  tone: Tone;
  desc: string;
  amount: number;
  balance: number;
};

export const UNMATCHED_SMS: SmsRecord[] = [
  { id: 'sms-918', bank: 'KBANK', account: '2841', amount: 2500, sender: 'นางสาว พิมพ์ชนก ส*', time: '14:23:08', ref: 'X4892', bestMatchDelta: 1 },
  { id: 'sms-921', bank: 'KBANK', account: '2841', amount: 199, sender: 'นาย กิตติ ส*', time: '14:30:12', ref: 'X4895', bestMatchDelta: 0 },
  { id: 'sms-923', bank: 'SCB', account: '7732', amount: 5000, sender: 'นาย ธนะ ค*', time: '14:18:45', ref: '—', bestMatchDelta: null },
  { id: 'sms-925', bank: 'KBANK', account: '2841', amount: 1499, sender: 'นาย ธนกฤต ภ*', time: '13:08:22', ref: 'X4880', bestMatchDelta: 0 },
];

export const OPEN_BILLS: OpenBill[] = [
  { id: 'FB-0142', customer: 'พิมพ์ชนก ส.', channel: 'FB', amount: 2499, service: 'Celtic Cross "ความรักหลังเลิกแฟน"', waiting: 14, celtic: true },
  { id: 'LN-3299', customer: 'กิตติ ส.', channel: 'LINE', amount: 199, service: 'ดูดวงรายเดือน', waiting: 6 },
  { id: 'LN-3284', customer: 'ธนกฤต ภ.', channel: 'LINE', amount: 1499, service: 'Celtic Cross "การงานปีหน้า"', waiting: 54, celtic: true },
  { id: 'FB-0140', customer: 'อภิญญา ม.', channel: 'FB', amount: 299, service: 'ดูดวง 3 ใบ', waiting: 22 },
  { id: 'FB-0138', customer: 'มนัสนันท์ ป.', channel: 'FB', amount: 599, service: 'แพ็ค 5 ครั้ง', waiting: 38 },
  { id: 'LN-3270', customer: 'รัตนา ฉ.', channel: 'LINE', amount: 99, service: 'ทาโรต์ใบเดียว', waiting: 8 },
];

export const FLOATING_BILLS: FloatingBill[] = [
  { id: 'FB-0131', customer: 'อภินันท์ ก.', service: 'Celtic Cross', amount: 1499, channel: 'FB', waiting: 62, slip: true, slipNote: 'เบลอ' },
  { id: 'LN-3258', customer: 'วราภรณ์ ม.', service: 'ดูดวงเร่งด่วน', amount: 299, channel: 'LINE', waiting: 48, slip: true, slipNote: 'OK' },
  { id: 'FB-0125', customer: 'สิทธิชัย ป.', service: 'เครดิต 50 ครั้ง', amount: 1990, channel: 'FB', waiting: 35, slip: false, slipNote: '' },
  { id: 'LN-3249', customer: 'นภัสสร ล.', service: 'ทาโรต์ 7 ใบ', amount: 499, channel: 'LINE', waiting: 28, slip: true, slipNote: 'OK' },
  { id: 'FB-0119', customer: 'อัครพล ช.', service: 'ดูดวงรายเดือน', amount: 199, channel: 'FB', waiting: 18, slip: true, slipNote: 'ผิดธนาคาร' },
  { id: 'LN-3240', customer: '(ไม่ระบุชื่อ)', service: 'ทาโรต์ใบเดียว', amount: 99, channel: 'LINE', waiting: 8, slip: false, slipNote: '' },
];

export const LEDGER: LedgerEntry[] = [
  { time: '14:32:08', kind: 'PAY IN', tone: 'ok', desc: 'รับโอน · กิตติ ส. · LN-3299 · ดูดวงรายเดือน', amount: 199, balance: 48290 },
  { time: '14:31:30', kind: 'SMS ?', tone: 'warn', desc: 'SMS KBANK ฿2,500 · ยังไม่จับคู่ (สูงสุดต่างกัน +1฿)', amount: 0, balance: 48091 },
  { time: '14:30:42', kind: 'PAY IN', tone: 'ok', desc: 'รับโอน · จิราพร ส. · LN-3296 · ทาโรต์ 3 ใบ', amount: 299, balance: 48091 },
  { time: '14:29:34', kind: 'PAY IN', tone: 'ok', desc: 'รับโอน · กฤษณ์ ส. · LN-3280 · Celtic Cross', amount: 1499, balance: 47792 },
  { time: '14:25:12', kind: 'REFUND', tone: 'crit', desc: 'คืนเงิน · ชาตรี ว. · เคสคืนเงิน 599', amount: -599, balance: 46293 },
  { time: '14:18:42', kind: 'SMS ?', tone: 'warn', desc: 'SMS SCB ฿5,000 · ไม่พบบิลใกล้ — รอตามลูกค้า', amount: 0, balance: 46892 },
  { time: '14:15:22', kind: 'PAY IN', tone: 'ok', desc: 'รับโอน · นภัสสร ป. · FB-0136 · Celtic', amount: 1499, balance: 46892 },
  { time: '14:10:00', kind: 'COMM', tone: 'mystic', desc: 'จ่ายคอมมิชชั่น · แม่หมอบี · สัปดาห์ 19', amount: -4200, balance: 45393 },
  { time: '14:02:18', kind: 'PAY IN', tone: 'ok', desc: 'รับโอน · ปัทมา จ. · FB-0135 · แพ็ค 10', amount: 990, balance: 49593 },
  { time: '13:55:44', kind: 'PAY IN', tone: 'ok', desc: 'รับโอน · อมรินทร์ ภ. · LN-3268', amount: 599, balance: 48603 },
  { time: '13:48:30', kind: 'PAY IN', tone: 'ok', desc: 'รับโอน · ภคพร ส. · FB-0133', amount: 299, balance: 48004 },
  { time: '13:30:00', kind: 'COMM', tone: 'mystic', desc: 'จ่ายคอมมิชชั่น · แม่หมอแอม · สัปดาห์ 19', amount: -18000, balance: 47705 },
];

export const PAYMENT_TABS = [
  { k: 'match', label: 'จับคู่ SMS ↔ บิล', count: 4, tone: 'warn' as Tone },
  { k: 'floating', label: 'บิลลอย', count: 6, tone: 'crit' as Tone },
  { k: 'ledger', label: 'สมุดบัญชีวันนี้', count: 42, tone: 'info' as Tone },
];

export const PAYMENT_KPIS = [
  { label: 'รับเงินวันนี้', value: '฿48,290', sub: '42 รายการ', color: '#10b981' },
  { label: 'จับคู่อัตโนมัติ', value: '38 / 42', sub: '90.5%', color: '#e5e7eb', subColor: '#10b981' },
  { label: 'รอกระทบยอด', value: '4', sub: '+1 ใน 5 นาที', color: '#f59e0b', subColor: '#f59e0b' },
  { label: 'บิลลอย', value: '6', sub: 'มูลค่า ฿1,794', color: '#ef4444', subColor: '#ef4444' },
  { label: 'คืนเงินวันนี้', value: '฿599', sub: '1 รายการ', color: '#e5e7eb' },
];
