import type { Channel } from './types';

export type Rarity = 'LEGENDARY' | 'EPIC' | 'RARE' | 'UNCOMMON' | 'COMMON';

export type CustomerCard = {
  id: number;
  name: string;
  psid: string;
  channel: Channel;
  rarity: Rarity;
  level: number;
  exp: number;
  vip: boolean;
  problem: boolean;
  ltv: number;
  credits: number;
  readings: number;
  sentiment: string;
};

// 🧹 (2026-06-04) Demo data removed — real customers come from /users. Empty
//   fallback so no fake cards flash before the live fetch lands.
export const CUSTOMERS: CustomerCard[] = [];
