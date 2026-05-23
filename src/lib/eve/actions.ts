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
  | 'PROPOSE';       // PROPOSE:label — for destructive ops, drops a confirm toast

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
  { tag: 'PROPOSE',        syntax: '[PROPOSE:label]',            description: 'สำหรับงานที่เสี่ยง (อนุมัติ/refund/cancel) — โพสต์ toast ขออนุญาตแทนการลงมือ', destructive: true },
];

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
    'กติกาความปลอดภัย:',
    '- ถ้าผู้ใช้สั่งงานที่เสี่ยง (อนุมัติถอน · refund · cancel · ban · mark-paid) ให้ใช้ [PROPOSE:label] แทนการลงมือเอง',
    '- ตอบสั้น กระชับ แสดง tag ในบรรทัดสุดท้ายเสมอ',
    '- ใส่ tag ได้หลายอันใน reply เดียว ระบบจะ execute ตามลำดับ',
    '- ตัวอย่าง: "ได้เลยค่ะ เปิดหน้าบิลให้นะคะ [GOTO:/bills]"',
  ].join('\n');
}
