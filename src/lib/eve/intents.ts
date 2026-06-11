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
  // ⚠ approvals MUST come before payment — "ถอนเงิน" used to be hijacked by the
  //   payment row's bare เงิน and navigated to the wrong page.
  { keywords: /(approval|อนุมัติ|รออนุมัติ|withdrawal|ถอน|commission|คอมมิช)/i,                       path: '/approvals',  label: 'รออนุมัติ' },
  { keywords: /(payment|กระทบยอด|sms|recon|เงินเข้า|ยอดโอน|สลิป)/i,                                  path: '/payment',    label: 'กระทบยอดการเงิน' },
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

// Thai counting classifiers — a number sitting directly *before* one of these is
// a quantity ("3 รายการ", "2 คน", "5 ครั้ง", "60 นาที"), never a target id. Used to
// reject counts so "อนุมัติถอน 3 รายการล่าสุด" never approves withdrawal #3.
const CLASSIFIER_RE = /^(?:รายการ|ราย|คน|ครั้ง|รอบ|อัน|ตัว|บิล|ใบ|ข้อความ|ที่|วัน|ชั่วโมง|ชม|นาที|บาท)/;

// An *explicitly marked* id — highest confidence. "#5", "id 5", "no. 5",
// "reading 5012", "r-5", "เลข 5", "หมายเลข 5", "รายการที่ 5", "ไอดี 5".
const ID_MARKER_RE = /(?:#\s*|\bid\s+|\bno\.?\s*|reading\s+|\br-|เลขที่\s*|เลข\s*|หมายเลข\s*|รายการที่\s*|ไอดี\s*)#?\s*(\d+)/i;

/**
 * Pull the single unambiguous target id from an utterance, or null.
 *   1. An explicitly marked id (#5 · "reading 5012" · "เลข 5" · "รายการที่ 5") wins.
 *   2. Otherwise gather numbers that are NOT Thai counts (not immediately followed
 *      by a classifier word). Exactly one such number → use it; zero or several →
 *      null, so we fall through to the LLM rather than act on the wrong target.
 * Guards against the old "first number anywhere" bug, where "อนุมัติถอน 3 รายการ"
 * approved withdrawal #3 and "แบน 2 คนนี้ facebook 99887766" banned psid 2.
 */
function targetId(u: string): string | null {
  const marked = u.match(ID_MARKER_RE);
  if (marked) return marked[1];

  const candidates: string[] = [];
  const re = /(\d+)\s*([฀-๿a-zA-Z]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(u)) !== null) {
    const following = m[2] ?? '';
    if (following && CLASSIFIER_RE.test(following)) continue; // it's a count, not an id
    candidates.push(m[1]);
  }
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Map a clear management command → a managed action. Requires an explicit verb +
 * object + an unambiguous target id (see targetId). Returns null otherwise so
 * casual chatter, counts, and multi-number sentences never fire a destructive op.
 * Classifier-originated managed actions ALWAYS surface a confirm card (the caller
 * forces ask-permission even in auto mode) — this is the first of several gates.
 */
function detectManagementIntent(u: string): { action: ParsedAction; ack: string } | null {
  const id = targetId(u);
  if (!id) return null;

  // Withdrawals
  if (/(ปฏิเสธ|ไม่อนุมัติ|reject)/i.test(u) && /(ถอน|withdraw)/i.test(u))
    return { action: makeAction('REJECT_WD', [id]), ack: `ปฏิเสธถอนเงิน #${id}` };
  if (/(อนุมัติ|approve)/i.test(u) && /(ถอน|withdraw)/i.test(u))
    return { action: makeAction('APPROVE_WD', [id]), ack: `อนุมัติถอนเงิน #${id}` };

  // SMS reconciliation
  if (/(ปฏิเสธ|reject)/i.test(u) && /sms/i.test(u))
    return { action: makeAction('REJECT_SMS', [id]), ack: `ปฏิเสธ SMS #${id}` };
  if (/(จับคู่|match|ยืนยัน)/i.test(u) && /sms/i.test(u))
    return { action: makeAction('MATCH_SMS', [id]), ack: `จับคู่ SMS #${id}` };

  // Bans (check ปลดแบน before แบน)
  if (/(ปลดแบน|เลิกแบน|unban)/i.test(u))
    return { action: makeAction('UNBAN', [id]), ack: `ปลดแบน #${id}` };
  if (/(แบน|ban)/i.test(u)) {
    const plat = /line|ไลน์/i.test(u) ? 'line' : 'facebook';
    return { action: makeAction('BAN', [plat, id]), ack: `แบน ${plat} ${id}` };
  }

  // Reading / bill operations
  if (/(คืนเงิน|refund)/i.test(u))
    return { action: makeAction('REFUND', [id]), ack: `คืนเงิน reading ${id}` };
  if (/(ยกเลิก|cancel)/i.test(u))
    return { action: makeAction('CANCEL', [id]), ack: `ยกเลิก reading ${id}` };
  if (/(ยืนยัน.*(จ่าย|ชำระ)|จ่ายแล้ว|กู้บิล|mark.*paid|ชำระแล้ว)/i.test(u))
    return { action: makeAction('MARK_PAID', [id]), ack: `ยืนยันชำระเงิน reading ${id}` };

  // Chat takeover / resume
  if (/(คืนงาน|คืนบอท|resume.*bot)/i.test(u))
    return { action: makeAction('RESUME_BOT', [id]), ack: `คืนงานให้บอท reading ${id}` };
  if (/(รับช่วง|takeover|เทคโอเวอร์)/i.test(u))
    return { action: makeAction('TAKEOVER', [id]), ack: `รับช่วงต่อจากบอท reading ${id}` };

  // Bots / providers — needs the word บอท/bot or provider + an on/off/toggle verb
  if (/(provider|โพรไวเดอร์)/i.test(u) && /(เปิด|ปิด|สลับ|toggle)/i.test(u))
    return { action: makeAction('TOGGLE_PROVIDER', [id]), ack: `สลับ provider #${id}` };
  if (/(บอท|bot)/i.test(u) && /(เปิด|ปิด|สลับ|toggle)/i.test(u))
    return { action: makeAction('TOGGLE_BOT', [id]), ack: `สลับสถานะบอท #${id}` };

  return null;
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

  // 7. Management tools (approve/refund/cancel/ban/toggle…). Conservative — needs
  //    an explicit verb+object+id so a casual message never fires by accident.
  const mgmt = detectManagementIntent(u);
  if (mgmt) {
    actions.push(mgmt.action);
    acks.push(mgmt.ack);
  }

  if (actions.length === 0) return null;

  return {
    actions,
    spokenAck: 'ได้เลยค่ะ · ' + acks.join(' · '),
  };
}
