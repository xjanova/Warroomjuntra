'use client';

import { useSettings } from '@/lib/stores/settings';
import { ApiError } from './errors';

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;             // e.g. '/auth/me' (relative to baseUrl)
  body?: unknown;           // serialized as JSON
  signal?: AbortSignal;
  timeoutMs?: number;       // default 15_000
  // overrides for one-off calls (e.g. pairing before settings are saved)
  baseUrlOverride?: string;
  tokenOverride?: string;
  // skip the "must have token" guard — for /auth/login, /auth/verify-2fa, etc.
  allowAnon?: boolean;
  // raw response — skip JSON parse
  raw?: boolean;
};

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

export async function apiRequest<T = unknown>(opts: RequestOptions): Promise<T> {
  const s = useSettings.getState();
  const baseUrl = opts.baseUrlOverride ?? s.connection.baseUrl;
  const token = opts.tokenOverride ?? s.connection.token;

  if (!baseUrl) {
    throw new ApiError('config', 'ยังไม่ได้ตั้ง Base URL ใน Settings');
  }
  if (!token && !opts.tokenOverride && !opts.allowAnon) {
    throw new ApiError('config', 'ยังไม่ได้ใส่ API Token ใน Settings');
  }

  const url = joinUrl(baseUrl, opts.path);
  const ctrl = new AbortController();
  const signals: AbortSignal[] = [ctrl.signal];
  if (opts.signal) signals.push(opts.signal);
  const timer = window.setTimeout(() => ctrl.abort('timeout'), opts.timeoutMs ?? 15_000);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: mergeAbortSignals(signals),
      // CORS: must be allowed by juntraweb. Token in Authorization header so 'omit' is fine.
      credentials: 'omit',
      mode: 'cors',
    });
  } catch (err) {
    window.clearTimeout(timer);
    if (ctrl.signal.aborted && ctrl.signal.reason === 'timeout') {
      throw new ApiError('timeout', 'request timed out', { url });
    }
    throw new ApiError('network', (err as Error)?.message ?? 'network error', { url });
  }
  window.clearTimeout(timer);

  if (opts.raw) {
    if (!res.ok) {
      throw mapStatus(res.status, undefined, url);
    }
    return res as unknown as T;
  }

  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      if (res.ok) {
        throw new ApiError('parse', 'response was not JSON', { status: res.status, body: text, url });
      }
      // non-JSON error body — still surface the status
      throw mapStatus(res.status, text, url);
    }
  }

  if (!res.ok) {
    const msg = extractServerMessage(parsed) ?? `HTTP ${res.status}`;
    throw mapStatus(res.status, msg, url, parsed);
  }

  // Thaiprompt admin API uses envelope: { success, data, message?, errors? }.
  // Unwrap when present; pass through when the endpoint returns bare JSON.
  return unwrapEnvelope<T>(parsed);
}

function unwrapEnvelope<T>(parsed: unknown): T {
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const b = parsed as Record<string, unknown>;
    if ('success' in b && 'data' in b) {
      if (b.success === false) {
        const msg = typeof b.message === 'string' ? b.message : 'request failed';
        throw new ApiError('client', msg, { body: b });
      }
      return b.data as T;
    }
  }
  return parsed as T;
}

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1) return signals[0];
  // AbortSignal.any exists in modern browsers; fallback to manual relay
  // (Next.js 14 + modern Chromium/FF — fine)
  // @ts-ignore
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals);
  const ctrl = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      ctrl.abort(sig.reason);
      break;
    }
    sig.addEventListener('abort', () => ctrl.abort(sig.reason), { once: true });
  }
  return ctrl.signal;
}

function mapStatus(status: number, msg?: unknown, url?: string, body?: unknown): ApiError {
  const message = typeof msg === 'string' ? msg : `HTTP ${status}`;
  if (status === 401) return new ApiError('unauthorized', message, { status, body, url });
  if (status === 403) return new ApiError('forbidden', message, { status, body, url });
  if (status === 404) return new ApiError('not_found', message, { status, body, url });
  if (status === 429) return new ApiError('rate_limited', message, { status, body, url });
  if (status >= 500) return new ApiError('server', message, { status, body, url });
  return new ApiError('client', message, { status, body, url });
}

function extractServerMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return;
  const b = body as Record<string, unknown>;
  if (typeof b.message === 'string') return b.message;
  if (typeof b.error === 'string') return b.error;
  if (b.errors && typeof b.errors === 'object') {
    // Laravel validation shape: { errors: { field: ["msg"] } }
    const first = Object.values(b.errors as Record<string, unknown>)[0];
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  }
}
