'use client';

// Thai-language intent classifier — runs BEFORE the LLM call. If the user's
// utterance clearly matches a navigate/toggle/refresh command, we execute it
// immediately so Eve responds in <100ms instead of waiting 1–3s for the LLM.
// (The LLM still gets called in parallel so Eve can also say something
// natural — "เปิดหน้าบิลให้แล้วค่ะ ✦")
//
// Regexes are intentionally permissive. Speech-to-text on Thai is messy —
// "บิว" sometimes comes through as "วิว" or "บิวล์"; numbers in Thai vary by
// word ("สอง" vs "2"). Better to accept loosely than reject strictly.

import type { ParsedAction } from './actions';

export type IntentMatch = {
  actions: ParsedAction[];
  spokenAck?: string;  // optional immediate reply Eve can say while LLM still runs
};

const PAGE_ROUTES: Array<{ keywords: RegExp; path: string; label: string }> = [
  { keywords: /(หน้าแรก|warroom|war\s*room|home|dashboard|มิชชั่นคอนโทรล|mission\s*control)/i, path: '/',           label: 'หน้าแรก' },
  { keywords: /(แชต|chat|takeover|takeo|ตอบลูกค้า)/i,                                              path: '/chat',       label: 'แชต' },
  { keywords: /(บิล|invoice|bills|รายการบิล|จัดการบิล)/i,                                            path: '/bills',      label: 'บิล' },
  { keywords: /(payment|กระทบยอด|sms|recon|เงิน(เข้า)?|ยอดโอน)/i,                                  path: '/payment',    label: 'กระทบยอดการเงิน' },
  { keywords: /(approval|อนุมัติ|รออนุมัติ|withdrawal|ถอน|commission|คอมมิช)/i,                       path: '/approvals',  label: 'รออนุมัติ' },
  { keywords: /(moderation|เฝ้าระวัง|sensitive|อ่อนไหว|ban(ned)?|แบน|ห้าม)/i,                          path: '/moderation', label: 'เฝ้าระวัง' },
  { keywords: /(bot(s)?|บอท|automation|อัตโนมัติ)/i,                                                  path: '/bots',       label: 'บอท' },
  { keywords: /(customer(s)?|ลูกค้า|customer\s*360|360|persona)/i,                                  path: '/customers',  label: 'ลูกค้า' },
  { keywords: /(event(s)?|อีเวนต์|stream|ฟีด|feed)/i,                                                path: '/events',     label: 'อีเวนต์' },
  { keywords: /(predict|workbench|playground|ทำนาย|ทดลอง)/i,                                       path: '/predict',    label: 'AI Workbench' },
  { keywords: /(eve|อีฟ|คุย\s*eve)/i,                                                                 path: '/eve',        label: 'หน้า Eve' },
];

const NAV_HINT = /(เปิด|ไป|พาไป|ขอ|ดู|แสดง|โชว์|open|go|navigate|show)/i;

// Toggle phrases — distinct on/off triggers
const FREEZE_ON  = /(แช่แข็ง|freeze|หยุดอัปเดต|พักการอัปเดต|หยุด\s*poll)/i;
const FREEZE_OFF = /(ปลด(การ)?แช่|unfreeze|กลับมา\s*อัปเดต|resume)/i;
const MUTE_ON    = /(ปิดเสียง|ม[ั่ิ]ว[ทธ]|mute|เงียบ|หยุดเสียง)/i;
const MUTE_OFF   = /(เปิดเสียง|unmute|เปิด\s*audio)/i;
const FOCUS_ON   = /(โหมด(โฟกัส|focus)|เน้น(จอ)?|focus\s*mode\s*on|ตั้งใจ)/i;
const FOCUS_OFF  = /(ปิดโฟกัส|focus\s*off|เลิกโฟกัส)/i;

const REFRESH_RE = /(รีเฟรช|refresh|reload|อัปเดต(ใหม่)?|ดึง(ข้อมูล)?ใหม่)/i;
const SETTINGS_RE = /(ตั้งค่า|setting(s)?|preference|config(uration)?)/i;
const CMDK_RE = /(command\s*palette|cmd\s*k|ค้นหา\s*คำสั่ง|พาเลต)/i;
const CLEAR_CHAT_RE = /(ล้าง(แชต|chat|ประวัติ)|clear\s*chat|รีเซ็ตแชต)/i;
const HIDE_EVE_RE = /(ซ่อน\s*eve|ปิดอีฟ|hide\s*eve|ปิดตัวเอง)/i;

// Numeric ID extractors — "เปิดเคส 42", "ลูกค้า 1234"
const CASE_ID_RE = /(?:เคส|case|reading)\s*#?\s*([rR]?-?\d+)/i;
const CUSTOMER_ID_RE = /(?:ลูกค้า|customer|user)\s*#?\s*(\d+)/i;

function makeAction(tag: ParsedAction['tag'], args: string[] = []): ParsedAction {
  const argStr = args.length > 0 ? ':' + args.join(':') : '';
  return { tag, args, raw: `[${tag}${argStr}]` };
}

/**
 * Inspect the user's utterance and return any actions we can confidently
 * execute right now. Returns null if no obvious intent matched — caller
 * should send to the LLM and use whatever it emits.
 */
export function detectIntent(utterance: string): IntentMatch | null {
  const u = utterance.trim();
  if (!u) return null;

  const actions: ParsedAction[] = [];
  const acks: string[] = [];

  // 1. Navigation. Match a page keyword. Hint words ("เปิด", "ไป") boost confidence
  //    but aren't required — "บิล" alone is enough if it's the whole utterance.
  for (const r of PAGE_ROUTES) {
    if (r.keywords.test(u) && (NAV_HINT.test(u) || u.length < 25)) {
      actions.push(makeAction('GOTO', [r.path]));
      acks.push('ไปหน้า' + r.label);
      break; // only one page at a time
    }
  }

  // 2. Settings / cmdk
  if (SETTINGS_RE.test(u)) {
    actions.push(makeAction('OPEN_SETTINGS'));
    acks.push('เปิดตั้งค่า');
  }
  if (CMDK_RE.test(u)) {
    actions.push(makeAction('CMDK'));
    acks.push('เปิด Command Palette');
  }

  // 3. Refresh
  if (REFRESH_RE.test(u)) {
    actions.push(makeAction('REFRESH'));
    acks.push('รีเฟรชแล้ว');
  }

  // 4. Toggles
  if (FREEZE_OFF.test(u)) {
    actions.push(makeAction('FREEZE', ['off']));
    acks.push('ปลดล็อกการอัปเดต');
  } else if (FREEZE_ON.test(u)) {
    actions.push(makeAction('FREEZE', ['on']));
    acks.push('แช่แข็งการอัปเดต');
  }

  if (MUTE_OFF.test(u)) {
    actions.push(makeAction('MUTE', ['off']));
    acks.push('เปิดเสียง');
  } else if (MUTE_ON.test(u)) {
    actions.push(makeAction('MUTE', ['on']));
    acks.push('ปิดเสียง');
  }

  if (FOCUS_OFF.test(u)) {
    actions.push(makeAction('FOCUS', ['off']));
    acks.push('ปิดโฟกัส');
  } else if (FOCUS_ON.test(u)) {
    actions.push(makeAction('FOCUS', ['on']));
    acks.push('เปิดโฟกัส');
  }

  // 5. Open specific case / customer by number
  const caseMatch = u.match(CASE_ID_RE);
  if (caseMatch) {
    const id = caseMatch[1].startsWith('r') ? caseMatch[1] : 'r-' + caseMatch[1];
    actions.push(makeAction('OPEN_CASE', [id]));
    acks.push('เปิดเคส ' + caseMatch[1]);
  }
  const custMatch = u.match(CUSTOMER_ID_RE);
  if (custMatch) {
    actions.push(makeAction('OPEN_CUSTOMER', [custMatch[1]]));
    acks.push('เปิดข้อมูลลูกค้า ' + custMatch[1]);
  }

  // 6. Misc
  if (CLEAR_CHAT_RE.test(u)) {
    actions.push(makeAction('CLEAR_CHAT'));
    acks.push('ล้างประวัติแชต');
  }
  if (HIDE_EVE_RE.test(u)) {
    actions.push(makeAction('HIDE_EVE'));
    acks.push('ซ่อน Eve');
  }

  if (actions.length === 0) return null;

  return {
    actions,
    spokenAck: 'ได้เลยค่ะ · ' + acks.join(' · '),
  };
}
