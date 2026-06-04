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

// 🧹 (2026-06-04) demo data removed — live data only
export const BOT_CARDS: BotCard[] = [];

export const BOT_STATS = [
  { label: 'บอทเปิดอยู่', color: '#10b981', dyn: true },
  { label: 'รันวันนี้', value: '128', sub: '94% สำเร็จ', color: '#e5e7eb' },
  { label: 'ล้มเหลว 24h', value: '8', sub: '4 ใน 1 ชม.ล่าสุด', color: '#f59e0b' },
  { label: 'เข้าถึงรวม (ส่ง)', value: '42.8k', sub: '+18%', color: '#22d3ee' },
  { label: 'รายได้จากแคมเปญ', value: '฿18,720', sub: 'วันนี้', color: '#8b5cf6' },
];
