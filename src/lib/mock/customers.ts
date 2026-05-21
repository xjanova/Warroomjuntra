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

export const CUSTOMERS: CustomerCard[] = [
  { id: 1, name: 'พิมพ์ชนก ส.', psid: '1042883', channel: 'FB', rarity: 'LEGENDARY', level: 28, exp: 64, vip: true, problem: false, ltv: 24599, credits: 142, readings: 189, sentiment: 'oo+oo-oo+o-oo+' },
  { id: 2, name: 'ธนกฤต ภ.', psid: 'U-b8c2', channel: 'LINE', rarity: 'EPIC', level: 18, exp: 68, vip: true, problem: false, ltv: 9420, credits: 54, readings: 62, sentiment: '+o+oo+oo+oo+oo' },
  { id: 3, name: 'กฤษณ์ ส.', psid: '1188211', channel: 'FB', rarity: 'EPIC', level: 21, exp: 42, vip: true, problem: false, ltv: 14820, credits: 88, readings: 104, sentiment: '+oo+o+oo+o+oo+' },
  { id: 4, name: 'รัชชุดา ส.', psid: '1198822', channel: 'FB', rarity: 'RARE', level: 9, exp: 76, vip: false, problem: false, ltv: 990, credits: 2, readings: 11, sentiment: '+++o++oo+++oo+' },
  { id: 5, name: 'อภิญญา ม.', psid: '1124492', channel: 'FB', rarity: 'UNCOMMON', level: 7, exp: 45, vip: false, problem: false, ltv: 299, credits: 3, readings: 8, sentiment: 'o+oo+oo++o+ooo' },
  { id: 6, name: 'ปวีณา ก.', psid: 'U-a4d9', channel: 'LINE', rarity: 'RARE', level: 12, exp: 53, vip: false, problem: false, ltv: 1290, credits: 8, readings: 24, sentiment: 'oo+o++ooo+oo+o' },
  { id: 7, name: 'วรากร พ.', psid: '1098232', channel: 'FB', rarity: 'COMMON', level: 4, exp: 40, vip: false, problem: true, ltv: 599, credits: 0, readings: 3, sentiment: '-oo-oo--oo-oo-' },
  { id: 8, name: 'สมชาย จ.', psid: 'U-d4f1', channel: 'LINE', rarity: 'COMMON', level: 2, exp: 40, vip: false, problem: true, ltv: 0, credits: 0, readings: 5, sentiment: 'oo-oooo-oo-ooo' },
  { id: 9, name: 'มนัสนันท์ ป.', psid: '1230091', channel: 'FB', rarity: 'EPIC', level: 16, exp: 88, vip: true, problem: false, ltv: 7200, credits: 35, readings: 48, sentiment: '+oo+++oo++o+++' },
  { id: 10, name: 'จิราพร ส.', psid: 'U-c8a2', channel: 'LINE', rarity: 'UNCOMMON', level: 8, exp: 32, vip: false, problem: false, ltv: 498, credits: 1, readings: 7, sentiment: 'oo+oo+oo+oo+oo' },
  { id: 11, name: 'รัตนา ฉ.', psid: 'U-f1b8', channel: 'LINE', rarity: 'UNCOMMON', level: 6, exp: 18, vip: false, problem: false, ltv: 198, credits: 0, readings: 3, sentiment: '+oo+oo+ooo+ooo' },
  { id: 12, name: 'กิตติ ส.', psid: '1144229', channel: 'FB', rarity: 'COMMON', level: 3, exp: 62, vip: false, problem: false, ltv: 198, credits: 0, readings: 2, sentiment: 'ooo+oooo+ooooo' },
  { id: 13, name: 'อภินันท์ ก.', psid: '1188032', channel: 'FB', rarity: 'RARE', level: 11, exp: 80, vip: false, problem: false, ltv: 2890, credits: 14, readings: 22, sentiment: 'oo+oo++oo+oo+o' },
  { id: 14, name: 'นภัสสร ป.', psid: '1199821', channel: 'FB', rarity: 'EPIC', level: 14, exp: 34, vip: true, problem: false, ltv: 4498, credits: 18, readings: 31, sentiment: '+oo++oo+++o+oo' },
  { id: 15, name: 'ชาตรี ว.', psid: '1098188', channel: 'FB', rarity: 'COMMON', level: 1, exp: 50, vip: false, problem: true, ltv: 0, credits: 0, readings: 1, sentiment: '--oooo--oooo--' },
];
