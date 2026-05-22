'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSettings, isPaired } from '@/lib/stores/settings';
import { useWarroom } from '@/lib/stores/warroom';
import { ApiError, describeError } from './errors';

export type DataSource = 'live' | 'mock' | 'loading' | 'error';

export type AdminDataResult<T> = {
  data: T;
  source: DataSource;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastFetchedAt: number | null;
};

export type UseAdminDataOptions<T> = {
  /** Unique cache + dedupe key. Two components passing the same `key` share
   *  one in-flight request + one cache slot. Pass a stable string. */
  key: string;
  /** Fetcher — runs only when settings.connection is paired. */
  fetcher: () => Promise<T>;
  /** Mock data to render when not paired (or while first request is in-flight). */
  mock: T;
  /** Override the global refreshInterval (seconds). 0 = never auto-refresh. */
  intervalOverride?: number;
  /** Disable polling but keep first-fetch + refetch() available. */
  pauseAutoRefresh?: boolean;
};

// ── Module-level cache + pub/sub ────────────────────────────────────────────
// Two components asking for the same `key` get one fetch and one update.

type CacheEntry<T> = {
  data: T | undefined;
  source: DataSource;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  inflight: Promise<void> | null;
  subscribers: Set<() => void>;
  fetcher: (() => Promise<unknown>) | null;
};

const cache = new Map<string, CacheEntry<unknown>>();

function getEntry<T>(key: string): CacheEntry<T> {
  let e = cache.get(key) as CacheEntry<T> | undefined;
  if (!e) {
    e = {
      data: undefined,
      source: 'loading',
      isLoading: false,
      error: null,
      lastFetchedAt: null,
      inflight: null,
      subscribers: new Set(),
      fetcher: null,
    };
    cache.set(key, e as unknown as CacheEntry<unknown>);
  }
  return e;
}

function notify(key: string) {
  const e = cache.get(key);
  if (!e) return;
  for (const fn of e.subscribers) fn();
}

async function fetchInto<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
  const e = getEntry<T>(key);
  // Remember the fetcher so refreshAll() can re-invoke it later.
  e.fetcher = fetcher as () => Promise<unknown>;
  // Dedupe: if a request is already in flight, await it instead of starting a new one.
  if (e.inflight) return e.inflight;

  e.isLoading = true;
  notify(key);

  const p = (async () => {
    try {
      const fresh = await fetcher();
      e.data = fresh;
      e.source = 'live';
      e.error = null;
      e.lastFetchedAt = Date.now();
    } catch (err) {
      e.error = describeError(err);
      e.source = 'error';
      // keep last data — better than blanking the UI on a transient blip

      // If our token went bad mid-session (401/403), flip the connection to
      // 'error' so polling stops everywhere instead of spamming retries.
      if (err instanceof ApiError && (err.kind === 'unauthorized' || err.kind === 'forbidden')) {
        try {
          // dynamic import to avoid a circular dep at module init
          const { useSettings } = await import('@/lib/stores/settings');
          const s = useSettings.getState();
          if (s.connection.status === 'paired') {
            s.setConnectionStatus('error', e.error);
            s.markChecked();
          }
        } catch {
          /* ignore */
        }
      }
    } finally {
      e.isLoading = false;
      e.inflight = null;
      notify(key);
    }
  })();

  e.inflight = p;
  return p;
}

/** Invalidate a key's cache — useful after a mutation. */
export function invalidate(key: string) {
  const e = cache.get(key);
  if (!e) return;
  e.lastFetchedAt = null;
  notify(key);
}

/** Manually evict a key entirely. */
export function evict(key: string) {
  cache.delete(key);
}

/**
 * Refresh every cache entry that has a stored fetcher. Used by the TopBar
 * "refresh now" button when the operator wants fresh data without waiting
 * for the next poll tick.
 */
export function refreshAll() {
  for (const [key, e] of cache.entries()) {
    if (e.subscribers.size === 0) continue; // nothing mounted; skip
    if (!e.fetcher) continue;
    void fetchInto(key, e.fetcher);
  }
}

export function getCacheKeys(): string[] {
  return Array.from(cache.keys());
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAdminData<T>(opts: UseAdminDataOptions<T>): AdminDataResult<T> {
  const paired = useSettings((s) => isPaired(s));
  const refreshInterval = useSettings((s) => s.refreshInterval);
  const frozen = useWarroom((s) => s.frozen);

  const entry = getEntry<T>(opts.key);

  // Local state mirrors the cache entry — re-render when notify() fires.
  const [, force] = useState(0);
  useEffect(() => {
    const sub = () => force((n) => n + 1);
    entry.subscribers.add(sub);
    return () => {
      entry.subscribers.delete(sub);
    };
  }, [entry]);

  // Keep a stable ref to the fetcher.
  const fetcherRef = useRef(opts.fetcher);
  useEffect(() => {
    fetcherRef.current = opts.fetcher;
  }, [opts.fetcher]);

  const refetch = useCallback(async () => {
    return fetchInto(opts.key, () => fetcherRef.current());
  }, [opts.key]);

  // Reset cached data when unpaired (don't keep stale live data masquerading as live).
  useEffect(() => {
    if (!paired) {
      entry.data = undefined;
      entry.source = 'mock';
      entry.error = null;
      entry.lastFetchedAt = null;
      notify(opts.key);
    }
  }, [paired, opts.key, entry]);

  // First fetch + polling
  useEffect(() => {
    if (!paired) return;
    // Trigger first fetch unless someone else already did within the last tick.
    void fetchInto(opts.key, () => fetcherRef.current());

    if (opts.pauseAutoRefresh) return;
    if (frozen) return;
    const intervalSec = opts.intervalOverride ?? refreshInterval;
    if (!intervalSec || intervalSec <= 0) return;
    const id = window.setInterval(() => {
      void fetchInto(opts.key, () => fetcherRef.current());
    }, intervalSec * 1000);
    return () => window.clearInterval(id);
  }, [paired, frozen, refreshInterval, opts.intervalOverride, opts.pauseAutoRefresh, opts.key]);

  const data = (entry.data ?? opts.mock) as T;
  const source: DataSource = paired ? entry.source : 'mock';

  return {
    data,
    source,
    isLoading: entry.isLoading,
    error: entry.error,
    refetch,
    lastFetchedAt: entry.lastFetchedAt,
  };
}
