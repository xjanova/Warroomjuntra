'use client';

import { useAdminData, fetchFortuneReadings, type FortuneReading } from '@/lib/api';

const EMPTY: FortuneReading[] = [];

/** How many readings the shared fortune feed pulls per refresh. Exported so a
 *  page can state its window honestly rather than implying it shows every
 *  conversation that exists.
 *
 *  Raised 30 -> 100 (the server's cap) once the request started asking for
 *  `preview=1`: `ai_response` is a 2-4k-character reading and was the bulk of
 *  the payload, so trimming it to a 200-char preview buys a much wider window
 *  for LESS bandwidth than the old 30 full rows. Every consumer of this feed
 *  uses ai_response only for truthiness or a <=200 char snippet; the Customer
 *  360 drawer reads the full text from the per-reading endpoint, which is
 *  untouched. */
export const FORTUNE_FEED_PAGE_SIZE = 100;

/**
 * Single shared fetcher for /fortune/readings. Pulls the latest readings (see FORTUNE_FEED_PAGE_SIZE).
 *
 * Cache key `fortune-feed` is shared across TriageQueue / LiveChats /
 * EventStream / CriticalBanner so we issue ONE request per refresh tick
 * instead of four. Each consumer derives its own slice via adapter.
 *
 * When not paired the hook returns an empty array — callers must check
 * `source` and fall back to their own mock-shaped data.
 */
export function useFortuneFeed() {
  return useAdminData<FortuneReading[]>({
    key: 'fortune-feed',
    fetcher: async () => {
      const res = await fetchFortuneReadings({ per_page: FORTUNE_FEED_PAGE_SIZE, preview: true });
      return res.data;
    },
    mock: EMPTY,
  });
}
