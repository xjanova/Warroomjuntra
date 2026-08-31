'use client';

import { useAdminData, fetchFortunePayoutAccount, type FortunePayoutAccount } from '@/lib/api';

/**
 * The account Fortune Bot is collecting into RIGHT NOW.
 *
 * Warroom used to hardcode the PromptPay number in two places (`/bills` QR and
 * the `/chat` composer). The live value lives in `payment_bank_accounts` and an
 * operator can re-tick it from admin web at any time — so the moment the account
 * was rotated, warroom would keep quoting the old number: customers pay into a
 * retired account, and the SMS auto-matcher rejects the slip as "not our
 * account" even though the customer paid correctly. juntraweb hit exactly this
 * bug on 2026-07-26, which is why the backend already resolves the account in
 * ONE place; this hook just puts warroom on the same source.
 *
 * There is deliberately NO hardcoded fallback. A stale QR is worse than a
 * missing one — it silently sends money somewhere nobody is watching — so
 * callers must render an honest empty state when `account` is null.
 *
 * Cache key is shared, so `/bills` and `/chat` coalesce into one request.
 * Refetched rarely: the account changes when a human edits it, not per second.
 */
export function usePayoutAccount() {
  const feed = useAdminData<FortunePayoutAccount | null>({
    key: 'fortune-payout-account',
    fetcher: () => fetchFortunePayoutAccount(),
    mock: null,
    intervalOverride: 300, // 5 min — it only changes when an admin edits it
  });

  const account = feed.source === 'live' ? feed.data : null;

  return {
    account,
    /** PromptPay id to build a QR from, or null when we can't vouch for one. */
    promptPayId: account?.promptpay_id?.trim() || null,
    isLoading: feed.isLoading,
    error: feed.error,
    refetch: feed.refetch,
  };
}
