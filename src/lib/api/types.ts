// Response types for the thaiprompt admin API (/api/admin/*).
// Shapes mirror the Laravel Resource/controller files in
// app/Http/Controllers/Api/Admin/* and app/Http/Resources/Admin/*.

export type Iso8601 = string;

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

export type AdminMe = {
  id: number | string;
  name: string;
  email?: string;
  role?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — GET /dashboard
// Controller: Api/Admin/DashboardController@index
// ─────────────────────────────────────────────────────────────────────────────

export type DashboardHero = {
  monthly_revenue: number;
  last_month_revenue: number;
  revenue_growth_pct: number;
  currency: string;
};

export type DashboardStats = {
  total_users: number;
  total_affiliates: number;
  new_users_today: number;
  orders_total: number;
  orders_pending: number;
  pending_withdrawals: number;
};

export type DashboardSparkPoint = {
  date: string;        // YYYY-MM-DD
  count: number;
  total: number;
};

export type DashboardQuickActions = {
  approvals: number;
  withdrawals: number;
  kyc_pending: number;
  reports: number;
};

export type DashboardResponse = {
  hero: DashboardHero;
  stats: DashboardStats;
  sparkline: DashboardSparkPoint[];
  quick_actions: DashboardQuickActions;
  generated_at: Iso8601;
};

// ─────────────────────────────────────────────────────────────────────────────
// Fortune Readings — GET /fortune/readings (paginated)
// Resource: Admin/Fortune/FortuneReadingResource
// Controller wraps the paginator in the envelope, so unwrapped client gets:
//   { data: FortuneReading[], current_page, last_page, per_page, total, links, ... }
// ─────────────────────────────────────────────────────────────────────────────

export type FortuneReading = {
  id: number;
  user?: { id: number; name: string; email?: string };
  facebook_user_name: string | null;
  facebook_user_id: string | null;
  questions: string[] | string | null;
  categories: string[] | string | null;
  reading_type: 'basic' | 'deep' | string;
  ai_response: string | null;
  reading_image_url: string | null;
  is_paid: boolean;
  amount_paid: number;
  paid_at: Iso8601 | null;
  response_type: 'pending' | 'ai' | 'admin' | string | null;
  responded_at: Iso8601 | null;
  ai: {
    provider: string | null;
    model: string | null;
    tokens_used: number | null;
  };
  view_count: number;
  rating: number | null;
  feedback: string | null;
  created_at: Iso8601 | null;
};

export type Paginator<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
  // Laravel may also include `links`, `path`, etc. — ignored
};

export type FortuneReadingsResponse = Paginator<FortuneReading>;

export type FortuneReadingsStats = {
  total: number;
  paid: number;
  pending: number;
  deep: number;
  basic: number;
  total_revenue_thb: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// AI Dashboard — GET /ai/dashboard
// Controller: Api/Admin/Ai/AiDashboardController@index
// ─────────────────────────────────────────────────────────────────────────────

export type AiHero = {
  total_tokens: number;
  total_cost_thb: number;
  cache_hit_pct: number;
};

export type AiProviderSummary = {
  id: number;
  name: string;
  type: string;
  is_available: boolean;
  quota_pct: number;
  cost_thb: number;
};

export type AiBotsSummary = {
  total: number;
  active: number;
  rentable: number;
};

export type AiInference = {
  p95_latency_ms: number;
  requests_per_min: number;
  errors_pct: number;
};

export type AiDashboardResponse = {
  hero: AiHero;
  providers_summary: AiProviderSummary[];
  bots_summary: AiBotsSummary;
  inference: AiInference;
  generated_at: Iso8601;
  period: 'today' | 'week' | 'month' | string;
};

// ─────────────────────────────────────────────────────────────────────────────
// AI Bots — GET /ai/bots (paginated)
// Resource: Admin/Ai/AiBotResource
// ─────────────────────────────────────────────────────────────────────────────

export type AiBot = {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  avatar_url: string | null;
  provider?: { id: number | null; name: string | null; type: string | null };
  model?: { id: number | null; name: string | null };
  tuning: {
    temperature: number;
    max_tokens: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
  };
  capabilities: {
    knowledge_base: boolean;
    web_search: boolean;
    code_interpreter: boolean;
  };
  line_oa: {
    channel_id: string | null;
    is_connected: boolean;
  };
  is_active: boolean;
  is_public: boolean;
  is_rentable: boolean;
  rental: {
    price_per_month: number;
    price_per_message: number;
    commission_rate: number;
  };
  owner_id: number | null;
  created_at: Iso8601 | null;
};

export type AiBotsResponse = Paginator<AiBot>;

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawals — GET /withdrawals/pending
// Controller: Api/Admin/Finance/WithdrawalController
// Shape inferred from controller; conservative — extend when wiring deeper.
// ─────────────────────────────────────────────────────────────────────────────

export type WithdrawalRequest = {
  id: number;
  user_id: number;
  user?: { id: number; name: string; email?: string };
  amount: number;
  fee?: number;
  net_amount?: number;
  currency?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | string;
  bank_account?: {
    bank: string;
    account_no: string;
    account_name: string;
  } | null;
  requested_at?: Iso8601;
  approved_at?: Iso8601 | null;
  rejected_at?: Iso8601 | null;
  rejection_reason?: string | null;
  created_at?: Iso8601;
};

export type WithdrawalsListResponse = WithdrawalRequest[] | Paginator<WithdrawalRequest>;

// ─────────────────────────────────────────────────────────────────────────────
// Users — GET /users (paginated)
// Resource: Admin/AdminUserListResource
// ─────────────────────────────────────────────────────────────────────────────

export type AdminUserListItem = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  is_super_admin: boolean;
  is_blocked: boolean;
  blocked_at: Iso8601 | null;
  phone_verified: boolean;
  line_verified: boolean;
  facebook_verified: boolean;
  wallet?: { balance: number; wallet_address: string | null };
  rank?: { id: number | null; name: string | null; level: number; color: string | null };
  referral_code: string | null;
  city: string | null;
  country: string | null;
  created_at: Iso8601 | null;
  last_login_at: Iso8601 | null;
};

export type AdminUsersResponse = Paginator<AdminUserListItem>;

export type AdminUserStats = {
  total: number;
  active: number;
  blocked: number;
  super_admins: number;
  admins: number;
  new_today: number;
  new_this_week: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Analytics — GET /analytics/overview
// Conservative shape; refine when consumed.
// ─────────────────────────────────────────────────────────────────────────────

export type AnalyticsOverview = {
  events_recent?: Array<{
    id: number | string;
    type: string;
    message: string;
    ref?: string;
    created_at: Iso8601;
  }>;
  [k: string]: unknown;
};
