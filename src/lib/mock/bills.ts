import type { Channel } from './types';

export type BillStatus = 'open' | 'paid' | 'floating' | 'cancelled' | 'refunded';

export type Bill = {
  id: string;
  customer: string;
  channel: Channel;
  service: string;
  amount: number;
  status: BillStatus;
  when: string;
  paidAt?: string;
};

export const BILLS: Bill[] = [
  { id: 'FB-0149', customer: 'ละมัย ป.', channel: 'FB', service: 'ดูดวงเร่งด่วน 3 ใบ', amount: 299, status: 'open', when: '14:31' },
  { id: 'LN-3301', customer: 'กฤษณ์ ส.', channel: 'LINE', service: 'Celtic Cross การงาน', amount: 1499, status: 'open', when: '14:29' },
  { id: 'FB-0148', customer: 'กิตติ ส.', channel: 'FB', service: 'ดูดวงรายเดือน', amount: 199, status: 'paid', when: '14:30', paidAt: '14:32' },
  { id: 'LN-3299', customer: 'จิราพร ส.', channel: 'LINE', service: 'ทาโรต์ 3 ใบ', amount: 299, status: 'paid', when: '14:28', paidAt: '14:30' },
  { id: 'FB-0147', customer: 'ปิยะดา ก.', channel: 'FB', service: 'แพ็ค 5 ครั้ง', amount: 599, status: 'open', when: '14:25' },
  { id: 'LN-3298', customer: 'สุนิสา ม.', channel: 'LINE', service: 'ดูดวงรายเดือน', amount: 299, status: 'open', when: '14:18' },
  { id: 'FB-0145', customer: 'กิตติชัย ฉ.', channel: 'FB', service: 'เครดิต 50 ครั้ง', amount: 1990, status: 'open', when: '14:15' },
  { id: 'FB-0144', customer: 'นภัสสร ป.', channel: 'FB', service: 'Celtic Cross', amount: 1499, status: 'paid', when: '14:10', paidAt: '14:15' },
  { id: 'FB-0142', customer: 'พิมพ์ชนก ส.', channel: 'FB', service: 'Celtic Cross', amount: 2499, status: 'open', when: '14:00' },
  { id: 'FB-0141', customer: 'พรทิพย์ จ.', channel: 'FB', service: 'ทาโรต์ใบเดียว', amount: 99, status: 'floating', when: '14:00' },
  { id: 'LN-3284', customer: 'ธนกฤต ภ.', channel: 'LINE', service: 'Celtic Cross การงาน', amount: 1499, status: 'paid', when: '13:00', paidAt: '13:10' },
  { id: 'FB-0140', customer: 'อภิญญา ม.', channel: 'FB', service: 'ดูดวง 3 ใบ', amount: 299, status: 'paid', when: '13:50', paidAt: '14:00' },
  { id: 'FB-0138', customer: 'มนัสนันท์ ป.', channel: 'FB', service: 'แพ็ค 5 ครั้ง', amount: 599, status: 'paid', when: '13:30', paidAt: '14:08' },
  { id: 'LN-3270', customer: 'รัตนา ฉ.', channel: 'LINE', service: 'ทาโรต์ใบเดียว', amount: 99, status: 'paid', when: '13:20', paidAt: '13:30' },
  { id: 'FB-0131', customer: 'อภินันท์ ก.', channel: 'FB', service: 'Celtic Cross', amount: 1499, status: 'floating', when: '13:00' },
  { id: 'FB-0125', customer: 'สิทธิชัย ป.', channel: 'FB', service: 'เครดิต 50 ครั้ง', amount: 1990, status: 'floating', when: '12:30' },
  { id: 'LN-3258', customer: 'วราภรณ์ ม.', channel: 'LINE', service: 'ดูดวงเร่งด่วน', amount: 299, status: 'floating', when: '12:25' },
  { id: 'FB-0120', customer: 'ชาตรี ว.', channel: 'FB', service: 'แพ็ค 5 ครั้ง', amount: 599, status: 'refunded', when: '11:40', paidAt: '12:00' },
  { id: 'FB-0118', customer: '(ลูกค้า)', channel: 'FB', service: 'ทาโรต์ใบเดียว', amount: 99, status: 'cancelled', when: '11:30' },
];

const STATUS_LABEL: Record<BillStatus, string> = {
  open: 'รอจ่าย',
  paid: 'จ่ายแล้ว',
  floating: 'บิลลอย',
  cancelled: 'ยกเลิก',
  refunded: 'คืนเงิน',
};

const STATUS_TONE: Record<BillStatus, 'ok' | 'warn' | 'crit' | 'rose' | 'dim'> = {
  open: 'warn',
  paid: 'ok',
  floating: 'crit',
  cancelled: 'dim',
  refunded: 'rose',
};

export function billStatusLabel(s: BillStatus): string {
  return STATUS_LABEL[s];
}
export function billStatusTone(s: BillStatus) {
  return STATUS_TONE[s];
}
