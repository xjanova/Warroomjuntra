'use client';

import { useAdminData, fetchFortuneReading, type FortuneReading } from '@/lib/api';

/**
 * Fetch one fortune reading by id. Used by CaseDetailDrawer when the user
 * clicks a triage row whose id is `r-{readingId}`.
 *
 * intervalOverride: 0 → no polling. Drawer should re-fetch only when reopened.
 */
export function useReadingDetail(readingId: string | null) {
  return useAdminData<FortuneReading | null>({
    key: readingId ? `reading-${readingId}` : 'reading-noop',
    fetcher: async () => {
      if (!readingId) return null;
      return await fetchFortuneReading(readingId);
    },
    mock: null,
    intervalOverride: 0,
    pauseAutoRefresh: !readingId,
  });
}
