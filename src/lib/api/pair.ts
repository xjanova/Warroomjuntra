'use client';

import { useSettings } from '@/lib/stores/settings';
import { fetchMe, login, verifyTwoFactor } from './endpoints';
import type { AdminMe } from './endpoints';
import { describeError } from './errors';

export type PairUser = { id: number | string; name: string; email?: string; role?: string };

export type PairResult =
  | { ok: true; user: PairUser }
  | { ok: false; error: string };

export type LoginPairResult =
  | { ok: true; user: PairUser }
  | { ok: false; error: string }
  | { ok: false; requires_2fa: true; challenge_token: string };

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
 * Login with email + password to thaiprompt.online admin API. If the account
 * has 2FA enabled, returns `requires_2fa` with a challenge_token to feed into
 * `verifyTwoFactorAndPair`. Otherwise, persists the new Sanctum token and the
 * paired user (same end state as pairConnection with a pasted token).
 */
export async function loginAndPair(input: { baseUrl: string; email: string; password: string }): Promise<LoginPairResult> {
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, '');
  const email = input.email.trim();
  const password = input.password;

  if (!baseUrl) return { ok: false, error: 'กรุณากรอก Base URL' };
  if (!email) return { ok: false, error: 'กรุณากรอกอีเมล' };
  if (!password) return { ok: false, error: 'กรุณากรอกรหัสผ่าน' };
  if (!/^https?:\/\//i.test(baseUrl)) {
    return { ok: false, error: 'Base URL ต้องขึ้นต้นด้วย http:// หรือ https://' };
  }

  const s = useSettings.getState();
  // Stash baseUrl right away so the client uses it during the anon login call.
  s.setBaseUrl(baseUrl);
  s.setConnectionStatus('testing');

  try {
    const res = await login({ email, password }, { baseUrlOverride: baseUrl });

    // Discriminate on `token` (present in the success variant, absent in 2FA).
    // Using 'token' in res lets TS narrow the union correctly.
    if ('token' in res) {
      return commitLogin(res.token, res.user);
    }
    // 2FA branch — don't flip status to 'error', we're mid-flow waiting for code
    s.setConnectionStatus('idle');
    return { ok: false, requires_2fa: true, challenge_token: res.challenge_token };
  } catch (e) {
    const msg = describeError(e);
    s.setConnectionStatus('error', msg);
    s.markChecked();
    return { ok: false, error: msg };
  }
}

/** Second step of the 2FA flow — exchange challenge_token + code → real token. */
export async function verifyTwoFactorAndPair(input: { baseUrl: string; challenge_token: string; code: string }): Promise<PairResult> {
  const s = useSettings.getState();
  s.setConnectionStatus('testing');

  try {
    const res = await verifyTwoFactor(
      { challenge_token: input.challenge_token, code: input.code.trim() },
      { baseUrlOverride: input.baseUrl },
    );
    return commitLogin(res.token, res.user);
  } catch (e) {
    const msg = describeError(e);
    s.setConnectionStatus('error', msg);
    s.markChecked();
    return { ok: false, error: msg };
  }
}

function commitLogin(token: string, me: AdminMe): PairResult {
  const s = useSettings.getState();
  s.setToken(token);
  const user: PairUser = {
    id: me.id,
    name: me.name ?? me.email ?? 'admin',
    email: me.email,
    role: me.role,
  };
  s.setPairedUser(user);
  s.setConnectionStatus('paired');
  s.markChecked();
  return { ok: true, user };
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
