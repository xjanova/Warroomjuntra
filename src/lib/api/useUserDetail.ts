'use client';

import { useAdminData, fetchUser, type AdminUserListItem } from '@/lib/api';

/**
 * Fetch one admin user by id for the Customer360Drawer.
 * No polling — drawer should re-fetch only when reopened.
 */
export function useUserDetail(userId: string | number | null) {
  return useAdminData<AdminUserListItem | null>({
    key: userId ? `user-${userId}` : 'user-noop',
    fetcher: async () => {
      if (!userId) return null;
      return await fetchUser(userId);
    },
    mock: null,
    intervalOverride: 0,
    pauseAutoRefresh: !userId,
  });
}
