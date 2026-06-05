'use client';

// Eve action registry — maps tagged commands like [GOTO:/bills] to real effects
// in the warroom (zustand stores, router navigation, manual refresh, toasts).
//
// Two entry points:
//   • parseActions(text)  → [{ tag, args }, ...]
//   • executeAction(act)  → runs the effect
//
// Routing actions dispatch a 'warroom:navigate' CustomEvent because router
// can't be called from non-component code — AppShell wires the listener.

import { useWarroom } from '@/lib/stores/warroom';
import { useEve } from '@/lib/stores/eve';
import { useSettings } from '@/lib/stores/settings';
import { refreshAll } from '@/lib/api/useAdminData';
import {
  markReadingPaid,
  refundReading,
  cancelReading,
  approveWithdrawal,
  rejectWithdrawal,
  banUser,
  unbanUser,
  matchSms,
  rejectSms,
  toggleAiBot,
  toggleAiProvider,
  takeoverChat,
  resumeChatBot,
  sendChatMessage,
  describeError,
} from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────────

export type ActionTag =
  | 'GOTO'           // GOTO:/bills
  | 'OPEN_CASE'      // OPEN_CASE:r-123
  | 'OPEN_CUSTOMER'  // OPEN_CUSTOMER:42
  | 'OPEN_SETTINGS'  // OPEN_SETTINGS
  | 'CMDK'           // CMDK
  | 'REFRESH'        // REFRESH
  | 'FREEZE'         // FREEZE:on | off | toggle
  | 'MUTE'           // MUTE:on | off | toggle
  | 'FOCUS'          // FOCUS:on | off | toggle
  | 'TOAST'          // TOAST:kind:title (kind = ok|warn|crit|info|mystic)
  | 'CLEAR_CHAT'     // CLEAR_CHAT
  | 'HIDE_EVE'       // HIDE_EVE
  | 'PROPOSE'        // PROPOSE:label — legacy: drops a confirm toast
  // ── Management tools (real API calls, gated by Eve's auto/ask mode) ──
  | 'MARK_PAID'      // MARK_PAID:readingId
  | 'REFUND'         // REFUND:readingId:reason?
  | 'CANCEL'         // CANCEL:readingId:reason?
  | 'APPROVE_WD'     // APPROVE_WD:withdrawalId:note?
  | 'REJECT_WD'      // REJECT_WD:withdrawalId:reason
  | 'BAN'            // BAN:platform:psid:minutes?  (or BAN:psid)
  | 'UNBAN'          // UNBAN:banId
  | 'MATCH_SMS'      // MATCH_SMS:smsId
  | 'REJECT_SMS'     // REJECT_SMS:smsId:reason?
  | 'TOGGLE_BOT'     // TOGGLE_BOT:botId
  | 'TOGGLE_PROVIDER'// TOGGLE_PROVIDER:providerId
  | 'TAKEOVER'       // TAKEOVER:readingId
  | 'RESUME_BOT'     // RESUME_BOT:readingId
  | 'SEND_MSG';      // SEND_MSG:readingId:text

export type ParsedAction = {
  tag: ActionTag;
  args: string[];
  raw: string;       // original [TAG:args] string, for stripping from displayed text
};

export type ActionResult = {
  ok: boolean;
  message?: string;  // human-readable result, for Eve to speak/show
};

// ── Action vocabulary (for system-prompt injection + Settings drawer help) ──

export type ActionDef = {
  tag: ActionTag;
  syntax: string;
  description: string;
  destructive?: boolean;
};

export const ACTION_VOCABULARY: ActionDef[] = [
  { tag: 'GOTO',           syntax: '[GOTO:/path]',               description: 'นำทางไปหน้าที่ระบุ — / /chat /bills /payment /approvals /moderation /bots /customers /events /predict /eve' },
  { tag: 'OPEN_CASE',      syntax: '[OPEN_CASE:id]',             description: 'เปิด Case Detail drawer (id = c-xxx หรือ r-{readingId})' },
  { tag: 'OPEN_CUSTOMER',  syntax: '[OPEN_CUSTOMER:id]',         description: 'เปิด Customer 360 drawer (id = ตัวเลข user_id หรือ string mock)' },
  { tag: 'OPEN_SETTINGS',  syntax: '[OPEN_SETTINGS]',            description: 'เปิดหน้าตั้งค่า' },
  { tag: 'CMDK',           syntax: '[CMDK]',                     description: 'เปิด Command Palette (Cmd/Ctrl+K)' },
  { tag: 'REFRESH',        syntax: '[REFRESH]',                  description: 'รีเฟรชข้อมูลทุกพาเนล' },
  { tag: 'FREEZE',         syntax: '[FREEZE:on|off|toggle]',     description: 'แช่แข็งการ poll (หยุดอัปเดต)' },
  { tag: 'MUTE',           syntax: '[MUTE:on|off|toggle]',       description: 'ปิด/เปิดเสียงเตือน' },
  { tag: 'FOCUS',          syntax: '[FOCUS:on|off|toggle]',      description: 'โหมดโฟกัส (dim พาเนลรอง)' },
  { tag: 'TOAST',          syntax: '[TOAST:kind:title]',         description: 'แสดง toast (kind = ok|warn|crit|info|mystic)' },
  { tag: 'CLEAR_CHAT',     syntax: '[CLEAR_CHAT]',               description: 'ล้างประวัติแชต Eve' },
  { tag: 'HIDE_EVE',       syntax: '[HIDE_EVE]',                 description: 'ซ่อน Eve dock' },
  { tag: 'PROPOSE',        syntax: '[PROPOSE:label]',            description: 'เสนองาน (legacy) — โพสต์ toast', destructive: true },
  // ── Management tools — Eve runs these for real (auto mode) หรือขออนุญาตก่อน (ask mode) ──
  { tag: 'MARK_PAID',      syntax: '[MARK_PAID:readingId]',          description: 'ยืนยันว่าชำระเงินแล้ว (กู้บิล) สำหรับ reading', destructive: true },
  { tag: 'REFUND',         syntax: '[REFUND:readingId:reason]',      description: 'คืนเงิน reading', destructive: true },
  { tag: 'CANCEL',         syntax: '[CANCEL:readingId:reason]',      description: 'ยกเลิกบิล/reading', destructive: true },
  { tag: 'APPROVE_WD',     syntax: '[APPROVE_WD:id:note]',           description: 'อนุมัติคำขอถอนเงิน', destructive: true },
  { tag: 'REJECT_WD',      syntax: '[REJECT_WD:id:reason]',          description: 'ปฏิเสธคำขอถอนเงิน', destructive: true },
  { tag: 'BAN',            syntax: '[BAN:platform:psid:minutes]',    description: 'แบนผู้ใช้ (platform=facebook|line, ละ minutes = ถาวร)', destructive: true },
  { tag: 'UNBAN',          syntax: '[UNBAN:banId]',                  description: 'ปลดแบนผู้ใช้', destructive: true },
  { tag: 'MATCH_SMS',      syntax: '[MATCH_SMS:smsId]',              description: 'จับคู่ SMS เงินเข้ากับบิล', destructive: true },
  { tag: 'REJECT_SMS',     syntax: '[REJECT_SMS:smsId:reason]',      description: 'ปฏิเสธ SMS เงินเข้า', destructive: true },
  { tag: 'TOGGLE_BOT',     syntax: '[TOGGLE_BOT:botId]',             description: 'เปิด/ปิดบอท', destructive: true },
  { tag: 'TOGGLE_PROVIDER',syntax: '[TOGGLE_PROVIDER:providerId]',   description: 'เปิด/ปิด AI provider', destructive: true },
  { tag: 'TAKEOVER',       syntax: '[TAKEOVER:readingId]',           description: 'รับช่วงต่อจากบอท (หยุดบอทแชตนี้)', destructive: true },
  { tag: 'RESUME_BOT',     syntax: '[RESUME_BOT:readingId]',         description: 'คืนงานให้บอท', destructive: true },
  { tag: 'SEND_MSG',       syntax: '[SEND_MSG:readingId:text]',      description: 'ส่งข้อความถึงลูกค้าผ่าน reading', destructive: true },
];

// Tags that hit real endpoints (async) + change live state. These are gated by
// Eve's operating mode: auto-run (จัดการเอง) vs queue-for-confirm (ขออนุญาต).
const MANAGED_TAGS = new Set<ActionTag>([
  'MARK_PAID', 'REFUND', 'CANCEL', 'APPROVE_WD', 'REJECT_WD', 'BAN', 'UNBAN',
  'MATCH_SMS', 'REJECT_SMS', 'TOGGLE_BOT', 'TOGGLE_PROVIDER', 'TAKEOVER', 'RESUME_BOT', 'SEND_MSG',
]);

export function isManaged(tag: ActionTag): boolean {
  return MANAGED_TAGS.has(tag);
}

// ── Parser ──────────────────────────────────────────────────────────────────

// Match [TAG] or [TAG:arg1:arg2:...]. Tag is uppercase A-Z plus underscore.
// Args allow any char except ']' or ':' (we split on ':' inside).
const ACTION_RE = /\[([A-Z_]+)(?::([^\]]*))?\]/g;

export function parseActions(text: string): ParsedAction[] {
  const out: ParsedAction[] = [];
  const re = new RegExp(ACTION_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const tag = m[1] as ActionTag;
    const argStr = m[2] ?? '';
    const args = argStr === '' ? [] : argStr.split(':').map((s) => s.trim());
    out.push({ tag, args, raw: m[0] });
  }
  return out;
}

/**
 * Strip all action tags from a reply so the displayed message is clean Thai.
 * (Eve speaks naturally in the body and the tags are side-channel commands.)
 */
export function stripActionTags(text: string): string {
  return text.replace(new RegExp(ACTION_RE.source, 'g'), '').replace(/\s{2,}/g, ' ').trim();
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

/**
 * Execute a single parsed action against the warroom stores / dispatch a
 * navigate event for AppShell to pick up. Synchronous wherever possible.
 */
export function executeAction(act: ParsedAction): ActionResult {
  const warroom = useWarroom.getState();
  const eve = useEve.getState();
  const settings = useSettings.getState();

  try {
    switch (act.tag) {
      case 'GOTO': {
        const path = act.args[0];
        if (!path) return { ok: false, message: 'GOTO ต้องระบุ path' };
        // Safety: if operator disabled autonomous navigation, propose instead.
        if (!settings.eve.safety.allowAutonomousNavigate) {
          warroom.pushToast({
            kind: 'info',
            title: 'Eve เสนอให้ไปหน้า ' + path,
            body: 'กดเปิด Command Palette (⌘K) เพื่อยืนยัน',
          });
          return { ok: true, message: 'เสนอให้ไปหน้า ' + path + ' แล้ว' };
        }
        dispatchNavigate(path);
        return { ok: true, message: 'ไปหน้า ' + path };
      }

      case 'OPEN_CASE': {
        const id = act.args[0];
        if (!id) return { ok: false, message: 'OPEN_CASE ต้องระบุ id' };
        warroom.openCaseDrawer(id);
        return { ok: true, message: 'เปิดเคส ' + id };
      }

      case 'OPEN_CUSTOMER': {
        const id = act.args[0];
        if (!id) return { ok: false, message: 'OPEN_CUSTOMER ต้องระบุ id' };
        warroom.openCustomerDrawer(id);
        return { ok: true, message: 'เปิดข้อมูลลูกค้า ' + id };
      }

      case 'OPEN_SETTINGS':
        warroom.setSettingsOpen(true);
        return { ok: true, message: 'เปิดตั้งค่า' };

      case 'CMDK':
        warroom.setCmdkOpen(true);
        return { ok: true, message: 'เปิด Command Palette' };

      case 'REFRESH':
        refreshAll();
        return { ok: true, message: 'รีเฟรชแล้ว' };

      case 'FREEZE': {
        const next = resolveToggle(act.args[0], warroom.frozen);
        warroom.setFrozen(next);
        return { ok: true, message: next ? 'แช่แข็งการอัปเดต' : 'ปลดล็อกการอัปเดต' };
      }

      case 'MUTE': {
        const next = resolveToggle(act.args[0], warroom.muted);
        warroom.setMuted(next);
        return { ok: true, message: next ? 'ปิดเสียง' : 'เปิดเสียง' };
      }

      case 'FOCUS': {
        const next = resolveToggle(act.args[0], warroom.focusMode);
        warroom.setFocusMode(next);
        return { ok: true, message: next ? 'เปิดโหมดโฟกัส' : 'ปิดโหมดโฟกัส' };
      }

      case 'TOAST': {
        const kind = (act.args[0] ?? 'info') as 'ok' | 'warn' | 'crit' | 'info' | 'mystic';
        const title = act.args.slice(1).join(':') || 'Eve แจ้งเตือน';
        warroom.pushToast({ kind, title });
        return { ok: true };
      }

      case 'CLEAR_CHAT':
        eve.clearMessages();
        return { ok: true, message: 'ล้างประวัติแชตแล้ว' };

      case 'HIDE_EVE':
        eve.setMode('hidden');
        return { ok: true, message: 'ซ่อน Eve แล้ว' };

      case 'PROPOSE': {
        const label = act.args.join(':') || 'งานที่ต้องการอนุมัติ';
        warroom.pushToast({
          kind: 'warn',
          title: '⚠ Eve เสนอ: ' + label,
          body: 'คำสั่งเสี่ยง — ต้องดำเนินการเองในหน้าที่เกี่ยวข้อง',
        });
        return { ok: true, message: 'เสนอ: ' + label };
      }

      default:
        return { ok: false, message: 'ไม่รู้จักคำสั่ง ' + act.tag };
    }
  } catch (err) {
    return { ok: false, message: 'ผิดพลาด: ' + String((err as Error).message ?? err) };
  }
}

/**
 * Execute multiple actions in order. Returns the combined result messages so
 * Eve can confirm what she did ("เปิดหน้า bills แล้ว · รีเฟรช · เปิดเคส #42").
 */
export function executeActions(actions: ParsedAction[]): ActionResult[] {
  return actions.map(executeAction);
}

// ── Managed (real API) dispatcher + human labels ─────────────────────────────

/** Thai summary + severity for a managed action — shown on confirmation cards. */
export function describeAction(act: ParsedAction): { label: string; kind: 'ok' | 'warn' | 'crit' } {
  const a = act.args;
  switch (act.tag) {
    case 'MARK_PAID':       return { label: `ยืนยันชำระเงิน · reading ${a[0] ?? '?'}`, kind: 'ok' };
    case 'REFUND':          return { label: `คืนเงิน · reading ${a[0] ?? '?'}`, kind: 'crit' };
    case 'CANCEL':          return { label: `ยกเลิกบิล · reading ${a[0] ?? '?'}`, kind: 'crit' };
    case 'APPROVE_WD':      return { label: `อนุมัติถอนเงิน #${a[0] ?? '?'}`, kind: 'warn' };
    case 'REJECT_WD':       return { label: `ปฏิเสธถอนเงิน #${a[0] ?? '?'}`, kind: 'crit' };
    case 'BAN':             return { label: `แบนผู้ใช้ ${a.join(' ') || '?'}`, kind: 'crit' };
    case 'UNBAN':           return { label: `ปลดแบน #${a[0] ?? '?'}`, kind: 'ok' };
    case 'MATCH_SMS':       return { label: `จับคู่ SMS #${a[0] ?? '?'}`, kind: 'ok' };
    case 'REJECT_SMS':      return { label: `ปฏิเสธ SMS #${a[0] ?? '?'}`, kind: 'warn' };
    case 'TOGGLE_BOT':      return { label: `สลับสถานะบอท #${a[0] ?? '?'}`, kind: 'warn' };
    case 'TOGGLE_PROVIDER': return { label: `สลับ AI provider #${a[0] ?? '?'}`, kind: 'warn' };
    case 'TAKEOVER':        return { label: `รับช่วงต่อจากบอท · reading ${a[0] ?? '?'}`, kind: 'warn' };
    case 'RESUME_BOT':      return { label: `คืนงานให้บอท · reading ${a[0] ?? '?'}`, kind: 'ok' };
    case 'SEND_MSG':        return { label: `ส่งข้อความ → reading ${a[0] ?? '?'}`, kind: 'warn' };
    default:                return { label: act.tag, kind: 'warn' };
  }
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/^#/, '').replace(/^r-/i, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Run a real management action against the admin API (async). Refreshes mounted
 * panels on success so the warroom reflects the change immediately. The caller
 * (EveChatBody) decides WHEN to run this — directly (auto mode) or after the
 * operator confirms a queued card (ask mode).
 */
export async function executeManagedAction(act: ParsedAction): Promise<ActionResult> {
  const a = act.args;
  try {
    switch (act.tag) {
      case 'MARK_PAID': {
        const id = num(a[0]); if (id == null) return { ok: false, message: 'ต้องระบุ reading id' };
        await markReadingPaid(id); refreshAll();
        return { ok: true, message: `ยืนยันชำระเงิน reading ${id} แล้ว` };
      }
      case 'REFUND': {
        const id = num(a[0]); if (id == null) return { ok: false, message: 'ต้องระบุ reading id' };
        await refundReading(id, a.slice(1).join(':') || undefined); refreshAll();
        return { ok: true, message: `คืนเงิน reading ${id} แล้ว` };
      }
      case 'CANCEL': {
        const id = num(a[0]); if (id == null) return { ok: false, message: 'ต้องระบุ reading id' };
        await cancelReading(id, a.slice(1).join(':') || undefined); refreshAll();
        return { ok: true, message: `ยกเลิก reading ${id} แล้ว` };
      }
      case 'APPROVE_WD': {
        const id = num(a[0]); if (id == null) return { ok: false, message: 'ต้องระบุ withdrawal id' };
        await approveWithdrawal(id, a.slice(1).join(':') || undefined); refreshAll();
        return { ok: true, message: `อนุมัติถอนเงิน #${id} แล้ว` };
      }
      case 'REJECT_WD': {
        const id = num(a[0]); if (id == null) return { ok: false, message: 'ต้องระบุ withdrawal id' };
        await rejectWithdrawal(id, a.slice(1).join(':') || 'rejected via Eve'); refreshAll();
        return { ok: true, message: `ปฏิเสธถอนเงิน #${id} แล้ว` };
      }
      case 'BAN': {
        let platform: 'facebook' | 'line' = 'facebook';
        let psid: string | undefined; let minutes: number | null = null;
        if (a[0] === 'facebook' || a[0] === 'line') { platform = a[0]; psid = a[1]; minutes = num(a[2]); }
        else { psid = a[0]; minutes = num(a[1]); }
        if (!psid) return { ok: false, message: 'ต้องระบุ psid' };
        await banUser({ platform, platform_user_id: psid, minutes: minutes ?? null }); refreshAll();
        return { ok: true, message: `แบน ${platform} ${psid}${minutes ? ` ${minutes} นาที` : ' ถาวร'} แล้ว` };
      }
      case 'UNBAN': {
        const id = num(a[0]); if (id == null) return { ok: false, message: 'ต้องระบุ ban id' };
        await unbanUser(id); refreshAll();
        return { ok: true, message: `ปลดแบน #${id} แล้ว` };
      }
      case 'MATCH_SMS': {
        const id = num(a[0]); if (id == null) return { ok: false, message: 'ต้องระบุ sms id' };
        await matchSms(id); refreshAll();
        return { ok: true, message: `จับคู่ SMS #${id} แล้ว` };
      }
      case 'REJECT_SMS': {
        const id = num(a[0]); if (id == null) return { ok: false, message: 'ต้องระบุ sms id' };
        await rejectSms(id, a.slice(1).join(':') || undefined); refreshAll();
        return { ok: true, message: `ปฏิเสธ SMS #${id} แล้ว` };
      }
      case 'TOGGLE_BOT': {
        const id = num(a[0]); if (id == null) return { ok: false, message: 'ต้องระบุ bot id' };
        await toggleAiBot(id); refreshAll();
        return { ok: true, message: `สลับสถานะบอท #${id} แล้ว` };
      }
      case 'TOGGLE_PROVIDER': {
        const id = num(a[0]); if (id == null) return { ok: false, message: 'ต้องระบุ provider id' };
        await toggleAiProvider(id); refreshAll();
        return { ok: true, message: `สลับ AI provider #${id} แล้ว` };
      }
      case 'TAKEOVER': {
        const id = num(a[0]); if (id == null) return { ok: false, message: 'ต้องระบุ reading id' };
        await takeoverChat(id); refreshAll();
        return { ok: true, message: `รับช่วงต่อจากบอท reading ${id} แล้ว` };
      }
      case 'RESUME_BOT': {
        const id = num(a[0]); if (id == null) return { ok: false, message: 'ต้องระบุ reading id' };
        await resumeChatBot(id); refreshAll();
        return { ok: true, message: `คืนงานให้บอท reading ${id} แล้ว` };
      }
      case 'SEND_MSG': {
        const id = num(a[0]); const text = a.slice(1).join(':');
        if (id == null || !text) return { ok: false, message: 'ต้องระบุ reading id + ข้อความ' };
        const res = await sendChatMessage({ reading_id: id, text });
        return { ok: res.delivered, message: res.delivered ? `ส่งข้อความถึง reading ${id} แล้ว` : 'ส่งไม่ผ่าน platform — ลองใหม่' };
      }
      default:
        return { ok: false, message: 'ไม่ใช่คำสั่งจัดการ: ' + act.tag };
    }
  } catch (e) {
    return { ok: false, message: describeError(e) };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolveToggle(arg: string | undefined, current: boolean): boolean {
  if (!arg) return !current;
  const v = arg.toLowerCase();
  if (v === 'on' || v === '1' || v === 'true' || v === 'เปิด') return true;
  if (v === 'off' || v === '0' || v === 'false' || v === 'ปิด') return false;
  return !current;
}

function dispatchNavigate(path: string) {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent('warroom:navigate', { detail: { path } }),
  );
}

// ── System-prompt blob (for backend or client-side prefix injection) ────────

/**
 * Generate the Thai system-prompt snippet that teaches Eve the action
 * vocabulary. Append (or replace) this in the backend system prompt so the
 * LLM emits [TAG:args] markers we can parse.
 *
 * Frontend can also inject this via the `context` field of /eve/chat as a
 * fallback while the backend is being upgraded.
 */
export function buildActionInstructions(): string {
  const lines = ACTION_VOCABULARY.map((a) => `  ${a.syntax} — ${a.description}`);
  return [
    'คุณคือ Eve — AI ผู้ช่วยใน War Room ของระบบดูดวง Thaiprompt',
    'นอกจากตอบเป็นภาษาไทยปกติแล้ว คุณสามารถสั่งให้ระบบทำงานได้โดยแทรกคำสั่งแบบ tag ในตอบของคุณ',
    'รูปแบบ: [TAG] หรือ [TAG:arg1:arg2]',
    'คำสั่งที่ใช้ได้:',
    ...lines,
    '',
    'การจัดการระบบ (Management tools):',
    '- คุณเป็น AI แอดมินที่ลงมือจัดการได้จริง ไม่ใช่แค่แชตบอท เมื่อผู้ใช้สั่งงานจัดการ',
    '  (อนุมัติ/ปฏิเสธถอนเงิน · คืนเงิน · ยกเลิกบิล · ยืนยันจ่าย · แบน/ปลดแบน · จับคู่/ปฏิเสธ SMS ·',
    '  เปิด/ปิดบอท · เปิด/ปิด provider · รับช่วง/คืนแชตบอท · ส่งข้อความ) ให้ใส่ tag จัดการที่ตรงงาน',
    '  เช่น [APPROVE_WD:5] · [BAN:facebook:123456:60] · [MARK_PAID:4862] · [TOGGLE_BOT:2]',
    '- ระบบดูแลความปลอดภัยให้เอง: โหมด "ขออนุญาต" จะขึ้นการ์ดให้แอดมินกดยืนยันก่อนทำจริง,',
    '  โหมด "จัดการเอง" จะทำทันที — หน้าที่คุณคือใส่ tag ให้ถูกต้องเท่านั้น',
    '- ต้องมี id ที่ชัดเจน (reading id · withdrawal id · sms id · bot id · psid) — ถ้าไม่รู้ id ให้ถามก่อน อย่าเดา',
    '- ตอบสั้น กระชับ ใส่ tag ในบรรทัดสุดท้าย ใส่ได้หลาย tag ระบบ execute ตามลำดับ',
    '- ถ้า state มี pending_records (withdrawals/sms ที่รออยู่) ให้ใช้ id + จำนวนเงิน + ชื่อจริงจากตรงนั้นตอนเสนอ',
    '  เช่น "อนุมัติถอน #5 ฿2,000 ของคุณสมชายไหมคะ ✦ [APPROVE_WD:5]" — อย่าถาม id ที่มีอยู่แล้วใน state',
    '- ตัวอย่าง: "อนุมัติถอนรายการ 5 ให้เลยนะคะ ✦ [APPROVE_WD:5]"',
  ].join('\n');
}
