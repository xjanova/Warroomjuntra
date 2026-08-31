'use client';

import { useAdminData, fetchFortuneReadings, type FortuneReading } from '@/lib/api';

const EMPTY: FortuneReading[] = [];

/** How many readings the shared fortune feed pulls per refresh. Exported so a
 *  page can state its window honestly rather than implying it shows every
 *  conversation that exists. */
export const FORTUNE_FEED_PAGE_SIZE = 30;

/**
 * Single shared fetcher for /fortune/readings. Pulls 30 latest readings.
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
      const res = await fetchFortuneReadings({ per_page: FORTUNE_FEED_PAGE_SIZE });
      return res.data;
    },
    mock: EMPTY,
  });
}
