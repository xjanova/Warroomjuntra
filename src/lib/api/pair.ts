'use client';

import { useSettings } from '@/lib/stores/settings';
import { fetchMe } from './endpoints';
import { describeError } from './errors';

export type PairResult =
  | { ok: true; user: { id: number | string; name: string; email?: string; role?: string } }
  | { ok: false; error: string };

/**
 * Pair the warroom with a thaiprompt.online admin API.
 * baseUrl should already include the admin prefix (.../api/admin).
 * Uses the baseUrl + token the user just typed (NOT yet saved to settings).
 * On success, persists the connection + paired user.
 */
export async function pairConnection(input: { baseUrl: string; token: string }): Promise<PairResult> {
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, '');
  const token = input.token.trim();

  if (!baseUrl) return { ok: false, error: 'กรุณากรอก Base URL' };
  if (!token) return { ok: false, error: 'กรุณากรอก API Token' };
  if (!/^https?:\/\//i.test(baseUrl)) {
    return { ok: false, error: 'Base URL ต้องขึ้นต้นด้วย http:// หรือ https://' };
  }

  const s = useSettings.getState();
  s.setBaseUrl(baseUrl);
  s.setToken(token);
  s.setConnectionStatus('testing');

  try {
    const me = await fetchMe({ baseUrlOverride: baseUrl, tokenOverride: token });
    const user = {
      id: me.id,
      name: me.name ?? me.email ?? 'admin',
      email: me.email,
      role: me.role,
    };
    s.setPairedUser(user);
    s.setConnectionStatus('paired');
    s.markChecked();
    return { ok: true, user };
  } catch (e) {
    const msg = describeError(e);
    s.setConnectionStatus('error', msg);
    s.markChecked();
    return { ok: false, error: msg };
  }
}

/**
 * Re-verify an already-saved connection (e.g. on app load or "Refresh status").
 * Does not change baseUrl/token; just updates status + user.
 */
export async function verifyConnection(): Promise<PairResult> {
  const s = useSettings.getState();
  const { baseUrl, token } = s.connection;

  if (!baseUrl || !token) {
    return { ok: false, error: 'ยังไม่มี Base URL หรือ Token' };
  }

  s.setConnectionStatus('testing');
  try {
    const me = await fetchMe();
    const user = {
      id: me.id,
      name: me.name ?? me.email ?? 'admin',
      email: me.email,
      role: me.role,
    };
    s.setPairedUser(user);
    s.setConnectionStatus('paired');
    s.markChecked();
    return { ok: true, user };
  } catch (e) {
    const msg = describeError(e);
    s.setConnectionStatus('error', msg);
    s.markChecked();
    return { ok: false, error: msg };
  }
}
