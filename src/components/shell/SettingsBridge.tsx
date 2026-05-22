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

  // re-verify connection once on mount if we have credentials
  useEffect(() => {
    if (conn.baseUrl && conn.token && conn.status !== 'testing') {
      void verifyConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
