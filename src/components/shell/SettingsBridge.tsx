'use client';

import { useEffect } from 'react';
import { useSettings } from '@/lib/stores/settings';
import { useWarroom } from '@/lib/stores/warroom';
import { verifyConnection } from '@/lib/api';

/**
 * One-way bridge: persisted settings → ephemeral warroom session store.
 * Mount once near the root. Also kicks off a connection re-verify on load
 * so the StatusBar reflects reality, not whatever was true when we last quit.
 */
export function SettingsBridge() {
  const refreshInterval = useSettings((s) => s.refreshInterval);
  const setWarroomRefresh = useWarroom((s) => s.setRefreshInterval);
  const conn = useSettings((s) => s.connection);

  // sync refresh interval
  useEffect(() => {
    setWarroomRefresh(refreshInterval);
  }, [refreshInterval, setWarroomRefresh]);

  // Re-verify connection once on mount if we have credentials AND haven't
  // already verified. AuthGate now also kicks verifyConnection, so this
  // mostly no-ops in the common path — but stays for safety (and for the
  // "user hits a (warroom) route directly with already-paired state" case).
  useEffect(() => {
    if (
      conn.baseUrl &&
      conn.token &&
      conn.status !== 'testing' &&
      conn.status !== 'paired'
    ) {
      void verifyConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
