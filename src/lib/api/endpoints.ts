'use client';

import { apiRequest } from './client';
import type {
  AdminMe,
  DashboardResponse,
  FortuneReadingsResponse,
  FortuneReadingsStats,
  FortuneReading,
  AiDashboardResponse,
  AiBotsResponse,
  WithdrawalsListResponse,
  AnalyticsOverview,
  AdminUsersResponse,
  AdminUserListItem,
  AdminUserStats,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Thaiprompt Admin API
// Base URL convention: store the FULL admin prefix in Settings,
//   e.g. https://thaiprompt.online/api/admin
// Then every path here is relative to that prefix (e.g. /auth/me).
// All endpoints sit behind ['auth:sanctum','admin.api'] except /auth/login,
// /auth/verify-2fa, /auth/pair/claim, /auth/pair/status.
// Routes: routes/admin_api.php (mounted via bootstrap/app.php under /api/admin).
// ─────────────────────────────────────────────────────────────────────────────

// ---- Auth ------------------------------------------------------------------

export async function fetchMe(opts?: { baseUrlOverride?: string; tokenOverride?: string }) {
  return apiRequest<AdminMe>({
    path: '/auth/me',
    ...opts,
  });
}

export type LoginPayload = { email: string; password: string };
export type LoginResponse =
  | { token: string; user: AdminMe }
  | { requires_2fa: true; challenge_token: string };

// re-export common types so callers can import everything from '@/lib/api'
export type { AdminMe } from './types';

export async function login(payload: LoginPayload, opts?: { baseUrlOverride?: string }) {
  return apiRequest<LoginResponse>({
    method: 'POST',
    path: '/auth/login',
    body: payload,
    allowAnon: true,
    ...opts,
  });
}

export async function verifyTwoFactor(payload: { challenge_token: string; code: string }, opts?: { baseUrlOverride?: string }) {
  return apiRequest<{ token: string; user: AdminMe }>({
    method: 'POST',
    path: '/auth/verify-2fa',
    body: payload,
    allowAnon: true,
    ...opts,
  });
}

export async function logout() {
  return apiRequest<{ ok: boolean }>({ method: 'POST', path: '/auth/logout' });
}

// ---- Dashboard (KPIs) ------------------------------------------------------

export async function fetchDashboard() {
  return apiRequest<DashboardResponse>({ path: '/dashboard' });
}

export async function fetchDashboardSparkline(params?: { days?: number }) {
  const qs = toQuery(params);
  return apiRequest<{ days: number; series: Array<{ date: string; count: number; total: number }> }>({
    path: `/dashboard/sparkline${qs}`,
  });
}

// ---- Fortune (Triage / Live readings) --------------------------------------

export async function fetchFortuneDashboard() {
  return apiRequest<unknown>({ path: '/fortune/dashboard' });
}

export async function fetchFortuneReadings(params?: {
  search?: string;
  is_paid?: boolean;
  response_type?: string;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}) {
  const qs = toQuery(params);
  return apiRequest<FortuneReadingsResponse>({ path: `/fortune/readings${qs}` });
}

export async function fetchFortuneReadingsStats() {
  return apiRequest<FortuneReadingsStats>({ path: '/fortune/readings/stats' });
}

export async function fetchFortuneReading(id: string | number) {
  return apiRequest<FortuneReading>({ path: `/fortune/readings/${id}` });
}

// ---- Wallets / Withdrawals (Payment recon + Approvals) ---------------------

export async function fetchWallets(params?: { page?: number; per_page?: number; q?: string }) {
  const qs = toQuery(params);
  return apiRequest<unknown>({ path: `/wallets${qs}` });
}

export async function fetchWalletsSystemStats() {
  return apiRequest<unknown>({ path: '/wallets/system-stats' });
}

export async function fetchWalletTransactions(params?: { wallet_id?: string | number; page?: number }) {
  const qs = toQuery(params);
  return apiRequest<unknown>({ path: `/wallets/transactions${qs}` });
}

export async function fetchPendingWithdrawals() {
  return apiRequest<WithdrawalsListResponse>({ path: '/withdrawals/pending' });
}

export async function approveWithdrawal(id: string | number, note?: string) {
  return apiRequest<unknown>({
    method: 'POST',
    path: `/withdrawals/${id}/approve`,
    body: note ? { note } : {},
  });
}

export async function rejectWithdrawal(id: string | number, reason: string) {
  return apiRequest<unknown>({
    method: 'POST',
    path: `/withdrawals/${id}/reject`,
    body: { reason },
  });
}

// ---- AI providers + bots (System Health + Bots page) -----------------------

export async function fetchAiDashboard(params?: { period?: 'today' | 'week' | 'month' }) {
  const qs = toQuery(params);
  return apiRequest<AiDashboardResponse>({ path: `/ai/dashboard${qs}` });
}

export async function fetchAiProviders() {
  return apiRequest<unknown>({ path: '/ai/providers' });
}

export async function toggleAiProvider(provider: string) {
  return apiRequest<unknown>({ method: 'POST', path: `/ai/providers/${provider}/toggle` });
}

export async function testAiProvider(provider: string) {
  return apiRequest<unknown>({ method: 'POST', path: `/ai/providers/${provider}/test-connection` });
}

export async function fetchAiBots(params?: { search?: string; active?: boolean; per_page?: number; page?: number }) {
  const qs = toQuery(params);
  return apiRequest<AiBotsResponse>({ path: `/ai/bots${qs}` });
}

export async function toggleAiBot(botId: string | number) {
  return apiRequest<unknown>({ method: 'POST', path: `/ai/bots/${botId}/toggle` });
}

// ---- Users (Customer 360) --------------------------------------------------

export async function fetchUsers(params?: {
  search?: string;
  role?: string;
  rank_id?: number;
  blocked?: boolean;
  page?: number;
  per_page?: number;
}) {
  const qs = toQuery(params);
  return apiRequest<AdminUsersResponse>({ path: `/users${qs}` });
}

export async function fetchUserStats() {
  return apiRequest<AdminUserStats>({ path: '/users/stats' });
}

export async function fetchUser(id: string | number) {
  return apiRequest<AdminUserListItem>({ path: `/users/${id}` });
}

// ---- Analytics (Event Stream + overview) -----------------------------------

export async function fetchAnalyticsOverview() {
  return apiRequest<AnalyticsOverview>({ path: '/analytics/overview' });
}

// ---- Helpers ---------------------------------------------------------------

function toQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}
