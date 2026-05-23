'use client';

// Per-browser device identity — backend /auth/login requires a stable
// `device_id` so it can name + revoke tokens per-device. We generate a UUID
// once and persist it in localStorage. The token issued for a given device_id
// is named `admin-mobile-{first 12 chars}` server-side.
//
// device_name is human-readable for the admin to recognize which device a
// token belongs to (e.g. when revoking). Default is derived from User-Agent.

const DEVICE_ID_KEY = 'warroom.device_id';
const DEVICE_NAME_KEY = 'warroom.device_name';

/**
 * Get-or-create the device_id for this browser. Stable across reloads, only
 * resets when the operator clears localStorage or hits "ตัดการเชื่อมต่อ" if
 * we wire disconnect to also clear device_id (currently it doesn't — keeping
 * the same device_id across re-logins means the backend can recognize the
 * same physical device and issue tokens consistently).
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (id && id.length >= 16) return id;
  // Generate a new UUID v4. Modern browsers have crypto.randomUUID().
  id = generateUuid();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

/**
 * Human-readable name for this device. Defaults to "Warroom · {browser} on {os}"
 * derived from User-Agent. Operator can override via Settings (saved to localStorage).
 */
export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Warroom · server';
  const stored = localStorage.getItem(DEVICE_NAME_KEY);
  if (stored && stored.trim()) return stored;
  return deriveDefaultDeviceName();
}

export function setDeviceName(name: string): void {
  if (typeof window === 'undefined') return;
  const clean = name.trim().slice(0, 100);
  if (clean) localStorage.setItem(DEVICE_NAME_KEY, clean);
  else localStorage.removeItem(DEVICE_NAME_KEY);
}

/** Reset the device identity — next login will get a brand-new token row. */
export function resetDeviceIdentity(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEVICE_ID_KEY);
  localStorage.removeItem(DEVICE_NAME_KEY);
}

// ─── helpers ────────────────────────────────────────────────────────────────

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers — RFC4122 v4 from getRandomValues
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last-resort fallback — Math.random based (NOT cryptographically secure)
  return 'wxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function deriveDefaultDeviceName(): string {
  const ua = navigator.userAgent;
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\//.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) && /Version\//.test(ua) ? 'Safari' :
    'Browser';
  const os =
    /Windows NT/.test(ua) ? 'Windows' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad|iPod/.test(ua) ? 'iOS' :
    /Linux/.test(ua) ? 'Linux' :
    'Unknown';
  return `Warroom · ${browser} on ${os}`;
}
