import type { Channel, Tone } from './types';

export type ApprovalKind = 'COMM' | 'BILL' | 'REFUND' | 'CREDIT';

export type ApprovalItem = {
  id: string;
  kind: ApprovalKind;
  tone: Tone;
  title: string;
  note: string;
  party: string;
  channel?: Channel | null;
  amount: number;
  when: string;
  by: string;
  detail: string;
  evidence?: { label: string; value: string }[];
};

export const APPROVAL_TABS = [
  { k: 'all', label: 'ทั้งหมด', count: 23, tone: 'warn' as Tone },
  { k: 'comm', label: 'คอมมิชชั่น', count: 6, tone: 'mystic' as Tone },
  { k: 'bill', label: 'แก้บิล', count: 4, tone: 'warn' as Tone },
  { k: 'refund', label: 'คืนเงิน', count: 4, tone: 'crit' as Tone },
  { k: 'credit', label: 'เครดิต', count: 9, tone: 'info' as Tone },
];

export const APPROVAL_ITEMS: ApprovalItem[] = [
  {
    id: 'a1', kind: 'COMM', tone: 'mystic',
    title: 'แม่หมอบี — Celtic Cross 12 ใบ', note: 'พฤษภาคม · 15%',
    party: 'แม่หมอบี', channel: null, amount: 18000, when: '14:10', by: 'system',
    detail: 'คอมมิชชั่นรายสัปดาห์ที่ 19 — 12 เคส × ฿1,499 × 15% × multiplier 1.0',
    evidence: [
      { label: 'จำนวนเคส', value: '12 ใบ' },
      { label: 'rating เฉลี่ย', value: '4.92 / 5' },
      { label: 'รีวิว 1 ดาว', value: '0' },
    ],
  },
  {
    id: 'a2', kind: 'BILL', tone: 'warn',
    title: 'ส่วนต่างยอดโอน คุณพิมพ์ชนก', note: '+฿1.00 · บิล 0142',
    party: 'พิมพ์ชนก ส.', channel: 'FB', amount: 1, when: '14:24', by: 'แอน',
    detail: 'ลูกค้าโอนเกินจริง 1 บาท — ขออนุมัติยอมรับเข้ารายได้ (ไม่คืน)',
    evidence: [
      { label: 'SMS', value: 'KBANK ฿2,500 จากนางสาวพิมพ์ชนก' },
      { label: 'บิล', value: 'FB-0142 · ฿2,499' },
    ],
  },
  {
    id: 'a3', kind: 'REFUND', tone: 'crit',
    title: 'คืนเงิน คุณชาตรี', note: 'AI ตอบไม่ตรง · 599฿',
    party: 'ชาตรี ว.', channel: 'FB', amount: -599, when: '14:25', by: 'แอน',
    detail: 'ลูกค้าทักว่า "AI ตอบไม่ตรงคำถามเลยค่ะ ขอคืนเงิน" — แอนยืนยันว่า AI ตอบนอกประเด็นจริง',
    evidence: [
      { label: 'คำถาม', value: 'งานที่สมัครจะได้ไหม' },
      { label: 'คำตอบ AI', value: '(ตอบเรื่องความรักแทน)' },
    ],
  },
  { id: 'a4', kind: 'COMM', tone: 'mystic', title: 'แม่หมอบี — รายสัปดาห์', note: '18 เคส', party: 'แม่หมอบี', channel: null, amount: 4200, when: '14:00', by: 'system', detail: 'คอมรายสัปดาห์', evidence: [] },
  { id: 'a5', kind: 'CREDIT', tone: 'info', title: 'เติมเครดิต VIP คุณกฤษณ์', note: 'แพ็ค 50 ครั้ง', party: 'กฤษณ์ ส.', channel: 'LINE', amount: 1990, when: '13:55', by: 'นัท', detail: 'VIP เติมเครดิต', evidence: [] },
  { id: 'a6', kind: 'REFUND', tone: 'crit', title: 'คืนเงิน คุณรุ่งทิวา', note: 'ลูกค้าเปลี่ยนใจ', party: 'รุ่งทิวา ก.', channel: 'FB', amount: -299, when: '13:42', by: 'ปอนด์', detail: 'ขอคืน', evidence: [] },
  { id: 'a7', kind: 'CREDIT', tone: 'info', title: 'แถมเครดิต ลูกค้าใหม่', note: 'แคมเปญ "พฤษภามู"', party: 'อนุชา พ.', channel: 'LINE', amount: 99, when: '13:30', by: 'system', detail: 'จากแคมเปญ', evidence: [] },
  { id: 'a8', kind: 'COMM', tone: 'mystic', title: 'แม่หมอแอม — รายเดือน', note: '42 เคส', party: 'แม่หมอแอม', channel: null, amount: 18000, when: '13:15', by: 'system', detail: 'คอมเดือน', evidence: [] },
  { id: 'a9', kind: 'BILL', tone: 'warn', title: 'แก้ยอดบิล LN-3270', note: 'พิมพ์ผิด ฿100→฿199', party: 'รัตนา ฉ.', channel: 'LINE', amount: 99, when: '13:00', by: 'แอน', detail: 'แก้บิล', evidence: [] },
  { id: 'a10', kind: 'CREDIT', tone: 'info', title: 'รีเซ็ตเครดิตฟรี — ลูกค้าเก่า 6 เดือน', note: '200 ราย', party: '(batch)', channel: null, amount: 1980, when: '12:50', by: 'แอน', detail: 'รีเซ็ตให้กลุ่มลูกค้าเก่า', evidence: [] },
];

export const APPROVAL_STATS = [
  { label: 'รออนุมัติ', value: '23', sub: '฿86,420 รวม', color: '#f59e0b' },
  { label: 'คอมมิชชั่น', value: '฿62,400', sub: '6 แม่หมอ', color: '#8b5cf6' },
  { label: 'คืนเงิน', value: '฿3,494', sub: '4 ราย', color: '#ef4444' },
  { label: 'เครดิตพิเศษ', value: '฿18,750', sub: '9 ราย', color: '#22d3ee' },
  { label: 'วันนี้อนุมัติแล้ว', value: '฿42,290', sub: '38 รายการ', color: '#10b981' },
];
