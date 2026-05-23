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
//   e.g. https://main.thaiprompt.online/api/admin (apex 308s — use the subdomain)
// Then every path here is relative to that prefix (e.g. /auth/me).
// All endpoints sit behind ['auth:sanctum','admin.api'] except /auth/login,
// /auth/verify-2fa, /auth/pair/claim, /auth/pair/status.
// Routes: routes/admin_api.php (mounted via bootstrap/app.php under /api/admin).
// ─────────────────────────────────────────────────────────────────────────────

// ---- Auth ------------------------------------------------------------------

export async function fetchMe(opts?: { baseUrlOverride?: string; tokenOverride?: string }) {
  // Backend wraps in {admin: AdminUserResource}. Unwrap so callers see a flat AdminMe.
  const res = await apiRequest<{ admin: AdminMe } | AdminMe>({
    path: '/auth/me',
    ...opts,
  });
  return ('admin' in (res as object) ? (res as { admin: AdminMe }).admin : res) as AdminMe;
}

export type LoginPayload = {
  email: string;
  password: string;
  device_id: string;     // required by backend — stable per-browser UUID
  device_name?: string;  // optional human-readable label (max 100 chars)
};

// Mirrors backend AuthController response shape ({admin}, not {user}).
// AdminUserResource exposes id/name/email/role/phone/avatar_url/permissions/
// is_super_admin/two_factor — we only consume a subset via AdminMe.
export type LoginResponse =
  | { token: string; admin: AdminMe; requires_2fa?: false }
  | { requires_2fa: true; challenge_token: string; expires_in: number; method: string };

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
  return apiRequest<{ token: string; admin: AdminMe }>({
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

export async function logoutAll() {
  return apiRequest<{ ok: boolean }>({ method: 'POST', path: '/auth/logout-all' });
}

// QR pair-code flow — admin web creates a pair_code, mobile/warroom claims it.
export async function pairInit() {
  return apiRequest<{ pair_code: string; expires_at: string }>({
    method: 'POST',
    path: '/auth/pair/init',
  });
}

export async function pairCancel(code: string) {
  return apiRequest<{ ok: boolean }>({
    method: 'POST',
    path: '/auth/pair/cancel',
    body: { pair_code: code },
  });
}

export async function pairClaim(code: string) {
  return apiRequest<{ token: string; admin: AdminMe }>({
    method: 'POST',
    path: '/auth/pair/claim',
    body: { pair_code: code },
    allowAnon: true,
  });
}

export async function pairStatus(code: string) {
  const qs = toQuery({ pair_code: code });
  return apiRequest<{ status: 'pending' | 'claimed' | 'expired' | 'cancelled' }>({
    path: `/auth/pair/status${qs}`,
    allowAnon: true,
  });
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

export async function markReadingPaid(id: string | number, payload?: { amount?: number; note?: string }) {
  return apiRequest<unknown>({
    method: 'POST',
    path: `/fortune/readings/${id}/mark-paid`,
    body: payload ?? {},
  });
}

export async function refundReading(id: string | number, reason?: string) {
  return apiRequest<unknown>({
    method: 'POST',
    path: `/fortune/readings/${id}/refund`,
    body: reason ? { reason } : {},
  });
}

export async function cancelReading(id: string | number, reason?: string) {
  return apiRequest<unknown>({
    method: 'POST',
    path: `/fortune/readings/${id}/cancel`,
    body: reason ? { reason } : {},
  });
}

// ---- Finance: Wallets / Withdrawals (Payment recon + Approvals) ------------
// IMPORTANT: routes are mounted under /finance/* (not /wallets/* or /withdrawals/*)
// despite the controller namespace being Finance\WalletController. Match the
// actual route prefix in routes/admin_api.php, not the controller name.

export async function fetchWallets(params?: { page?: number; per_page?: number; q?: string }) {
  const qs = toQuery(params);
  return apiRequest<unknown>({ path: `/finance/wallets${qs}` });
}

export async function fetchWalletsSystemStats() {
  return apiRequest<unknown>({ path: '/finance/wallets/system-stats' });
}

export async function fetchWalletTransactions(params?: { wallet_id?: string | number; page?: number }) {
  const qs = toQuery(params);
  return apiRequest<unknown>({ path: `/finance/wallets/transactions${qs}` });
}

export async function fetchWallet(id: string | number) {
  return apiRequest<unknown>({ path: `/finance/wallets/${id}` });
}

export async function adjustWalletBalance(id: string | number, payload: { amount: number; reason: string }) {
  return apiRequest<unknown>({ method: 'POST', path: `/finance/wallets/${id}/adjust`, body: payload });
}

export async function lockWallet(id: string | number, reason?: string) {
  return apiRequest<unknown>({ method: 'POST', path: `/finance/wallets/${id}/lock`, body: reason ? { reason } : {} });
}

export async function unlockWallet(id: string | number) {
  return apiRequest<unknown>({ method: 'POST', path: `/finance/wallets/${id}/unlock` });
}

export async function suspendWallet(id: string | number, reason?: string) {
  return apiRequest<unknown>({ method: 'POST', path: `/finance/wallets/${id}/suspend`, body: reason ? { reason } : {} });
}

export async function unsuspendWallet(id: string | number) {
  return apiRequest<unknown>({ method: 'POST', path: `/finance/wallets/${id}/unsuspend` });
}

export async function fetchWithdrawals(params?: { page?: number; per_page?: number; status?: string }) {
  const qs = toQuery(params);
  return apiRequest<WithdrawalsListResponse>({ path: `/finance/withdrawals${qs}` });
}

export async function fetchPendingWithdrawals() {
  return apiRequest<WithdrawalsListResponse>({ path: '/finance/withdrawals/pending' });
}

export async function fetchWithdrawal(id: string | number) {
  return apiRequest<unknown>({ path: `/finance/withdrawals/${id}` });
}

export async function approveWithdrawal(id: string | number, note?: string) {
  return apiRequest<unknown>({
    method: 'POST',
    path: `/finance/withdrawals/${id}/approve`,
    body: note ? { note } : {},
  });
}

export async function rejectWithdrawal(id: string | number, reason: string) {
  return apiRequest<unknown>({
    method: 'POST',
    path: `/finance/withdrawals/${id}/reject`,
    body: { reason },
  });
}

export async function completeWithdrawal(id: string | number, note?: string) {
  return apiRequest<unknown>({
    method: 'POST',
    path: `/finance/withdrawals/${id}/complete`,
    body: note ? { note } : {},
  });
}

export async function batchApproveWithdrawals(ids: Array<string | number>) {
  return apiRequest<unknown>({
    method: 'POST',
    path: '/finance/withdrawals/batch-approve',
    body: { ids },
  });
}

// ---- AI providers + bots (System Health + Bots page) -----------------------

export async function fetchAiDashboard(params?: { period?: 'today' | 'week' | 'month' }) {
  const qs = toQuery(params);
  return apiRequest<AiDashboardResponse>({ path: `/ai/dashboard${qs}` });
}

export async function fetchAiTimeseries(params?: { hours?: number }) {
  const qs = toQuery(params);
  return apiRequest<{
    hours: number;
    series: Array<{ time: string; requests: number; avg_latency_ms: number }>;
  }>({ path: `/ai/dashboard/timeseries${qs}` });
}

export async function fetchAiProviders() {
  return apiRequest<unknown>({ path: '/ai/providers' });
}

export async function fetchAiProvider(id: string | number) {
  return apiRequest<unknown>({ path: `/ai/providers/${id}` });
}

export async function toggleAiProvider(id: string | number) {
  return apiRequest<unknown>({ method: 'POST', path: `/ai/providers/${id}/toggle` });
}

export async function testAiProvider(id: string | number) {
  return apiRequest<{ ok: boolean; latency_ms?: number; message?: string }>({
    method: 'POST',
    path: `/ai/providers/${id}/test-connection`,
  });
}

export async function fetchAiBots(params?: { search?: string; active?: boolean; per_page?: number; page?: number }) {
  const qs = toQuery(params);
  return apiRequest<AiBotsResponse>({ path: `/ai/bots${qs}` });
}

export async function fetchAiBot(id: string | number) {
  return apiRequest<unknown>({ path: `/ai/bots/${id}` });
}

export async function toggleAiBot(botId: string | number) {
  return apiRequest<unknown>({ method: 'POST', path: `/ai/bots/${botId}/toggle` });
}

export async function testAiBot(botId: string | number, payload?: { prompt?: string }) {
  return apiRequest<{ ok: boolean; output?: string; latency_ms?: number; error?: string }>({
    method: 'POST',
    path: `/ai/bots/${botId}/test`,
    body: payload ?? {},
  });
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

// ---- Ranks (leaderboard tiers) ---------------------------------------------

export async function fetchRanks() {
  return apiRequest<Array<{
    id: number;
    name: string;
    name_th?: string;
    level: number;
    color?: string;
    min_volume?: number;
    [k: string]: unknown;
  }>>({ path: '/ranks' });
}

// ---- Eve (Warroom AI assistant) ------------------------------------------

export type EveChatRequest = {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: Record<string, unknown>;
  provider?: string;     // default 'groq'
  model?: string;        // default 'llama-3.3-70b-versatile'
  temperature?: number;  // 0..2, default 0.55
  max_tokens?: number;   // 64..1024, default 320
};

export type EveChatResponse = {
  reply: string;
  provider: string;
  model: string | null;
  latency_ms: number;
  tokens: number | null;
  mood: 'idle' | 'happy' | 'talking' | 'thinking' | 'concerned' | 'surprise';
};

export async function eveChat(payload: EveChatRequest) {
  return apiRequest<EveChatResponse>({
    method: 'POST',
    path: '/eve/chat',
    body: payload,
    timeoutMs: 30_000,
  });
}

// ---- Admin chat takeover (Warroom /chat compose) --------------------------

export async function sendChatMessage(payload: {
  reading_id?: number;
  platform?: 'facebook' | 'line';
  platform_user_id?: string;
  text: string;
}) {
  return apiRequest<{
    platform: 'facebook' | 'line';
    platform_user_id: string;
    delivered: boolean;
    at: string;
  }>({
    method: 'POST',
    path: '/chat/send',
    body: payload,
  });
}

export async function suggestChatReply(payload: {
  reading_id?: number;
  context_text: string;
  customer_name?: string;
}) {
  return apiRequest<{ suggestion: string; customer_name: string }>({
    method: 'POST',
    path: '/chat/suggest',
    body: payload,
  });
}

// ---- User detail extras (Customer 360 drawer) -----------------------------

export async function fetchUserReadings(id: string | number, params?: { per_page?: number }) {
  const qs = toQuery(params);
  return apiRequest<{
    data: Array<{
      id: number;
      questions: string[];
      ai_provider: string;
      ai_model: string | null;
      tokens_used: number | null;
      is_paid: boolean;
      price_paid_thb: number | null;
      rating: number | null;
      response_type: string;
      paid_at: string | null;
      responded_at: string | null;
      created_at: string;
    }>;
    total: number;
  }>({ path: `/users/${id}/readings${qs}` });
}

// ---- Live presence (TopBar avatar strip) ----------------------------------

export type AdminPresence = {
  id: number;
  name: string;
  email: string | null;
  avatar: string | null;
  role: string;
  last_seen_at: string | null;
  is_online: boolean;
  initials: string;
};

export async function fetchAdminsOnline() {
  return apiRequest<{
    data: AdminPresence[];
    online_count: number;
    window_minutes: number;
    generated_at: string;
  }>({ path: '/users/admins/online' });
}

// ---- Payment Reconciliation (Warroom /payment) ----------------------------

export type SmsInboxItem = {
  id: number;
  bank: string;
  type: 'credit' | 'debit';
  amount: number;
  account_number: string | null;
  sender_or_receiver: string | null;
  reference_number: string | null;
  sms_timestamp: string | null;
  device_id: string;
  status: 'pending' | 'matched' | 'confirmed' | 'rejected' | 'expired';
  matched_transaction_id: number | null;
  created_at: string | null;
  matched_bill: {
    id: number;
    user_id: number | null;
    amount: number;
    status: string;
    payment_method: string;
    created_at: string | null;
  } | null;
};

export async function fetchSmsInbox(params?: {
  status?: SmsInboxItem['status'];
  bank?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  per_page?: number;
  page?: number;
}) {
  const qs = toQuery(params);
  return apiRequest<{
    data: SmsInboxItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  }>({ path: `/payment/sms/inbox${qs}` });
}

export async function fetchPaymentReconStats() {
  return apiRequest<{
    today: { total: number; matched: number; pending: number; match_rate_pct: number };
    week_by_status: Record<string, { count: number; amount_sum_thb: number }>;
    generated_at: string;
  }>({ path: '/payment/recon/stats' });
}

export async function matchSms(id: number) {
  return apiRequest<{ sms: SmsInboxItem }>({
    method: 'POST',
    path: `/payment/sms/${id}/match`,
  });
}

export async function rejectSms(id: number, reason?: string) {
  return apiRequest<{ sms: SmsInboxItem }>({
    method: 'POST',
    path: `/payment/sms/${id}/reject`,
    body: reason ? { reason } : {},
  });
}

// ---- Moderation (Warroom /moderation) -------------------------------------

export type ModerationSuspect = {
  reading_id: number;
  user_id: number | null;
  platform_user_id: string | null;
  display_name: string | null;
  response_type: string;
  is_paid: boolean;
  rating: number | null;
  created_at: string;
  matched_keywords: string[];
  score: number;
  flags: string[];
  preview: string;
};

export type ModerationBan = {
  id: number;
  platform: 'facebook' | 'line';
  platform_user_id: string;
  display_name: string | null;
  reason: string | null;
  banned_until: string | null;
  is_permanent: boolean;
  is_active: boolean;
  attempt_count: number;
  notify_count: number;
  last_notified_at: string | null;
  banned_by: { id: number; name: string; email: string | null } | null;
  created_at: string | null;
};

export async function fetchModerationSuspects(params?: { since_hours?: number; min_score?: number; per_page?: number }) {
  const qs = toQuery(params);
  return apiRequest<{
    data: ModerationSuspect[];
    total: number;
    window_hours: number;
    keywords_used: string[];
    generated_at: string;
  }>({ path: `/moderation/suspects${qs}` });
}

export async function fetchModerationBanned(params?: {
  platform?: 'facebook' | 'line';
  search?: string;
  active_only?: boolean;
  per_page?: number;
  page?: number;
}) {
  const qs = toQuery(params);
  return apiRequest<{
    data: ModerationBan[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  }>({ path: `/moderation/banned${qs}` });
}

export async function banUser(payload: {
  platform: 'facebook' | 'line';
  platform_user_id: string;
  display_name?: string;
  reason?: string;
  banned_until?: string | null;
}) {
  return apiRequest<{ ban: ModerationBan }>({
    method: 'POST',
    path: '/moderation/ban',
    body: payload,
  });
}

export async function unbanUser(banId: number) {
  return apiRequest<{ ban: ModerationBan }>({
    method: 'POST',
    path: `/moderation/unban/${banId}`,
  });
}

export async function fetchModerationRules() {
  return apiRequest<{
    default_keywords: string[];
    extra_keywords: string[];
    all_keywords: string[];
  }>({ path: '/moderation/rules' });
}

export async function updateModerationRules(extraKeywords: string[]) {
  return apiRequest<{ extra_keywords: string[] }>({
    method: 'PUT',
    path: '/moderation/rules',
    body: { extra_keywords: extraKeywords },
  });
}

// ---- AI Playground (Warroom /predict) -------------------------------------

export type PlaygroundProvider = {
  id: number;
  name: string;
  display_name: string;
  provider_type: string;
  models: Array<{ id: number; name: string; display_name: string | null; context_window: number | null }>;
};

export type PlaygroundResult = {
  provider: string;
  model: string | null;
  success: boolean;
  latency_ms: number;
  response: string | null;
  tokens: number | null;
  error: string | null;
};

export async function fetchPlaygroundProviders() {
  return apiRequest<{ providers: PlaygroundProvider[] }>({ path: '/ai/playground/providers' });
}

// ---- AI per-provider usage (Warroom /usage) -------------------------------

export type ProviderUsageRow = {
  name: string;            // varchar slug ('openai', 'groq', 'gemini', 'grok', ...)
  display_name: string;
  color: string;           // hex / hsl — baked on the server
  is_active: boolean;
  total_keys: number;
  active_keys: number;
  requests: number;
  tokens: number;
  tokens_today: number;
  tokens_month: number;
  cost_usd: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  error_rate_pct: number;
  series: Array<{ time: string; tokens: number; requests: number }>;
  series_buckets: number;
};

export async function fetchPerProviderUsage(hours: number = 1) {
  const qs = toQuery({ hours });
  return apiRequest<{
    providers: ProviderUsageRow[];
    window_hours: number;
    bucket_count: number;
    generated_at: string;
  }>({ path: `/ai/usage/per-provider${qs}` });
}

// ---- Fortune worker queue (Warroom /workers) ------------------------------

export type WorkerCallRow = {
  log_id: number;
  provider: string;
  model: string;
  key_name: string;
  request_type: string;
  tokens: number;
  latency_ms: number;
  success: boolean;
  created_at: string;
  age_seconds?: number;
  error_message?: string | null;
};

export type CommentDmRow = {
  id: number;
  fb_user_id: string;
  fb_post_id: string;
  comment_text: string;
  comment_reply: string;
  dm_message: string;
  engaged_at: string;
};

export type ProviderSplitRow = {
  provider: string;
  calls: number;
  ok: number;
  tokens: number;
};

export type FortuneWorkersQueue = {
  queue: {
    pending_paid: number;
    pending_unpaid: number;
    in_flight: number;
    stuck: number;
    completed_last_15m: number;
    completed_last_hour: number;
    failed_last_15m: number;
  };
  throughput: { per_min: number; per_hour: number };
  latency: { avg_ms: number; p95_ms: number };
  in_flight: WorkerCallRow[];
  recent_completed: WorkerCallRow[];
  comment_dms: CommentDmRow[];
  provider_split: ProviderSplitRow[];
  generated_at: string;
};

export async function fetchFortuneWorkersQueue() {
  return apiRequest<FortuneWorkersQueue>({ path: '/fortune/workers/queue' });
}

// ---- AI Playground ---------------------------------------------------------

export async function runPlayground(payload: {
  system_prompt: string;
  user_message: string;
  providers: Array<{
    provider: string;
    model?: string;
    api_key?: string;
    temperature?: number;
    max_tokens?: number;
  }>;
}) {
  return apiRequest<{ results: PlaygroundResult[]; generated_at: string }>({
    method: 'POST',
    path: '/ai/playground/run',
    body: payload,
  });
}

// ---- Marketplace (read-only — out of warroom's primary scope) --------------

export async function fetchMarketplaceDashboard() {
  return apiRequest<unknown>({ path: '/marketplace/dashboard' });
}

export async function fetchMarketplaceOrders(params?: { page?: number; per_page?: number; status?: string }) {
  const qs = toQuery(params);
  return apiRequest<unknown>({ path: `/marketplace/orders${qs}` });
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
