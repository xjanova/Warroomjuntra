import type { Channel, Tone } from './types';

export type Suspect = {
  id: string;
  name: string;
  psid: string;
  channel: Channel;
  level: number; // 0 ปกติ - 4 แบน
  score: number;
  aliases: number;
  reasons: string[];
  lastActive: string;
  signals?: { k: string; label: string; tone: Tone; value: string }[];
  evidence?: { ts: string; tag: string; severity: 'crit' | 'warn'; text: string }[];
  audit?: { ts: string; action: string; by: string }[];
  aliasList?: { name: string; channel: Channel; match: number }[];
};

export type BannedUser = {
  id: string;
  name: string;
  psid: string;
  channel: Channel;
  reason: string;
  by: string;
  bannedAt: string;
  endsAt: string;
  permanent: boolean;
};

export const MOD_TABS = [
  { k: 'list', label: 'รายการเฝ้าระวัง', count: 42, tone: 'warn' as Tone },
  { k: 'banned', label: 'แบนแล้ว', count: 147, tone: 'crit' as Tone },
  { k: 'rules', label: 'กฎอัตโนมัติ', count: 6, tone: 'info' as Tone },
];

export const SUSPECTS: Suspect[] = [
  {
    id: 's1', name: 'วรากร พ.', psid: '1098232', channel: 'FB', level: 4, score: 78, aliases: 1,
    reasons: ['ขู่/รีวิว', 'คำหยาบ', 'mood swing'], lastActive: '2 นาที',
    signals: [
      { k: 'threats', label: 'ขู่จะรีวิว 1 ดาว / ฟ้อง', tone: 'crit', value: '3 ครั้ง' },
      { k: 'profanity', label: 'คำหยาบ', tone: 'crit', value: '7 ครั้ง' },
      { k: 'mood', label: 'mood swing happy→angry', tone: 'warn', value: '2 ครั้ง' },
      { k: 'spam', label: 'ทักซ้ำใน 5 นาที', tone: 'warn', value: '4 ครั้ง' },
    ],
    evidence: [
      { ts: '14:29', tag: 'ขู่', severity: 'crit', text: 'ถ้าไม่คืนเงินจะไปรีวิวให้ดู' },
      { ts: '14:24', tag: 'คำหยาบ', severity: 'crit', text: '(ข้อความถูกเซ็นเซอร์) ... โกหก' },
      { ts: '14:18', tag: 'ทักซ้ำ', severity: 'warn', text: '(ส่งข้อความเดียวกัน 4 ครั้ง)' },
    ],
    audit: [
      { ts: '14:31', action: 'เพิ่มในเฝ้าระวัง (อัตโนมัติ)', by: 'system' },
      { ts: '14:24', action: 'flag คำหยาบ', by: 'system' },
    ],
  },
  {
    id: 's2', name: 'นนทกฤช ส.', psid: '1199822', channel: 'FB', level: 5, score: 92, aliases: 3,
    reasons: ['multi-account', 'สแปม', 'ขายของ'], lastActive: '5 นาที',
    aliasList: [
      { name: 'Nontakrich S.', channel: 'FB', match: 97 },
      { name: 'น้องเอ้ ดูดวง', channel: 'LINE', match: 88 },
      { name: '(บัญชีใหม่ 3 วัน)', channel: 'FB', match: 81 },
    ],
    signals: [
      { k: 'multi', label: 'IP fingerprint ตรง 3 บัญชี', tone: 'crit', value: '97%' },
      { k: 'sales', label: 'พยายามขายของ/ลิงก์', tone: 'crit', value: '12 ครั้ง' },
      { k: 'spam', label: 'ทักซ้ำ', tone: 'warn', value: '8 ครั้ง' },
    ],
    evidence: [
      { ts: '14:32', tag: 'ขายของ', severity: 'crit', text: 'รับดูดวงราคาถูกกว่า inbox มาคุยเลย' },
      { ts: '14:30', tag: 'ลิงก์', severity: 'crit', text: 'mor[link].com/9d2f' },
    ],
    audit: [
      { ts: '14:32', action: 'พบ alias เพิ่ม (88%)', by: 'system' },
      { ts: '14:00', action: 'เพิ่มในเฝ้าระวัง', by: 'แอน' },
    ],
  },
  {
    id: 's3', name: 'สมชาย จ.', psid: 'U-d4f1aa', channel: 'LINE', level: 3, score: 54, aliases: 1,
    reasons: ['mood swing', 'budget block'], lastActive: '8 นาที',
    signals: [
      { k: 'mood', label: 'mood swing บ่อย', tone: 'warn', value: '3 ครั้ง/สัปดาห์' },
      { k: 'budget', label: 'budget_blocked', tone: 'info', value: 'true' },
    ],
    evidence: [{ ts: '14:31', tag: 'mood', severity: 'warn', text: 'ขอคุยแม่หมอจริง ไม่อยากคุยกับ AI' }],
    audit: [{ ts: '14:10', action: 'เพิ่มในเฝ้าระวังเอง', by: 'ปอนด์' }],
  },
  {
    id: 's4', name: '(บัญชีใหม่ 24ชม)', psid: '1209911', channel: 'FB', level: 3, score: 62, aliases: 2,
    reasons: ['บัญชีใหม่', 'รูปโปรไฟล์ซ้ำ', 'ทักหลายร้าน'], lastActive: '12 นาที',
    signals: [
      { k: 'newacc', label: 'บัญชีอายุ < 24 ชม.', tone: 'warn', value: 'true' },
      { k: 'photo', label: 'รูปโปรไฟล์ตรงกับ alias', tone: 'warn', value: '95%' },
    ],
    evidence: [{ ts: '14:20', tag: 'ทดสอบ', severity: 'warn', text: 'ดูดวงฟรีได้ไหมครับ ขอลองดู' }],
    audit: [],
  },
  {
    id: 's5', name: '(ไม่ระบุชื่อ)', psid: '1212344', channel: 'FB', level: 2, score: 38, aliases: 1,
    reasons: ['ทักซ้ำ'], lastActive: '18 นาที',
    signals: [{ k: 'spam', label: 'ส่ง "?" ซ้ำ', tone: 'warn', value: '6 ครั้ง' }],
    evidence: [{ ts: '14:14', tag: 'ซ้ำ', severity: 'warn', text: '? ? ? ? ?' }],
    audit: [],
  },
  {
    id: 's6', name: 'มานพ ส.', psid: 'U-c8e1f2', channel: 'LINE', level: 2, score: 28, aliases: 1,
    reasons: ['ทักนอกเวลา'], lastActive: '2 ชม.',
    signals: [{ k: 'time', label: 'ทัก 02:30-05:00 บ่อย', tone: 'info', value: '14 ครั้ง' }],
    evidence: [],
    audit: [],
  },
];

export const BANNED: BannedUser[] = [
  { id: 'b1', name: 'ปรเมศวร์ ม.', psid: '1188332', channel: 'FB', reason: 'แบนหลังขู่ฟ้อง+โพสต์รีวิว 1 ดาวพร้อมเปิดเผยข้อมูล', by: 'แอน', bannedAt: 'พ.ค. 20 · 18:22', endsAt: 'พ.ค. 21 · 18:22', permanent: false },
  { id: 'b2', name: '(สแปมเมอร์)', psid: '1199844', channel: 'FB', reason: 'multi-account ขายของ 12 ครั้ง', by: 'นัท', bannedAt: 'พ.ค. 19 · 14:10', endsAt: '—', permanent: true },
  { id: 'b3', name: 'จงรักษ์ ห.', psid: 'U-aa11bb', channel: 'LINE', reason: 'คำหยาบรุนแรง', by: 'system', bannedAt: 'พ.ค. 18 · 11:42', endsAt: 'พ.ค. 21 · 11:42', permanent: false },
  { id: 'b4', name: '(บอท)', psid: 'U-aa22cc', channel: 'LINE', reason: 'ทักซ้ำ 200+ ครั้ง / นาที', by: 'system', bannedAt: 'พ.ค. 18 · 09:11', endsAt: '—', permanent: true },
  { id: 'b5', name: 'ภานุพงศ์ จ.', psid: '1199001', channel: 'FB', reason: 'พยายามเข้าเป็น admin', by: 'แอน', bannedAt: 'พ.ค. 17 · 22:38', endsAt: '—', permanent: true },
];

export const SPAM_WORDS = ['ขายของ', 'ปลด', 'ดูดวงฟรี', 'รับงาน', 'พนัน', 'ยา', 'คาสิโน', 'dm me'];

export function levelLabel(l: number) {
  return ['ปกติ', 'สงสัย', 'เฝ้าระวัง', 'ใกล้แบน', 'แบนแล้ว', 'วิกฤต'][l] ?? '—';
}
export function levelTone(l: number): Tone {
  return (['ok', 'info', 'warn', 'rose', 'crit', 'crit'][l] as Tone) ?? 'dim';
}
export function levelColor(l: number) {
  return ['#10b981', '#22d3ee', '#f59e0b', '#f43f5e', '#ef4444', '#ef4444'][l] ?? '#6b7280';
}
export function threatClass(score: number) {
  if (score >= 80) return 'linear-gradient(90deg, #ef4444, #6b21a8)';
  if (score >= 60) return 'linear-gradient(90deg, #f59e0b, #ef4444)';
  if (score >= 35) return 'linear-gradient(90deg, #22d3ee, #f59e0b)';
  return 'linear-gradient(90deg, #10b981, #22d3ee)';
}
