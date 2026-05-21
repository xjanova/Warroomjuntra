export type BotCard = {
  id: number;
  name: string;
  icon: string;
  color: string;
  desc: string;
  state: 'ok' | 'warn' | 'crit';
  enabled: boolean;
  next: string;
  last: string;
  success: number;
  runs7d: number;
  spark: string;
};

export const BOT_CARDS: BotCard[] = [
  { id: 1, name: 'โพสต์ดวงรายวัน · FB Page', icon: '📰', color: '#1877f2', desc: 'โพสต์ดวง 12 ราศีทุกเช้า 06:00', state: 'ok', enabled: true, next: '06:00 พรุ่งนี้', last: '06:00 · OK', success: 99, runs7d: 7, spark: 'M 0 28 L 28 24 L 56 26 L 84 20 L 112 16 L 140 18 L 168 12 L 200 8' },
  { id: 2, name: 'สายมูประจำวัน · LINE OA', icon: '🌙', color: '#06c755', desc: 'broadcast คาถาเสริมดวง', state: 'ok', enabled: true, next: '07:30 พรุ่งนี้', last: '07:30 · OK', success: 97, runs7d: 7, spark: 'M 0 26 L 28 22 L 56 20 L 84 24 L 112 18 L 140 16 L 168 14 L 200 10' },
  { id: 3, name: 'แคมเปญ "พฤษภาคม-มู"', icon: '🎯', color: '#8b5cf6', desc: 'broadcast โปรเฉพาะ — 50% off Celtic', state: 'ok', enabled: true, next: '19:00 วันนี้', last: '12:00 · sent 1,240 · CTR 12%', success: 96, runs7d: 5, spark: 'M 0 30 L 28 26 L 56 22 L 84 18 L 112 14 L 140 10 L 168 8 L 200 6' },
  { id: 4, name: 'ติดตามลูกค้าหายไป 7 วัน', icon: '🔔', color: '#f59e0b', desc: 'ทักลูกค้าเก่าที่ไม่กลับมา', state: 'warn', enabled: true, next: '18:00 วันนี้', last: 'เมื่อวาน · 12 fail/120', success: 90, runs7d: 7, spark: 'M 0 18 L 28 14 L 56 16 L 84 20 L 112 22 L 140 24 L 168 26 L 200 28' },
  { id: 5, name: 'แจ้งเครดิตใกล้หมด', icon: '⚠️', color: '#22d3ee', desc: 'ส่งเตือนเมื่อเครดิตเหลือ ≤ 3', state: 'ok', enabled: false, next: '(ปิดอยู่)', last: '5 วันก่อน · ปิดเอง', success: 100, runs7d: 0, spark: 'M 0 20 L 28 20 L 56 20 L 84 20 L 112 20 L 140 20 L 168 20 L 200 20' },
  { id: 6, name: 'ตอบดวงรายเดือน · Auto', icon: '🌟', color: '#22d3ee', desc: 'qwen-72b ตอบดวงรายเดือนอัตโนมัติ', state: 'warn', enabled: true, next: 'realtime', last: '4% timeout', success: 96, runs7d: 284, spark: 'M 0 8 L 28 10 L 56 6 L 84 12 L 112 8 L 140 14 L 168 10 L 200 12' },
  { id: 7, name: 'จับคู่ SMS ↔ บิล', icon: '💰', color: '#10b981', desc: 'parser อัตโนมัติทุก SMS เข้า', state: 'ok', enabled: true, next: 'realtime', last: '42 ใน 24ชม. · 90.5% จับคู่ได้', success: 91, runs7d: 298, spark: 'M 0 12 L 28 14 L 56 10 L 84 12 L 112 8 L 140 10 L 168 6 L 200 8' },
  { id: 8, name: 'AI Sentiment Watcher', icon: '😊', color: '#f43f5e', desc: 'ตรวจอารมณ์ลูกค้าทุกข้อความ', state: 'ok', enabled: true, next: 'realtime', last: 'flagged 14 ใน 24ชม.', success: 99, runs7d: 1820, spark: 'M 0 14 L 28 12 L 56 16 L 84 10 L 112 14 L 140 8 L 168 12 L 200 10' },
  { id: 9, name: 'TTS · ใบ้สวด/คาถา', icon: '🎙️', color: '#8b5cf6', desc: 'อ่านคำทำนายเป็นเสียง', state: 'ok', enabled: false, next: '(ปิดอยู่)', last: 'พ.ค. 18', success: 98, runs7d: 0, spark: 'M 0 18 L 28 18 L 56 18 L 84 18 L 112 18 L 140 18 L 168 18 L 200 18' },
];

export const BOT_STATS = [
  { label: 'บอทเปิดอยู่', color: '#10b981', dyn: true },
  { label: 'รันวันนี้', value: '128', sub: '94% สำเร็จ', color: '#e5e7eb' },
  { label: 'ล้มเหลว 24h', value: '8', sub: '4 ใน 1 ชม.ล่าสุด', color: '#f59e0b' },
  { label: 'เข้าถึงรวม (ส่ง)', value: '42.8k', sub: '+18%', color: '#22d3ee' },
  { label: 'รายได้จากแคมเปญ', value: '฿18,720', sub: 'วันนี้', color: '#8b5cf6' },
];
